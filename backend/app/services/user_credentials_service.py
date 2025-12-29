"""Service for managing user-specific ElevenLabs credentials."""

from datetime import datetime
from typing import Optional, Tuple
from app.services.firebase_service import get_firestore_client
from app.services.encryption_service import encrypt_api_key, decrypt_api_key


async def get_user_credentials(uid: str, kms_key_name: Optional[str] = None) -> Optional[dict]:
    """
    Get user's ElevenLabs credentials from Firestore.

    Args:
        uid: Firebase user ID
        kms_key_name: Google Cloud KMS key name for decryption

    Returns:
        User credentials dict with decrypted API key, or None if not found
    """
    try:
        db = get_firestore_client()
        doc = db.collection('user_credentials').document(uid).get()

        if not doc.exists:
            return None

        data = doc.to_dict()

        # Decrypt API key if present
        if data and data.get('elevenlabs') and data['elevenlabs'].get('apiKey'):
            encrypted_key = data['elevenlabs']['apiKey']
            data['elevenlabs']['apiKey'] = await decrypt_api_key(encrypted_key, kms_key_name)

        return data

    except Exception as e:
        print(f"[UserCredentials] Error fetching credentials: {e}")
        return None


async def save_user_credentials(
    uid: str,
    elevenlabs_api_key: str,
    elevenlabs_agent_id: str,
    kms_key_name: Optional[str] = None
) -> dict:
    """
    Save user's ElevenLabs credentials to Firestore (encrypted).

    Args:
        uid: Firebase user ID
        elevenlabs_api_key: User's ElevenLabs API key (will be encrypted)
        elevenlabs_agent_id: User's ElevenLabs agent ID
        kms_key_name: Google Cloud KMS key name for encryption

    Returns:
        Saved credentials dict (with decrypted API key for immediate use)

    Raises:
        ValueError: If encryption fails
    """
    db = get_firestore_client()
    now = datetime.utcnow()

    # Encrypt API key
    encrypted_key = await encrypt_api_key(elevenlabs_api_key, kms_key_name)

    credentials = {
        'uid': uid,
        'elevenlabs': {
            'apiKey': encrypted_key,
            'agentId': elevenlabs_agent_id,
            'encryptedAt': now,
            'encryptionVersion': 1,
        },
        'updatedAt': now,
        'createdAt': now,
    }

    db.collection('user_credentials').document(uid).set(credentials)
    print(f"[UserCredentials] Saved credentials for user {uid}")

    # Return with decrypted key for immediate use
    credentials['elevenlabs']['apiKey'] = elevenlabs_api_key
    return credentials


async def delete_user_credentials(uid: str) -> bool:
    """
    Delete user's credentials from Firestore.

    Args:
        uid: Firebase user ID

    Returns:
        True if deletion successful
    """
    try:
        db = get_firestore_client()
        db.collection('user_credentials').document(uid).delete()
        print(f"[UserCredentials] Deleted credentials for user {uid}")
        return True
    except Exception as e:
        print(f"[UserCredentials] Error deleting credentials: {e}")
        return False


async def get_elevenlabs_credentials_for_user(
    uid: Optional[str],
    default_api_key: str,
    default_agent_id: str,
    kms_key_name: Optional[str] = None
) -> Tuple[str, str]:
    """
    Get ElevenLabs credentials for a user (user's own or system default).

    This implements the credential hierarchy: user credentials ALWAYS override defaults.

    Args:
        uid: Firebase user ID (None for anonymous users)
        default_api_key: System default ElevenLabs API key
        default_agent_id: System default ElevenLabs agent ID
        kms_key_name: Google Cloud KMS key name

    Returns:
        Tuple of (api_key, agent_id)
    """
    if uid:
        user_creds = await get_user_credentials(uid, kms_key_name)
        if user_creds and user_creds.get('elevenlabs'):
            api_key = user_creds['elevenlabs'].get('apiKey')
            agent_id = user_creds['elevenlabs'].get('agentId')

            if api_key and agent_id:
                print(f"[UserCredentials] Using user credentials for {uid}")
                return (api_key, agent_id)

    # Fallback to system credentials
    print(f"[UserCredentials] Using system default credentials")
    return (default_api_key, default_agent_id)


async def has_user_credentials(uid: str) -> bool:
    """
    Check if user has configured their own ElevenLabs credentials.

    Args:
        uid: Firebase user ID

    Returns:
        True if user has credentials configured
    """
    creds = await get_user_credentials(uid)
    return creds is not None and creds.get('elevenlabs') is not None
