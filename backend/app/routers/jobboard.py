"""Job board and career matching endpoints."""

import json
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from fastapi import APIRouter, Header, HTTPException, Depends
from fastapi.responses import StreamingResponse

from app.middleware.auth_middleware import require_auth, AuthenticatedUser
from app.models.job import (
    FitAnalysis,
    InterviewPrepPlan,
    JobDetailResponse,
    JobMatch,
    JobPosting,
    JobSearchRequest,
    JobSearchResponse,
)
from app.models.resume import ResumeData
from app.routers.session import get_user_active_session
from app.services.job_matcher import (
    analyze_career_trajectory,
    analyze_job_fit,
    generate_career_advice,
    generate_interview_prep_plan,
    match_resume_to_jobs,
)
from app.services.jobboard_service import get_job_board_service
from app.services.firebase_service import get_firestore_client
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter()


def _get_resume_from_session(session_id: Optional[str]) -> Optional[ResumeData]:
    """Get resume data from session if available. Checks Firestore only."""
    if not session_id:
        print(f"[JobBoard] No session_id provided")
        return None

    # Get session from Firestore
    try:
        db = get_firestore_client()
        doc = db.collection('sessions').document(session_id).get()
        if not doc.exists:
            print(f"[JobBoard] Session not found in Firestore: {session_id}")
            return None

        session_data = doc.to_dict()
        print(f"[JobBoard] Found session in Firestore: {session_id}")
    except Exception as e:
        print(f"[JobBoard] Firestore lookup failed: {e}")
        return None

    resume_dict = session_data.get("resume_data")
    if not resume_dict:
        print(f"[JobBoard] No resume_data in session: {session_id}")
        return None

    print(f"[JobBoard] Found resume data for session: {session_id}")
    try:
        return ResumeData(**resume_dict)
    except Exception as e:
        print(f"[JobBoard] Failed to parse resume data: {e}")
        return None


@router.post("/jobs/search", response_model=JobSearchResponse)
async def search_jobs(
    request: JobSearchRequest,
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Search for jobs and get AI-powered match analysis.

    Returns personalized fit analysis and career advice based on user's resume.
    Uses JSearch API for real job listings.
    Requires authentication.
    """
    job_service = get_job_board_service()

    # Search jobs (now uses JSearch when available)
    jobs = await job_service.search_jobs(
        query=request.query,
        skills=request.skills,
        location=request.location,
        remote_only=request.remote_only,
        experience_level=request.experience_level,
        salary_min=request.salary_min,
        limit=request.limit,
        country=request.country,
        date_posted=request.date_posted,
        employment_type=request.employment_type,
    )

    if not jobs:
        return JobSearchResponse(
            jobs=[],
            total_count=0,
            career_advice=None,
        )

    # Get user's active session and resume data
    session = await get_user_active_session(user.uid)
    resume_data = _get_resume_from_session(session['session_id']) if session else None

    if resume_data:
        # Perform AI matching with resume context
        matched_jobs = await match_resume_to_jobs(
            resume_data=resume_data,
            jobs=jobs,
            include_trajectory=True,
        )

        # Generate career advice
        career_advice = await generate_career_advice(resume_data, matched_jobs)

        # Save search jobs results to session for persistence
        try:
            db = get_firestore_client()
            session_id = session['session_id']

            # Build task_meta for audit trail (camelCase keys)
            task_meta = {
                "jsearchParams": {
                    "query": request.query,
                    "location": request.location,
                    "remoteOnly": request.remote_only,
                    "country": request.country,
                    "datePosted": request.date_posted,
                    "employmentType": request.employment_type,
                    "experienceLevel": request.experience_level,
                    "salaryMin": request.salary_min,
                    "limit": request.limit,
                },
                "jsearchResultsCount": len(jobs),
                "aiMatchingScores": [
                    {"jobId": job.job.job_id, "score": job.fit_analysis.overall_match}
                    for job in matched_jobs
                ],
            }

            # Use camelCase keys to match frontend TypeScript interfaces
            search_jobs_data = {
                "jobs": [job.model_dump(by_alias=True) for job in matched_jobs],
                "careerAdvice": career_advice.model_dump(by_alias=True) if career_advice else None,
                "lastQuery": request.query or "",
                "filters": {
                    "remoteOnly": request.remote_only,
                    "country": request.country or "us",
                    "stateProvince": request.location or "",
                    "city": "",
                    "datePosted": request.date_posted or "all",
                    "employmentType": request.employment_type or "",
                    "experienceLevel": request.experience_level or "",
                    "salaryMin": request.salary_min,
                },
                "generatedAt": datetime.utcnow(),
                "taskMeta": task_meta,
            }

            db.collection('sessions').document(session_id).update({
                "search_jobs": search_jobs_data
            })
            print(f"[JobBoard] Saved search jobs ({len(matched_jobs)} jobs) to session {session_id}")
        except Exception as e:
            # Log but don't fail the request if save fails
            print(f"[JobBoard] Warning: Failed to save search jobs to session: {e}")

        return JobSearchResponse(
            jobs=matched_jobs,
            total_count=len(matched_jobs),
            career_advice=career_advice,
        )
    else:
        # Return jobs without personalized matching
        job_matches = [
            JobMatch(
                job=job,
                fit_analysis={
                    "overall_match": 0,
                    "skill_match": 0,
                    "experience_match": 0,
                    "strengths_for_role": [],
                    "potential_concerns": ["Upload resume for personalized matching"],
                    "interview_focus_areas": [],
                    "preparation_priority": [],
                    "skill_matches": [],
                },
                career_trajectory=None,
            )
            for job in jobs
        ]

        return JobSearchResponse(
            jobs=job_matches,
            total_count=len(job_matches),
            career_advice=None,
        )


@router.get("/jobs/recommended", response_model=JobSearchResponse)
async def get_recommended_jobs(
    limit: int = 5,
    country: Optional[str] = None,
    target_role: Optional[str] = None,
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Get AI-recommended jobs based on resume profile.

    Requires authentication and an active session with uploaded resume.
    Uses JSearch API for real job listings with smart query optimization.
    
    Query Parameters:
        limit: Maximum number of jobs to return (default: 5)
        country: Country code for job search (e.g., 'us', 'uk', 'ca')
        target_role: Optional user-specified target role to override AI suggestions
                     (e.g., 'Software Engineer', 'Data Scientist')
    """
    # Get user's active session
    session = await get_user_active_session(user.uid)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No active session found. Please complete setup first.",
        )

    resume_data = _get_resume_from_session(session['session_id'])

    if not resume_data:
        raise HTTPException(
            status_code=400,
            detail="Resume required for job recommendations. Please upload a resume first.",
        )

    job_service = get_job_board_service()

    # Get experience years from career signals
    experience_years = None
    if resume_data.career_signals:
        experience_years = resume_data.career_signals.years_experience

    # Get recommended jobs with smart query optimization
    # User-specified target_role takes priority over AI suggestions
    jobs = await job_service.get_recommended_jobs(
        skills=resume_data.skills,
        experience_years=experience_years,
        preferred_roles=resume_data.suggested_roles,
        limit=limit,
        resume_data=resume_data,
        country=country,
        user_target_role=target_role,
    )

    # Perform AI matching
    matched_jobs = await match_resume_to_jobs(
        resume_data=resume_data,
        jobs=jobs,
        include_trajectory=True,
    )

    # Generate career advice
    career_advice = await generate_career_advice(resume_data, matched_jobs)

    # Save AI discovery results to session for persistence
    try:
        db = get_firestore_client()
        session_id = session['session_id']

        # Build task_meta for audit trail
        # Use camelCase keys to match frontend TypeScript interfaces
        task_meta = {
            "resumeSkillsExtracted": resume_data.skills[:20] if resume_data.skills else [],
            "suggestedRolesFromResume": resume_data.suggested_roles[:5] if resume_data.suggested_roles else [],
            "queryGenerated": target_role or (resume_data.suggested_roles[0] if resume_data.suggested_roles else ""),
            "jsearchParams": {
                "limit": limit,
                "country": country,
                "targetRole": target_role,
            },
            "jsearchResultsCount": len(jobs),
            "aiMatchingScores": [
                {"jobId": job.job.job_id, "score": job.fit_analysis.overall_match}
                for job in matched_jobs
            ],
        }

        ai_discovery_data = {
            "jobs": [job.model_dump(by_alias=True) for job in matched_jobs],
            "careerAdvice": career_advice.model_dump(by_alias=True) if career_advice else None,
            "generatedAt": datetime.utcnow(),
            "taskMeta": task_meta,
        }

        db.collection('sessions').document(session_id).update({
            "ai_discovery": ai_discovery_data
        })
        print(f"[JobBoard] Saved AI discovery ({len(matched_jobs)} jobs) to session {session_id}")
    except Exception as e:
        # Log but don't fail the request if save fails
        print(f"[JobBoard] Warning: Failed to save AI discovery to session: {e}")

    return JobSearchResponse(
        jobs=matched_jobs,
        total_count=len(matched_jobs),
        career_advice=career_advice,
    )


@router.get("/jobs/{job_id}", response_model=JobDetailResponse)
async def get_job_details(
    job_id: str,
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Get detailed job information with fit analysis.

    Requires authentication. Includes personalized fit analysis if user has uploaded resume.
    Also checks saved_jobs collection for job data when not in JSearch cache.
    """
    job_service = get_job_board_service()
    job = await job_service.get_job_by_id(job_id, user_id=user.uid)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get user's active session and resume data
    session = await get_user_active_session(user.uid)
    resume_data = _get_resume_from_session(session['session_id']) if session else None

    if resume_data:
        # Generate personalized fit analysis
        fit_analysis = await analyze_job_fit(resume_data, job)
        career_trajectory = await analyze_career_trajectory(resume_data, job)

        return JobDetailResponse(
            job=job,
            fit_analysis=fit_analysis,
            career_trajectory=career_trajectory,
        )
    else:
        return JobDetailResponse(
            job=job,
            fit_analysis=None,
            career_trajectory=None,
        )


@router.post("/jobs/{job_id}/prepare", response_model=InterviewPrepPlan)
async def prepare_for_job(
    job_id: str,
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Generate a customized interview preparation plan for a specific job.

    Requires authentication and an active session with uploaded resume.
    """
    # Get user's active session
    session = await get_user_active_session(user.uid)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No active session found. Please complete setup first.",
        )

    resume_data = _get_resume_from_session(session['session_id'])

    if not resume_data:
        raise HTTPException(
            status_code=400,
            detail="Resume required for interview preparation. Please upload a resume first.",
        )

    job_service = get_job_board_service()
    job = await job_service.get_job_by_id(job_id, user_id=user.uid)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Generate interview prep plan
    prep_plan = await generate_interview_prep_plan(resume_data, job)

    return prep_plan


@router.get("/jobs/{job_id}/match", response_model=JobMatch)
async def get_job_match(
    job_id: str,
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Get full match analysis for a specific job.

    First checks saved_jobs for cached fit_analysis (fast path).
    Falls back to generating new analysis if not saved (requires session + resume).
    """
    # First, check if this job is in user's saved_jobs with cached fit_analysis
    try:
        db = get_firestore_client()
        saved_doc = db.collection('saved_jobs').document(f"{user.uid}_{job_id}").get()

        if saved_doc.exists:
            saved_data = saved_doc.to_dict()
            job_data = saved_data.get('job_data')
            cached_fit = saved_data.get('fit_analysis') or saved_data.get('fitAnalysis')

            if job_data and cached_fit:
                print(f"[JobMatch] Using cached fit_analysis from saved_jobs for {job_id}")
                # Return cached data without regenerating
                job = JobPosting(**job_data)
                fit_analysis = FitAnalysis(
                    overall_match=cached_fit.get('overallMatch', cached_fit.get('overall_match', 0)),
                    skill_match=cached_fit.get('skillMatch', cached_fit.get('skill_match', 0)),
                    experience_match=cached_fit.get('experienceMatch', cached_fit.get('experience_match', 0)),
                    culture_signals=cached_fit.get('cultureSignals', cached_fit.get('culture_signals')),
                    strengths_for_role=cached_fit.get('strengthsForRole', cached_fit.get('strengths_for_role', [])),
                    potential_concerns=cached_fit.get('potentialConcerns', cached_fit.get('potential_concerns', [])),
                    interview_focus_areas=cached_fit.get('interviewFocusAreas', cached_fit.get('interview_focus_areas', [])),
                    preparation_priority=cached_fit.get('preparationPriority', cached_fit.get('preparation_priority', [])),
                    skill_matches=cached_fit.get('skillMatches', cached_fit.get('skill_matches', [])),
                )

                # Convert datetime fields to ISO strings for serialization
                applied_at = saved_data.get('applied_at')
                if applied_at and hasattr(applied_at, 'isoformat'):
                    applied_at = applied_at.isoformat()

                cover_letter_at = saved_data.get('cover_letter_generated_at')
                if cover_letter_at and hasattr(cover_letter_at, 'isoformat'):
                    cover_letter_at = cover_letter_at.isoformat()

                company_intel_at = saved_data.get('company_intel_generated_at')
                if company_intel_at and hasattr(company_intel_at, 'isoformat'):
                    company_intel_at = company_intel_at.isoformat()

                return JobMatch(
                    job=job,
                    fit_analysis=fit_analysis,
                    career_trajectory=None,  # Could cache this too if needed
                    saved=True,
                    applied=saved_data.get('applied', False),
                    cover_letter=saved_data.get('cover_letter'),
                    cover_letter_generated_at=cover_letter_at,
                    application_status=saved_data.get('status', 'saved'),
                    applied_at=applied_at,
                    company_intel=saved_data.get('company_intel'),
                    company_intel_generated_at=company_intel_at,
                )
    except Exception as e:
        print(f"[JobMatch] Could not check saved_jobs: {e}")

    # Not in saved_jobs with cached data, proceed with normal flow
    # Get user's active session
    session = await get_user_active_session(user.uid)
    if not session:
        raise HTTPException(
            status_code=400,
            detail="No active session found. Please complete setup first.",
        )

    resume_data = _get_resume_from_session(session['session_id'])

    if not resume_data:
        raise HTTPException(
            status_code=400,
            detail="Resume required for job matching. Please upload a resume first.",
        )

    job_service = get_job_board_service()
    job = await job_service.get_job_by_id(job_id, user_id=user.uid)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Generate fit analysis and career trajectory
    fit_analysis = await analyze_job_fit(resume_data, job)
    career_trajectory = await analyze_career_trajectory(resume_data, job)

    return JobMatch(
        job=job,
        fit_analysis=fit_analysis,
        career_trajectory=career_trajectory,
    )


class SaveJobRequest(BaseModel):
    """Request body for saving a job with optional pre-computed data."""
    fit_analysis: Optional[dict] = None  # Accept cached fit analysis from frontend
    job_data: Optional[dict] = None  # Accept full job data from frontend (avoids lookup)
    company_intel: Optional[dict] = None  # Accept company intel for job-specific persistence


@router.post("/jobs/{job_id}/save")
async def save_job(
    job_id: str,
    request: Optional[SaveJobRequest] = None,
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Save a job for later.

    Creates a bookmark for the job associated with the authenticated user.
    Uses provided job_data if available (avoids lookup).
    Uses provided fit_analysis if available (avoids AI call).
    """
    try:
        db = get_firestore_client()

        job = None
        job_dict_for_storage = None

        print(f"[SavedJobs] Saving job {job_id}, request body: {request}")

        # Use provided job data from frontend if available (avoids lookup)
        if request and request.job_data:
            print(f"[SavedJobs] Using provided job_data from frontend for {job_id}")
            try:
                job = JobPosting(**request.job_data)
                job_dict_for_storage = request.job_data  # Use the raw dict for storage
            except Exception as e:
                print(f"[SavedJobs] Failed to parse provided job_data: {e}")
                import traceback
                traceback.print_exc()
                # Still use the raw data for storage even if parsing fails
                job_dict_for_storage = request.job_data

        # Fall back to looking up the job if not provided
        if not job and not job_dict_for_storage:
            print(f"[SavedJobs] No job_data provided, looking up job {job_id}")
            job_service = get_job_board_service()
            job = await job_service.get_job_by_id(job_id, user_id=user.uid)

        if not job and not job_dict_for_storage:
            print(f"[SavedJobs] Job {job_id} not found in cache or saved_jobs")
            raise HTTPException(status_code=404, detail="Job not found. Please provide job data when saving.")

        # Use provided fit analysis from frontend if available (avoids AI call)
        fit_analysis_dict = None
        if request and request.fit_analysis:
            print(f"[SavedJobs] Using provided fit_analysis from frontend for {job_id}")
            fit_analysis_dict = request.fit_analysis
        elif job:
            # Generate fit analysis only if not provided AND we have a parsed job object
            try:
                # Get user's active session for resume data
                session = await get_user_active_session(user.uid)
                if session:
                    resume_data = _get_resume_from_session(session['session_id'])
                    if resume_data:
                        print(f"[SavedJobs] Generating new fit_analysis for {job_id}")
                        fit_analysis = await analyze_job_fit(resume_data, job)
                        fit_analysis_dict = fit_analysis.model_dump(by_alias=True)
            except Exception as e:
                print(f"[SavedJobs] Could not generate fit analysis: {e}")
                # Continue without fit analysis
        else:
            print(f"[SavedJobs] Skipping fit_analysis generation - no parsed job object")
        
        # Save to Firestore with full job data
        from datetime import datetime

        # Get the job dict for storage - prefer parsed job, fall back to raw dict
        if job:
            job_dict = job.model_dump(by_alias=True)
            apply_link = job.url
        else:
            job_dict = job_dict_for_storage
            apply_link = job_dict_for_storage.get('url') if job_dict_for_storage else None

        save_data = {
            'user_id': user.uid,
            'job_id': job_id,
            'job_data': job_dict,  # Store full job data for JSearch jobs
            'apply_link': apply_link,  # Store apply link separately for easy access
            'saved_at': datetime.utcnow(),
            'applied': False,  # Track if user has applied
        }

        # Store fit analysis if we got one
        if fit_analysis_dict:
            save_data['fit_analysis'] = fit_analysis_dict

        # Store company intel if provided
        if request and request.company_intel:
            save_data['company_intel'] = request.company_intel
            save_data['company_intel_generated_at'] = datetime.utcnow()
            print(f"[SavedJobs] Including company_intel for job {job_id}")

        db.collection('saved_jobs').document(f"{user.uid}_{job_id}").set(save_data)
        print(f"[SavedJobs] Successfully saved job {job_id}")

        return {'success': True, 'message': 'Job saved successfully'}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[SavedJobs] Error saving job: {e}")
        raise HTTPException(status_code=500, detail="Failed to save job")


@router.delete("/jobs/{job_id}/save")
async def unsave_job(
    job_id: str,
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Remove a saved job.

    Removes the bookmark for the job associated with the authenticated user.
    """
    try:
        db = get_firestore_client()
        db.collection('saved_jobs').document(f"{user.uid}_{job_id}").delete()

        return {'success': True, 'message': 'Job removed from saved list'}
    except Exception as e:
        print(f"[SavedJobs] Error removing job: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove saved job")


@router.post("/jobs/{job_id}/apply")
async def mark_job_applied(
    job_id: str,
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Mark a job as applied.

    If the job is not already saved, it will be auto-saved first with fit analysis.
    Updates the applied status for tracking purposes.
    """
    try:
        db = get_firestore_client()
        doc_ref = db.collection('saved_jobs').document(f"{user.uid}_{job_id}")

        # Check if job is saved
        doc = doc_ref.get()

        if not doc.exists:
            # Job not saved yet - auto-save it first
            print(f"[SavedJobs] Job {job_id} not saved, auto-saving before marking applied")

            # Get job data
            job_service = get_job_board_service()
            job = await job_service.get_job_by_id(job_id, user_id=user.uid)

            if not job:
                raise HTTPException(status_code=404, detail="Job not found")

            # Try to generate fit analysis
            fit_analysis_dict = None
            try:
                session = await get_user_active_session(user.uid)
                if session:
                    resume_data = _get_resume_from_session(session['session_id'])
                    if resume_data:
                        fit_analysis = await analyze_job_fit(resume_data, job)
                        fit_analysis_dict = fit_analysis.model_dump(by_alias=True)
            except Exception as e:
                print(f"[SavedJobs] Could not generate fit analysis for auto-save: {e}")

            # Save the job
            job_dict = job.model_dump(by_alias=True)
            save_data = {
                'user_id': user.uid,
                'job_id': job_id,
                'job_data': job_dict,
                'apply_link': job.url,
                'saved_at': datetime.utcnow(),
                'applied': True,
                'applied_at': datetime.utcnow(),
                'auto_saved': True,
                'status': 'applied',
            }

            if fit_analysis_dict:
                save_data['fit_analysis'] = fit_analysis_dict

            doc_ref.set(save_data)
            print(f"[SavedJobs] Auto-saved and marked job {job_id} as applied")
        else:
            # Job already saved - just update applied status
            doc_ref.update({
                'applied': True,
                'applied_at': datetime.utcnow(),
                'status': 'applied',
            })
            print(f"[SavedJobs] Marked existing saved job {job_id} as applied")

        return {'success': True, 'message': 'Job marked as applied'}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[SavedJobs] Error marking job as applied: {e}")
        raise HTTPException(status_code=500, detail="Failed to update job status")


# ============================================================================
# COVER LETTER GENERATION
# ============================================================================

class CoverLetterRequest(BaseModel):
    """Request body for cover letter generation."""
    job_data: JobPosting
    resume_markdown: str
    target_role: Optional[str] = None
    target_company: Optional[str] = None


class CoverLetterResponse(BaseModel):
    """Response for cover letter generation."""
    cover_letter: str
    job_saved: bool
    saved_job_id: Optional[str] = None


@router.post("/jobs/{job_id}/cover-letter", response_model=CoverLetterResponse)
async def generate_cover_letter_endpoint(
    job_id: str,
    request: CoverLetterRequest,
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Generate a personalized cover letter for a job application (non-streaming).
    
    This will:
    1. Generate a cover letter using AI based on the job and resume
    2. Auto-save the job if not already saved (with cover letter attached)
    3. Return the generated cover letter
    
    Note: For streaming response, use /jobs/{job_id}/cover-letter/stream instead.
    """
    try:
        from app.services.cover_letter_service import generate_cover_letter_stream
        
        print(f"[CoverLetter] Generating for job {job_id} for user {user.uid}")
        
        # Generate cover letter by collecting all stream chunks
        cover_letter_chunks = []
        async for chunk in generate_cover_letter_stream(
            job=request.job_data,
            resume_markdown=request.resume_markdown,
            target_role=request.target_role,
            target_company=request.target_company,
        ):
            cover_letter_chunks.append(chunk)
        
        cover_letter = "".join(cover_letter_chunks)
        
        # Check if job is already saved
        db = get_firestore_client()
        doc_ref = db.collection('saved_jobs').document(f"{user.uid}_{job_id}")
        doc = doc_ref.get()
        
        job_saved = False
        
        if doc.exists:
            # Update existing saved job with cover letter
            doc_ref.update({
                'cover_letter': cover_letter,
                'cover_letter_generated_at': datetime.utcnow(),
            })
            print(f"[CoverLetter] Updated existing saved job with cover letter")
        else:
            # Auto-save the job with cover letter
            doc_ref.set({
                'user_id': user.uid,
                'job_id': job_id,
                'job_data': request.job_data.model_dump(),
                'saved_at': datetime.utcnow(),
                'auto_saved': True,
                'explicitly_saved': False,
                'cover_letter': cover_letter,
                'cover_letter_generated_at': datetime.utcnow(),
                'applied': False,
                'status': 'saved',
            })
            job_saved = True
            print(f"[CoverLetter] Auto-saved job with cover letter")
        
        return CoverLetterResponse(
            cover_letter=cover_letter,
            job_saved=job_saved,
            saved_job_id=f"{user.uid}_{job_id}",
        )
        
    except Exception as e:
        print(f"[CoverLetter] Error generating cover letter: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to generate cover letter")


@router.post("/jobs/{job_id}/cover-letter/stream")
async def generate_cover_letter_stream_endpoint(
    job_id: str,
    request: CoverLetterRequest,
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Generate a personalized cover letter with streaming output.
    
    Uses Server-Sent Events (SSE) to stream the cover letter as it's generated.
    
    Event format:
    - data: {"chunk": "text..."} for each text chunk
    - data: {"done": true, "fullText": "...", "jobSaved": true/false} when complete
    - data: {"error": "message"} on error
    """
    from app.services.cover_letter_service import generate_cover_letter_stream
    
    async def stream_generator():
        full_text = ""
        chunk_count = 0
        
        try:
            print(f"[CoverLetter Stream] Starting for job {job_id}, user {user.uid}")
            
            async for chunk in generate_cover_letter_stream(
                job=request.job_data,
                resume_markdown=request.resume_markdown,
                target_role=request.target_role,
                target_company=request.target_company,
            ):
                chunk_count += 1
                full_text += chunk
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            
            print(f"[CoverLetter Stream] Completed with {chunk_count} chunks, {len(full_text)} chars")
            
            # Save the job with cover letter
            job_saved = False
            try:
                db = get_firestore_client()
                doc_ref = db.collection('saved_jobs').document(f"{user.uid}_{job_id}")
                doc = doc_ref.get()
                
                if doc.exists:
                    doc_ref.update({
                        'cover_letter': full_text,
                        'cover_letter_generated_at': datetime.utcnow(),
                    })
                else:
                    doc_ref.set({
                        'user_id': user.uid,
                        'job_id': job_id,
                        'job_data': request.job_data.model_dump(),
                        'saved_at': datetime.utcnow(),
                        'auto_saved': True,
                        'explicitly_saved': False,
                        'cover_letter': full_text,
                        'cover_letter_generated_at': datetime.utcnow(),
                        'applied': False,
                        'status': 'saved',
                    })
                    job_saved = True
                print(f"[CoverLetter Stream] Saved to Firestore")
            except Exception as save_error:
                print(f"[CoverLetter Stream] Failed to save: {save_error}")
            
            # Send completion event
            yield f"data: {json.dumps({'done': True, 'fullText': full_text, 'jobSaved': job_saved, 'savedJobId': f'{user.uid}_{job_id}'})}\n\n"
            
        except Exception as e:
            print(f"[CoverLetter Stream] Error: {e}")
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


class UpdateJobStatusRequest(BaseModel):
    """Request body for updating job application status."""
    status: str  # 'saved' | 'applied' | 'interviewing' | 'offered' | 'rejected' | 'ghosted'
    notes: Optional[str] = None
    follow_up_date: Optional[str] = None


@router.patch("/jobs/{job_id}/status")
async def update_job_status(
    job_id: str,
    request: UpdateJobStatusRequest,
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Update the application status for a saved job.
    """
    try:
        valid_statuses = ['saved', 'applied', 'interviewing', 'offered', 'rejected', 'ghosted']
        if request.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        
        db = get_firestore_client()
        doc_ref = db.collection('saved_jobs').document(f"{user.uid}_{job_id}")
        
        # Check if job exists
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Job not found in saved list")
        
        # Update status
        update_data = {
            'status': request.status,
            'status_updated_at': datetime.utcnow(),
        }
        
        if request.notes is not None:
            update_data['notes'] = request.notes
        
        if request.follow_up_date is not None:
            update_data['follow_up_date'] = request.follow_up_date
        
        # If status is 'applied', also set applied = True
        if request.status == 'applied':
            update_data['applied'] = True
            update_data['applied_at'] = datetime.utcnow()
        
        doc_ref.update(update_data)
        
        return {'success': True, 'message': f'Status updated to {request.status}'}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[SavedJobs] Error updating job status: {e}")
        raise HTTPException(status_code=500, detail="Failed to update job status")


@router.get("/jobs/saved/list", response_model=JobSearchResponse)
async def get_saved_jobs(
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Get all saved jobs for the authenticated user.

    Returns saved jobs quickly without AI analysis (for fast page loads).
    Jobs include any cached match data from when they were saved.
    """
    try:
        db = get_firestore_client()

        # Get all saved jobs for this user
        saved_docs = db.collection('saved_jobs')\
            .where(filter=FieldFilter('user_id', '==', user.uid))\
            .order_by('saved_at', direction='DESCENDING')\
            .stream()

        saved_items = [doc.to_dict() for doc in saved_docs]

        if not saved_items:
            return JobSearchResponse(
                jobs=[],
                total_count=0,
                career_advice=None,
            )

        # Build job matches from stored data (no AI calls needed)
        job_matches = []
        for item in saved_items:
            job_id = item.get('job_id')
            job_data = item.get('job_data')
            
            if not job_data:
                print(f"[SavedJobs] Skipping job {job_id}: no job_data stored")
                continue
                
            try:
                job = JobPosting(**job_data)
                
                # Use cached fit_analysis if available, otherwise use placeholder
                cached_fit = item.get('fit_analysis') or item.get('fitAnalysis')
                
                if cached_fit:
                    # Use cached analysis from when job was saved
                    fit_analysis = FitAnalysis(
                        overall_match=cached_fit.get('overallMatch', cached_fit.get('overall_match', 0)),
                        skill_match=cached_fit.get('skillMatch', cached_fit.get('skill_match', 0)),
                        experience_match=cached_fit.get('experienceMatch', cached_fit.get('experience_match', 0)),
                        culture_signals=cached_fit.get('cultureSignals', cached_fit.get('culture_signals')),
                        strengths_for_role=cached_fit.get('strengthsForRole', cached_fit.get('strengths_for_role', [])),
                        potential_concerns=cached_fit.get('potentialConcerns', cached_fit.get('potential_concerns', [])),
                        interview_focus_areas=cached_fit.get('interviewFocusAreas', cached_fit.get('interview_focus_areas', [])),
                        preparation_priority=cached_fit.get('preparationPriority', cached_fit.get('preparation_priority', [])),
                        skill_matches=cached_fit.get('skillMatches', cached_fit.get('skill_matches', [])),
                    )
                else:
                    # Placeholder for jobs without cached analysis
                    fit_analysis = FitAnalysis(
                        overall_match=0,
                        skill_match=0,
                        experience_match=0,
                        strengths_for_role=[],
                        potential_concerns=[],
                        interview_focus_areas=[],
                        preparation_priority=[],
                        skill_matches=[],
                    )
                
                # Build JobMatch with metadata from saved_jobs document
                # Convert datetime objects to ISO strings for JSON serialization
                cover_letter_at = item.get('cover_letter_generated_at')
                if cover_letter_at and hasattr(cover_letter_at, 'isoformat'):
                    cover_letter_at = cover_letter_at.isoformat()
                
                applied_at = item.get('applied_at')
                if applied_at and hasattr(applied_at, 'isoformat'):
                    applied_at = applied_at.isoformat()

                company_intel_at = item.get('company_intel_generated_at')
                if company_intel_at and hasattr(company_intel_at, 'isoformat'):
                    company_intel_at = company_intel_at.isoformat()

                job_match = JobMatch(
                    job=job,
                    fit_analysis=fit_analysis,
                    career_trajectory=None,
                    saved=True,
                    applied=item.get('applied', False),
                    cover_letter=item.get('cover_letter'),
                    cover_letter_generated_at=cover_letter_at,
                    application_status=item.get('status', 'saved'),
                    applied_at=applied_at,
                    company_intel=item.get('company_intel'),
                    company_intel_generated_at=company_intel_at,
                )
                job_matches.append(job_match)
                
            except Exception as e:
                print(f"[SavedJobs] Failed to load job {job_id}: {e}")
                continue

        return JobSearchResponse(
            jobs=job_matches,
            total_count=len(job_matches),
            career_advice=None,  # Skip AI-generated advice for fast loading
        )
    except Exception as e:
        print(f"[SavedJobs] Error retrieving saved jobs: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to retrieve saved jobs")
