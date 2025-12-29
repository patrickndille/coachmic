"""Encryption service for sensitive user data using Google Cloud KMS."""

import base64
import os
from typing import Optional
from google.cloud import kms
from functools import lru_cache


@lru_cache
def get_kms_client():
    """
    Get Google Cloud KMS client (cached).

    Returns:
        KeyManagementServiceClient instance
    """
    return kms.KeyManagementServiceClient()


async def encrypt_api_key(plaintext: str, kms_key_name: Optional[str] = None) -> str:
    """
    Encrypt API key using Google Cloud KMS.

    Args:
        plaintext: The API key to encrypt
        kms_key_name: Full KMS key resource name (projects/.../locations/.../keyRings/.../cryptoKeys/...)

    Returns:
        Base64-encoded ciphertext

    Raises:
        ValueError: If KMS key not configured in production
    """
    # Fallback for development: base64 encode (NOT SECURE)
    if not kms_key_name or os.getenv('ENVIRONMENT') != 'production':
        if os.getenv('ENVIRONMENT') == 'production':
            raise ValueError("KMS key not configured in production environment")

        print("[Encryption] WARNING: Using base64 encoding (development mode only)")
        return base64.b64encode(plaintext.encode()).decode()

    try:
        client = get_kms_client()

        # Encrypt using KMS
        encrypt_response = client.encrypt(
            request={
                'name': kms_key_name,
                'plaintext': plaintext.encode(),
            }
        )

        # Return base64-encoded ciphertext
        ciphertext_b64 = base64.b64encode(encrypt_response.ciphertext).decode()
        return ciphertext_b64

    except Exception as e:
        raise ValueError(f"Encryption failed: {str(e)}")


async def decrypt_api_key(ciphertext_b64: str, kms_key_name: Optional[str] = None) -> str:
    """
    Decrypt API key using Google Cloud KMS.

    Args:
        ciphertext_b64: Base64-encoded ciphertext
        kms_key_name: Full KMS key resource name

    Returns:
        Decrypted plaintext API key

    Raises:
        ValueError: If decryption fails
    """
    # Fallback for development
    if not kms_key_name or os.getenv('ENVIRONMENT') != 'production':
        if os.getenv('ENVIRONMENT') == 'production':
            raise ValueError("KMS key not configured in production environment")

        print("[Encryption] WARNING: Using base64 decoding (development mode only)")
        try:
            return base64.b64decode(ciphertext_b64).decode()
        except Exception as e:
            raise ValueError(f"Base64 decode failed: {str(e)}")

    try:
        client = get_kms_client()
        ciphertext = base64.b64decode(ciphertext_b64)

        # Decrypt using KMS
        decrypt_response = client.decrypt(
            request={
                'name': kms_key_name,
                'ciphertext': ciphertext,
            }
        )

        return decrypt_response.plaintext.decode()

    except Exception as e:
        raise ValueError(f"Decryption failed: {str(e)}")


def is_kms_configured(kms_key_name: Optional[str]) -> bool:
    """
    Check if Google Cloud KMS is properly configured.

    Args:
        kms_key_name: KMS key resource name

    Returns:
        True if KMS is configured, False otherwise
    """
    return kms_key_name is not None and kms_key_name.startswith('projects/')
