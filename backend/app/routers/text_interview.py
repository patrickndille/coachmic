"""Text Interview API endpoints.

Provides REST endpoints for text-based mock interviews that use the same
interview prompts and feedback system as the ElevenLabs voice interviews.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

from app.middleware.auth_middleware import require_auth, AuthenticatedUser
from app.models.text_interview import (
    InterviewMetrics,
    PauseTextInterviewRequest,
    ResumeTextInterviewResponse,
    StartTextInterviewRequest,
    StartTextInterviewResponse,
    TextInterviewMessageRequest,
    TextInterviewMessageResponse,
    TextInterviewStateResponse,
)
from app.routers.session import get_user_active_session
from app.services.text_interview_service import (
    delete_interview_state,
    end_interview,
    format_transcript_for_feedback,
    get_interview_state,
    load_interview_state,
    pause_interview,
    process_user_message,
    resume_interview,
    start_text_interview,
)
from app.services.firebase_service import get_firestore_client

router = APIRouter(prefix="/api/v1/text-interview")


@router.post("/start", response_model=StartTextInterviewResponse)
async def start_text_interview_endpoint(
    request: Optional[StartTextInterviewRequest] = None,
    user: AuthenticatedUser = Depends(require_auth),
):
    """Start a new text-based interview session.

    Uses the same interview prompts as the voice interview but through text.
    Requires an active session with setup completed.
    """
    # Get user's active session
    session = await get_user_active_session(user.uid)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No active session found. Please complete setup first.",
        )

    session_id = session["session_id"]
    db = get_firestore_client()

    # Check if clear_existing is requested
    if request and request.clear_existing:
        try:
            await delete_interview_state(session_id)
            print(f"[TextInterview] Cleared existing interview for session {session_id}")
        except Exception as e:
            print(f"[TextInterview] No existing interview to clear or error: {e}")

    try:
        # Validate required session fields
        target_role = session.get("target_role")
        interview_type = session.get("interview_type")
        
        if not target_role:
            raise HTTPException(
                status_code=400,
                detail="Session is missing target role. Please start a new session and complete setup.",
            )
        
        if not interview_type:
            interview_type = "behavioral"  # Default fallback
        
        # Build session context (same as voice interview)
        session_context = {
            "target_role": target_role,
            "target_company": session.get("target_company"),
            "interview_type": interview_type,
            "interview_length": session.get("interview_length", "short"),
            "difficulty_level": session.get("difficulty_level", "easy"),
            "resume_data": session.get("resume_data"),
            "job_data": session.get("job_data"),
        }

        # Start the text interview
        state = await start_text_interview(
            session_id=session_id,
            user_id=user.uid,
            context=session_context,
        )

        # Update session status and interview mode
        try:
            db.collection("sessions").document(session_id).update(
                {"status": "interviewing", "interview_mode": "text"}
            )
        except Exception as e:
            print(f"[TextInterview] Failed to update session status: {e}")

        # Get candidate name from resume
        candidate_name = None
        if session.get("resume_data") and session["resume_data"].get("name"):
            candidate_name = session["resume_data"]["name"]

        return StartTextInterviewResponse(
            session_id=session_id,
            first_message=state.messages[0].content,
            interview_config=state.interview_config,
            candidate_name=candidate_name,
        )

    except Exception as e:
        print(f"[TextInterview] Error starting interview: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start text interview: {str(e)}",
        )


@router.post("/message", response_model=TextInterviewMessageResponse)
async def send_message_endpoint(
    request: TextInterviewMessageRequest,
    user: AuthenticatedUser = Depends(require_auth),
):
    """Send a message in the text interview and get the interviewer's response.

    The interviewer (Gemini) will respond based on the same prompts used in
    voice interviews, maintaining conversation context and tracking question count.
    """
    # Get user's active session
    session = await get_user_active_session(user.uid)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No active session found.",
        )

    session_id = session["session_id"]

    try:
        # Process the message
        (
            response,
            question_count,
            max_questions,
            is_closing,
            metrics,
        ) = await process_user_message(
            session_id=session_id,
            user_message=request.message,
            elapsed_time=request.elapsed_time,
        )

        return TextInterviewMessageResponse(
            message=response,
            question_count=question_count,
            max_questions=max_questions,
            is_closing_statement=is_closing,
            metrics=metrics,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[TextInterview] Error processing message: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process message: {str(e)}",
        )


@router.post("/pause")
async def pause_interview_endpoint(
    request: PauseTextInterviewRequest,
    user: AuthenticatedUser = Depends(require_auth),
):
    """Pause the text interview and save current state."""
    session = await get_user_active_session(user.uid)
    if not session:
        raise HTTPException(status_code=400, detail="No active session found.")

    session_id = session["session_id"]

    try:
        await pause_interview(
            session_id=session_id,
            elapsed_time=request.elapsed_time,
            metrics=request.metrics,
        )
        return {"success": True, "message": "Interview paused"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[TextInterview] Error pausing interview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resume", response_model=ResumeTextInterviewResponse)
async def resume_interview_endpoint(
    user: AuthenticatedUser = Depends(require_auth),
):
    """Resume a paused text interview with full context."""
    session = await get_user_active_session(user.uid)
    if not session:
        raise HTTPException(status_code=400, detail="No active session found.")

    session_id = session["session_id"]

    try:
        state = await resume_interview(session_id)
        if not state:
            raise HTTPException(
                status_code=404,
                detail="No paused interview found to resume.",
            )

        return ResumeTextInterviewResponse(
            session_id=session_id,
            resume_message=state.messages[-1].content,  # The resume message we added
            messages=state.messages[:-1],  # All messages except the resume message
            question_count=state.question_count,
            elapsed_time=state.elapsed_time,
            metrics=state.metrics,
            interview_config=state.interview_config,
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[TextInterview] Error resuming interview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/state", response_model=TextInterviewStateResponse)
async def get_state_endpoint(
    user: AuthenticatedUser = Depends(require_auth),
):
    """Get current text interview state for resume capability."""
    session = await get_user_active_session(user.uid)
    if not session:
        return TextInterviewStateResponse(has_state=False)

    session_id = session["session_id"]
    state = await load_interview_state(session_id)

    if not state:
        return TextInterviewStateResponse(has_state=False)

    return TextInterviewStateResponse(
        has_state=True,
        session_id=session_id,
        status=state.status,
        messages=state.messages,
        question_count=state.question_count,
        elapsed_time=state.elapsed_time,
        metrics=state.metrics,
        interview_config=state.interview_config,
    )


@router.post("/end")
async def end_interview_endpoint(
    user: AuthenticatedUser = Depends(require_auth),
):
    """End the text interview.

    After ending, call POST /feedback/generate with the transcript
    to generate feedback (same endpoint as voice interviews).
    """
    session = await get_user_active_session(user.uid)
    if not session:
        raise HTTPException(status_code=400, detail="No active session found.")

    session_id = session["session_id"]
    db = get_firestore_client()

    try:
        # Get the interview state to return transcript
        state = await load_interview_state(session_id)
        if not state:
            raise HTTPException(
                status_code=404,
                detail="No text interview found.",
            )

        # Format transcript for feedback generation
        transcript = format_transcript_for_feedback(state.messages)

        # End the interview
        await end_interview(session_id)

        # Update session status
        try:
            db.collection("sessions").document(session_id).update(
                {"status": "completed"}
            )
        except Exception as e:
            print(f"[TextInterview] Failed to update session status: {e}")

        return {
            "success": True,
            "message": "Interview ended",
            "transcript": transcript,
            "metrics": state.metrics.model_dump(),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[TextInterview] Error ending interview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/transcript")
async def get_transcript_endpoint(
    user: AuthenticatedUser = Depends(require_auth),
):
    """Get the interview transcript in feedback-compatible format.

    Useful for retrieving transcript after interview ends to pass
    to the feedback generation endpoint.
    """
    session = await get_user_active_session(user.uid)
    if not session:
        raise HTTPException(status_code=400, detail="No active session found.")

    session_id = session["session_id"]
    state = await load_interview_state(session_id)

    if not state:
        raise HTTPException(status_code=404, detail="No text interview found.")

    transcript = format_transcript_for_feedback(state.messages)

    return {
        "session_id": session_id,
        "transcript": transcript,
        "question_count": state.question_count,
        "elapsed_time": state.elapsed_time,
        "metrics": state.metrics.model_dump(),
    }
