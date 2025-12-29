"""Interview management endpoints."""

from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Depends

from app.config import get_settings
from app.middleware.auth_middleware import require_auth, AuthenticatedUser
from google.cloud import firestore
from app.models.interview import (
    ConversationOverrides,
    InterviewMetrics,
    InterviewStateResponse,
    InterviewTranscriptEntry,
    PauseInterviewRequest,
    Question,
    QuestionsResponse,
    SaveTranscriptBatchRequest,
    StartInterviewResponse,
)
from app.routers.session import get_user_active_session
from app.services.elevenlabs_service import (
    get_signed_url,
    build_prompt_overrides,
    build_resume_prompt_overrides,
    build_conversation_summary,
    get_last_agent_message,
)
from app.services.firebase_service import get_firestore_client

router = APIRouter()
settings = get_settings()


@router.post("/interview/start", response_model=StartInterviewResponse)
async def start_interview(
    clear_existing: bool = False,
    user: AuthenticatedUser = Depends(require_auth),
):
    """Start an interview session and get ElevenLabs signed URL.

    Requires authentication and an active session. Uses user's ElevenLabs credentials if configured,
    otherwise falls back to system default credentials.

    Args:
        clear_existing: If True, delete any existing interview data before starting fresh.
    """
    # Get user's active session
    session = await get_user_active_session(user.uid)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No active session found. Please complete setup first.",
        )

    session_id = session['session_id']
    db = get_firestore_client()

    # If clear_existing, delete the interview document to start fresh
    if clear_existing:
        try:
            db.collection('interviews').document(session_id).delete()
            print(f"[Interview] Cleared existing interview for session {session_id}")
        except Exception as e:
            print(f"[Interview] No existing interview to clear or error: {e}")

    try:
        # Build session context
        session_context = {
            "target_role": session["target_role"],
            "target_company": session.get("target_company"),
            "interview_type": session["interview_type"],
            "interview_length": session.get("interview_length", "short"),
            "difficulty_level": session.get("difficulty_level", "easy"),
            "resume_data": session.get("resume_data"),
            # Full job data for realistic interview questions
            "job_data": session.get("job_data"),
        }

        # Get signed URL from ElevenLabs (using user's credentials if configured)
        signed_url = await get_signed_url(
            agent_id=settings.elevenlabs_agent_id,
            session_context=session_context,
            user_id=user.uid,  # Pass user ID for credential resolution
        )

        # Build prompt overrides for the frontend to pass to ElevenLabs
        prompt_overrides = build_prompt_overrides(session_context)

        # Update session status and interview mode in Firestore
        try:
            db = get_firestore_client()
            db.collection('sessions').document(session_id).update({"status": "interviewing", "interview_mode": "voice"})
            print(f"[Interview] Updated session {session_id} status to 'interviewing', mode to 'voice'")
        except Exception as e:
            print(f"[Interview] Failed to update session status: {e}")
            # Non-fatal - continue with interview start

        # Calculate expiration (15 minutes from now)
        expires_at = datetime.utcnow() + timedelta(minutes=15)

        print(f"[Interview] Starting interview for session {session_id}")
        print(f"[Interview] Resume data available: {session.get('resume_data') is not None}")

        return StartInterviewResponse(
            signed_url=signed_url,
            agent_id=settings.elevenlabs_agent_id,
            expires_at=expires_at.isoformat(),
            overrides=ConversationOverrides(
                system_prompt=prompt_overrides["system_prompt"],
                first_message=prompt_overrides["first_message"],
            ),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start interview: {str(e)}",
        )


@router.post("/interview/end")
async def end_interview(
    user: AuthenticatedUser = Depends(require_auth)
):
    """End an interview session.

    Requires authentication. Ends the user's active session.
    """
    # Get user's active session
    session = await get_user_active_session(user.uid)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No active session found.",
        )

    session_id = session['session_id']

    # Update session status in Firestore
    try:
        db = get_firestore_client()
        db.collection('sessions').document(session_id).update({"status": "completed"})
        print(f"[Interview] Ended interview for session {session_id}")
    except Exception as e:
        print(f"[Interview] Failed to update session status: {e}")
        raise HTTPException(status_code=500, detail="Failed to end interview")

    return {"status": "success", "message": "Interview ended"}


@router.post("/interview/resume", response_model=StartInterviewResponse)
async def resume_interview(
    user: AuthenticatedUser = Depends(require_auth),
):
    """Resume an interrupted/paused interview with full context recovery.

    This endpoint builds the conversation history into the system prompt so the
    ElevenLabs agent has context about what happened before and can continue
    naturally without re-welcoming the candidate.
    """
    # Get user's active session
    session = await get_user_active_session(user.uid)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No active session found. Please complete setup first.",
        )

    session_id = session['session_id']
    db = get_firestore_client()

    # Get existing interview state from Firestore
    interview_ref = db.collection('interviews').document(session_id)
    interview_doc = interview_ref.get()

    if not interview_doc.exists:
        raise HTTPException(
            status_code=404,
            detail="No interview state found to resume. Please start a new interview.",
        )

    interview_data = interview_doc.to_dict()
    transcript = interview_data.get('transcript', [])
    questions_asked = interview_data.get('questionCount', 0)

    if not transcript:
        raise HTTPException(
            status_code=400,
            detail="No transcript found to resume from. Please start a new interview.",
        )

    try:
        # Build session context
        session_context = {
            "target_role": session["target_role"],
            "target_company": session.get("target_company"),
            "interview_type": session["interview_type"],
            "interview_length": session.get("interview_length", "short"),
            "difficulty_level": session.get("difficulty_level", "easy"),
            "resume_data": session.get("resume_data"),
            # Full job data for realistic interview questions
            "job_data": session.get("job_data"),
        }

        # Build conversation summary for context injection
        conversation_summary = build_conversation_summary(transcript)
        last_agent_message = get_last_agent_message(transcript)

        print(f"[Interview] Resuming interview for session {session_id}")
        print(f"[Interview] Transcript entries: {len(transcript)}")
        print(f"[Interview] Questions asked: {questions_asked}")
        print(f"[Interview] Last agent message: {last_agent_message[:50]}..." if last_agent_message else "[Interview] No previous agent message")

        # Get signed URL from ElevenLabs
        signed_url = await get_signed_url(
            agent_id=settings.elevenlabs_agent_id,
            session_context=session_context,
            user_id=user.uid,
        )

        # Build RESUME-specific overrides with context injection
        prompt_overrides = build_resume_prompt_overrides(
            session_context=session_context,
            conversation_summary=conversation_summary,
            last_agent_message=last_agent_message,
            questions_asked=questions_asked,
        )

        # Update interview and session status to 'active'
        interview_ref.update({
            'status': 'active',
            'lastActivityAt': datetime.utcnow(),
        })
        db.collection('sessions').document(session_id).update({"status": "interviewing", "interview_mode": "voice"})

        # Calculate expiration (15 minutes from now)
        expires_at = datetime.utcnow() + timedelta(minutes=15)

        return StartInterviewResponse(
            signed_url=signed_url,
            agent_id=settings.elevenlabs_agent_id,
            expires_at=expires_at.isoformat(),
            overrides=ConversationOverrides(
                system_prompt=prompt_overrides["system_prompt"],
                first_message=prompt_overrides["first_message"],
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Interview] Failed to resume interview: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to resume interview: {str(e)}",
        )


@router.post("/interview/mark-interrupted")
async def mark_interview_interrupted(
    user: AuthenticatedUser = Depends(require_auth),
):
    """Mark an interview as interrupted (connection lost, page refresh, etc.).

    This allows the user to resume the interview later.
    """
    session = await get_user_active_session(user.uid)
    if not session:
        return {"status": "no_session"}

    session_id = session['session_id']
    db = get_firestore_client()
    interview_ref = db.collection('interviews').document(session_id)

    try:
        interview_doc = interview_ref.get()
        if interview_doc.exists:
            interview_ref.update({
                'status': 'interrupted',
                'lastActivityAt': datetime.utcnow(),
            })
            print(f"[Interview] Marked interview as interrupted for session {session_id}")
            return {"status": "interrupted"}
        else:
            return {"status": "no_interview"}

    except Exception as e:
        print(f"[Interview] Failed to mark interview as interrupted: {e}")
        return {"status": "error", "message": str(e)}


# In-memory questions store (populated during interview start)
session_questions: dict[str, list[Question]] = {}


def generate_questions_for_session(session: dict) -> list[Question]:
    """Generate interview questions based on session config."""
    interview_type = session.get("interview_type", "behavioral")
    target_role = session.get("target_role", "")

    # Default questions by type (in production, these would be generated by Gemini)
    behavioral_questions = [
        Question(
            id="bq1",
            text="Tell me about a time when you had to work under pressure.",
            type="behavioral",
            category="stress_management",
        ),
        Question(
            id="bq2",
            text="Describe a situation where you had to work with a difficult team member.",
            type="behavioral",
            category="teamwork",
        ),
        Question(
            id="bq3",
            text="Give an example of a goal you set and how you achieved it.",
            type="behavioral",
            category="goal_setting",
        ),
    ]

    technical_questions = [
        Question(
            id="tq1",
            text=f"What technical skills do you think are most important for a {target_role}?",
            type="technical",
            category="technical_skills",
        ),
        Question(
            id="tq2",
            text="Walk me through how you would approach debugging a complex issue.",
            type="technical",
            category="problem_solving",
        ),
        Question(
            id="tq3",
            text="Describe a technical project you're proud of and your role in it.",
            type="technical",
            category="project_experience",
        ),
    ]

    situational_questions = [
        Question(
            id="sq1",
            text="How would you handle a situation where you disagree with your manager?",
            type="situational",
            category="conflict_resolution",
        ),
    ]

    if interview_type == "behavioral":
        return behavioral_questions + situational_questions
    elif interview_type == "technical":
        return technical_questions
    else:  # mixed
        return behavioral_questions[:2] + technical_questions[:2]


@router.get("/interview/questions", response_model=QuestionsResponse)
async def get_interview_questions(
    user: AuthenticatedUser = Depends(require_auth)
):
    """Get interview questions for the user's active session.

    Requires authentication. Returns questions for the user's current active session.
    """
    # Get user's active session
    session = await get_user_active_session(user.uid)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No active session found.",
        )

    session_id = session['session_id']

    # Generate questions if not already cached
    if session_id not in session_questions:
        session_questions[session_id] = generate_questions_for_session(session)

    questions = session_questions[session_id]

    return QuestionsResponse(
        sessionId=session_id,
        questions=questions,
        totalCount=len(questions),
    )


# ============================================================================
# INTERVIEW STATE PERSISTENCE ENDPOINTS
# ============================================================================


@router.post("/interview/transcript")
async def save_transcript_entries(
    request: SaveTranscriptBatchRequest,
    user: AuthenticatedUser = Depends(require_auth),
):
    """Save transcript entries to Firestore for persistence.

    This allows the interview to be resumed if the user leaves.
    Entries are appended to the existing transcript.
    """
    session = await get_user_active_session(user.uid)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No active session found.",
        )

    session_id = session["session_id"]
    db = get_firestore_client()
    interview_ref = db.collection("interviews").document(session_id)

    try:
        # Get existing interview document or create new one
        interview_doc = interview_ref.get()

        if interview_doc.exists:
            # Append entries to existing transcript
            update_data = {
                "lastActivityAt": datetime.utcnow(),
            }
            # Use ArrayUnion to append entries without duplicates
            for entry in request.entries:
                interview_ref.update({
                    "transcript": firestore.ArrayUnion([entry.model_dump()])
                })

            # Update optional fields if provided
            if request.elapsed_time is not None:
                update_data["elapsedTime"] = request.elapsed_time
            if request.question_count is not None:
                update_data["questionCount"] = request.question_count
            if request.metrics:
                update_data["metrics"] = request.metrics.model_dump(by_alias=True)

            interview_ref.update(update_data)
        else:
            # Create new interview document
            interview_data = {
                "sessionId": session_id,
                "user_id": user.uid,
                "status": "active",
                "transcript": [entry.model_dump() for entry in request.entries],
                "elapsedTime": request.elapsed_time or 0,
                "questionCount": request.question_count or 0,
                "metrics": request.metrics.model_dump(by_alias=True) if request.metrics else {},
                "startedAt": datetime.utcnow(),
                "lastActivityAt": datetime.utcnow(),
            }
            interview_ref.set(interview_data)

        print(f"[Interview] Saved {len(request.entries)} transcript entries for session {session_id}")
        return {"status": "saved", "count": len(request.entries)}

    except Exception as e:
        print(f"[Interview] Failed to save transcript: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save transcript: {str(e)}",
        )


@router.post("/interview/pause")
async def pause_interview(
    request: PauseInterviewRequest,
    user: AuthenticatedUser = Depends(require_auth),
):
    """Pause an interview and save the current state.

    The interview can be resumed later with the saved state.
    """
    session = await get_user_active_session(user.uid)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No active session found.",
        )

    session_id = session["session_id"]
    db = get_firestore_client()
    interview_ref = db.collection("interviews").document(session_id)

    try:
        update_data = {
            "status": "paused",
            "pausedAt": datetime.utcnow(),
            "elapsedTime": request.elapsed_time,
            "questionCount": request.question_count,
            "lastActivityAt": datetime.utcnow(),
        }

        if request.metrics:
            update_data["metrics"] = request.metrics.model_dump(by_alias=True)

        # Check if interview document exists
        interview_doc = interview_ref.get()
        if interview_doc.exists:
            interview_ref.update(update_data)
        else:
            # Create the document with minimal data
            interview_data = {
                "sessionId": session_id,
                "user_id": user.uid,
                "transcript": [],
                "startedAt": datetime.utcnow(),
                **update_data,
            }
            interview_ref.set(interview_data)

        # Also update session status
        db.collection("sessions").document(session_id).update({"status": "paused"})

        print(f"[Interview] Paused interview for session {session_id}")
        return {"status": "paused"}

    except Exception as e:
        print(f"[Interview] Failed to pause interview: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to pause interview: {str(e)}",
        )


@router.get("/interview/state", response_model=InterviewStateResponse)
async def get_interview_state(
    user: AuthenticatedUser = Depends(require_auth),
):
    """Get saved interview state for resuming.

    Returns the transcript, elapsed time, question count, and metrics
    if there is a saved interview state.
    """
    session = await get_user_active_session(user.uid)
    if not session:
        return InterviewStateResponse(has_state=False)

    session_id = session["session_id"]
    db = get_firestore_client()
    interview_ref = db.collection("interviews").document(session_id)

    try:
        interview_doc = interview_ref.get()

        if not interview_doc.exists:
            return InterviewStateResponse(has_state=False)

        data = interview_doc.to_dict()

        # Parse transcript entries
        transcript_data = data.get("transcript", [])
        transcript = [
            InterviewTranscriptEntry(**entry) for entry in transcript_data
        ]

        # Parse metrics if available
        metrics_data = data.get("metrics", {})
        metrics = InterviewMetrics(**metrics_data) if metrics_data else None

        # Format paused_at as ISO string if present
        paused_at = data.get("pausedAt")
        paused_at_str = paused_at.isoformat() if paused_at else None

        return InterviewStateResponse(
            has_state=True,
            session_id=session_id,
            transcript=transcript,
            elapsed_time=data.get("elapsedTime", 0),
            question_count=data.get("questionCount", 0),
            metrics=metrics,
            paused_at=paused_at_str,
            status=data.get("status"),
        )

    except Exception as e:
        print(f"[Interview] Failed to get interview state: {e}")
        return InterviewStateResponse(has_state=False)
