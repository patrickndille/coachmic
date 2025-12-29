"""Company Intelligence API endpoints."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth_middleware import require_auth, AuthenticatedUser
from app.models.company_intel import (
    GenerateCompanyIntelRequest,
    CompanyIntelResponse,
    CompanyIntel,
)
from app.routers.session import get_user_active_session
from app.services.company_intel_service import (
    generate_company_intel,
    get_cache_expiry,
)
from app.services.firebase_service import get_firestore_client

router = APIRouter(prefix="/api/v1/company", tags=["Company Intelligence"])


@router.get("/intel/saved", response_model=CompanyIntelResponse)
async def get_saved_company_intel(
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Get company intelligence saved in the user's active session.

    This retrieves previously generated company intel from Firestore,
    allowing it to persist across page refreshes.
    """
    try:
        session = await get_user_active_session(user.uid)
        if not session:
            return CompanyIntelResponse(
                success=False,
                error="No active session found",
            )

        company_intel_data = session.get("company_intel")
        if not company_intel_data:
            return CompanyIntelResponse(
                success=False,
                error="No company intelligence saved in session",
            )

        # Parse the saved data back into CompanyIntel model
        try:
            intel = CompanyIntel(**company_intel_data)
            return CompanyIntelResponse(
                success=True,
                intel=intel,
                cached=True,  # It's from Firestore, so it's cached
                cache_expires_at=None,
            )
        except Exception as e:
            print(f"[CompanyIntel API] Error parsing saved intel: {e}")
            return CompanyIntelResponse(
                success=False,
                error="Failed to parse saved company intelligence",
            )

    except Exception as e:
        print(f"[CompanyIntel API] Error retrieving saved intel: {e}")
        return CompanyIntelResponse(
            success=False,
            error=f"Failed to retrieve saved company intelligence: {str(e)}",
        )


@router.get("/intel/job/{job_id}", response_model=CompanyIntelResponse)
async def get_job_company_intel(
    job_id: str,
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Get company intelligence from a saved job.

    This retrieves previously generated company intel from the saved_jobs collection,
    ensuring job-specific intel persists and is tied to the correct job.
    """
    try:
        db = get_firestore_client()
        doc_id = f"{user.uid}_{job_id}"
        doc = db.collection('saved_jobs').document(doc_id).get()

        if not doc.exists:
            return CompanyIntelResponse(
                success=False,
                error="Job not saved",
            )

        data = doc.to_dict()
        company_intel_data = data.get("company_intel")

        if not company_intel_data:
            return CompanyIntelResponse(
                success=False,
                error="No company intelligence saved for this job",
            )

        # Parse the saved data back into CompanyIntel model
        try:
            intel = CompanyIntel(**company_intel_data)
            return CompanyIntelResponse(
                success=True,
                intel=intel,
                cached=True,
                cache_expires_at=None,
            )
        except Exception as e:
            print(f"[CompanyIntel API] Error parsing saved intel: {e}")
            return CompanyIntelResponse(
                success=False,
                error="Failed to parse saved company intelligence",
            )

    except Exception as e:
        print(f"[CompanyIntel API] Error retrieving job intel: {e}")
        return CompanyIntelResponse(
            success=False,
            error=f"Failed to retrieve company intelligence: {str(e)}",
        )


@router.post("/intel", response_model=CompanyIntelResponse)
async def generate_company_intel_endpoint(
    request: GenerateCompanyIntelRequest,
    job_id: Optional[str] = None,
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Generate comprehensive company intelligence for interview preparation.

    Uses Gemini with Google Search grounding to provide real-time company data:
    - Recent news and press releases
    - Leadership changes
    - Strategic initiatives
    - Culture signals
    - Financial health (for public companies)
    - Interview angles and talking points
    - Predicted interview questions
    - STAR story mapping (if resume available)

    Results are cached for 4 hours to optimize costs.
    """
    try:
        # Get resume data if available (for story mapping)
        resume_data = None
        if request.include_story_mapping:
            session = await get_user_active_session(user.uid)
            if session and session.get("resume_data"):
                # Resume data is stored directly in the session
                from app.models.resume import ResumeData
                try:
                    resume_data = ResumeData(**session["resume_data"])
                except Exception as e:
                    print(f"[CompanyIntel API] Error parsing resume data: {e}")

        # Generate intelligence
        intel = await generate_company_intel(
            company_name=request.company_name,
            target_role=request.target_role,
            resume_data=resume_data,
            include_questions=request.include_questions,
            include_story_mapping=request.include_story_mapping and resume_data is not None,
        )

        # Save to saved_jobs if job_id is provided and job is saved
        # Otherwise save to session as fallback for setup wizard context
        try:
            db = get_firestore_client()

            if job_id:
                # Save to specific saved job
                doc_id = f"{user.uid}_{job_id}"
                doc_ref = db.collection('saved_jobs').document(doc_id)
                doc = doc_ref.get()

                if doc.exists:
                    doc_ref.update({
                        "company_intel": intel.model_dump(),
                        "company_intel_generated_at": datetime.utcnow(),
                    })
                    print(f"[CompanyIntel] Saved intel to saved_job {job_id}")
                else:
                    print(f"[CompanyIntel] Job {job_id} not saved, intel not persisted to saved_jobs")
            else:
                # Fallback: save to session for setup wizard context
                session = await get_user_active_session(user.uid)
                if session:
                    db.collection('sessions').document(session['session_id']).update({
                        "company_intel": intel.model_dump()
                    })
                    print(f"[CompanyIntel] Saved intel to session {session['session_id']} (no job_id)")
        except Exception as e:
            print(f"[CompanyIntel] Failed to save intel: {e}")
            # Don't fail the request, just log the error

        # Get cache expiry
        cache_expiry = get_cache_expiry(request.company_name)

        return CompanyIntelResponse(
            success=True,
            intel=intel,
            cached=intel.data_freshness == "cached",
            cache_expires_at=cache_expiry.isoformat() if cache_expiry else None,
        )

    except ValueError as e:
        return CompanyIntelResponse(
            success=False,
            error=str(e),
        )
    except Exception as e:
        print(f"[CompanyIntel API] Error: {e}")
        return CompanyIntelResponse(
            success=False,
            error=f"Failed to generate company intelligence: {str(e)}",
        )


@router.get("/intel/{company_name}", response_model=CompanyIntelResponse)
async def get_cached_company_intel(
    company_name: str,
    target_role: Optional[str] = None,
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Get company intelligence, generating if not cached.

    This is a convenience endpoint that checks cache first.
    If no cached data exists, it generates fresh intelligence.
    """
    try:
        # Get resume data if available
        resume_data = None
        session = await get_user_active_session(user.uid)
        if session and session.get("resume_data"):
            from app.models.resume import ResumeData
            try:
                resume_data = ResumeData(**session["resume_data"])
            except Exception as e:
                print(f"[CompanyIntel API] Error parsing resume data: {e}")

        # Generate/retrieve intelligence
        intel = await generate_company_intel(
            company_name=company_name,
            target_role=target_role,
            resume_data=resume_data,
            include_questions=True,
            include_story_mapping=resume_data is not None,
        )

        cache_expiry = get_cache_expiry(company_name)

        return CompanyIntelResponse(
            success=True,
            intel=intel,
            cached=intel.data_freshness == "cached",
            cache_expires_at=cache_expiry.isoformat() if cache_expiry else None,
        )

    except Exception as e:
        print(f"[CompanyIntel API] Error: {e}")
        return CompanyIntelResponse(
            success=False,
            error=f"Failed to get company intelligence: {str(e)}",
        )


@router.post("/intel/refresh/{company_name}", response_model=CompanyIntelResponse)
async def refresh_company_intel(
    company_name: str,
    target_role: Optional[str] = None,
    job_id: Optional[str] = None,
    user: AuthenticatedUser = Depends(require_auth),
):
    """
    Force refresh company intelligence, ignoring cache.

    Use this when the user wants the latest data.
    """
    from app.services.company_intel_service import _intel_cache, _get_cache_key

    try:
        # Clear cache for this company
        cache_key = _get_cache_key(company_name)
        if cache_key in _intel_cache:
            del _intel_cache[cache_key]
            print(f"[CompanyIntel API] Cleared cache for '{company_name}'")

        # Get resume data if available
        resume_data = None
        session = await get_user_active_session(user.uid)
        if session and session.get("resume_data"):
            from app.models.resume import ResumeData
            try:
                resume_data = ResumeData(**session["resume_data"])
            except Exception as e:
                print(f"[CompanyIntel API] Error parsing resume data: {e}")

        # Generate fresh intelligence
        intel = await generate_company_intel(
            company_name=company_name,
            target_role=target_role,
            resume_data=resume_data,
            include_questions=True,
            include_story_mapping=resume_data is not None,
        )

        # Save refreshed intel to saved_jobs or session
        try:
            db = get_firestore_client()

            if job_id:
                # Save to specific saved job
                doc_id = f"{user.uid}_{job_id}"
                doc_ref = db.collection('saved_jobs').document(doc_id)
                doc = doc_ref.get()

                if doc.exists:
                    doc_ref.update({
                        "company_intel": intel.model_dump(),
                        "company_intel_generated_at": datetime.utcnow(),
                    })
                    print(f"[CompanyIntel] Saved refreshed intel to saved_job {job_id}")
                else:
                    print(f"[CompanyIntel] Job {job_id} not saved, refreshed intel not persisted")
            elif session:
                # Fallback: save to session
                db.collection('sessions').document(session['session_id']).update({
                    "company_intel": intel.model_dump()
                })
                print(f"[CompanyIntel] Saved refreshed intel to session {session['session_id']}")
        except Exception as e:
            print(f"[CompanyIntel] Failed to save refreshed intel: {e}")

        cache_expiry = get_cache_expiry(company_name)

        return CompanyIntelResponse(
            success=True,
            intel=intel,
            cached=False,
            cache_expires_at=cache_expiry.isoformat() if cache_expiry else None,
        )

    except Exception as e:
        print(f"[CompanyIntel API] Error: {e}")
        return CompanyIntelResponse(
            success=False,
            error=f"Failed to refresh company intelligence: {str(e)}",
        )
