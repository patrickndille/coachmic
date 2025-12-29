"""Authentication middleware for FastAPI."""

from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from app.services.firebase_service import verify_firebase_token


security = HTTPBearer(auto_error=False)


class AuthenticatedUser:
    """User information from verified JWT token."""

    def __init__(self, uid: str, email: str, claims: dict):
        self.uid = uid
        self.email = email
        self.claims = claims
        self.is_anonymous = False
        self.provider = claims.get('firebase', {}).get('sign_in_provider', 'unknown')

    def __str__(self):
        return f"User({self.uid}, {self.email})"

    def __repr__(self):
        return self.__str__()


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[AuthenticatedUser]:
    """
    Get current authenticated user from request.

    Checks for Firebase ID token in Authorization header (Bearer token).
    Returns None if no token or invalid token (does not raise exception).

    Args:
        request: FastAPI request object
        credentials: HTTP authorization credentials from Bearer token

    Returns:
        AuthenticatedUser object if token is valid, None otherwise
    """
    if not credentials:
        return None

    try:
        # Verify Firebase ID token
        claims = await verify_firebase_token(credentials.credentials)

        return AuthenticatedUser(
            uid=claims['uid'],
            email=claims.get('email', ''),
            claims=claims,
        )
    except ValueError as e:
        # Token verification failed - log but don't raise
        print(f"[Auth] Token verification failed: {e}")
        return None
    except Exception as e:
        print(f"[Auth] Unexpected error during token verification: {e}")
        return None


async def require_auth(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> AuthenticatedUser:
    """
    Require authenticated user (raise 401 if not authenticated).

    Use as FastAPI dependency in protected routes:

    Example:
        @app.get("/protected")
        async def protected_route(user: AuthenticatedUser = Depends(require_auth)):
            return {"message": f"Hello {user.email}"}

    Args:
        request: FastAPI request object
        credentials: HTTP authorization credentials

    Returns:
        AuthenticatedUser object

    Raises:
        HTTPException: 401 if not authenticated or token invalid
    """
    user = await get_current_user(request, credentials)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[AuthenticatedUser]:
    """
    Get user if authenticated, None otherwise (no error raised).

    Use for endpoints that support both authenticated and anonymous access.

    Example:
        @app.post("/session")
        async def create_session(user: Optional[AuthenticatedUser] = Depends(get_optional_user)):
            if user:
                # Authenticated user
                session_data['user_id'] = user.uid
            else:
                # Anonymous user
                session_data['user_id'] = None

    Args:
        request: FastAPI request object
        credentials: HTTP authorization credentials

    Returns:
        AuthenticatedUser if authenticated, None otherwise
    """
    return await get_current_user(request, credentials)
