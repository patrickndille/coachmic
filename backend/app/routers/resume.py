"""Resume parsing endpoints."""

import asyncio
import io
import json
import traceback
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, File, HTTPException, Depends, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from pypdf import PdfReader
from docx import Document
from google.cloud.firestore_v1 import ArrayUnion, ArrayRemove

from app.config import get_settings
from app.models.resume import (
    ParseResumeResponse,
    ResumeData,
    ATSAnalysis,
    KeywordGap,
    ResumeVersion,
    ResumeVersionResponse,
    ResumeVersionListResponse,
    SetCurrentVersionRequest,
    SetCurrentVersionResponse,
    GenerateImprovedPDFRequest,
    GenerateImprovedPDFResponse,
)
from app.services.resume_parser import parse_resume_file
from app.services.gemini_service import (
    generate_improved_resume,
    generate_improved_resume_stream,
    _parse_resume_basic,
    _parse_resume_career_analysis,
    calculate_ats_score_and_keywords,
)
from app.services.storage_service import (
    upload_resume_file,
    get_download_url,
    delete_resume_file,
    download_resume_file,
)
from app.middleware.auth_middleware import require_auth, AuthenticatedUser
from app.routers.session import get_user_active_session
from app.services.firebase_service import get_firestore_client

router = APIRouter()
settings = get_settings()

# Maximum number of resume versions per user
MAX_RESUME_VERSIONS = 10


async def _get_user_resume_versions(user_id: str) -> List[dict]:
    """Get all resume versions for a user from their user document.

    Args:
        user_id: Firebase user UID

    Returns:
        List of resume version dicts, sorted by uploaded_at (newest first)
    """
    db = get_firestore_client()
    user_doc = db.collection('users').document(user_id).get()

    if not user_doc.exists:
        return []

    user_data = user_doc.to_dict()
    versions = user_data.get('resume_versions', [])

    # Sort by uploaded_at descending (newest first)
    versions.sort(key=lambda v: v.get('uploaded_at', ''), reverse=True)
    return versions


async def _add_resume_version(
    user_id: str,
    version_data: dict,
    set_as_current: bool = True,
) -> None:
    """Add a resume version to the user's document.

    Handles the max 10 versions limit by deleting the oldest non-current version
    if necessary.

    Args:
        user_id: Firebase user UID
        version_data: ResumeVersion data as dict
        set_as_current: Whether to set this as the current version
    """
    db = get_firestore_client()
    user_ref = db.collection('users').document(user_id)

    # Get current versions
    versions = await _get_user_resume_versions(user_id)
    current_version_id = None

    user_doc = user_ref.get()
    if user_doc.exists:
        user_data = user_doc.to_dict()
        current_version_id = user_data.get('current_resume_version_id')

    # Check if we need to delete oldest version (max 10)
    if len(versions) >= MAX_RESUME_VERSIONS:
        # Find oldest version that is NOT the current one
        versions_sorted = sorted(versions, key=lambda v: v.get('uploaded_at', ''))
        for old_version in versions_sorted:
            if old_version.get('version_id') != current_version_id:
                # Delete from storage
                storage_path = old_version.get('storage_path')
                if storage_path:
                    try:
                        await delete_resume_file(storage_path)
                        print(f"[Resume] Deleted old version file: {storage_path}")
                    except Exception as e:
                        print(f"[Resume] Warning: Failed to delete old version file: {e}")

                # Remove from array
                user_ref.update({
                    'resume_versions': ArrayRemove([old_version])
                })
                print(f"[Resume] Removed old version from user doc: {old_version.get('version_id')}")
                break

    # Add new version to array
    update_data = {
        'resume_versions': ArrayUnion([version_data])
    }

    if set_as_current:
        update_data['current_resume_version_id'] = version_data['version_id']

    user_ref.update(update_data)
    print(f"[Resume] Added version {version_data['version_id']} to user {user_id}")


async def _store_resume_file(
    user_id: str,
    file_content: bytes,
    file_name: str,
    content_type: str,
    session_id: str,
    is_improved: bool = False,
    source_version_id: Optional[str] = None,
) -> dict:
    """Store a resume file and create a version entry.

    Args:
        user_id: Firebase user UID
        file_content: Raw file bytes
        file_name: Original filename
        content_type: MIME type
        session_id: Session to link version to
        is_improved: Whether this is an AI-improved version
        source_version_id: If improved, the original version ID

    Returns:
        Version data dict
    """
    # Upload to Firebase Storage
    version_id, storage_path, download_url = await upload_resume_file(
        user_id=user_id,
        file_content=file_content,
        file_name=file_name,
        content_type=content_type,
        is_improved=is_improved,
        source_version_id=source_version_id,
    )

    # Determine file type
    if 'pdf' in content_type.lower():
        file_type = 'pdf'
    elif 'docx' in content_type.lower() or 'wordprocessingml' in content_type.lower():
        file_type = 'docx'
    else:
        file_type = 'pdf'

    # Create version data
    version_data = {
        'version_id': version_id,
        'storage_path': storage_path,
        'download_url': download_url,
        'file_name': file_name,
        'file_type': file_type,
        'file_size': len(file_content),
        'uploaded_at': datetime.utcnow().isoformat(),
        'is_ai_improved': is_improved,
    }

    if source_version_id:
        version_data['source_version_id'] = source_version_id

    # Add to user's versions
    await _add_resume_version(user_id, version_data, set_as_current=True)

    # Link version to session
    db = get_firestore_client()
    db.collection('sessions').document(session_id).update({
        'resume_version_id': version_id
    })
    print(f"[Resume] Linked version {version_id} to session {session_id}")

    return version_data


# Request/Response models for improve endpoint
class ImproveResumeRequest(BaseModel):
    """Request body for resume improvement."""
    session_id: str = Field(..., alias="sessionId")

    class Config:
        populate_by_name = True


class ImproveResumeResponse(BaseModel):
    """Response body for resume improvement."""
    success: bool
    improved_resume_markdown: str = Field(..., alias="improvedResumeMarkdown")
    message: Optional[str] = None

    class Config:
        populate_by_name = True


class SaveImprovedResumeRequest(BaseModel):
    """Request body for saving improved resume."""
    session_id: str = Field(..., alias="sessionId")
    improved_resume_markdown: str = Field(..., alias="improvedResumeMarkdown")

    class Config:
        populate_by_name = True


class SaveImprovedResumeResponse(BaseModel):
    """Response body for saving improved resume."""
    success: bool
    message: Optional[str] = None

    class Config:
        populate_by_name = True


class GetImprovedResumeResponse(BaseModel):
    """Response body for getting improved resume."""
    success: bool
    improved_resume_markdown: Optional[str] = Field(None, alias="improvedResumeMarkdown")
    message: Optional[str] = None

    class Config:
        populate_by_name = True


def _convert_to_frontend_format(data: dict, is_basic: bool = True) -> dict:
    """Convert snake_case backend fields to camelCase frontend format.

    Args:
        data: Raw data from Gemini parsing
        is_basic: True for basic data, False for career analysis data

    Returns:
        Data with field names matching frontend TypeScript interfaces
    """
    if not data:
        return {}

    result = {}

    if is_basic:
        # Basic fields - direct copy
        if 'name' in data:
            result['name'] = data['name']
        if 'email' in data:
            result['email'] = data['email']
        if 'phone' in data:
            result['phone'] = data['phone']
        if 'skills' in data:
            result['skills'] = data['skills']

        # experience -> experiences (also convert nested fields)
        if 'experience' in data:
            experiences = []
            for exp in data.get('experience', []):
                converted_exp = {
                    'title': exp.get('title', ''),
                    'company': exp.get('company', ''),
                    'duration': exp.get('duration', ''),
                    'highlights': exp.get('highlights', []),
                }
                # Convert date fields if present
                if 'start_date' in exp:
                    converted_exp['startDate'] = exp['start_date']
                if 'end_date' in exp:
                    converted_exp['endDate'] = exp['end_date']
                experiences.append(converted_exp)
            result['experiences'] = experiences

        # education - convert nested fields
        if 'education' in data:
            education_list = []
            for edu in data.get('education', []):
                converted_edu = {
                    'degree': edu.get('degree', ''),
                    'institution': edu.get('institution', ''),
                    'year': edu.get('year', ''),
                }
                if 'graduation_year' in edu:
                    converted_edu['graduationYear'] = edu['graduation_year']
                education_list.append(converted_edu)
            result['education'] = education_list

        # key_achievements -> keyAchievements
        if 'key_achievements' in data:
            result['keyAchievements'] = data['key_achievements']

        # suggested_roles -> suggestedRoles
        if 'suggested_roles' in data:
            result['suggestedRoles'] = data['suggested_roles']

        # location - convert nested snake_case to camelCase
        if 'location' in data and data['location']:
            loc = data['location']
            result['location'] = {
                'city': loc.get('city'),
                'country': loc.get('country'),
                'countryCode': loc.get('country_code') or loc.get('countryCode'),
                'stateProvince': loc.get('state_province') or loc.get('stateProvince'),
                'rawAddress': loc.get('raw_address') or loc.get('rawAddress'),
            }

        # summary
        if 'summary' in data:
            result['summary'] = data['summary']

    else:
        # Career analysis fields

        # skill_graph -> skillGraph
        if 'skill_graph' in data and data['skill_graph']:
            sg = data['skill_graph']
            result['skillGraph'] = {
                'technical': sg.get('technical', []),
                'soft': sg.get('soft', []),
                'domain': sg.get('domain', []),
                'certifications': sg.get('certifications', []),
            }

        # career_signals -> careerSignals
        # Gemini returns: seniority_level, industry_focus, career_trajectory, years_experience
        # Frontend expects: seniorityLevel, industryFocus, careerTrajectory, yearsExperience
        if 'career_signals' in data and data['career_signals']:
            cs = data['career_signals']
            result['careerSignals'] = {
                'seniorityLevel': cs.get('seniority_level', ''),
                'industryFocus': cs.get('industry_focus', []),
                'careerTrajectory': cs.get('career_trajectory', ''),
                'yearsExperience': cs.get('years_experience'),
            }

        # star_stories -> starStories
        # Gemini returns: theme, situation, task, action, result, metrics, keywords
        # Frontend expects: theme, situation, task, action, result, metrics, keywords
        if 'star_stories' in data and data['star_stories']:
            stories = []
            for story in data.get('star_stories', []):
                stories.append({
                    'theme': story.get('theme', ''),
                    'situation': story.get('situation', ''),
                    'task': story.get('task', ''),
                    'action': story.get('action', ''),
                    'result': story.get('result', ''),
                    'metrics': story.get('metrics', []),
                    'keywords': story.get('keywords', []),
                })
            result['starStories'] = stories

        # talking_points -> talkingPoints
        # Gemini returns: elevator_pitch, key_strengths, unique_value
        # Frontend expects: elevatorPitch, keyStrengths, uniqueValue
        if 'talking_points' in data and data['talking_points']:
            tp = data['talking_points']
            result['talkingPoints'] = {
                'elevatorPitch': tp.get('elevator_pitch', ''),
                'keyStrengths': tp.get('key_strengths', []),
                'uniqueValue': tp.get('unique_value', ''),
            }

    return result


def _extract_pdf_text(content: bytes) -> str:
    """Extract text from PDF bytes."""
    reader = PdfReader(io.BytesIO(content))
    text_parts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            text_parts.append(text)
    return "\n".join(text_parts)


def _extract_docx_text(content: bytes) -> str:
    """Extract text from DOCX bytes."""
    doc = Document(io.BytesIO(content))
    text_parts = []
    for paragraph in doc.paragraphs:
        if paragraph.text.strip():
            text_parts.append(paragraph.text)
    return "\n".join(text_parts)


@router.post("/resume/parse/stream")
async def parse_resume_stream(
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(require_auth),
):
    """Parse resume with Server-Sent Events for progressive updates.

    Runs basic parsing, career analysis, and ATS scoring in parallel.
    Auto-triggers resume improvement when ATS completes.
    Stores resume file in Firebase Storage with versioning.

    Event types:
    - {"type": "basic", "data": {...}} - Basic info (name, skills, experience)
    - {"type": "career", "data": {...}} - Career analysis (skill_graph, star_stories)
    - {"type": "ats", "data": {...}} - ATS score and analysis
    - {"type": "improve", "data": "..."} - Improved resume markdown
    - {"type": "storage", "data": {...}} - File stored with version info
    - {"type": "warning", "message": "..."} - Non-fatal warning
    - {"type": "complete", "sessionId": "..."} - All done
    - {"type": "error", "message": "..."} - Error occurred
    """
    # Validate file type
    allowed_types = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    if file.content_type not in allowed_types:
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'message': 'Invalid file type. Please upload a PDF or DOCX file.'})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")

    # Validate file size
    content = await file.read()
    if len(content) > settings.max_upload_size:
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'message': f'File too large. Maximum size is {settings.max_upload_size // (1024 * 1024)}MB.'})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")

    # Extract text based on file type
    try:
        if file.content_type == "application/pdf":
            raw_text = _extract_pdf_text(content)
        else:
            raw_text = _extract_docx_text(content)
        print(f"[Resume Stream] Extracted text length: {len(raw_text)}")
    except Exception as e:
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'message': f'Failed to extract text: {str(e)}'})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")

    async def event_generator():
        import time
        start_time = time.time()
        print(f"[Resume Stream] Starting parallel parsing for user {user.uid}")

        # Create tasks for parallel execution
        basic_task = asyncio.create_task(_parse_resume_basic(raw_text))
        career_task = asyncio.create_task(_parse_resume_career_analysis(raw_text))
        ats_task = asyncio.create_task(calculate_ats_score_and_keywords(raw_text, [], None))

        # Track tasks
        task_map = {
            basic_task: 'basic',
            career_task: 'career',
            ats_task: 'ats',
        }
        pending = {basic_task, career_task, ats_task}
        results = {'raw_text': raw_text, 'file_name': file.filename}
        improve_task = None

        try:
            while pending:
                done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)

                for task in done:
                    task_name = task_map.get(task, 'improve')
                    elapsed = time.time() - start_time

                    try:
                        result = task.result()

                        if task_name == 'basic':
                            # Convert to frontend format (camelCase) and store converted version
                            frontend_basic = _convert_to_frontend_format(result, is_basic=True)
                            results['basic'] = frontend_basic  # Store camelCase for Firestore
                            print(f"[Resume Stream] Basic done in {elapsed:.2f}s, fields: {list(frontend_basic.keys())}")
                            yield f"data: {json.dumps({'type': 'basic', 'data': frontend_basic})}\n\n"

                        elif task_name == 'career':
                            # Convert to frontend format (camelCase) and store converted version
                            frontend_career = _convert_to_frontend_format(result, is_basic=False)
                            results['career'] = frontend_career  # Store camelCase for Firestore
                            print(f"[Resume Stream] Career done in {elapsed:.2f}s, fields: {list(frontend_career.keys())}")
                            yield f"data: {json.dumps({'type': 'career', 'data': frontend_career})}\n\n"

                        elif task_name == 'ats':
                            results['ats'] = result
                            print(f"[Resume Stream] ATS done in {elapsed:.2f}s")
                            yield f"data: {json.dumps({'type': 'ats', 'data': result})}\n\n"

                            # Auto-trigger improve when ATS completes
                            ats_issues = result.get('ats_issues', [])
                            keyword_gaps = result.get('keyword_gaps', [])
                            formatting_tips = result.get('formatting_tips', [])
                            industry_keywords = result.get('industry_keywords', {})

                            improve_task = asyncio.create_task(
                                generate_improved_resume(
                                    raw_text=raw_text,
                                    ats_issues=ats_issues,
                                    keyword_gaps=keyword_gaps,
                                    formatting_tips=formatting_tips,
                                    industry_keywords=industry_keywords,
                                )
                            )
                            task_map[improve_task] = 'improve'
                            pending.add(improve_task)
                            print(f"[Resume Stream] Auto-triggered improve task")

                        elif task_name == 'improve':
                            results['improve'] = result
                            print(f"[Resume Stream] Improve done in {elapsed:.2f}s")
                            yield f"data: {json.dumps({'type': 'improve', 'data': result})}\n\n"

                    except Exception as task_error:
                        print(f"[Resume Stream] Task {task_name} failed: {task_error}")
                        yield f"data: {json.dumps({'type': 'error', 'task': task_name, 'message': str(task_error)})}\n\n"

            # Merge results and save to Firestore
            merged_data = {
                'rawText': raw_text,
                'fileName': file.filename,
                **results.get('basic', {}),
                **results.get('career', {}),
            }

            # Convert ATS data to proper format
            ats_result = results.get('ats', {})
            if ats_result:
                keyword_gaps = []
                for gap in ats_result.get('keyword_gaps', []):
                    keyword_gaps.append({
                        'keyword': gap.get('keyword'),
                        'category': gap.get('category', 'technical'),
                        'importance': gap.get('importance', 'medium'),
                        'whereToAdd': gap.get('where_to_add'),
                    })

                merged_data['atsAnalysis'] = {
                    'atsScore': ats_result.get('ats_score', 70),
                    'scoreBreakdown': ats_result.get('score_breakdown', {}),
                    'atsIssues': ats_result.get('ats_issues', []),
                    'keywordGaps': keyword_gaps,
                    'formattingTips': ats_result.get('formatting_tips', []),
                    'industryKeywords': ats_result.get('industry_keywords', {}),
                }

            # Get or create session
            db = get_firestore_client()
            session = await get_user_active_session(user.uid)

            if session:
                session_id = session['session_id']
                db.collection('sessions').document(session_id).update({
                    'resume_data': merged_data,
                    'improved_resume_markdown': results.get('improve', ''),
                })
                print(f"[Resume Stream] Updated session {session_id}")
            else:
                session_id = str(uuid.uuid4())
                session_data = {
                    'session_id': session_id,
                    'user_id': user.uid,
                    'resume_data': merged_data,
                    'improved_resume_markdown': results.get('improve', ''),
                    'created_at': datetime.utcnow(),
                    'status': 'created',
                }
                db.collection('sessions').document(session_id).set(session_data)
                print(f"[Resume Stream] Created session {session_id}")

            # Store file in Firebase Storage and create version entry
            try:
                version_data = await _store_resume_file(
                    user_id=user.uid,
                    file_content=content,
                    file_name=file.filename,
                    content_type=file.content_type,
                    session_id=session_id,
                )
                print(f"[Resume Stream] Stored file version: {version_data['version_id']}")
                # Send storage event to frontend
                yield f"data: {json.dumps({'type': 'storage', 'data': version_data})}\n\n"
            except Exception as storage_error:
                print(f"[Resume Stream] Warning: Failed to store file: {storage_error}")
                print(traceback.format_exc())
                # Don't fail the stream, just log the error
                yield f"data: {json.dumps({'type': 'warning', 'message': f'File storage failed: {str(storage_error)}'})}\n\n"

            total_time = time.time() - start_time
            print(f"[Resume Stream] All tasks completed in {total_time:.2f}s")
            yield f"data: {json.dumps({'type': 'complete', 'sessionId': session_id})}\n\n"

        except Exception as e:
            print(f"[Resume Stream] Fatal error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


class ReparseRequest(BaseModel):
    """Request body for reparsing a stored resume version."""
    session_id: Optional[str] = Field(None, description="Existing session ID to update, or None to create new")


@router.post("/resume/reparse-stream/{version_id}")
async def reparse_stored_resume_stream(
    version_id: str,
    request: ReparseRequest = ReparseRequest(),
    user: AuthenticatedUser = Depends(require_auth),
):
    """Re-parse a stored resume version with Server-Sent Events for progressive updates.

    Downloads the stored file from Firebase Storage and runs full analysis pipeline.
    Does NOT create a new version entry - just re-analyzes the existing file.

    Args:
        version_id: The version_id of the stored resume to re-parse
        request: Optional session_id to update existing session

    Event types:
    - {"type": "basic", "data": {...}} - Basic info (name, skills, experience)
    - {"type": "career", "data": {...}} - Career analysis (skill_graph, star_stories)
    - {"type": "ats", "data": {...}} - ATS score and analysis
    - {"type": "improve", "data": "..."} - Improved resume markdown
    - {"type": "complete", "sessionId": "..."} - All done
    - {"type": "error", "message": "..."} - Error occurred
    """
    # Find the version in user's resume_versions
    versions = await _get_user_resume_versions(user.uid)
    version = next((v for v in versions if v.get('version_id') == version_id), None)

    if not version:
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'message': 'Resume version not found or access denied.'})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")

    storage_path = version.get('storage_path')
    file_name = version.get('file_name', 'resume.pdf')
    file_type = version.get('file_type', 'pdf')

    if not storage_path:
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'message': 'Resume version has no storage path.'})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")

    # Download file from Firebase Storage
    try:
        content = await download_resume_file(storage_path)
        print(f"[Reparse Stream] Downloaded file: {storage_path} ({len(content)} bytes)")
    except Exception as e:
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'message': f'Failed to download stored file: {str(e)}'})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")

    # Extract text based on file type
    try:
        if file_type == 'pdf':
            raw_text = _extract_pdf_text(content)
        else:
            raw_text = _extract_docx_text(content)
        print(f"[Reparse Stream] Extracted text length: {len(raw_text)}")
    except Exception as e:
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'message': f'Failed to extract text: {str(e)}'})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")

    async def event_generator():
        import time
        start_time = time.time()
        print(f"[Reparse Stream] Starting parallel parsing for user {user.uid}, version {version_id}")

        # Create tasks for parallel execution
        basic_task = asyncio.create_task(_parse_resume_basic(raw_text))
        career_task = asyncio.create_task(_parse_resume_career_analysis(raw_text))
        ats_task = asyncio.create_task(calculate_ats_score_and_keywords(raw_text, [], None))

        # Track tasks
        task_map = {
            basic_task: 'basic',
            career_task: 'career',
            ats_task: 'ats',
        }
        pending = {basic_task, career_task, ats_task}
        results = {'raw_text': raw_text, 'file_name': file_name}
        improve_task = None

        try:
            while pending:
                done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)

                for task in done:
                    task_name = task_map.get(task, 'improve')
                    elapsed = time.time() - start_time

                    try:
                        result = task.result()

                        if task_name == 'basic':
                            # Convert to frontend format (camelCase) and store converted version
                            frontend_basic = _convert_to_frontend_format(result, is_basic=True)
                            results['basic'] = frontend_basic  # Store camelCase for Firestore
                            print(f"[Reparse Stream] Basic done in {elapsed:.2f}s, fields: {list(frontend_basic.keys())}")
                            yield f"data: {json.dumps({'type': 'basic', 'data': frontend_basic})}\n\n"

                        elif task_name == 'career':
                            # Convert to frontend format (camelCase) and store converted version
                            frontend_career = _convert_to_frontend_format(result, is_basic=False)
                            results['career'] = frontend_career  # Store camelCase for Firestore
                            print(f"[Reparse Stream] Career done in {elapsed:.2f}s, fields: {list(frontend_career.keys())}")
                            yield f"data: {json.dumps({'type': 'career', 'data': frontend_career})}\n\n"

                        elif task_name == 'ats':
                            results['ats'] = result
                            print(f"[Reparse Stream] ATS done in {elapsed:.2f}s")
                            yield f"data: {json.dumps({'type': 'ats', 'data': result})}\n\n"

                            # Auto-trigger improve when ATS completes
                            ats_issues = result.get('ats_issues', [])
                            keyword_gaps = result.get('keyword_gaps', [])
                            formatting_tips = result.get('formatting_tips', [])
                            industry_keywords = result.get('industry_keywords', {})

                            improve_task = asyncio.create_task(
                                generate_improved_resume(
                                    raw_text=raw_text,
                                    ats_issues=ats_issues,
                                    keyword_gaps=keyword_gaps,
                                    formatting_tips=formatting_tips,
                                    industry_keywords=industry_keywords,
                                )
                            )
                            task_map[improve_task] = 'improve'
                            pending.add(improve_task)
                            print(f"[Reparse Stream] Auto-triggered improve task")

                        elif task_name == 'improve':
                            results['improve'] = result
                            print(f"[Reparse Stream] Improve done in {elapsed:.2f}s")
                            yield f"data: {json.dumps({'type': 'improve', 'data': result})}\n\n"

                    except Exception as task_error:
                        print(f"[Reparse Stream] Task {task_name} failed: {task_error}")
                        yield f"data: {json.dumps({'type': 'error', 'task': task_name, 'message': str(task_error)})}\n\n"

            # Merge results and save to Firestore
            merged_data = {
                'rawText': raw_text,
                'fileName': file_name,
                **results.get('basic', {}),
                **results.get('career', {}),
            }

            # Convert ATS data to proper format
            ats_result = results.get('ats', {})
            if ats_result:
                keyword_gaps = []
                for gap in ats_result.get('keyword_gaps', []):
                    keyword_gaps.append({
                        'keyword': gap.get('keyword'),
                        'category': gap.get('category', 'technical'),
                        'importance': gap.get('importance', 'medium'),
                        'whereToAdd': gap.get('where_to_add'),
                    })

                merged_data['atsAnalysis'] = {
                    'atsScore': ats_result.get('ats_score', 70),
                    'scoreBreakdown': ats_result.get('score_breakdown', {}),
                    'atsIssues': ats_result.get('ats_issues', []),
                    'keywordGaps': keyword_gaps,
                    'formattingTips': ats_result.get('formatting_tips', []),
                    'industryKeywords': ats_result.get('industry_keywords', {}),
                }

            # Get or create session
            db = get_firestore_client()
            session_id = request.session_id

            if session_id:
                # Update existing session
                session_ref = db.collection('sessions').document(session_id)
                session_doc = session_ref.get()
                if session_doc.exists:
                    session_ref.update({
                        'resume_data': merged_data,
                        'resume_version_id': version_id,
                        'improved_resume_markdown': results.get('improve', ''),
                    })
                    print(f"[Reparse Stream] Updated existing session {session_id}")
                else:
                    # Session doesn't exist, create new
                    session_id = str(uuid.uuid4())
                    session_data = {
                        'session_id': session_id,
                        'user_id': user.uid,
                        'resume_data': merged_data,
                        'resume_version_id': version_id,
                        'improved_resume_markdown': results.get('improve', ''),
                        'created_at': datetime.utcnow(),
                        'status': 'created',
                    }
                    db.collection('sessions').document(session_id).set(session_data)
                    print(f"[Reparse Stream] Created new session {session_id}")
            else:
                # Check for active session or create new
                session = await get_user_active_session(user.uid)
                if session:
                    session_id = session['session_id']
                    db.collection('sessions').document(session_id).update({
                        'resume_data': merged_data,
                        'resume_version_id': version_id,
                        'improved_resume_markdown': results.get('improve', ''),
                    })
                    print(f"[Reparse Stream] Updated active session {session_id}")
                else:
                    session_id = str(uuid.uuid4())
                    session_data = {
                        'session_id': session_id,
                        'user_id': user.uid,
                        'resume_data': merged_data,
                        'resume_version_id': version_id,
                        'improved_resume_markdown': results.get('improve', ''),
                        'created_at': datetime.utcnow(),
                        'status': 'created',
                    }
                    db.collection('sessions').document(session_id).set(session_data)
                    print(f"[Reparse Stream] Created session {session_id}")

            # Note: We do NOT create a new storage version for reparse
            # The file is already stored, we're just re-analyzing it

            total_time = time.time() - start_time
            print(f"[Reparse Stream] All tasks completed in {total_time:.2f}s")
            yield f"data: {json.dumps({'type': 'complete', 'sessionId': session_id})}\n\n"

        except Exception as e:
            print(f"[Reparse Stream] Fatal error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/resume/parse", response_model=ParseResumeResponse, response_model_by_alias=True)
async def parse_resume(
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(require_auth),
):
    """Parse an uploaded resume file (PDF or DOCX).

    Requires authentication. Links resume to user's active session.
    """
    # Validate file type
    allowed_types = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload a PDF or DOCX file.",
        )

    # Validate file size
    content = await file.read()
    if len(content) > settings.max_upload_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {settings.max_upload_size // (1024 * 1024)}MB.",
        )

    try:
        # Parse the resume
        parsed_data = await parse_resume_file(content, file.content_type)
        
        # Add the filename to the parsed data
        parsed_data.file_name = file.filename
        
        # Serialize with aliases for camelCase field names
        resume_dict = parsed_data.model_dump(by_alias=True)

        # Get user's active session or create new one
        session = await get_user_active_session(user.uid)
        db = get_firestore_client()

        if session:
            # Update existing session with resume data
            session_id = session['session_id']
            try:
                db.collection('sessions').document(session_id).update({"resume_data": resume_dict})
                print(f"[Resume] Updated session {session_id} with resume data for user {user.uid}")
            except Exception as e:
                print(f"[Resume] Failed to update session with resume data: {e}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to save resume to session: {str(e)}"
                )
        else:
            # Create new session with resume data
            session_id = str(uuid.uuid4())
            session_data = {
                "session_id": session_id,
                "user_id": user.uid,
                "resume_data": resume_dict,
                "created_at": datetime.utcnow(),
                "status": "created"
            }
            try:
                db.collection('sessions').document(session_id).set(session_data)
                print(f"[Resume] Created new session {session_id} with resume data for user {user.uid}")
            except Exception as e:
                print(f"[Resume] Failed to create session with resume data: {e}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to create session: {str(e)}"
                )

        response = ParseResumeResponse(
            success=True,
            parsedData=parsed_data,
            message="Resume parsed successfully",
            sessionId=session_id,
        )
        print(f"[Resume] Returning response for session {session_id}")
        return response
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse resume: {str(e)}",
        )


@router.post("/resume/improve", response_model=ImproveResumeResponse, response_model_by_alias=True)
async def improve_resume(
    request: ImproveResumeRequest,
    user: AuthenticatedUser = Depends(require_auth),
):
    """Generate an improved version of the resume based on ATS analysis.

    Requires authentication. Uses the session's stored resume data and ATS analysis
    to generate an improved version of the resume in Markdown format.
    """
    db = get_firestore_client()

    # Fetch the session
    try:
        session_doc = db.collection('sessions').document(request.session_id).get()
        if not session_doc.exists:
            raise HTTPException(status_code=404, detail="Session not found")

        session_data = session_doc.to_dict()

        # Verify user owns this session
        if session_data.get('user_id') != user.uid:
            raise HTTPException(status_code=403, detail="Unauthorized access to session")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch session: {str(e)}")

    # Extract resume data
    resume_data = session_data.get('resume_data')
    if not resume_data:
        raise HTTPException(status_code=400, detail="No resume data found in session")

    # Support both camelCase (new) and snake_case (legacy) field names
    raw_text = resume_data.get('rawText') or resume_data.get('raw_text', '')
    if not raw_text:
        raise HTTPException(status_code=400, detail="No resume text found in session")

    # Extract ATS analysis data (support both naming conventions)
    ats_analysis = resume_data.get('atsAnalysis') or resume_data.get('ats_analysis', {})
    ats_issues = ats_analysis.get('atsIssues') or ats_analysis.get('ats_issues', [])
    keyword_gaps = ats_analysis.get('keywordGaps') or ats_analysis.get('keyword_gaps', [])
    formatting_tips = ats_analysis.get('formattingTips') or ats_analysis.get('formatting_tips', [])
    industry_keywords = ats_analysis.get('industryKeywords') or ats_analysis.get('industry_keywords', {})

    # Generate improved resume
    try:
        improved_markdown = await generate_improved_resume(
            raw_text=raw_text,
            ats_issues=ats_issues,
            keyword_gaps=keyword_gaps,
            formatting_tips=formatting_tips,
            industry_keywords=industry_keywords,
        )

        # Auto-save the improved resume to Firestore
        try:
            db.collection('sessions').document(request.session_id).update({
                "improved_resume_markdown": improved_markdown
            })
            print(f"[Resume] Auto-saved improved resume to session {request.session_id}")
        except Exception as save_error:
            print(f"[Resume] Warning: Failed to auto-save improved resume: {save_error}")
            # Continue anyway - the resume was generated successfully

        return ImproveResumeResponse(
            success=True,
            improvedResumeMarkdown=improved_markdown,
            message="Resume improved successfully",
        )
    except Exception as e:
        print(f"[Resume] Failed to generate improved resume: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate improved resume: {str(e)}",
        )


@router.post("/resume/improve/stream")
async def improve_resume_stream(
    request: ImproveResumeRequest,
    user: AuthenticatedUser = Depends(require_auth),
):
    """Generate an improved version of the resume with streaming output.

    Requires authentication. Uses Server-Sent Events (SSE) to stream the
    generated resume text as it's being created by the LLM.

    Event format:
    - data: {"chunk": "text..."} for each text chunk
    - data: {"done": true, "fullText": "..."} when complete
    - data: {"error": "message"} on error
    """
    db = get_firestore_client()

    # Fetch and validate session
    try:
        session_doc = db.collection('sessions').document(request.session_id).get()
        if not session_doc.exists:
            async def error_stream():
                yield f"data: {json.dumps({'error': 'Session not found'})}\n\n"
            return StreamingResponse(error_stream(), media_type="text/event-stream")

        session_data = session_doc.to_dict()

        if session_data.get('user_id') != user.uid:
            async def error_stream():
                yield f"data: {json.dumps({'error': 'Unauthorized access to session'})}\n\n"
            return StreamingResponse(error_stream(), media_type="text/event-stream")

    except Exception as e:
        async def error_stream():
            yield f"data: {json.dumps({'error': f'Failed to fetch session: {str(e)}'})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")

    # Extract resume data
    resume_data = session_data.get('resume_data')
    if not resume_data:
        async def error_stream():
            yield f"data: {json.dumps({'error': 'No resume data found in session'})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")

    raw_text = resume_data.get('rawText') or resume_data.get('raw_text', '')
    if not raw_text:
        async def error_stream():
            yield f"data: {json.dumps({'error': 'No resume text found in session'})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")

    # Extract ATS analysis data
    ats_analysis = resume_data.get('atsAnalysis') or resume_data.get('ats_analysis', {})
    ats_issues = ats_analysis.get('atsIssues') or ats_analysis.get('ats_issues', [])
    keyword_gaps = ats_analysis.get('keywordGaps') or ats_analysis.get('keyword_gaps', [])
    formatting_tips = ats_analysis.get('formattingTips') or ats_analysis.get('formatting_tips', [])
    industry_keywords = ats_analysis.get('industryKeywords') or ats_analysis.get('industry_keywords', {})

    async def stream_generator():
        full_text = ""
        chunk_count = 0
        try:
            print(f"[Resume Stream] Starting streaming generation for session {request.session_id}")
            async for chunk in generate_improved_resume_stream(
                raw_text=raw_text,
                ats_issues=ats_issues,
                keyword_gaps=keyword_gaps,
                formatting_tips=formatting_tips,
                industry_keywords=industry_keywords,
            ):
                chunk_count += 1
                full_text += chunk
                print(f"[Resume Stream] Chunk {chunk_count}: {len(chunk)} chars")
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"

            # Save the complete resume to Firestore
            try:
                db.collection('sessions').document(request.session_id).update({
                    "improved_resume_markdown": full_text
                })
                print(f"[Resume] Auto-saved streamed improved resume to session {request.session_id}")
            except Exception as save_error:
                print(f"[Resume] Warning: Failed to auto-save improved resume: {save_error}")

            # Send completion event
            yield f"data: {json.dumps({'done': True, 'fullText': full_text})}\n\n"

        except Exception as e:
            print(f"[Resume] Streaming error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


@router.get("/resume/improved/{session_id}", response_model=GetImprovedResumeResponse, response_model_by_alias=True)
async def get_improved_resume(
    session_id: str,
    user: AuthenticatedUser = Depends(require_auth),
):
    """Get the saved improved resume for a session.

    Requires authentication. Returns the improved resume markdown if it exists.
    """
    db = get_firestore_client()

    try:
        session_doc = db.collection('sessions').document(session_id).get()
        if not session_doc.exists:
            raise HTTPException(status_code=404, detail="Session not found")

        session_data = session_doc.to_dict()

        # Verify user owns this session
        if session_data.get('user_id') != user.uid:
            raise HTTPException(status_code=403, detail="Unauthorized access to session")

        improved_markdown = session_data.get('improved_resume_markdown')

        return GetImprovedResumeResponse(
            success=True,
            improvedResumeMarkdown=improved_markdown,
            message="Improved resume retrieved" if improved_markdown else "No improved resume found",
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Resume] Failed to get improved resume: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get improved resume: {str(e)}",
        )


@router.put("/resume/improved", response_model=SaveImprovedResumeResponse, response_model_by_alias=True)
async def save_improved_resume(
    request: SaveImprovedResumeRequest,
    user: AuthenticatedUser = Depends(require_auth),
):
    """Save or update the improved resume for a session.

    Requires authentication. Allows users to save their edited resume.
    """
    db = get_firestore_client()

    try:
        session_doc = db.collection('sessions').document(request.session_id).get()
        if not session_doc.exists:
            raise HTTPException(status_code=404, detail="Session not found")

        session_data = session_doc.to_dict()

        # Verify user owns this session
        if session_data.get('user_id') != user.uid:
            raise HTTPException(status_code=403, detail="Unauthorized access to session")

        # Update the improved resume markdown
        db.collection('sessions').document(request.session_id).update({
            "improved_resume_markdown": request.improved_resume_markdown
        })
        print(f"[Resume] Saved improved resume for session {request.session_id}")

        return SaveImprovedResumeResponse(
            success=True,
            message="Improved resume saved successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Resume] Failed to save improved resume: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save improved resume: {str(e)}",
        )


# ============================================================================
# RESUME VERSION MANAGEMENT ENDPOINTS
# ============================================================================


@router.get("/resume/versions", response_model=ResumeVersionListResponse, response_model_by_alias=True)
async def list_resume_versions(
    user: AuthenticatedUser = Depends(require_auth),
):
    """List all resume versions for the current user.

    Returns versions sorted by upload date (newest first), with max 10 versions.
    """
    try:
        versions = await _get_user_resume_versions(user.uid)

        # Get current version ID
        db = get_firestore_client()
        user_doc = db.collection('users').document(user.uid).get()
        current_version_id = None
        if user_doc.exists:
            current_version_id = user_doc.to_dict().get('current_resume_version_id')

        return ResumeVersionListResponse(
            success=True,
            versions=[ResumeVersion(**v) for v in versions],
            currentVersionId=current_version_id,
            message=f"Found {len(versions)} resume versions",
        )
    except Exception as e:
        print(f"[Resume] Failed to list versions: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list resume versions: {str(e)}",
        )


@router.get("/resume/versions/{version_id}/download")
async def get_version_download_url(
    version_id: str,
    user: AuthenticatedUser = Depends(require_auth),
):
    """Get a fresh download URL for a specific resume version.

    URLs expire after 7 days, so this endpoint generates a new one.
    """
    try:
        versions = await _get_user_resume_versions(user.uid)

        # Find the requested version
        version = None
        for v in versions:
            if v.get('version_id') == version_id:
                version = v
                break

        if not version:
            raise HTTPException(status_code=404, detail="Resume version not found")

        # Generate fresh download URL
        storage_path = version.get('storage_path')
        if not storage_path:
            raise HTTPException(status_code=500, detail="Version has no storage path")

        fresh_url = await get_download_url(storage_path)

        return {
            "success": True,
            "downloadUrl": fresh_url,
            "versionId": version_id,
            "fileName": version.get('file_name'),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Resume] Failed to get download URL: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get download URL: {str(e)}",
        )


@router.delete("/resume/versions/{version_id}")
async def delete_resume_version(
    version_id: str,
    user: AuthenticatedUser = Depends(require_auth),
):
    """Delete a specific resume version.

    Cannot delete the current version. User must set a different version as current first.
    """
    db = get_firestore_client()
    user_ref = db.collection('users').document(user.uid)

    try:
        user_doc = user_ref.get()
        if not user_doc.exists:
            raise HTTPException(status_code=404, detail="User not found")

        user_data = user_doc.to_dict()
        current_version_id = user_data.get('current_resume_version_id')

        # Check if trying to delete current version
        if version_id == current_version_id:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the current resume version. Set a different version as current first.",
            )

        # Find the version to delete
        versions = user_data.get('resume_versions', [])
        version_to_delete = None
        for v in versions:
            if v.get('version_id') == version_id:
                version_to_delete = v
                break

        if not version_to_delete:
            raise HTTPException(status_code=404, detail="Resume version not found")

        # Delete from storage
        storage_path = version_to_delete.get('storage_path')
        if storage_path:
            try:
                await delete_resume_file(storage_path)
                print(f"[Resume] Deleted file from storage: {storage_path}")
            except Exception as storage_error:
                print(f"[Resume] Warning: Failed to delete from storage: {storage_error}")

        # Remove from user's version array
        user_ref.update({
            'resume_versions': ArrayRemove([version_to_delete])
        })

        print(f"[Resume] Deleted version {version_id} for user {user.uid}")

        return {
            "success": True,
            "message": "Resume version deleted successfully",
            "versionId": version_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Resume] Failed to delete version: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete resume version: {str(e)}",
        )


@router.post("/resume/set-current/{version_id}", response_model=SetCurrentVersionResponse, response_model_by_alias=True)
async def set_current_version(
    version_id: str,
    user: AuthenticatedUser = Depends(require_auth),
):
    """Set a specific resume version as the current active version."""
    db = get_firestore_client()
    user_ref = db.collection('users').document(user.uid)

    try:
        # Verify version exists
        versions = await _get_user_resume_versions(user.uid)
        version_exists = any(v.get('version_id') == version_id for v in versions)

        if not version_exists:
            raise HTTPException(status_code=404, detail="Resume version not found")

        # Update current version
        user_ref.update({
            'current_resume_version_id': version_id
        })

        print(f"[Resume] Set current version to {version_id} for user {user.uid}")

        return SetCurrentVersionResponse(
            success=True,
            message="Current resume version updated",
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Resume] Failed to set current version: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to set current version: {str(e)}",
        )


@router.post("/resume/improve/pdf", response_model=GenerateImprovedPDFResponse, response_model_by_alias=True)
async def generate_improved_pdf(
    request: GenerateImprovedPDFRequest,
    user: AuthenticatedUser = Depends(require_auth),
):
    """Generate a PDF from the improved resume markdown and optionally set as current.

    Takes the improved_resume_markdown from the session, converts it to PDF,
    uploads to Firebase Storage as a new version, and optionally sets it as current.
    """
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.units import inch
    import markdown as md

    db = get_firestore_client()

    try:
        # Get session
        session_doc = db.collection('sessions').document(request.session_id).get()
        if not session_doc.exists:
            raise HTTPException(status_code=404, detail="Session not found")

        session_data = session_doc.to_dict()

        # Verify ownership
        if session_data.get('user_id') != user.uid:
            raise HTTPException(status_code=403, detail="Unauthorized access to session")

        # Get improved markdown
        improved_markdown = session_data.get('improved_resume_markdown')
        if not improved_markdown:
            raise HTTPException(status_code=400, detail="No improved resume found in session")

        # Get original resume filename for naming
        resume_data = session_data.get('resume_data', {})
        original_filename = resume_data.get('fileName', 'resume')
        if '.' in original_filename:
            base_name = original_filename.rsplit('.', 1)[0]
        else:
            base_name = original_filename

        # Get source version ID if available
        source_version_id = session_data.get('resume_version_id')

        # Convert markdown to PDF
        pdf_buffer = io.BytesIO()
        doc = SimpleDocTemplate(pdf_buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)

        # Get styles
        styles = getSampleStyleSheet()
        normal_style = styles['Normal']
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading1'],
            fontSize=14,
            spaceAfter=12,
            spaceBefore=18,
        )

        # Parse markdown and build PDF content
        story = []

        # Simple markdown to paragraphs conversion
        lines = improved_markdown.split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                story.append(Spacer(1, 6))
            elif line.startswith('# '):
                story.append(Paragraph(line[2:], heading_style))
            elif line.startswith('## '):
                story.append(Paragraph(line[3:], heading_style))
            elif line.startswith('### '):
                story.append(Paragraph(line[4:], heading_style))
            elif line.startswith('- ') or line.startswith('* '):
                story.append(Paragraph(f"• {line[2:]}", normal_style))
            else:
                # Escape special characters and render as paragraph
                line = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                story.append(Paragraph(line, normal_style))

        doc.build(story)

        # Get PDF bytes
        pdf_bytes = pdf_buffer.getvalue()
        pdf_buffer.close()

        # Upload to storage
        improved_filename = f"{base_name}-improved.pdf"
        version_data = await _store_resume_file(
            user_id=user.uid,
            file_content=pdf_bytes,
            file_name=improved_filename,
            content_type='application/pdf',
            session_id=request.session_id,
            is_improved=True,
            source_version_id=source_version_id,
        )

        # If not setting as current, revert to previous current
        if not request.set_as_current and source_version_id:
            user_ref = db.collection('users').document(user.uid)
            user_ref.update({
                'current_resume_version_id': source_version_id
            })

        print(f"[Resume] Generated improved PDF version: {version_data['version_id']}")

        return GenerateImprovedPDFResponse(
            success=True,
            version=ResumeVersion(**version_data),
            message="Improved resume PDF generated successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Resume] Failed to generate improved PDF: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate improved PDF: {str(e)}",
        )
