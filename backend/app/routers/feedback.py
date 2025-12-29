"""Feedback generation endpoints."""

import asyncio
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from fastapi.responses import HTMLResponse

from app.models.feedback import (
    FeedbackData,
    FeedbackStatusResponse,
    GenerateFeedbackRequest,
)
from app.services.feedback_generator import generate_interview_feedback
from app.services.firebase_service import get_firestore_client, get_feedback_collection
from app.middleware.auth_middleware import require_auth, AuthenticatedUser

router = APIRouter()


async def _process_feedback(session_id: str, transcript: list, user_id: str):
    """Background task to generate feedback."""
    db = get_firestore_client()
    feedback_doc = db.collection('feedback').document(session_id)

    try:
        # Update status to processing
        feedback_doc.set({
            'user_id': user_id,
            'session_id': session_id,
            'status': 'processing',
            'progress': 0,
            'created_at': datetime.utcnow(),
        })
        print(f"[Feedback] Starting feedback generation for session {session_id}")

        # Simulate progress updates
        for progress in [20, 40, 60, 80]:
            await asyncio.sleep(0.5)
            feedback_doc.update({'progress': progress})

        # Get session data from Firestore
        session = {}
        try:
            doc = db.collection('sessions').document(session_id).get()
            if doc.exists:
                session = doc.to_dict()
        except Exception as e:
            print(f"[Feedback] Failed to get session: {e}")

        print(f"[Feedback] Session data: role={session.get('target_role')}, type={session.get('interview_type')}")
        print(f"[Feedback] Transcript entries: {len(transcript)}")

        # Generate feedback using Gemini
        feedback = await generate_interview_feedback(
            session_id=session_id,
            transcript=transcript,
            target_role=session.get("target_role", "General"),
            interview_type=session.get("interview_type", "behavioral"),
        )

        # Convert Pydantic model to dict for Firestore
        # Use by_alias=True to convert field names (e.g., session_id -> sessionId)
        # Use mode='json' to ensure all nested models are properly serialized
        feedback_dict = feedback.model_dump(mode='json', by_alias=True)

        # Store feedback in Firestore
        feedback_doc.update({
            'feedback_data': feedback_dict,
            'status': 'completed',
            'progress': 100,
            'generated_at': datetime.utcnow(),
        })
        print(f"[Feedback] Successfully generated feedback for session {session_id}")

    except Exception as e:
        import traceback
        print(f"[Feedback] ERROR generating feedback: {e}")
        traceback.print_exc()
        feedback_doc.update({
            'status': 'failed',
            'progress': 0,
            'error_message': str(e),
        })


@router.post("/feedback/generate")
async def generate_feedback(
    request: GenerateFeedbackRequest,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(require_auth),
):
    """Generate feedback for an interview session (async)."""
    session_id = request.session_id

    # Check if session exists and belongs to user
    try:
        db = get_firestore_client()
        doc = db.collection('sessions').document(session_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Session not found")

        session = doc.to_dict()
        if session.get('user_id') != user.uid:
            raise HTTPException(status_code=403, detail="Not authorized to access this session")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Feedback] Error checking session: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify session")

    # Get transcript from request or fallback to Firestore
    transcript = request.transcript

    # If transcript not provided or empty, try to get from Firestore interview document
    if not transcript or len(transcript) == 0:
        print(f"[Feedback] No transcript in request, trying Firestore fallback...")
        try:
            interview_doc = db.collection('interviews').document(session_id).get()
            if interview_doc.exists:
                interview_data = interview_doc.to_dict()
                firestore_transcript = interview_data.get('transcript', [])
                if firestore_transcript:
                    # Import TranscriptEntry model for parsing
                    from app.models.feedback import TranscriptEntry
                    transcript = [TranscriptEntry(**entry) for entry in firestore_transcript]
                    print(f"[Feedback] Loaded {len(transcript)} entries from Firestore")
        except Exception as e:
            print(f"[Feedback] Failed to load transcript from Firestore: {e}")

    # Validate transcript has actual user responses
    user_responses = [
        entry for entry in transcript
        if entry.speaker == "user" and entry.text and len(entry.text.strip()) > 5
    ]

    if len(user_responses) < 1:
        raise HTTPException(
            status_code=400,
            detail="No interview responses found. Please answer at least one question before generating feedback."
        )

    print(f"[Feedback] Validated transcript: {len(user_responses)} user responses")

    # Generate feedback ID
    feedback_id = str(uuid.uuid4())

    # Start background processing
    background_tasks.add_task(
        _process_feedback,
        session_id,
        [entry.model_dump() for entry in transcript],
        user.uid,
    )

    return {"feedbackId": feedback_id, "status": "processing"}


@router.get("/feedback/{session_id}/status", response_model=FeedbackStatusResponse)
async def get_feedback_status(
    session_id: str,
    user: AuthenticatedUser = Depends(require_auth),
):
    """Check the status of feedback generation."""
    db = get_firestore_client()
    feedback_doc = db.collection('feedback').document(session_id).get()

    if not feedback_doc.exists:
        raise HTTPException(status_code=404, detail="Feedback not found")

    feedback_data = feedback_doc.to_dict()

    # Verify ownership
    if feedback_data.get('user_id') != user.uid:
        raise HTTPException(status_code=403, detail="Not authorized")

    return FeedbackStatusResponse(
        status=feedback_data.get("status", "unknown"),
        progress=feedback_data.get("progress", 0),
        message=feedback_data.get("error_message"),
    )


@router.get("/feedback/{session_id}", response_model=FeedbackData)
async def get_feedback(
    session_id: str,
    user: AuthenticatedUser = Depends(require_auth),
):
    """Get the generated feedback for a session."""
    db = get_firestore_client()
    feedback_doc = db.collection('feedback').document(session_id).get()

    if not feedback_doc.exists:
        raise HTTPException(status_code=404, detail="Feedback not found")

    feedback_data = feedback_doc.to_dict()

    # Verify ownership
    if feedback_data.get('user_id') != user.uid:
        raise HTTPException(status_code=403, detail="Not authorized")

    if feedback_data.get('status') != 'completed':
        raise HTTPException(status_code=400, detail="Feedback generation not completed")

    result = feedback_data.get('feedback_data', {})

    # Add session context (role/company) if not already present
    if not result.get('targetRole'):
        try:
            session_doc = db.collection('sessions').document(session_id).get()
            if session_doc.exists:
                session = session_doc.to_dict()
                result['targetRole'] = session.get('target_role', '')
                result['targetCompany'] = session.get('target_company', '')
        except Exception as e:
            print(f"[Feedback] Failed to fetch session context: {e}")

    return result


@router.get("/feedback/{session_id}/pdf", response_class=HTMLResponse)
async def get_feedback_pdf(
    session_id: str,
    user: AuthenticatedUser = Depends(require_auth),
):
    """Export feedback as a printable HTML report (can be saved as PDF via browser)."""
    db = get_firestore_client()
    feedback_doc = db.collection('feedback').document(session_id).get()

    if not feedback_doc.exists:
        raise HTTPException(status_code=404, detail="Feedback not found")

    feedback_data = feedback_doc.to_dict()

    # Verify ownership
    if feedback_data.get('user_id') != user.uid:
        raise HTTPException(status_code=403, detail="Not authorized")

    if feedback_data.get('status') != 'completed':
        raise HTTPException(status_code=400, detail="Feedback generation not completed")

    feedback = feedback_data.get('feedback_data')

    # Get session info from Firestore
    session = {}
    try:
        db = get_firestore_client()
        doc = db.collection('sessions').document(session_id).get()
        if doc.exists:
            session = doc.to_dict()
    except Exception as e:
        print(f"[Feedback PDF] Failed to get session: {e}")

    target_role = session.get("target_role", "Interview")
    target_company = session.get("target_company", "")

    # Build HTML report
    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interview Feedback Report - CoachMic</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; padding: 40px; max-width: 800px; margin: 0 auto; }}
        .header {{ text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #6366f1; }}
        .header h1 {{ color: #6366f1; font-size: 28px; margin-bottom: 8px; }}
        .header p {{ color: #64748b; font-size: 14px; }}
        .score-section {{ background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; }}
        .score-section .overall {{ font-size: 64px; font-weight: bold; }}
        .score-section .label {{ font-size: 18px; opacity: 0.9; }}
        .section {{ margin-bottom: 30px; }}
        .section h2 {{ color: #1a1a2e; font-size: 20px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }}
        .scores-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }}
        .score-card {{ background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center; }}
        .score-card .value {{ font-size: 24px; font-weight: bold; color: #6366f1; }}
        .score-card .name {{ font-size: 12px; color: #64748b; text-transform: uppercase; }}
        .metrics-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }}
        .metric-card {{ background: #f8fafc; padding: 16px; border-radius: 8px; }}
        .metric-card .value {{ font-size: 20px; font-weight: bold; color: #1a1a2e; }}
        .metric-card .name {{ font-size: 12px; color: #64748b; }}
        .list {{ list-style: none; padding: 0; }}
        .list li {{ padding: 8px 0; padding-left: 24px; position: relative; }}
        .list li::before {{ content: ''; position: absolute; left: 0; top: 14px; width: 8px; height: 8px; border-radius: 50%; }}
        .strengths li::before {{ background: #22c55e; }}
        .improvements li::before {{ background: #f59e0b; }}
        .question-feedback {{ background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 16px; }}
        .question-feedback h4 {{ color: #1a1a2e; margin-bottom: 8px; }}
        .question-feedback .score {{ display: inline-block; background: #6366f1; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-bottom: 8px; }}
        .question-feedback .response {{ background: white; padding: 12px; border-radius: 4px; margin: 12px 0; font-style: italic; color: #64748b; }}
        .question-feedback .feedback-text {{ color: #1a1a2e; }}
        .footer {{ margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px; }}
        @media print {{ body {{ padding: 20px; }} .score-section {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }} }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Interview Feedback Report</h1>
        <p>{target_role}{f' at {target_company}' if target_company else ''} | Generated on {feedback.get('generated_at', datetime.utcnow().isoformat())[:10]}</p>
    </div>

    <div class="score-section">
        <div class="overall">{feedback.get('overall_score', 0)}</div>
        <div class="label">Overall Score</div>
    </div>

    <div class="section">
        <h2>Category Scores</h2>
        <div class="scores-grid">
            <div class="score-card">
                <div class="value">{feedback.get('category_scores', {}).get('content', 0)}</div>
                <div class="name">Content</div>
            </div>
            <div class="score-card">
                <div class="value">{feedback.get('category_scores', {}).get('delivery', 0)}</div>
                <div class="name">Delivery</div>
            </div>
            <div class="score-card">
                <div class="value">{feedback.get('category_scores', {}).get('structure', 0)}</div>
                <div class="name">Structure</div>
            </div>
            <div class="score-card">
                <div class="value">{feedback.get('category_scores', {}).get('relevance', 0)}</div>
                <div class="name">Relevance</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Speaking Metrics</h2>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="value">{feedback.get('speaking_metrics', {}).get('words_per_minute', 0)}</div>
                <div class="name">Words per Minute</div>
            </div>
            <div class="metric-card">
                <div class="value">{feedback.get('speaking_metrics', {}).get('filler_word_count', 0)}</div>
                <div class="name">Filler Words</div>
            </div>
            <div class="metric-card">
                <div class="value">{feedback.get('speaking_metrics', {}).get('total_speaking_time', 0)}s</div>
                <div class="name">Total Speaking Time</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Strengths</h2>
        <ul class="list strengths">
            {''.join(f'<li>{s}</li>' for s in feedback.get('strengths', []))}
        </ul>
    </div>

    <div class="section">
        <h2>Areas for Improvement</h2>
        <ul class="list improvements">
            {''.join(f'<li>{a}</li>' for a in feedback.get('areas_for_improvement', []))}
        </ul>
    </div>

    <div class="section">
        <h2>Question-by-Question Feedback</h2>
        {''.join(f'''
        <div class="question-feedback">
            <h4>{qf.get('question', '')}</h4>
            <span class="score">Score: {qf.get('score', 0)}/100</span>
            <div class="response">"{qf.get('user_response', '')[:200]}{'...' if len(qf.get('user_response', '')) > 200 else ''}"</div>
            <p class="feedback-text">{qf.get('feedback', '')}</p>
            {f'<p style="margin-top: 8px; color: #6366f1;"><strong>Suggestion:</strong> {qf.get("suggested_improvement", "")}</p>' if qf.get('suggested_improvement') else ''}
        </div>
        ''' for qf in feedback.get('question_feedback', []))}
    </div>

    <div class="footer">
        <p>Generated by CoachMic | Your Voice is Your Superpower</p>
        <p>Print this page or save as PDF using your browser's print function (Ctrl/Cmd + P)</p>
    </div>
</body>
</html>
"""
    return HTMLResponse(content=html_content)
