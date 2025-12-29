"""AI Coach endpoints for pre and post interview coaching."""

import json
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Header, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.middleware.auth_middleware import require_auth, AuthenticatedUser
from app.models.resume import ResumeData
from app.routers.session import get_user_active_session, get_user_session_for_coaching
from app.services.firebase_service import get_firestore_client
from app.services.coach_service import (
    CoachingSession,
    CoachResponse,
    start_coaching_session,
    process_coach_message,
    get_coaching_session,
    end_coaching_session,
    detect_coaching_phase,
    _get_pre_coaching_summary,
)
from app.services.elevenlabs_service import (
    text_to_speech_stream,
    get_signed_url,
    build_coach_prompt_overrides,
)
from app.config import get_settings

settings = get_settings()

router = APIRouter()


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================


class StartCoachingRequest(BaseModel):
    """Request to start a coaching session."""

    session_id: str = Field(..., alias="sessionId")
    coach_type: Literal["pre_interview", "post_interview"] = Field(
        ..., alias="coachType"
    )
    target_role: Optional[str] = Field(None, alias="targetRole")
    target_company: Optional[str] = Field(None, alias="targetCompany")

    class Config:
        populate_by_name = True


class StartCoachingResponse(BaseModel):
    """Response after starting coaching session."""

    session_id: str = Field(..., alias="sessionId")
    coach_type: str = Field(..., alias="coachType")
    initial_message: str = Field(..., alias="initialMessage")
    suggestions: list[str] = Field(default_factory=list)

    class Config:
        populate_by_name = True


class SendMessageRequest(BaseModel):
    """Request to send a message to the coach."""

    session_id: str = Field(..., alias="sessionId")
    message: str

    class Config:
        populate_by_name = True


class CoachMessageResponse(BaseModel):
    """Response from the coach."""

    message: str
    suggestions: list[str] = Field(default_factory=list)
    session_notes: list[str] = Field(default_factory=list, alias="sessionNotes")
    action_items: list[str] = Field(default_factory=list, alias="actionItems")

    class Config:
        populate_by_name = True


class SessionHistoryResponse(BaseModel):
    """Coaching session history."""

    session_id: str = Field(..., alias="sessionId")
    coach_type: str = Field(..., alias="coachType")
    messages: list[dict] = Field(default_factory=list)
    created_at: str = Field(..., alias="createdAt")

    class Config:
        populate_by_name = True


class EndSessionResponse(BaseModel):
    """Response when ending a coaching session."""

    session_id: str = Field(..., alias="sessionId")
    message_count: int = Field(..., alias="messageCount")
    summary: str

    class Config:
        populate_by_name = True


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def _get_resume_from_session(session_id: Optional[str]) -> Optional[ResumeData]:
    """Get resume data from session if available. Checks Firestore."""
    if not session_id:
        print(f"[Coach] No session_id provided")
        return None

    session_data = None

    # Try Firestore
    try:
        db = get_firestore_client()
        doc = db.collection('sessions').document(session_id).get()
        if doc.exists:
            session_data = doc.to_dict()
            print(f"[Coach] Found session in Firestore: {session_id}")
        else:
            print(f"[Coach] Session not found in Firestore: {session_id}")
    except Exception as e:
        print(f"[Coach] Firestore lookup failed: {e}")

    if not session_data:
        print(f"[Coach] Session not found: {session_id}")
        return None

    resume_dict = session_data.get("resume_data")
    if not resume_dict:
        print(f"[Coach] No resume_data in session: {session_id}")
        return None

    print(f"[Coach] Found resume data for session: {session_id}")
    try:
        return ResumeData(**resume_dict)
    except Exception as e:
        print(f"[Coach] Failed to parse resume data: {e}")
        return None


def _get_feedback_from_session(session_id: Optional[str]) -> Optional[dict]:
    """Get feedback data from session if available. Checks Firestore."""
    if not session_id:
        return None

    try:
        db = get_firestore_client()
        feedback_doc = db.collection('feedback').document(session_id).get()

        if not feedback_doc.exists:
            print(f"[Coach] No feedback found for session: {session_id}")
            return None

        feedback_data = feedback_doc.to_dict()
        if feedback_data.get('status') != 'completed':
            print(f"[Coach] Feedback not completed for session: {session_id}")
            return None

        print(f"[Coach] Found feedback for session: {session_id}")
        return feedback_data.get('feedback_data')
    except Exception as e:
        print(f"[Coach] Error fetching feedback: {e}")
        return None


# ============================================================================
# ENDPOINTS
# ============================================================================


class StartCoachingRequestUpdated(BaseModel):
    """Request to start a coaching session - coachType is OPTIONAL (auto-detected)."""

    coach_type: Optional[Literal["pre_interview", "post_interview"]] = Field(
        None, alias="coachType"  # Now optional - will auto-detect if not provided
    )
    target_role: Optional[str] = Field(None, alias="targetRole")
    target_company: Optional[str] = Field(None, alias="targetCompany")

    class Config:
        populate_by_name = True


# ============================================================================
# PHASE DETECTION ENDPOINT
# ============================================================================


class DetectPhaseResponse(BaseModel):
    """Response for phase detection."""

    phase: Literal["pre_interview", "post_interview"]
    has_feedback: bool = Field(..., alias="hasFeedback")
    has_resume: bool = Field(..., alias="hasResume")
    session_id: str = Field(..., alias="sessionId")

    class Config:
        populate_by_name = True


@router.get("/coach/detect-phase", response_model=DetectPhaseResponse)
async def detect_phase(
    user: AuthenticatedUser = Depends(require_auth)
):
    """
    Detect the coaching phase for the user's active session.

    Enables the Unified Interview Coach - automatically determines
    whether to provide pre-interview or post-interview coaching
    based on available data:
    - No completed feedback → PRE_INTERVIEW
    - Completed feedback exists → POST_INTERVIEW

    Returns phase, and flags for hasResume/hasFeedback for UI display.
    """
    # Get user's active session
    session = await get_user_session_for_coaching(user.uid)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No active session found. Please complete setup first.",
        )

    session_id = session['session_id']

    # Auto-detect phase
    phase = detect_coaching_phase(session_id)

    # Check what data is available for UI display
    has_feedback = _get_feedback_from_session(session_id) is not None
    has_resume = _get_resume_from_session(session_id) is not None

    print(f"[Coach] Phase detection for session {session_id}: {phase}")
    print(f"[Coach] hasFeedback={has_feedback}, hasResume={has_resume}")

    return DetectPhaseResponse(
        phase=phase,
        hasFeedback=has_feedback,
        hasResume=has_resume,
        sessionId=session_id,
    )


@router.post("/coach/start", response_model=StartCoachingResponse)
async def start_coaching(
    request: StartCoachingRequestUpdated,
    user: AuthenticatedUser = Depends(require_auth)
):
    """
    Start a new AI coaching session.

    Requires authentication and an active session. Coaching is personalized based on resume
    and interview feedback (if available).

    The coaching phase (pre/post interview) is now AUTO-DETECTED if not provided:
    - No completed feedback → PRE_INTERVIEW coaching
    - Completed feedback exists → POST_INTERVIEW coaching
    """
    # Get user's active session
    session = await get_user_session_for_coaching(user.uid)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No active session found. Please complete setup first.",
        )

    session_id = session['session_id']
    resume_data = _get_resume_from_session(session_id)
    feedback_data = _get_feedback_from_session(session_id)

    # Use session's target role/company if not specified
    target_role = request.target_role or session.get("target_role")
    target_company = request.target_company or session.get("target_company")

    # Auto-detect coach type if not provided (Unified Coach feature)
    coach_type = request.coach_type
    if coach_type is None:
        coach_type = detect_coaching_phase(session_id)
        print(f"[Coach] Auto-detected phase for start: {coach_type}")

    # Get pre-coaching context for post-interview sessions (cross-phase continuity)
    pre_coaching_context = None
    if coach_type == "post_interview":
        pre_coaching_context = _get_pre_coaching_summary(session_id)
        if pre_coaching_context:
            print(f"[Coach] Injecting pre-coaching context for post-interview session")

    # Start coaching session
    coaching_session = await start_coaching_session(
        session_id=session_id,
        coach_type=coach_type,
        user_id=user.uid,
        target_role=target_role,
        target_company=target_company,
        resume_data=resume_data,
        feedback_data=feedback_data,
        pre_coaching_context=pre_coaching_context,  # NEW: cross-phase context
    )

    # Get initial message
    initial_msg = coaching_session.messages[0] if coaching_session.messages else None

    return StartCoachingResponse(
        sessionId=session_id,
        coachType=coach_type,  # Use detected/resolved coach_type, not request value
        initialMessage=initial_msg.content if initial_msg else "Hello! How can I help you prepare?",
        suggestions=initial_msg.suggestions if initial_msg else [],
    )


class SendMessageRequestUpdated(BaseModel):
    """Request to send a message to the coach (without session_id)."""

    message: str

    class Config:
        populate_by_name = True


@router.post("/coach/message", response_model=CoachMessageResponse)
async def send_coach_message(
    request: SendMessageRequestUpdated,
    user: AuthenticatedUser = Depends(require_auth)
):
    """
    Send a message to the AI coach and get a response.

    Requires authentication and an active session. The coach maintains conversation context and provides personalized advice.
    """
    # Get user's active session
    session = await get_user_session_for_coaching(user.uid)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No active session found.",
        )

    session_id = session['session_id']

    # Check if coaching session exists
    coaching_session = get_coaching_session(session_id)
    if not coaching_session:
        raise HTTPException(
            status_code=400,
            detail="No active coaching session. Please start a coaching session first.",
        )

    # Verify ownership
    if coaching_session.user_id and coaching_session.user_id != user.uid:
        raise HTTPException(status_code=403, detail="Not authorized to access this coaching session")

    # Get context data
    resume_data = _get_resume_from_session(session_id)
    feedback_data = _get_feedback_from_session(session_id)

    # Process message
    try:
        response = await process_coach_message(
            session_id=session_id,
            user_message=request.message,
            resume_data=resume_data,
            feedback_data=feedback_data,
        )

        return CoachMessageResponse(
            message=response.message.content,
            suggestions=response.message.suggestions,
            sessionNotes=response.session_notes,
            actionItems=response.action_items,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process message: {str(e)}",
        )


@router.get("/coach/history", response_model=SessionHistoryResponse)
async def get_coaching_history(
    user: AuthenticatedUser = Depends(require_auth)
):
    """
    Get the current coaching session history.

    Requires authentication. Returns all messages in the user's active coaching conversation.
    """
    # Get user's active session
    session = await get_user_session_for_coaching(user.uid)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No active session found.",
        )

    session_id = session['session_id']
    coaching_session = get_coaching_session(session_id)
    if not coaching_session:
        raise HTTPException(status_code=404, detail="No active coaching session")

    # Verify ownership
    if coaching_session.user_id and coaching_session.user_id != user.uid:
        raise HTTPException(status_code=403, detail="Not authorized to access this coaching session")

    messages = [
        {
            "id": msg.id,
            "role": msg.role,
            "content": msg.content,
            "timestamp": msg.timestamp,
            "suggestions": msg.suggestions,
        }
        for msg in coaching_session.messages
    ]

    return SessionHistoryResponse(
        sessionId=coaching_session.session_id,
        coachType=coaching_session.coach_type,
        messages=messages,
        createdAt=coaching_session.created_at,
    )


@router.post("/coach/end", response_model=EndSessionResponse)
async def end_coaching(
    user: AuthenticatedUser = Depends(require_auth)
):
    """
    End the current coaching session.

    Requires authentication. Ends the user's active coaching session and returns a summary.
    """
    # Get user's active session
    session = await get_user_session_for_coaching(user.uid)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No active session found.",
        )

    session_id = session['session_id']

    # Verify ownership before ending
    coaching_session = get_coaching_session(session_id)
    if coaching_session and coaching_session.user_id and coaching_session.user_id != user.uid:
        raise HTTPException(status_code=403, detail="Not authorized to access this coaching session")

    result = end_coaching_session(session_id)

    if not result:
        raise HTTPException(status_code=404, detail="No active coaching session")

    return EndSessionResponse(
        sessionId=result["session_id"],
        messageCount=result["message_count"],
        summary=result["summary"],
    )


@router.get("/coach/status")
async def get_coaching_status(
    user: AuthenticatedUser = Depends(require_auth)
):
    """
    Check if there's an active coaching session.

    Requires authentication. Checks the user's active session.
    """
    # Get user's active session
    session = await get_user_session_for_coaching(user.uid)
    if not session:
        return {
            "hasActiveSession": False,
            "coachType": None,
            "messageCount": 0,
        }

    session_id = session['session_id']
    coaching_session = get_coaching_session(session_id)

    # Verify ownership if session exists
    if coaching_session and coaching_session.user_id and coaching_session.user_id != user.uid:
        raise HTTPException(status_code=403, detail="Not authorized to access this coaching session")

    return {
        "hasActiveSession": coaching_session is not None,
        "coachType": coaching_session.coach_type if coaching_session else None,
        "messageCount": len(coaching_session.messages) if coaching_session else 0,
    }


class VoiceCoachingRequest(BaseModel):
    """Request to start a voice coaching session."""

    session_id: str = Field(..., alias="sessionId")
    coach_type: Literal["pre_interview", "post_interview"] = Field(
        ..., alias="coachType"
    )
    target_role: Optional[str] = Field(None, alias="targetRole")
    target_company: Optional[str] = Field(None, alias="targetCompany")

    class Config:
        populate_by_name = True


class VoiceCoachingResponse(BaseModel):
    """Response with ElevenLabs signed URL for voice coaching."""

    signed_url: str = Field(..., alias="signedUrl")
    agent_id: str = Field(..., alias="agentId")
    expires_at: str = Field(..., alias="expiresAt")
    overrides: dict

    class Config:
        populate_by_name = True


class VoiceCoachingRequestUpdated(BaseModel):
    """Request to start a voice coaching session - coachType is OPTIONAL (auto-detected)."""

    coach_type: Optional[Literal["pre_interview", "post_interview"]] = Field(
        None, alias="coachType"  # Now optional - will auto-detect if not provided
    )
    target_role: Optional[str] = Field(None, alias="targetRole")
    target_company: Optional[str] = Field(None, alias="targetCompany")

    class Config:
        populate_by_name = True


@router.post("/coach/voice/start", response_model=VoiceCoachingResponse)
async def start_voice_coaching(
    request: VoiceCoachingRequestUpdated,
    user: AuthenticatedUser = Depends(require_auth)
):
    """
    Start a voice coaching session using ElevenLabs Conversational AI.

    Requires authentication and an active session. Uses user's ElevenLabs credentials if configured.
    Returns a signed URL for WebSocket connection with coaching prompts.

    The coaching phase (pre/post interview) is now AUTO-DETECTED if not provided:
    - No completed feedback → PRE_INTERVIEW coaching
    - Completed feedback exists → POST_INTERVIEW coaching
    """
    from datetime import datetime, timedelta

    if not settings.elevenlabs_agent_id:
        raise HTTPException(status_code=500, detail="ElevenLabs agent not configured")

    # Get user's active session
    session = await get_user_session_for_coaching(user.uid)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No active session found. Please complete setup first.",
        )

    session_id = session['session_id']
    resume_data = session.get("resume_data")
    feedback_data = _get_feedback_from_session(session_id)

    # Use session's target role/company if not specified
    target_role = request.target_role or session.get("target_role")
    target_company = request.target_company or session.get("target_company")

    # Auto-detect coach type if not provided (Unified Coach feature)
    coach_type = request.coach_type
    if coach_type is None:
        coach_type = detect_coaching_phase(session_id)
        print(f"[Coach Voice] Auto-detected phase: {coach_type}")

    # Get pre-coaching context for post-interview sessions (cross-phase continuity)
    pre_coaching_context = None
    if coach_type == "post_interview":
        pre_coaching_context = _get_pre_coaching_summary(session_id)
        if pre_coaching_context:
            print(f"[Coach Voice] Injecting pre-coaching context for post-interview session")

    # Build context for coach prompts
    coach_context = {
        "coach_type": coach_type,  # Use detected/resolved coach_type
        "target_role": target_role,
        "target_company": target_company,
        "resume_data": resume_data,
        "feedback_data": feedback_data,
        "pre_coaching_context": pre_coaching_context,  # NEW: cross-phase context
    }

    try:
        # Get signed URL from ElevenLabs (using user's credentials if configured)
        signed_url = await get_signed_url(
            agent_id=settings.elevenlabs_agent_id,
            session_context=coach_context,
            user_id=user.uid,  # Pass user ID for credential resolution
        )

        # Build coach-specific prompt overrides
        prompt_overrides = build_coach_prompt_overrides(coach_context)

        # Get cross-mode context from text chat history (if any)
        cross_mode_context = _get_cross_mode_context(session_id, "voice")
        if cross_mode_context:
            # Inject text mode history into voice session prompt
            prompt_overrides["system_prompt"] += f"""

## CROSS-MODE CONTEXT
You have previously been chatting with this candidate in text mode. Here's a summary of that discussion:

{cross_mode_context}

Continue from this context naturally. Acknowledge that you've been chatting and are now switching to voice mode.
"""
            print(f"[Coach Voice] Injected cross-mode context from text session")

        # Calculate expiration (30 minutes for coaching)
        expires_at = datetime.utcnow() + timedelta(minutes=30)

        print(f"[Coach Voice] Starting voice coaching for session {session_id}")
        print(f"[Coach Voice] Type: {request.coach_type}, Role: {target_role}")

        return VoiceCoachingResponse(
            signedUrl=signed_url,
            agentId=settings.elevenlabs_agent_id,
            expiresAt=expires_at.isoformat(),
            overrides={
                "systemPrompt": prompt_overrides["system_prompt"],
                "firstMessage": prompt_overrides["first_message"],
            },
        )
    except Exception as e:
        print(f"[Coach Voice] Error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start voice coaching: {str(e)}",
        )


class TTSRequest(BaseModel):
    """Request for text-to-speech conversion."""

    session_id: str = Field(..., alias="sessionId")
    text: str = Field(..., min_length=1, max_length=5000)

    class Config:
        populate_by_name = True


class TTSRequestUpdated(BaseModel):
    """Request for text-to-speech conversion (without session_id)."""

    text: str = Field(..., min_length=1, max_length=5000)

    class Config:
        populate_by_name = True


@router.post("/coach/tts")
async def text_to_speech(
    request: TTSRequestUpdated,
    user: AuthenticatedUser = Depends(require_auth)
):
    """
    Convert text to speech using ElevenLabs.

    Requires authentication and an active session. Returns audio stream in mp3 format for playing in the browser.
    """
    # Get user's active session (just for validation)
    session = await get_user_session_for_coaching(user.uid)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No active session found.",
        )

    try:
        return StreamingResponse(
            text_to_speech_stream(request.text),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline",
                "Cache-Control": "no-cache",
            },
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate speech: {str(e)}",
        )


# ============================================================================
# GEMINI TTS ENDPOINTS (Google Cloud TTS for Reader Mode)
# ============================================================================


class GeminiTTSRequest(BaseModel):
    """Request for Gemini text-to-speech conversion."""

    text: str = Field(..., min_length=1, max_length=5000)
    voice_name: str = Field(default="Kore", alias="voiceName")
    style_prompt: Optional[str] = Field(
        default="warmly and encouragingly, like a supportive career coach",
        alias="stylePrompt"
    )

    class Config:
        populate_by_name = True


class GeminiTTSVoice(BaseModel):
    """A Gemini TTS voice option."""

    name: str
    description: str


class GeminiTTSVoicesResponse(BaseModel):
    """Response with available Gemini TTS voices."""

    voices: list[GeminiTTSVoice]
    default: str


@router.get("/coach/gemini-tts/voices")
async def get_gemini_tts_voices(
    user: AuthenticatedUser = Depends(require_auth)
) -> GeminiTTSVoicesResponse:
    """
    Get available Gemini TTS voices for Reader Mode.

    Returns a list of voice options with names and descriptions.
    """
    from app.services.gemini_service import get_available_tts_voices, DEFAULT_TTS_VOICE

    voices = get_available_tts_voices()
    return GeminiTTSVoicesResponse(
        voices=[GeminiTTSVoice(**v) for v in voices],
        default=DEFAULT_TTS_VOICE
    )


@router.post("/coach/gemini-tts")
async def gemini_text_to_speech(
    request: GeminiTTSRequest,
    user: AuthenticatedUser = Depends(require_auth)
):
    """
    Convert text to speech using Google Gemini TTS.

    This endpoint is used for "Reader Mode" in the text coaching interface,
    allowing users to hear coach responses read aloud using Google's TTS.

    Requires authentication. Returns WAV audio data.

    Args:
        request: GeminiTTSRequest with text, voice_name, and optional style_prompt

    Returns:
        WAV audio file as response with audio/wav media type
    """
    from fastapi.responses import Response
    from app.services.gemini_service import generate_speech_with_gemini

    # Validate session exists (just for security)
    session = await get_user_session_for_coaching(user.uid)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No active session found.",
        )

    try:
        audio_data = await generate_speech_with_gemini(
            text=request.text,
            voice_name=request.voice_name,
            style_prompt=request.style_prompt,
        )

        return Response(
            content=audio_data,
            media_type="audio/wav",
            headers={
                "Content-Disposition": "inline",
                "Cache-Control": "no-cache",
            },
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[Gemini TTS Endpoint] Error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate speech with Gemini: {str(e)}",
        )


# ============================================================================
# VOICE COACHING PERSISTENCE ENDPOINTS
# ============================================================================


class VoiceTranscriptEntry(BaseModel):
    """Single voice transcript entry."""

    id: str
    speaker: Literal["coach", "user"]
    text: str
    timestamp: int  # Unix timestamp in milliseconds


class SaveVoiceTranscriptRequest(BaseModel):
    """Request to save voice transcript entries."""

    entries: list[VoiceTranscriptEntry]
    elapsed_time: Optional[int] = Field(None, alias="elapsedTime")

    class Config:
        populate_by_name = True


class VoiceCoachingStateResponse(BaseModel):
    """Response with voice coaching state for resuming."""

    has_state: bool = Field(..., alias="hasState")
    session_id: Optional[str] = Field(None, alias="sessionId")
    transcript: list[VoiceTranscriptEntry] = Field(default_factory=list)
    elapsed_time: int = Field(0, alias="elapsedTime")
    status: Optional[str] = None
    coach_type: Optional[str] = Field(None, alias="coachType")

    class Config:
        populate_by_name = True


@router.post("/coach/voice/transcript")
async def save_voice_transcript(
    request: SaveVoiceTranscriptRequest,
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Save voice coaching transcript entries to Firestore.

    Requires authentication. Saves batched transcript entries for voice coaching sessions.
    Uses ArrayUnion to prevent duplicates.
    """
    from datetime import datetime
    from google.cloud import firestore as fs

    session = await get_user_session_for_coaching(user.uid)
    if not session:
        raise HTTPException(status_code=400, detail="No active session found.")

    session_id = session["session_id"]
    db = get_firestore_client()
    coaching_ref = db.collection("coaching_sessions").document(session_id)

    try:
        doc = coaching_ref.get()
        entries_to_save = [entry.model_dump() for entry in request.entries]

        if doc.exists:
            # Append entries using ArrayUnion to prevent duplicates
            coaching_ref.update({
                "voice_transcript": fs.ArrayUnion(entries_to_save),
                "lastActivityAt": datetime.utcnow().isoformat(),
                "elapsedTime": request.elapsed_time or 0,
                "mode": "voice",
            })
        else:
            # Create new coaching document for voice mode
            coaching_ref.set({
                "session_id": session_id,
                "user_id": user.uid,
                "mode": "voice",
                "status": "active",
                "voice_transcript": entries_to_save,
                "elapsedTime": request.elapsed_time or 0,
                "started_at": datetime.utcnow().isoformat(),
                "lastActivityAt": datetime.utcnow().isoformat(),
                "target_role": session.get("target_role"),
                "target_company": session.get("target_company"),
            })

        print(f"[Coach Voice] Saved {len(request.entries)} transcript entries for session {session_id}")
        return {"status": "saved", "count": len(request.entries)}
    except Exception as e:
        print(f"[Coach Voice] Failed to save transcript: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save transcript: {str(e)}")


@router.post("/coach/voice/mark-interrupted")
async def mark_voice_coaching_interrupted(
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Mark voice coaching session as interrupted.

    Called when the ElevenLabs connection is lost unexpectedly.
    Allows the session to be resumed later.
    """
    from datetime import datetime

    session = await get_user_session_for_coaching(user.uid)
    if not session:
        return {"status": "no_session"}

    session_id = session["session_id"]
    db = get_firestore_client()
    coaching_ref = db.collection("coaching_sessions").document(session_id)

    try:
        doc = coaching_ref.get()
        if doc.exists:
            coaching_ref.update({
                "status": "interrupted",
                "lastActivityAt": datetime.utcnow().isoformat(),
            })
            print(f"[Coach Voice] Marked session {session_id} as interrupted")
            return {"status": "interrupted"}
        return {"status": "no_coaching_session"}
    except Exception as e:
        print(f"[Coach Voice] Error marking interrupted: {e}")
        return {"status": "error", "message": str(e)}


@router.get("/coach/voice/state", response_model=VoiceCoachingStateResponse)
async def get_voice_coaching_state(
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Get saved voice coaching state for resuming.

    Checks if there's a resumable voice coaching session with transcript.
    """
    session = await get_user_session_for_coaching(user.uid)
    if not session:
        return VoiceCoachingStateResponse(hasState=False)

    session_id = session["session_id"]
    db = get_firestore_client()
    coaching_ref = db.collection("coaching_sessions").document(session_id)

    try:
        doc = coaching_ref.get()
        if not doc.exists:
            return VoiceCoachingStateResponse(hasState=False)

        data = doc.to_dict()

        # Check if this is a voice session with transcript
        if data.get("mode") != "voice" or not data.get("voice_transcript"):
            return VoiceCoachingStateResponse(hasState=False)

        # Verify ownership
        if data.get("user_id") and data["user_id"] != user.uid:
            return VoiceCoachingStateResponse(hasState=False)

        transcript = [
            VoiceTranscriptEntry(**e)
            for e in data.get("voice_transcript", [])
        ]

        return VoiceCoachingStateResponse(
            hasState=True,
            sessionId=session_id,
            transcript=transcript,
            elapsedTime=data.get("elapsedTime", 0),
            status=data.get("status"),
            coachType=data.get("coach_type"),
        )
    except Exception as e:
        print(f"[Coach Voice] Error getting state: {e}")
        return VoiceCoachingStateResponse(hasState=False)


def _build_voice_conversation_summary(transcript: list[dict], max_entries: int = 10) -> str:
    """Build a summary of the voice conversation for context injection."""
    if not transcript:
        return "No previous conversation."

    recent = transcript[-max_entries:]
    lines = []
    for entry in recent:
        speaker = "Coach" if entry.get("speaker") == "coach" else "Candidate"
        text = entry.get("text", "")[:200]  # Truncate long messages
        lines.append(f"{speaker}: {text}")

    return "\n\n".join(lines)


def _get_last_coach_message(transcript: list[dict]) -> Optional[str]:
    """Get the last coach message from transcript."""
    for entry in reversed(transcript):
        if entry.get("speaker") == "coach":
            return entry.get("text", "")
    return None


@router.post("/coach/voice/resume", response_model=VoiceCoachingResponse)
async def resume_voice_coaching(
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Resume an interrupted voice coaching session with context recovery.

    Retrieves the saved transcript and injects it as context into the new
    ElevenLabs session so the coach can continue naturally.
    """
    from datetime import datetime, timedelta

    if not settings.elevenlabs_agent_id:
        raise HTTPException(status_code=500, detail="ElevenLabs agent not configured")

    session = await get_user_session_for_coaching(user.uid)
    if not session:
        raise HTTPException(status_code=400, detail="No active session found.")

    session_id = session["session_id"]
    db = get_firestore_client()
    coaching_ref = db.collection("coaching_sessions").document(session_id)

    doc = coaching_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="No coaching session found to resume.")

    data = doc.to_dict()

    # Verify ownership
    if data.get("user_id") and data["user_id"] != user.uid:
        raise HTTPException(status_code=403, detail="Not authorized to access this session")

    transcript = data.get("voice_transcript", [])

    if not transcript:
        raise HTTPException(status_code=400, detail="No transcript found to resume from.")

    # Build context for resume
    coach_type = data.get("coach_type", "pre_interview")
    target_role = session.get("target_role")
    target_company = session.get("target_company")
    resume_data = session.get("resume_data")
    feedback_data = _get_feedback_from_session(session_id)

    # Build conversation summary for context injection
    conversation_summary = _build_voice_conversation_summary(transcript)
    last_coach_message = _get_last_coach_message(transcript)

    coach_context = {
        "coach_type": coach_type,
        "target_role": target_role,
        "target_company": target_company,
        "resume_data": resume_data,
        "feedback_data": feedback_data,
    }

    try:
        # Get signed URL
        signed_url = await get_signed_url(
            agent_id=settings.elevenlabs_agent_id,
            session_context=coach_context,
            user_id=user.uid,
        )

        # Build base prompt overrides
        base_overrides = build_coach_prompt_overrides(coach_context)

        # Add resume context to system prompt
        resume_context = f"""

## COACHING SESSION RESUME CONTEXT
This is a RESUMED coaching session. The candidate was disconnected.

### Previous Conversation:
{conversation_summary}

### Your Last Message Was:
"{last_coach_message or 'N/A'}"

### CRITICAL INSTRUCTIONS FOR RESUME:
1. Do NOT greet the candidate again - you've already been talking
2. Acknowledge the reconnection briefly (e.g., "Welcome back!")
3. Continue from where you left off naturally
4. If your last message was a question, wait for their answer
5. Maintain the same warm, coaching tone
"""
        system_prompt = base_overrides["system_prompt"] + resume_context

        # Generate appropriate resume first message
        if last_coach_message and '?' in last_coach_message:
            first_message = "Welcome back! I believe I just asked you something. Please go ahead whenever you're ready."
        else:
            first_message = "Welcome back! Let's pick up where we left off. Are you ready to continue?"

        # Update session status
        coaching_ref.update({
            "status": "active",
            "lastActivityAt": datetime.utcnow().isoformat(),
        })

        expires_at = datetime.utcnow() + timedelta(minutes=30)

        print(f"[Coach Voice] Resuming voice coaching for session {session_id}")
        print(f"[Coach Voice] Transcript entries: {len(transcript)}")

        return VoiceCoachingResponse(
            signedUrl=signed_url,
            agentId=settings.elevenlabs_agent_id,
            expiresAt=expires_at.isoformat(),
            overrides={
                "systemPrompt": system_prompt,
                "firstMessage": first_message,
            },
        )
    except Exception as e:
        print(f"[Coach Voice] Resume error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to resume voice coaching: {str(e)}",
        )


# ============================================================================
# PHASE 4: UNIFIED TEXT/VOICE MEMORY
# ============================================================================


def _get_cross_mode_context(session_id: str, current_mode: str) -> Optional[str]:
    """
    Get context from the other coaching mode for cross-mode memory.

    If switching to voice, get summary of text chat history.
    If switching to text, get summary of voice transcript.
    """
    db = get_firestore_client()
    coaching_ref = db.collection("coaching_sessions").document(session_id)

    try:
        doc = coaching_ref.get()
        if not doc.exists:
            return None

        data = doc.to_dict()

        if current_mode == "voice":
            # Get text messages context for voice mode
            messages = data.get("messages", [])
            if not messages:
                return None

            # Build summary of text conversation
            recent = messages[-5:]  # Last 5 messages
            lines = []
            for msg in recent:
                role = "Coach" if msg.get("role") == "coach" else "Candidate"
                content = msg.get("content", "")[:150]  # Truncate
                lines.append(f"{role}: {content}")

            return "Previous text coaching discussion:\n" + "\n".join(lines)

        elif current_mode == "text":
            # Get voice transcript context for text mode
            transcript = data.get("voice_transcript", [])
            if not transcript:
                return None

            # Build summary of voice conversation
            recent = transcript[-5:]  # Last 5 entries
            lines = []
            for entry in recent:
                speaker = "Coach" if entry.get("speaker") == "coach" else "Candidate"
                text = entry.get("text", "")[:150]  # Truncate
                lines.append(f"{speaker}: {text}")

            return "Previous voice coaching discussion:\n" + "\n".join(lines)

    except Exception as e:
        print(f"[Coach] Error getting cross-mode context: {e}")
        return None

    return None


def _get_aggregated_notes(session_id: str) -> dict:
    """Get aggregated session notes and action items from both modes."""
    db = get_firestore_client()
    coaching_ref = db.collection("coaching_sessions").document(session_id)

    result = {"session_notes": [], "action_items": []}

    try:
        doc = coaching_ref.get()
        if not doc.exists:
            return result

        data = doc.to_dict()

        # Collect notes from stored aggregates
        result["session_notes"] = data.get("session_notes", [])
        result["action_items"] = data.get("action_items", [])

        return result
    except Exception as e:
        print(f"[Coach] Error getting aggregated notes: {e}")
        return result


class UnifiedCoachingHistoryResponse(BaseModel):
    """Response with unified coaching history from both modes."""

    session_id: str = Field(..., alias="sessionId")
    text_messages: list[dict] = Field(default_factory=list, alias="textMessages")
    voice_transcript: list[dict] = Field(default_factory=list, alias="voiceTranscript")
    session_notes: list[str] = Field(default_factory=list, alias="sessionNotes")
    action_items: list[str] = Field(default_factory=list, alias="actionItems")
    last_mode: Optional[str] = Field(None, alias="lastMode")

    class Config:
        populate_by_name = True


@router.get("/coach/unified-history", response_model=UnifiedCoachingHistoryResponse)
async def get_unified_coaching_history(
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Get unified coaching history including both text and voice modes.

    Returns all messages, transcripts, notes, and action items from the session.
    """
    session = await get_user_session_for_coaching(user.uid)
    if not session:
        raise HTTPException(status_code=400, detail="No active session found.")

    session_id = session["session_id"]
    db = get_firestore_client()
    coaching_ref = db.collection("coaching_sessions").document(session_id)

    try:
        doc = coaching_ref.get()
        if not doc.exists:
            return UnifiedCoachingHistoryResponse(
                sessionId=session_id,
                textMessages=[],
                voiceTranscript=[],
                sessionNotes=[],
                actionItems=[],
                lastMode=None,
            )

        data = doc.to_dict()

        # Verify ownership
        if data.get("user_id") and data["user_id"] != user.uid:
            raise HTTPException(status_code=403, detail="Not authorized")

        return UnifiedCoachingHistoryResponse(
            sessionId=session_id,
            textMessages=data.get("messages", []),
            voiceTranscript=data.get("voice_transcript", []),
            sessionNotes=data.get("session_notes", []),
            actionItems=data.get("action_items", []),
            lastMode=data.get("mode"),
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Coach] Error getting unified history: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get history: {str(e)}")


class SaveNotesRequest(BaseModel):
    """Request to save coaching notes and action items."""

    notes: list[str] = Field(default_factory=list)
    action_items: list[str] = Field(default_factory=list, alias="actionItems")

    class Config:
        populate_by_name = True


@router.post("/coach/save-notes")
async def save_coaching_notes(
    request: SaveNotesRequest,
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Save session notes and action items to the unified coaching session.

    Appends to existing notes rather than replacing.
    """
    from google.cloud import firestore as fs

    session = await get_user_session_for_coaching(user.uid)
    if not session:
        raise HTTPException(status_code=400, detail="No active session found.")

    session_id = session["session_id"]
    db = get_firestore_client()
    coaching_ref = db.collection("coaching_sessions").document(session_id)

    try:
        doc = coaching_ref.get()
        if doc.exists:
            updates = {}
            if request.notes:
                updates["session_notes"] = fs.ArrayUnion(request.notes)
            if request.action_items:
                updates["action_items"] = fs.ArrayUnion(request.action_items)
            if updates:
                coaching_ref.update(updates)
        else:
            coaching_ref.set({
                "session_id": session_id,
                "user_id": user.uid,
                "session_notes": request.notes,
                "action_items": request.action_items,
                "created_at": datetime.utcnow().isoformat(),
            })

        return {"status": "saved", "notesCount": len(request.notes), "actionItemsCount": len(request.action_items)}
    except Exception as e:
        print(f"[Coach] Error saving notes: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save notes: {str(e)}")


# ============================================================================
# PHASE 5: VOICE SESSION NOTES EXTRACTION
# ============================================================================


class VoiceSessionEndResponse(BaseModel):
    """Response when ending a voice coaching session with extracted insights."""

    session_notes: list[str] = Field(default_factory=list, alias="sessionNotes")
    action_items: list[str] = Field(default_factory=list, alias="actionItems")
    summary: str = ""
    message_count: int = Field(0, alias="messageCount")

    class Config:
        populate_by_name = True


@router.post("/coach/voice/end", response_model=VoiceSessionEndResponse)
async def end_voice_coaching(
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    End voice coaching session and extract session notes using Gemini.

    Analyzes the voice transcript to extract:
    - Key session notes (insights, important points)
    - Action items (specific things candidate should do)
    - Summary of the coaching session
    """
    from datetime import datetime
    from app.services.gemini_service import generate_with_gemini

    session = await get_user_session_for_coaching(user.uid)
    if not session:
        raise HTTPException(status_code=400, detail="No active session found.")

    session_id = session["session_id"]
    db = get_firestore_client()
    coaching_ref = db.collection("coaching_sessions").document(session_id)

    try:
        doc = coaching_ref.get()
        if not doc.exists:
            return VoiceSessionEndResponse(
                sessionNotes=[],
                actionItems=[],
                summary="No coaching session data found.",
                messageCount=0,
            )

        data = doc.to_dict()

        # Verify ownership
        if data.get("user_id") and data["user_id"] != user.uid:
            raise HTTPException(status_code=403, detail="Not authorized")

        transcript = data.get("voice_transcript", [])

        if not transcript:
            # Mark session as completed
            coaching_ref.update({
                "status": "completed",
                "ended_at": datetime.utcnow().isoformat(),
            })
            return VoiceSessionEndResponse(
                sessionNotes=[],
                actionItems=[],
                summary="Session ended with no conversation recorded.",
                messageCount=0,
            )

        # Build transcript text for Gemini analysis
        transcript_text = "\n".join([
            f"{'Coach' if e.get('speaker') == 'coach' else 'Candidate'}: {e.get('text', '')}"
            for e in transcript
        ])

        # Use Gemini to extract notes and action items
        extraction_prompt = f"""Analyze this interview coaching session transcript and extract key insights.

TRANSCRIPT:
{transcript_text}

Extract the following:
1. SESSION NOTES: Key insights, tips, and important points discussed (3-5 notes)
2. ACTION ITEMS: Specific things the candidate should do to improve (2-4 items)
3. SUMMARY: A 1-2 sentence summary of what was accomplished in this session

Return ONLY valid JSON in this exact format:
{{
    "session_notes": ["Note 1", "Note 2", "Note 3"],
    "action_items": ["Action 1", "Action 2"],
    "summary": "Brief summary here"
}}"""

        try:
            response = await generate_with_gemini(
                prompt=extraction_prompt,
                temperature=0.3,
                max_tokens=1024,
            )

            # Parse the response
            cleaned = response.strip()
            if cleaned.startswith("```"):
                parts = cleaned.split("```")
                if len(parts) >= 2:
                    cleaned = parts[1]
                    if cleaned.startswith("json"):
                        cleaned = cleaned[4:]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("```", 1)[0]

            extracted = json.loads(cleaned.strip())
            session_notes = extracted.get("session_notes", [])
            action_items = extracted.get("action_items", [])
            summary = extracted.get("summary", "Coaching session completed.")

        except (json.JSONDecodeError, Exception) as e:
            print(f"[Coach Voice] Gemini extraction failed: {e}")
            # Fallback: generate basic notes
            session_notes = ["Voice coaching session completed"]
            action_items = ["Review the conversation topics discussed"]
            summary = f"Voice coaching session with {len(transcript)} exchanges."

        # Update Firestore with extracted notes and mark completed
        from google.cloud import firestore as fs
        coaching_ref.update({
            "status": "completed",
            "ended_at": datetime.utcnow().isoformat(),
            "session_notes": fs.ArrayUnion(session_notes),
            "action_items": fs.ArrayUnion(action_items),
            "voice_summary": summary,
        })

        print(f"[Coach Voice] Ended session {session_id} with {len(transcript)} entries")

        return VoiceSessionEndResponse(
            sessionNotes=session_notes,
            actionItems=action_items,
            summary=summary,
            messageCount=len(transcript),
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Coach Voice] Error ending session: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to end voice coaching: {str(e)}",
        )
