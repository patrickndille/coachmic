"""Account deletion service for cascade deletion across all user data."""

import traceback
from typing import Dict, List
from firebase_admin import auth
from app.services.firebase_service import get_firestore_client
from google.cloud.firestore_v1.base_query import FieldFilter


async def _delete_collection_by_user_id(
    collection_name: str,
    uid: str
) -> Dict[str, int]:
    """
    Delete all documents in a collection where user_id == uid.

    Args:
        collection_name: Name of the Firestore collection
        uid: User ID to filter by

    Returns:
        Dict with 'deleted' count and 'errors' count
    """
    deleted_count = 0
    error_count = 0

    try:
        db = get_firestore_client()
        docs = db.collection(collection_name)\
            .where(filter=FieldFilter('user_id', '==', uid))\
            .stream()

        # Collect all document references to delete
        doc_refs = []
        for doc in docs:
            doc_refs.append(doc.reference)

        # Delete in batches (max 500 operations per batch)
        batch_size = 500
        for i in range(0, len(doc_refs), batch_size):
            batch = db.batch()
            batch_refs = doc_refs[i:i + batch_size]

            for doc_ref in batch_refs:
                batch.delete(doc_ref)

            try:
                batch.commit()
                deleted_count += len(batch_refs)
                print(f"[AccountDeletion] Deleted {len(batch_refs)} documents from {collection_name}")
            except Exception as e:
                error_count += len(batch_refs)
                print(f"[AccountDeletion] Error deleting batch from {collection_name}: {e}")

    except Exception as e:
        print(f"[AccountDeletion] Error querying {collection_name}: {e}")
        print(traceback.format_exc())
        error_count += 1

    return {
        'deleted': deleted_count,
        'errors': error_count
    }


async def _delete_saved_jobs(uid: str) -> int:
    """
    Delete saved jobs with composite key {uid}_*.

    Args:
        uid: User ID

    Returns:
        Number of saved jobs deleted
    """
    deleted_count = 0

    try:
        db = get_firestore_client()

        # Query all saved_jobs documents and filter by document ID prefix
        docs = db.collection('saved_jobs').stream()

        doc_refs_to_delete = []
        for doc in docs:
            # Check if document ID starts with uid_
            if doc.id.startswith(f"{uid}_"):
                doc_refs_to_delete.append(doc.reference)

        # Delete in batches
        batch_size = 500
        for i in range(0, len(doc_refs_to_delete), batch_size):
            batch = db.batch()
            batch_refs = doc_refs_to_delete[i:i + batch_size]

            for doc_ref in batch_refs:
                batch.delete(doc_ref)

            try:
                batch.commit()
                deleted_count += len(batch_refs)
                print(f"[AccountDeletion] Deleted {len(batch_refs)} saved jobs")
            except Exception as e:
                print(f"[AccountDeletion] Error deleting saved jobs batch: {e}")

    except Exception as e:
        print(f"[AccountDeletion] Error deleting saved jobs: {e}")
        print(traceback.format_exc())

    return deleted_count


async def _delete_user_profile(uid: str) -> bool:
    """
    Delete user profile document.

    Args:
        uid: User ID

    Returns:
        True if successful, False otherwise
    """
    try:
        db = get_firestore_client()
        db.collection('users').document(uid).delete()
        print(f"[AccountDeletion] Deleted user profile: {uid}")
        return True
    except Exception as e:
        print(f"[AccountDeletion] Error deleting user profile: {e}")
        print(traceback.format_exc())
        return False


async def _delete_user_credentials(uid: str) -> bool:
    """
    Delete user credentials document.

    Args:
        uid: User ID

    Returns:
        True if successful, False otherwise
    """
    try:
        db = get_firestore_client()
        db.collection('user_credentials').document(uid).delete()
        print(f"[AccountDeletion] Deleted user credentials: {uid}")
        return True
    except Exception as e:
        print(f"[AccountDeletion] Error deleting user credentials: {e}")
        print(traceback.format_exc())
        return False


async def _delete_firebase_auth_user(uid: str) -> bool:
    """
    Delete user from Firebase Authentication.

    Args:
        uid: User ID

    Returns:
        True if successful, False otherwise
    """
    try:
        auth.delete_user(uid)
        print(f"[AccountDeletion] Deleted Firebase Auth user: {uid}")
        return True
    except auth.UserNotFoundError:
        # User already deleted - treat as success (idempotent)
        print(f"[AccountDeletion] Firebase Auth user already deleted: {uid}")
        return True
    except Exception as e:
        print(f"[AccountDeletion] Error deleting Firebase Auth user: {e}")
        print(traceback.format_exc())
        return False


async def delete_user_account(uid: str) -> dict:
    """
    Delete all user data and Firebase Auth account.

    This function performs a cascade deletion across all Firestore collections
    and Firebase Authentication. It continues even if some deletions fail to
    ensure maximum data removal.

    Deletion order:
    1. sessions (user_id)
    2. feedback (user_id)
    3. interviews (user_id) - voice interview state
    4. text_interviews (user_id) - text-based interview state
    5. coaching_sessions (user_id)
    6. saved_jobs (composite doc ID: uid_job_id)
    7. resume_files (Firebase Storage: resumes/{uid}/*)
    8. user_credentials (doc ID: uid)
    9. users (doc ID: uid)
    10. Firebase Authentication user

    Args:
        uid: Firebase user ID

    Returns:
        Dict with:
        - success: bool (True if all critical deletions succeeded)
        - deleted_counts: dict with counts per collection
        - errors: list of error messages if any
    """
    print(f"[AccountDeletion] Starting account deletion for user: {uid}")

    deleted_counts = {}
    errors = []

    # Step 1: Delete sessions
    try:
        result = await _delete_collection_by_user_id('sessions', uid)
        deleted_counts['sessions'] = result['deleted']
        if result['errors'] > 0:
            errors.append(f"Failed to delete {result['errors']} sessions")
    except Exception as e:
        errors.append(f"Error deleting sessions: {str(e)}")
        deleted_counts['sessions'] = 0

    # Step 2: Delete feedback
    try:
        result = await _delete_collection_by_user_id('feedback', uid)
        deleted_counts['feedback'] = result['deleted']
        if result['errors'] > 0:
            errors.append(f"Failed to delete {result['errors']} feedback records")
    except Exception as e:
        errors.append(f"Error deleting feedback: {str(e)}")
        deleted_counts['feedback'] = 0

    # Step 2.5: Delete interviews (interview state persistence)
    try:
        result = await _delete_collection_by_user_id('interviews', uid)
        deleted_counts['interviews'] = result['deleted']
        if result['errors'] > 0:
            errors.append(f"Failed to delete {result['errors']} interview records")
    except Exception as e:
        errors.append(f"Error deleting interviews: {str(e)}")
        deleted_counts['interviews'] = 0

    # Step 2.6: Delete text interviews (text-based interview state)
    try:
        result = await _delete_collection_by_user_id('text_interviews', uid)
        deleted_counts['text_interviews'] = result['deleted']
        if result['errors'] > 0:
            errors.append(f"Failed to delete {result['errors']} text interview records")
    except Exception as e:
        errors.append(f"Error deleting text interviews: {str(e)}")
        deleted_counts['text_interviews'] = 0

    # Step 3: Delete coaching sessions
    try:
        result = await _delete_collection_by_user_id('coaching_sessions', uid)
        deleted_counts['coaching_sessions'] = result['deleted']
        if result['errors'] > 0:
            errors.append(f"Failed to delete {result['errors']} coaching sessions")
    except Exception as e:
        errors.append(f"Error deleting coaching sessions: {str(e)}")
        deleted_counts['coaching_sessions'] = 0

    # Step 4: Delete saved jobs
    try:
        count = await _delete_saved_jobs(uid)
        deleted_counts['saved_jobs'] = count
    except Exception as e:
        errors.append(f"Error deleting saved jobs: {str(e)}")
        deleted_counts['saved_jobs'] = 0

    # Step 4.5: Delete resume files from Firebase Storage
    try:
        from app.services.storage_service import delete_all_user_resumes
        storage_deleted = await delete_all_user_resumes(uid)
        deleted_counts['resume_files'] = storage_deleted
        print(f"[AccountDeletion] Deleted {storage_deleted} resume files from storage")
    except Exception as e:
        errors.append(f"Error deleting resume files: {str(e)}")
        deleted_counts['resume_files'] = 0
        print(f"[AccountDeletion] Error deleting resume files: {e}")
        print(traceback.format_exc())

    # Step 5: Delete user credentials
    try:
        success = await _delete_user_credentials(uid)
        deleted_counts['user_credentials'] = 1 if success else 0
        if not success:
            errors.append("Failed to delete user credentials")
    except Exception as e:
        errors.append(f"Error deleting user credentials: {str(e)}")
        deleted_counts['user_credentials'] = 0

    # Step 6: Delete user profile
    try:
        success = await _delete_user_profile(uid)
        deleted_counts['users'] = 1 if success else 0
        if not success:
            errors.append("Failed to delete user profile")
    except Exception as e:
        errors.append(f"Error deleting user profile: {str(e)}")
        deleted_counts['users'] = 0

    # Step 7: Delete Firebase Auth user (critical - if this fails, user can't sign in but data might remain)
    auth_deleted = False
    try:
        auth_deleted = await _delete_firebase_auth_user(uid)
        deleted_counts['firebase_auth'] = 1 if auth_deleted else 0
        if not auth_deleted:
            errors.append("Failed to delete Firebase Authentication user")
    except Exception as e:
        errors.append(f"Error deleting Firebase Auth user: {str(e)}")
        deleted_counts['firebase_auth'] = 0

    # Determine overall success
    # Critical: Firebase Auth user must be deleted for full success
    # If Auth deletion fails, user can't sign in again properly
    success = auth_deleted and len(errors) == 0

    if success:
        print(f"[AccountDeletion] Successfully deleted account: {uid}")
        print(f"[AccountDeletion] Deleted counts: {deleted_counts}")
    else:
        print(f"[AccountDeletion] Account deletion completed with errors for {uid}")
        print(f"[AccountDeletion] Deleted counts: {deleted_counts}")
        print(f"[AccountDeletion] Errors: {errors}")

    return {
        'success': success,
        'deleted_counts': deleted_counts,
        'errors': errors if errors else None
    }
