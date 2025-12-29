"""Firebase Admin SDK initialization and helpers."""

import os
import firebase_admin
from firebase_admin import credentials, firestore, auth
from functools import lru_cache
from typing import Optional
from datetime import datetime


# Initialize Firebase Admin SDK (singleton)
_firebase_initialized = False
_firestore_client = None


def initialize_firebase(service_account_path: Optional[str] = None, project_id: Optional[str] = None, database_url: Optional[str] = None):
    """
    Initialize Firebase Admin SDK with service account.

    Args:
        service_account_path: Path to service account JSON key file
        project_id: Firebase project ID
        database_url: Firebase Realtime Database URL (optional)

    Raises:
        ValueError: If initialization fails
    """
    global _firebase_initialized, _firestore_client

    if _firebase_initialized:
        print("[Firebase] Already initialized")
        return

    if not service_account_path:
        raise ValueError("Firebase admin key path not configured")

    try:
        # Resolve relative paths to absolute
        if not os.path.isabs(service_account_path):
            # __file__ is in backend/app/services/firebase_service.py
            # Get the backend directory (where uvicorn runs from)
            backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            # Resolve the path relative to backend directory
            service_account_path = os.path.abspath(os.path.join(backend_dir, service_account_path))

        print(f"[Firebase] Resolving service account path: {service_account_path}")

        if not os.path.exists(service_account_path):
            raise ValueError(f"Service account file not found at: {service_account_path}")

        print(f"[Firebase] Service account file found, initializing...")

        cred = credentials.Certificate(service_account_path)
        config = {'projectId': project_id}
        if database_url:
            config['databaseURL'] = database_url

        firebase_admin.initialize_app(cred, config)

        _firestore_client = firestore.client()
        _firebase_initialized = True

        print(f"[Firebase] Initialized successfully for project: {project_id}")
    except Exception as e:
        print(f"[Firebase] Initialization failed: {str(e)}")
        raise ValueError(f"Failed to initialize Firebase: {str(e)}")


def get_firestore_client():
    """
    Get Firestore client (cached).

    Returns:
        Firestore client instance

    Raises:
        RuntimeError: If Firebase not initialized
    """
    global _firestore_client

    if not _firebase_initialized or _firestore_client is None:
        raise RuntimeError("Firebase not initialized. Call initialize_firebase() first.")

    return _firestore_client


def get_coaching_sessions_collection():
    """
    Get coaching sessions collection.

    Returns:
        Firestore collection reference for coaching_sessions
    """
    return get_firestore_client().collection('coaching_sessions')


def get_feedback_collection():
    """
    Get feedback collection.

    Returns:
        Firestore collection reference for feedback
    """
    return get_firestore_client().collection('feedback')


def get_session_history_collection():
    """
    Get sessions collection (for all sessions, not just active).

    Returns:
        Firestore collection reference for sessions
    """
    return get_firestore_client().collection('sessions')


async def verify_firebase_token(id_token: str) -> dict:
    """
    Verify Firebase ID token and return decoded claims.

    Args:
        id_token: Firebase ID token from frontend

    Returns:
        dict with user claims (uid, email, etc.)

    Raises:
        ValueError: If token is invalid or expired
    """
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token
    except auth.InvalidIdTokenError as e:
        raise ValueError(f"Invalid Firebase token: {str(e)}")
    except auth.ExpiredIdTokenError:
        raise ValueError("Firebase token has expired")
    except auth.RevokedIdTokenError:
        raise ValueError("Firebase token has been revoked")
    except Exception as e:
        raise ValueError(f"Token verification failed: {str(e)}")


async def get_user_profile(uid: str) -> Optional[dict]:
    """
    Get user profile from Firestore.

    Args:
        uid: Firebase user ID

    Returns:
        User profile dict or None if not found
    """
    try:
        db = get_firestore_client()
        doc = db.collection('users').document(uid).get()
        return doc.to_dict() if doc.exists else None
    except Exception as e:
        print(f"[Firebase] Error fetching user profile: {e}")
        return None


async def create_user_profile(
    uid: str,
    email: str,
    display_name: Optional[str] = None,
    photo_url: Optional[str] = None,
    provider: str = 'google'
) -> dict:
    """
    Create new user profile in Firestore.

    Args:
        uid: Firebase user ID
        email: User email address
        display_name: User's display name (optional)
        photo_url: User's profile photo URL (optional)
        provider: Auth provider (google, microsoft, apple, github)

    Returns:
        Created user profile dict
    """
    db = get_firestore_client()
    now = datetime.utcnow()

    profile = {
        'uid': uid,
        'email': email,
        'displayName': display_name,
        'photoURL': photo_url,
        'provider': provider,
        'createdAt': now,
        'lastLoginAt': now,
        'preferences': {
            'defaultRole': None,
            'defaultCompany': None,
            'defaultInterviewType': 'behavioral',
            'default_interview_length': 'short',  # Short (5-7 questions) by default
            'difficulty_level': 'easy',  # Easy by default to encourage usage
            'emailNotifications': True,
        },
        'plan': 'free',
        'metadata': {},
    }

    db.collection('users').document(uid).set(profile)
    print(f"[Firebase] Created user profile for {email}")

    return profile


async def update_last_login(uid: str):
    """
    Update user's last login timestamp.

    Args:
        uid: Firebase user ID
    """
    try:
        db = get_firestore_client()
        db.collection('users').document(uid).update({
            'lastLoginAt': datetime.utcnow()
        })
    except Exception as e:
        print(f"[Firebase] Error updating last login: {e}")


async def get_or_create_user_profile(
    uid: str,
    email: str,
    display_name: Optional[str] = None,
    photo_url: Optional[str] = None,
    provider: str = 'google'
) -> dict:
    """
    Get existing user profile or create if it doesn't exist.

    Args:
        uid: Firebase user ID
        email: User email
        display_name: User's display name
        photo_url: Profile photo URL
        provider: Auth provider

    Returns:
        User profile dict
    """
    profile = await get_user_profile(uid)

    if profile:
        # Update last login
        await update_last_login(uid)
        return profile

    # Create new profile
    return await create_user_profile(uid, email, display_name, photo_url, provider)
