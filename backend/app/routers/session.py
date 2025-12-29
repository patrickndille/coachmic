"""Session management endpoints."""

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from app.middleware.auth_middleware import AuthenticatedUser, require_auth
from app.services.firebase_service import get_firestore_client
from app.models.session import (
    CreateSessionRequest,
    CreateSessionResponse,
    DeleteSessionResponse,
    UpdateSessionRequest,
    SessionSummary,
    SessionHistoryResponse,
    FullSessionResponse,
)
from app.models.feedback import FeedbackData

router = APIRouter()


async def get_user_active_session(user_id: str) -> Optional[dict]:
    """Get user's most recent ACTIVE session from Firestore.

    Returns the newest session that is in an active/in-progress state.
    IMPORTANT: Does NOT return 'completed' sessions - those are historical records.
    Use get_user_session_by_id() to access completed sessions (e.g., for Practice Again).

    Returns None if no active session exists for the user.
    """
    try:
        db = get_firestore_client()
        print(f"[Session] Looking for active session for user: {user_id}")

        # First, let's see ALL sessions for this user (debug)
        all_sessions = db.collection('sessions')\
            .where(filter=FieldFilter('user_id', '==', user_id))\
            .limit(5)\
            .stream()

        session_list = list(all_sessions)
        print(f"[Session] Found {len(session_list)} total sessions for user {user_id}")

        for doc in session_list:
            data = doc.to_dict()
            print(f"[Session]   - Session {doc.id}: status='{data.get('status')}', created_at={data.get('created_at')}")

        # Now do the actual query with status filter
        # REMOVED 'completed' - completed sessions are historical, not active
        # This ensures "New Session" creates a fresh session instead of reusing completed ones
        session_docs = db.collection('sessions')\
            .where(filter=FieldFilter('user_id', '==', user_id))\
            .where(filter=FieldFilter('status', 'in', ['created', 'interviewing', 'paused', 'coaching']))\
            .order_by('created_at', direction=firestore.Query.DESCENDING)\
            .limit(1)\
            .stream()

        # Get first result
        for doc in session_docs:
            session_data = doc.to_dict()
            session_data['session_id'] = doc.id  # Ensure session_id is included
            print(f"[Session] Found active session: {doc.id}")
            return session_data

        print(f"[Session] No active session found for user {user_id}")
        return None
    except Exception as e:
        print(f"[Session] Error getting user active session: {e}")
        import traceback
        traceback.print_exc()
        return None


async def get_user_session_by_id(user_id: str, session_id: str) -> Optional[dict]:
    """Get a specific session by ID, regardless of status.

    Use this for features that need access to completed sessions:
    - Viewing feedback from past interviews
    - "Practice Again" functionality
    - Interview history

    Args:
        user_id: The user's ID (for ownership verification)
        session_id: The session ID to retrieve

    Returns:
        Session data dict or None if not found/unauthorized
    """
    try:
        db = get_firestore_client()
        doc = db.collection('sessions').document(session_id).get()

        if not doc.exists:
            print(f"[Session] Session {session_id} not found")
            return None

        data = doc.to_dict()

        # Verify ownership
        if data.get('user_id') != user_id:
            print(f"[Session] Session {session_id} belongs to different user")
            return None

        data['session_id'] = doc.id
        print(f"[Session] Retrieved session {session_id} (status: {data.get('status')})")
        return data

    except Exception as e:
        print(f"[Session] Error getting session {session_id}: {e}")
        return None


async def get_user_session_for_coaching(user_id: str) -> Optional[dict]:
    """Get user's most recent session for coaching, INCLUDING completed sessions.

    For coaching, we need access to completed sessions because:
    - Post-interview coaching happens after session status is 'completed'
    - Pre-interview coaching can happen on any session state

    Returns the newest session regardless of completion status.
    """
    try:
        db = get_firestore_client()

        # Include 'completed' status for post-interview coaching
        session_docs = db.collection('sessions')\
            .where(filter=FieldFilter('user_id', '==', user_id))\
            .where(filter=FieldFilter('status', 'in', ['created', 'interviewing', 'paused', 'coaching', 'completed']))\
            .order_by('created_at', direction=firestore.Query.DESCENDING)\
            .limit(1)\
            .stream()

        for doc in session_docs:
            session_data = doc.to_dict()
            session_data['session_id'] = doc.id
            print(f"[Session] Found session for coaching: {doc.id} (status: {session_data.get('status')})")
            return session_data

        print(f"[Session] No session found for coaching for user {user_id}")
        return None

    except Exception as e:
        print(f"[Session] Error getting session for coaching: {e}")
        return None


@router.post("/session", response_model=CreateSessionResponse)
async def create_session(
    request: CreateSessionRequest,
    user: AuthenticatedUser = Depends(require_auth)
):
    """Create a new interview session.

    Requires authentication. Session is saved to Firestore.
    """
    session_id = str(uuid.uuid4())
    now = datetime.utcnow()

    session_data = {
        "session_id": session_id,
        "user_id": user.uid,
        "target_role": request.target_role,
        "target_company": request.target_company,
        "interview_type": request.interview_type,
        "interview_length": request.interview_length,
        "difficulty_level": request.difficulty_level,
        "status": "created",
        "created_at": now,
        "resume_data": None,
        # Saved job reference (single source of truth for artifacts)
        "saved_job_id": request.saved_job_id,
        # Full job data for interviewer context
        "job_data": request.job_data,
    }

    # Save to Firestore
    try:
        db = get_firestore_client()
        db.collection('sessions').document(session_id).set(session_data)
        print(f"[Session] Created Firestore session {session_id} for user {user.uid}")
    except Exception as e:
        print(f"[Session] Failed to save to Firestore: {e}")
        raise HTTPException(status_code=500, detail="Failed to create session in database")

    return CreateSessionResponse(
        sessionId=session_id,
        status="created",
        createdAt=now,
    )


# IMPORTANT: This route must come BEFORE /session/{session_id} to avoid "active" being treated as a session_id
@router.get("/session/active", response_model=CreateSessionResponse)
async def get_active_session(
    user: AuthenticatedUser = Depends(require_auth)
):
    """Get the user's current active session.

    Returns the most recent session that is in an active state (created, interviewing, or coaching).
    Requires authentication.

    Returns:
        CreateSessionResponse: The active session details

    Raises:
        HTTPException: 404 if no active session exists
    """
    print(f"[Session API] /session/active called for user: {user.uid}")

    session = await get_user_active_session(user.uid)

    if not session:
        print(f"[Session API] No session found for user: {user.uid}, returning 404")
        raise HTTPException(
            status_code=404,
            detail="No active session found. Please complete setup first."
        )

    print(f"[Session API] Returning session: {session.get('session_id')}, mode: {session.get('interview_mode')}")
    return CreateSessionResponse(
        sessionId=session["session_id"],
        status=session["status"],
        interviewMode=session.get("interview_mode"),
        createdAt=session["created_at"],
    )


@router.get("/session/{session_id}", response_model=CreateSessionResponse)
async def get_session(
    session_id: str,
    user: AuthenticatedUser = Depends(require_auth)
):
    """Get session details.

    Requires authentication. Retrieves session from Firestore.
    """
    # Get session from Firestore
    try:
        db = get_firestore_client()
        doc = db.collection('sessions').document(session_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Session not found")
        session = doc.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Session] Firestore lookup failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve session")

    # Verify user owns this session
    if session.get("user_id") != user.uid:
        raise HTTPException(status_code=403, detail="Access denied")

    return CreateSessionResponse(
        sessionId=session["session_id"],
        status=session["status"],
        createdAt=session["created_at"],
    )


@router.get("/session/{session_id}/full", response_model=FullSessionResponse)
async def get_full_session(
    session_id: str,
    user: AuthenticatedUser = Depends(require_auth)
):
    """Get full session data including resume, improved resume, and company intel.

    Used for "Practice Again" to restore previous session data.
    Requires authentication.
    """
    try:
        db = get_firestore_client()
        doc = db.collection('sessions').document(session_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Session not found")
        session = doc.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Session] Firestore lookup failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve session")

    # Verify user owns this session
    if session.get("user_id") != user.uid:
        raise HTTPException(status_code=403, detail="Access denied")

    # Build full response with all data
    return FullSessionResponse(
        sessionId=session.get("session_id", session_id),
        targetRole=session.get("target_role", ""),
        targetCompany=session.get("target_company"),
        interviewType=session.get("interview_type", "behavioral"),
        interviewLength=session.get("interview_length", "short"),
        difficultyLevel=session.get("difficulty_level", "easy"),
        status=session.get("status", "created"),
        createdAt=session.get("created_at"),
        # Saved job reference
        savedJobId=session.get("saved_job_id"),
        jobData=session.get("job_data"),
        # Full data
        resumeData=session.get("resume_data"),
        improvedResumeMarkdown=session.get("improved_resume_markdown"),
        companyIntel=session.get("company_intel"),
        # Job discovery data
        aiDiscovery=session.get("ai_discovery"),
        searchJobs=session.get("search_jobs"),
        # Flags
        hasResumeData=session.get("resume_data") is not None,
        hasImprovedResume=session.get("improved_resume_markdown") is not None,
        hasCompanyIntel=session.get("company_intel") is not None,
        hasAiDiscovery=session.get("ai_discovery") is not None,
        hasSearchJobs=session.get("search_jobs") is not None,
        hasSavedJob=session.get("saved_job_id") is not None,
    )


@router.put("/session/{session_id}", response_model=CreateSessionResponse)
async def update_session(
    session_id: str,
    request: UpdateSessionRequest,
    user: AuthenticatedUser = Depends(require_auth)
):
    """Update session configuration.

    Requires authentication. Updates session in Firestore.
    """
    # Get session from Firestore
    try:
        db = get_firestore_client()
        doc = db.collection('sessions').document(session_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Session not found")
        session = doc.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Session] Firestore lookup failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve session")

    # Verify user owns this session
    if session.get("user_id") != user.uid:
        raise HTTPException(status_code=403, detail="Access denied")

    # Update only provided fields
    update_data = {}
    if request.target_role is not None:
        update_data["target_role"] = request.target_role
        session["target_role"] = request.target_role
    if request.target_company is not None:
        update_data["target_company"] = request.target_company
        session["target_company"] = request.target_company
    if request.interview_type is not None:
        update_data["interview_type"] = request.interview_type
        session["interview_type"] = request.interview_type
    if request.saved_job_id is not None:
        update_data["saved_job_id"] = request.saved_job_id
        session["saved_job_id"] = request.saved_job_id
    if request.job_data is not None:
        update_data["job_data"] = request.job_data
        session["job_data"] = request.job_data

    # Save updates to Firestore
    if update_data:
        try:
            db.collection('sessions').document(session_id).update(update_data)
            print(f"[Session] Updated Firestore session {session_id}")
        except Exception as e:
            print(f"[Session] Failed to update Firestore: {e}")
            raise HTTPException(status_code=500, detail="Failed to update session")

    return CreateSessionResponse(
        sessionId=session["session_id"],
        status=session["status"],
        createdAt=session["created_at"],
    )


@router.delete("/session/{session_id}", response_model=DeleteSessionResponse)
async def delete_session(
    session_id: str,
    user: AuthenticatedUser = Depends(require_auth)
):
    """Delete a session and cleanup resources.

    Requires authentication. Deletes session from Firestore.
    """
    # Get session from Firestore to verify ownership
    try:
        db = get_firestore_client()
        doc = db.collection('sessions').document(session_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Session not found")

        session = doc.to_dict()

        # Verify user owns this session
        if session.get("user_id") != user.uid:
            raise HTTPException(status_code=403, detail="Access denied")

        # Delete the session
        db.collection('sessions').document(session_id).delete()
        print(f"[Session] Deleted Firestore session {session_id}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Session] Firestore deletion failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete session")

    return DeleteSessionResponse(
        sessionId=session_id,
        deleted=True,
        message="Session deleted successfully",
    )


@router.get("/sessions/history", response_model=SessionHistoryResponse)
async def get_session_history(
    user: AuthenticatedUser = Depends(require_auth),
    limit: int = 20,
    offset: int = 0,
):
    """Get user's session history with pagination.

    Requires authentication. Returns all sessions belonging to the user,
    ordered by creation date (newest first).

    Args:
        limit: Maximum number of sessions to return (default: 20, max: 100)
        offset: Number of sessions to skip (default: 0)

    Returns:
        SessionHistoryResponse with sessions and pagination info
    """
    # Validate pagination parameters
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 100")
    if offset < 0:
        raise HTTPException(status_code=400, detail="Offset must be non-negative")

    try:
        db = get_firestore_client()

        # Get total count first
        all_sessions = db.collection('sessions')\
            .where(filter=FieldFilter('user_id', '==', user.uid))\
            .stream()
        total = sum(1 for _ in all_sessions)

        # Get paginated sessions
        sessions_query = db.collection('sessions')\
            .where(filter=FieldFilter('user_id', '==', user.uid))\
            .order_by('created_at', direction=firestore.Query.DESCENDING)\
            .limit(limit)\
            .offset(offset)\
            .stream()

        sessions = []
        for doc in sessions_query:
            session_data = doc.to_dict()

            # Try to get overall score from feedback
            overall_score = None
            try:
                feedback_doc = db.collection('feedback').document(doc.id).get()
                if feedback_doc.exists:
                    feedback_data = feedback_doc.to_dict()
                    if feedback_data.get('status') == 'completed':
                        feedback_content = feedback_data.get('feedback_data', {})
                        # Try both camelCase (new format) and snake_case (old format) for compatibility
                        overall_score = feedback_content.get('overallScore') or feedback_content.get('overall_score')
            except Exception:
                pass  # Feedback not available, that's ok

            sessions.append(SessionSummary(
                sessionId=doc.id,
                targetRole=session_data.get('target_role', 'Unknown'),
                targetCompany=session_data.get('target_company'),
                interviewType=session_data.get('interview_type', 'behavioral'),
                status=session_data.get('status', 'created'),
                createdAt=session_data.get('created_at', datetime.utcnow()),
                overallScore=overall_score,
                hasResumeData=session_data.get('resume_data') is not None,
                hasImprovedResume=session_data.get('improved_resume_markdown') is not None,
            ))

        return SessionHistoryResponse(
            sessions=sessions,
            total=total,
            limit=limit,
            offset=offset,
        )

    except Exception as e:
        print(f"[Session History] Error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve session history: {str(e)}"
        )


@router.get("/sessions/{session_id}/feedback", response_model=FeedbackData)
async def get_session_feedback(
    session_id: str,
    user: AuthenticatedUser = Depends(require_auth),
):
    """Get feedback for a specific session.

    Requires authentication and ownership of the session.

    Args:
        session_id: The session ID to get feedback for

    Returns:
        FeedbackData for the session

    Raises:
        HTTPException: 404 if session or feedback not found, 403 if not authorized
    """
    try:
        db = get_firestore_client()

        # Verify session exists and belongs to user
        session_doc = db.collection('sessions').document(session_id).get()
        if not session_doc.exists:
            raise HTTPException(status_code=404, detail="Session not found")

        session_data = session_doc.to_dict()
        if session_data.get('user_id') != user.uid:
            raise HTTPException(status_code=403, detail="Not authorized to access this session")

        # Get feedback
        feedback_doc = db.collection('feedback').document(session_id).get()
        if not feedback_doc.exists:
            raise HTTPException(status_code=404, detail="Feedback not found for this session")

        feedback_data = feedback_doc.to_dict()

        # Verify feedback is completed
        if feedback_data.get('status') != 'completed':
            raise HTTPException(
                status_code=400,
                detail=f"Feedback generation not completed (status: {feedback_data.get('status')})"
            )

        return feedback_data.get('feedback_data')

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Session Feedback] Error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve feedback: {str(e)}"
        )
