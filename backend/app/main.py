"""CoachMic - FastAPI Application Entry Point."""

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from google.cloud.firestore_v1.base_query import FieldFilter

from app.config import get_settings
from app.routers import auth, coach, company_intel, feedback, interview, jobboard, resume, session, stt, text_interview
from app.services.firebase_service import initialize_firebase

settings = get_settings()

# Session expiration settings
SESSION_EXPIRY_HOURS = 24
CLEANUP_INTERVAL_MINUTES = 30


async def cleanup_expired_sessions():
    """Background task to clean up expired sessions from Firestore."""
    while True:
        try:
            from app.services.firebase_service import get_firestore_client

            now = datetime.utcnow()
            cutoff_time = now - timedelta(hours=SESSION_EXPIRY_HOURS)
            expired_count = 0

            # Query Firestore for expired sessions
            db = get_firestore_client()
            expired_docs = db.collection('sessions')\
                .where(filter=FieldFilter('created_at', '<', cutoff_time))\
                .stream()

            # Delete expired sessions
            for doc in expired_docs:
                session_id = doc.id
                db.collection('sessions').document(session_id).delete()

                # Also clean up related feedback data from Firestore
                try:
                    db.collection('feedback').document(session_id).delete()
                    print(f"[Cleanup] Removed feedback for session: {session_id}")
                except Exception as e:
                    print(f"[Cleanup] Failed to delete feedback for session {session_id}: {e}")

                # Clean up text_interviews data for this session
                try:
                    db.collection('text_interviews').document(session_id).delete()
                    print(f"[Cleanup] Removed text_interview for session: {session_id}")
                except Exception as e:
                    print(f"[Cleanup] Failed to delete text_interview for session {session_id}: {e}")

                # Clean up interviews (voice) data for this session
                try:
                    db.collection('interviews').document(session_id).delete()
                    print(f"[Cleanup] Removed interview for session: {session_id}")
                except Exception as e:
                    print(f"[Cleanup] Failed to delete interview for session {session_id}: {e}")

                expired_count += 1
                print(f"[Cleanup] Removed expired session: {session_id}")

            if expired_count > 0:
                print(f"[Cleanup] Cleaned up {expired_count} expired sessions")

        except Exception as e:
            print(f"[Cleanup] Error during session cleanup: {e}")

        # Wait before next cleanup cycle
        await asyncio.sleep(CLEANUP_INTERVAL_MINUTES * 60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print(f"Starting {settings.app_name} v{settings.app_version}")
    print(f"Environment: {settings.environment}")
    print(f"Session expiry: {SESSION_EXPIRY_HOURS} hours, cleanup every {CLEANUP_INTERVAL_MINUTES} minutes")

    # Initialize Firebase Admin SDK
    try:
        initialize_firebase(
            service_account_path=settings.firebase_admin_key_path,
            project_id=settings.firebase_project_id,
            database_url=settings.firebase_database_url,
        )
        print("[Firebase] Admin SDK initialized successfully")
    except Exception as e:
        print(f"[Firebase] Failed to initialize Admin SDK: {e}")
        print("[Firebase] Authentication and Firestore features will be unavailable")

    # Start background cleanup task
    cleanup_task = asyncio.create_task(cleanup_expired_sessions())

    yield

    # Shutdown
    print("Shutting down...")
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI-powered interview practice with real-time voice feedback",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1", tags=["Auth"])
app.include_router(session.router, prefix="/api/v1", tags=["Session"])
app.include_router(resume.router, prefix="/api/v1", tags=["Resume"])
app.include_router(interview.router, prefix="/api/v1", tags=["Interview"])
app.include_router(feedback.router, prefix="/api/v1", tags=["Feedback"])
app.include_router(jobboard.router, prefix="/api/v1", tags=["Job Board"])
app.include_router(coach.router, prefix="/api/v1", tags=["Coach"])
app.include_router(company_intel.router, tags=["Company Intelligence"])
app.include_router(stt.router, tags=["Speech-to-Text"])
app.include_router(text_interview.router, tags=["Text Interview"])


@app.get("/health")
async def health_check():
    """Health check endpoint for Cloud Run."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.app_version,
    }


@app.get("/health/detailed")
async def health_check_detailed():
    """Detailed health check with dependency status."""
    import httpx

    checks = {
        "api": {"status": "healthy", "latency_ms": 0},
        "elevenlabs": {"status": "unknown", "latency_ms": None},
        "gcp": {"status": "unknown", "latency_ms": None},
        "firebase": {"status": "unknown"},
    }

    # Check Firebase Admin SDK
    try:
        from app.services.firebase_service import get_firestore_client
        db = get_firestore_client()
        # Try a simple operation to verify it works
        db.collection('_health_check').document('test').get()
        checks["firebase"] = {
            "status": "healthy",
            "project_id": settings.firebase_project_id,
            "admin_key_configured": bool(settings.firebase_admin_key_path),
        }
    except Exception as e:
        checks["firebase"] = {
            "status": "unhealthy",
            "error": str(e),
            "admin_key_path": settings.firebase_admin_key_path,
        }

    # Check ElevenLabs API
    if settings.elevenlabs_api_key:
        try:
            start = datetime.utcnow()
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.elevenlabs.io/v1/user",
                    headers={"xi-api-key": settings.elevenlabs_api_key},
                    timeout=5.0,
                )
            latency = (datetime.utcnow() - start).total_seconds() * 1000
            checks["elevenlabs"] = {
                "status": "healthy" if response.status_code == 200 else "degraded",
                "latency_ms": round(latency, 2),
            }
        except Exception as e:
            checks["elevenlabs"] = {"status": "unhealthy", "error": str(e)}
    else:
        checks["elevenlabs"] = {"status": "not_configured"}

    # Check GCP connectivity
    if settings.gcp_project_id:
        try:
            from google.auth import default
            start = datetime.utcnow()
            credentials, project = default()
            latency = (datetime.utcnow() - start).total_seconds() * 1000
            checks["gcp"] = {
                "status": "healthy",
                "project": project or settings.gcp_project_id,
                "latency_ms": round(latency, 2),
            }
        except Exception as e:
            checks["gcp"] = {"status": "unhealthy", "error": str(e)}
    else:
        checks["gcp"] = {"status": "not_configured"}

    # Determine overall status
    statuses = [c.get("status") for c in checks.values()]
    if all(s in ["healthy", "not_configured"] for s in statuses):
        overall = "healthy"
    elif any(s == "unhealthy" for s in statuses):
        overall = "unhealthy"
    else:
        overall = "degraded"

    return {
        "status": overall,
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.app_version,
        "environment": settings.environment,
        "checks": checks,
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
