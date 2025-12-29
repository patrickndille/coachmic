"""Firebase Storage service for resume file management.

Firebase Storage uses Google Cloud Storage as its backend.
This service handles resume file upload, download URL generation,
and deletion for the resume versioning system.
"""

import os
import uuid
import traceback
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Tuple, List
from google.cloud import storage
from google.cloud.exceptions import NotFound
from google.oauth2 import service_account
from app.config import get_settings

settings = get_settings()

# Singleton storage client
_storage_client = None


def _resolve_key_path(key_path: str) -> Optional[str]:
    """Resolve the service account key path, handling relative paths."""
    if not key_path:
        return None

    # If absolute path, use as-is
    if os.path.isabs(key_path):
        return key_path if os.path.exists(key_path) else None

    # Try relative to current working directory
    if os.path.exists(key_path):
        return os.path.abspath(key_path)

    # Try relative to backend directory (parent of app/)
    backend_dir = Path(__file__).parent.parent.parent
    resolved = backend_dir / key_path
    if resolved.exists():
        return str(resolved)

    return None


def get_storage_client():
    """Get or create a Google Cloud Storage client (singleton).

    Uses service account credentials if available (required for signed URLs).
    Falls back to Application Default Credentials otherwise.
    """
    global _storage_client
    if _storage_client is None:
        # Try to use service account key file (required for signed URLs)
        key_path = _resolve_key_path(settings.firebase_admin_key_path)

        if key_path:
            try:
                credentials = service_account.Credentials.from_service_account_file(key_path)
                _storage_client = storage.Client(
                    project=settings.gcp_project_id,
                    credentials=credentials
                )
                print(f"[Storage] Initialized with service account: {key_path}")
            except Exception as e:
                print(f"[Storage] Failed to load service account key: {e}")
                print(f"[Storage] Falling back to ADC (signed URLs may not work)")
                _storage_client = storage.Client(project=settings.gcp_project_id)
        else:
            # Fall back to Application Default Credentials
            _storage_client = storage.Client(project=settings.gcp_project_id)
            print(f"[Storage] Initialized with ADC for project: {settings.gcp_project_id}")
            print(f"[Storage] WARNING: Service account key not found at: {settings.firebase_admin_key_path}")
            print(f"[Storage] Signed URL generation may fail with OAuth credentials")

    return _storage_client


def get_bucket():
    """Get the configured GCS bucket for Firebase Storage."""
    client = get_storage_client()
    bucket_name = settings.gcs_bucket_name
    if not bucket_name:
        raise ValueError("GCS_BUCKET_NAME not configured")
    return client.bucket(bucket_name)


async def upload_resume_file(
    user_id: str,
    file_content: bytes,
    file_name: str,
    content_type: str,
    is_improved: bool = False,
    source_version_id: Optional[str] = None,
) -> Tuple[str, str, Optional[str]]:
    """
    Upload resume file to Firebase Storage.

    Args:
        user_id: Firebase user UID
        file_content: File bytes
        file_name: Original filename
        content_type: MIME type (application/pdf or docx mime type)
        is_improved: Whether this is an AI-improved version
        source_version_id: If improved, the original version ID

    Returns:
        Tuple of (version_id, storage_path, download_url)
        download_url may be None if signed URL generation fails

    Raises:
        Exception: If file upload fails (not signed URL generation)
    """
    version_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

    # Determine file extension
    if "pdf" in content_type.lower():
        ext = "pdf"
    elif "docx" in content_type.lower() or "wordprocessingml" in content_type.lower():
        ext = "docx"
    elif "." in file_name:
        ext = file_name.rsplit(".", 1)[-1].lower()
    else:
        ext = "pdf"  # Default to PDF

    # Build storage path: resumes/{userId}/resume-{timestamp}[-improved].{ext}
    suffix = "-improved" if is_improved else ""
    storage_path = f"resumes/{user_id}/resume-{timestamp}{suffix}.{ext}"

    try:
        bucket = get_bucket()
        blob = bucket.blob(storage_path)

        # Set metadata
        blob.metadata = {
            "version_id": version_id,
            "original_filename": file_name,
            "is_improved": str(is_improved).lower(),
            "uploaded_at": datetime.utcnow().isoformat(),
        }
        if source_version_id:
            blob.metadata["source_version_id"] = source_version_id

        # Upload the file first
        blob.upload_from_string(file_content, content_type=content_type)
        print(f"[Storage] Uploaded resume: {storage_path} (version: {version_id})")

    except Exception as e:
        print(f"[Storage] Upload failed for {storage_path}: {e}")
        print(traceback.format_exc())
        raise

    # Generate signed URL separately (don't fail if this doesn't work)
    download_url = None
    try:
        download_url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(days=7),
            method="GET",
        )
        print(f"[Storage] Generated signed URL for: {storage_path}")
    except Exception as e:
        print(f"[Storage] Signed URL generation failed (will generate on-demand): {e}")
        # Don't raise - version entry can still be created
        # URL will be generated on-demand when downloading

    return version_id, storage_path, download_url


async def get_download_url(storage_path: str, expiration_days: int = 7) -> str:
    """
    Generate a fresh signed download URL for a stored file.

    Args:
        storage_path: Path to the file in storage (e.g., resumes/{uid}/resume-xxx.pdf)
        expiration_days: Number of days until URL expires (default 7)

    Returns:
        Signed download URL

    Raises:
        NotFound: If file doesn't exist
    """
    try:
        bucket = get_bucket()
        blob = bucket.blob(storage_path)

        # Verify file exists
        if not blob.exists():
            raise NotFound(f"File not found: {storage_path}")

        download_url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(days=expiration_days),
            method="GET",
        )

        print(f"[Storage] Generated download URL for: {storage_path}")
        return download_url

    except NotFound:
        raise
    except Exception as e:
        print(f"[Storage] Error generating URL for {storage_path}: {e}")
        raise


async def delete_resume_file(storage_path: str) -> bool:
    """
    Delete a resume file from storage.

    Args:
        storage_path: Path to the file in storage

    Returns:
        True if deleted successfully, False otherwise
    """
    try:
        bucket = get_bucket()
        blob = bucket.blob(storage_path)

        if blob.exists():
            blob.delete()
            print(f"[Storage] Deleted file: {storage_path}")
            return True
        else:
            print(f"[Storage] File not found (already deleted?): {storage_path}")
            return True  # Treat as success (idempotent)

    except Exception as e:
        print(f"[Storage] Failed to delete {storage_path}: {e}")
        return False


async def delete_all_user_resumes(user_id: str) -> int:
    """
    Delete all resume files for a user (for account deletion cascade).

    Args:
        user_id: Firebase user UID

    Returns:
        Number of files deleted
    """
    deleted_count = 0
    prefix = f"resumes/{user_id}/"

    try:
        bucket = get_bucket()
        blobs = bucket.list_blobs(prefix=prefix)

        for blob in blobs:
            try:
                blob.delete()
                deleted_count += 1
                print(f"[Storage] Deleted: {blob.name}")
            except Exception as e:
                print(f"[Storage] Failed to delete {blob.name}: {e}")

        print(f"[Storage] Deleted {deleted_count} resume files for user {user_id}")
        return deleted_count

    except Exception as e:
        print(f"[Storage] Error listing files for user {user_id}: {e}")
        print(traceback.format_exc())
        return deleted_count


async def list_user_resumes(user_id: str) -> List[dict]:
    """
    List all resume files for a user.

    Args:
        user_id: Firebase user UID

    Returns:
        List of file info dicts with name, size, updated timestamp
    """
    prefix = f"resumes/{user_id}/"
    files = []

    try:
        bucket = get_bucket()
        blobs = bucket.list_blobs(prefix=prefix)

        for blob in blobs:
            files.append({
                "name": blob.name,
                "size": blob.size,
                "content_type": blob.content_type,
                "updated": blob.updated.isoformat() if blob.updated else None,
                "metadata": blob.metadata or {},
            })

        return files

    except Exception as e:
        print(f"[Storage] Error listing files for user {user_id}: {e}")
        return []


async def check_file_exists(storage_path: str) -> bool:
    """
    Check if a file exists in storage.

    Args:
        storage_path: Path to check

    Returns:
        True if file exists, False otherwise
    """
    try:
        bucket = get_bucket()
        blob = bucket.blob(storage_path)
        return blob.exists()
    except Exception as e:
        print(f"[Storage] Error checking file existence {storage_path}: {e}")
        return False


async def download_resume_file(storage_path: str) -> bytes:
    """
    Download resume file bytes from storage for re-parsing.

    Args:
        storage_path: Path to the file in storage (e.g., resumes/{uid}/resume-xxx.pdf)

    Returns:
        File content as bytes

    Raises:
        NotFound: If file doesn't exist
    """
    try:
        bucket = get_bucket()
        blob = bucket.blob(storage_path)

        # Verify file exists
        if not blob.exists():
            raise NotFound(f"File not found: {storage_path}")

        file_bytes = blob.download_as_bytes()
        print(f"[Storage] Downloaded file: {storage_path} ({len(file_bytes)} bytes)")
        return file_bytes

    except NotFound:
        raise
    except Exception as e:
        print(f"[Storage] Error downloading {storage_path}: {e}")
        raise
