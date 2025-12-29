"""Speech-to-Text WebSocket endpoint for real-time transcription.

Provides a WebSocket interface for streaming audio to Google Cloud
Speech-to-Text and receiving live transcripts.

Protocol:
1. Client connects to /ws/stt
2. Client sends initial JSON message with auth token
3. Backend validates token, initializes STT session
4. Client streams binary audio chunks (PCM 16kHz)
5. Backend forwards to Google STT, returns transcript JSON
6. Client sends "stop" message to end session
"""

import asyncio
import json
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.firebase_service import verify_firebase_token
from app.services.stt_service import SpeechToTextSession

router = APIRouter()


async def authenticate_websocket(websocket: WebSocket) -> Optional[dict]:
    """Wait for and validate authentication message.

    Args:
        websocket: The WebSocket connection

    Returns:
        User claims dict if authenticated, None otherwise
    """
    try:
        # Wait for auth message (5 second timeout)
        data = await asyncio.wait_for(
            websocket.receive_text(),
            timeout=5.0
        )
        message = json.loads(data)

        if message.get("type") != "auth":
            await websocket.send_json({
                "type": "error",
                "code": "INVALID_AUTH_MESSAGE",
                "message": "First message must be auth type"
            })
            return None

        token = message.get("token")
        if not token:
            await websocket.send_json({
                "type": "error",
                "code": "MISSING_TOKEN",
                "message": "Token is required"
            })
            return None

        # Verify Firebase token
        claims = await verify_firebase_token(token)
        return claims

    except asyncio.TimeoutError:
        await websocket.send_json({
            "type": "error",
            "code": "AUTH_TIMEOUT",
            "message": "Authentication timeout"
        })
        return None
    except ValueError as e:
        await websocket.send_json({
            "type": "error",
            "code": "AUTH_FAILED",
            "message": str(e)
        })
        return None
    except json.JSONDecodeError:
        await websocket.send_json({
            "type": "error",
            "code": "INVALID_JSON",
            "message": "Invalid JSON message"
        })
        return None


@router.websocket("/ws/stt")
async def stt_websocket(websocket: WebSocket):
    """WebSocket endpoint for streaming speech-to-text.

    Protocol:
        1. Client sends: {"type": "auth", "token": "firebase-jwt"}
        2. Server sends: {"type": "auth_success"}
        3. Client streams: binary PCM audio chunks (16kHz, mono, LINEAR16)
        4. Server sends: {"type": "transcript", "text": "...", "is_final": bool}
        5. Client sends: {"type": "stop"} to end session
    """
    await websocket.accept()
    print("[STT WebSocket] Connection accepted")

    # Step 1: Authenticate
    user_claims = await authenticate_websocket(websocket)
    if not user_claims:
        await websocket.close(code=4001, reason="Authentication failed")
        return

    user_id = user_claims.get("uid", "unknown")
    print(f"[STT WebSocket] User {user_id} authenticated")

    await websocket.send_json({"type": "auth_success"})

    # Step 2: Create STT session
    stt_session = SpeechToTextSession(
        language_code="en-US",
        sample_rate_hertz=16000,
        enable_interim_results=True,
    )

    # Track tasks for cleanup
    process_task: Optional[asyncio.Task] = None
    receive_task: Optional[asyncio.Task] = None

    try:
        # Start processing audio in background
        async def process_and_send():
            """Process audio stream and send transcripts to client."""
            try:
                async for result in stt_session.process_audio_stream():
                    await websocket.send_json({
                        "type": "transcript",
                        "text": result["text"],
                        "is_final": result["is_final"],
                    })
            except Exception as e:
                print(f"[STT WebSocket] Processing error: {e}")
                try:
                    await websocket.send_json({
                        "type": "error",
                        "code": "STT_ERROR",
                        "message": str(e),
                    })
                except Exception:
                    pass

        # Start the processing task
        process_task = asyncio.create_task(process_and_send())

        # Step 3: Receive audio chunks
        async def receive_audio():
            """Receive and queue audio chunks from client."""
            while True:
                try:
                    message = await websocket.receive()

                    if message["type"] == "websocket.disconnect":
                        break

                    if "bytes" in message:
                        # Binary audio data
                        await stt_session.add_audio(message["bytes"])

                    elif "text" in message:
                        # JSON control message
                        try:
                            data = json.loads(message["text"])
                            if data.get("type") == "stop":
                                print(f"[STT WebSocket] Stop requested by user {user_id}")
                                break
                        except json.JSONDecodeError:
                            pass

                except WebSocketDisconnect:
                    break

        receive_task = asyncio.create_task(receive_audio())

        # Wait for receive task to complete
        await receive_task

    except Exception as e:
        print(f"[STT WebSocket] Error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "code": "SERVER_ERROR",
                "message": str(e),
            })
        except Exception:
            pass

    finally:
        # Cleanup
        print(f"[STT WebSocket] Cleaning up for user {user_id}")

        # Stop STT session
        await stt_session.stop()

        # Cancel tasks
        if receive_task and not receive_task.done():
            receive_task.cancel()
            try:
                await receive_task
            except asyncio.CancelledError:
                pass

        if process_task and not process_task.done():
            process_task.cancel()
            try:
                await process_task
            except asyncio.CancelledError:
                pass

        # Close WebSocket
        try:
            await websocket.close()
        except Exception:
            pass

        print(f"[STT WebSocket] Connection closed for user {user_id}")
