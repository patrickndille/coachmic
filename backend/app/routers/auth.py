"""Authentication endpoints."""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
import httpx
import traceback
from app.middleware.auth_middleware import require_auth, AuthenticatedUser
from app.services.firebase_service import get_or_create_user_profile, get_firestore_client
from app.services.user_credentials_service import (
    get_user_credentials,
    save_user_credentials,
    delete_user_credentials,
    has_user_credentials,
)
from app.services.account_deletion_service import delete_user_account
from app.models.user import UserPreferences
from app.config import get_settings

router = APIRouter()
settings = get_settings()


# Request/Response Models
class UserProfileResponse(BaseModel):
    """User profile information."""
    uid: str
    email: str
    displayName: Optional[str] = Field(None, alias="displayName")
    photoURL: Optional[str] = Field(None, alias="photoURL")
    plan: str = "free"
    provider: str

    class Config:
        populate_by_name = True


class SaveCredentialsRequest(BaseModel):
    """Request to save ElevenLabs credentials."""
    apiKey: str = Field(..., alias="apiKey", min_length=10)
    agentId: str = Field(..., alias="agentId", min_length=10)

    class Config:
        populate_by_name = True


class CredentialsResponse(BaseModel):
    """User's credentials (API key masked for security)."""
    hasCredentials: bool = Field(..., alias="hasCredentials")
    agentId: Optional[str] = Field(None, alias="agentId")
    # Never return API key to frontend

    class Config:
        populate_by_name = True


# Endpoints
@router.get("/auth/me", response_model=UserProfileResponse)
async def get_current_user_profile(user: AuthenticatedUser = Depends(require_auth)):
    """
    Get current user's profile.

    Creates profile if it doesn't exist (first login).
    """
    try:
        profile = await get_or_create_user_profile(
            uid=user.uid,
            email=user.email,
            display_name=user.claims.get('name'),
            photo_url=user.claims.get('picture'),
            provider=user.provider,
        )

        return UserProfileResponse(
            uid=profile['uid'],
            email=profile['email'],
            displayName=profile.get('displayName'),
            photoURL=profile.get('photoURL'),
            plan=profile.get('plan', 'free'),
            provider=profile.get('provider', 'unknown'),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get user profile: {str(e)}")


@router.get("/auth/credentials", response_model=CredentialsResponse)
async def get_credentials(user: AuthenticatedUser = Depends(require_auth)):
    """
    Check if user has configured their own ElevenLabs credentials.

    Returns agent ID if configured, but never returns the API key.
    """
    try:
        has_creds = await has_user_credentials(user.uid)

        if has_creds:
            creds = await get_user_credentials(user.uid, settings.kms_key_name)
            agent_id = creds.get('elevenlabs', {}).get('agentId') if creds else None

            return CredentialsResponse(
                hasCredentials=True,
                agentId=agent_id,
            )

        return CredentialsResponse(
            hasCredentials=False,
            agentId=None,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check credentials: {str(e)}")


@router.post("/auth/credentials", response_model=CredentialsResponse)
async def save_credentials(
    request: SaveCredentialsRequest,
    user: AuthenticatedUser = Depends(require_auth)
):
    """
    Save user's ElevenLabs credentials (encrypted).

    Validates credentials before saving by testing with ElevenLabs API.
    """
    # Validate API key format
    if not request.apiKey.startswith('sk_'):
        raise HTTPException(status_code=400, detail="Invalid API key format. Must start with 'sk_'")

    # Validate agent ID format
    if not request.agentId.startswith('agent_'):
        raise HTTPException(status_code=400, detail="Invalid agent ID format. Must start with 'agent_'")

    # Test credentials with ElevenLabs API before saving
    # Validate API key by fetching the specific agent (requires agent read permission)
    try:
        async with httpx.AsyncClient() as client:
            # First, validate API key by fetching the agent
            response = await client.get(
                f"https://api.elevenlabs.io/v1/convai/agents/{request.agentId}",
                headers={"xi-api-key": request.apiKey},
                timeout=10.0,
            )

            if response.status_code == 404:
                print(f"[Auth] Agent not found: {request.agentId}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Agent ID not found. Make sure the agent exists and your API key has access to it."
                )
            elif response.status_code != 200:
                error_detail = f"ElevenLabs returned status {response.status_code}"
                try:
                    error_body = response.json()
                    error_detail += f": {error_body.get('detail', error_body)}"
                except Exception:
                    error_detail += f": {response.text[:200]}"
                print(f"[Auth] ElevenLabs validation failed: {error_detail}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid ElevenLabs API key. {error_detail}"
                )
    except httpx.TimeoutException:
        print("[Auth] ElevenLabs API request timed out")
        raise HTTPException(status_code=400, detail="ElevenLabs API request timed out. Please try again.")
    except httpx.RequestError as e:
        print(f"[Auth] ElevenLabs request failed: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to verify credentials with ElevenLabs API: {str(e)}")

    # Save credentials (encrypted)
    try:
        await save_user_credentials(
            uid=user.uid,
            elevenlabs_api_key=request.apiKey,
            elevenlabs_agent_id=request.agentId,
            kms_key_name=settings.kms_key_name,
        )

        return CredentialsResponse(
            hasCredentials=True,
            agentId=request.agentId,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save credentials: {str(e)}")


@router.delete("/auth/credentials")
async def remove_credentials(user: AuthenticatedUser = Depends(require_auth)):
    """
    Delete user's ElevenLabs credentials.

    After deletion, user will use system default credentials.
    """
    try:
        success = await delete_user_credentials(user.uid)

        if success:
            return {"success": True, "message": "Credentials removed. You will now use default system credentials."}
        else:
            raise HTTPException(status_code=500, detail="Failed to remove credentials")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error removing credentials: {str(e)}")


@router.get("/auth/preferences", response_model=UserPreferences)
async def get_preferences(user: AuthenticatedUser = Depends(require_auth)):
    """
    Get user preferences.

    Returns default preferences if none have been saved yet.
    """
    try:
        db = get_firestore_client()
        user_doc = db.collection('users').document(user.uid).get()

        if user_doc.exists:
            user_data = user_doc.to_dict()
            if 'preferences' in user_data:
                return UserPreferences(**user_data['preferences'])

        # Return defaults if no preferences saved
        return UserPreferences()
    except Exception as e:
        print(f"[Preferences] Error getting preferences: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve preferences")


@router.put("/auth/preferences")
async def update_preferences(
    preferences: UserPreferences,
    user: AuthenticatedUser = Depends(require_auth)
):
    """
    Update user preferences.

    Saves or updates all preference settings for the authenticated user.
    """
    try:
        db = get_firestore_client()
        user_ref = db.collection('users').document(user.uid)

        # Get existing user doc or create new one
        user_doc = user_ref.get()

        if user_doc.exists:
            # Update existing preferences
            user_ref.update({
                'preferences': preferences.model_dump(),
            })
        else:
            # Create new user doc with preferences
            user_ref.set({
                'uid': user.uid,
                'email': user.email,
                'preferences': preferences.model_dump(),
            })

        return {"success": True, "message": "Preferences updated successfully"}
    except Exception as e:
        print(f"[Preferences] Error updating preferences: {e}")
        raise HTTPException(status_code=500, detail="Failed to update preferences")


@router.delete("/auth/account")
async def delete_account(user: AuthenticatedUser = Depends(require_auth)):
    """
    Delete user account and all associated data.

    WARNING: This action is PERMANENT and IRREVERSIBLE.

    Deletes:
    - All interview sessions and embedded resume data
    - All interview feedback
    - All coaching session history
    - All saved jobs
    - User credentials (ElevenLabs API keys)
    - User profile and preferences
    - Firebase Authentication account

    After deletion, the user can sign up again with the same email
    address for a completely fresh start.

    Returns:
        Dict with success status, message, and deleted counts
    """
    try:
        print(f"[AccountDeletion] Starting deletion for user: {user.uid}")

        result = await delete_user_account(user.uid)

        if result['success']:
            print(f"[AccountDeletion] Successfully deleted account: {user.uid}")
            return {
                "success": True,
                "message": "Account deleted successfully. You can now sign up again for a fresh start.",
                "deleted_counts": result.get('deleted_counts', {})
            }
        else:
            error_msg = f"Account deletion partially failed: {'; '.join(result.get('errors', ['Unknown error']))}"
            print(f"[AccountDeletion] Partial deletion for {user.uid}: {error_msg}")
            raise HTTPException(
                status_code=500,
                detail=error_msg
            )

    except HTTPException:
        # Re-raise HTTPException as-is
        raise
    except Exception as e:
        error_msg = f"Failed to delete account: {str(e)}"
        print(f"[AccountDeletion] Error for {user.uid}: {error_msg}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_msg)
