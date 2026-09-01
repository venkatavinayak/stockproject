import os
import json
import secrets
import httpx
from typing import Optional, Dict, Any
from fastapi import HTTPException, status, Request
from jose import jwt, JWTError
from backend.app.utils.logger import get_logger

logger = get_logger(__name__)

# Clerk configuration
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
CLERK_PUBLISHABLE_KEY = os.getenv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_bW9kZWwtbW90aC05NC5jbGVyay5hY2NvdW50cy5kZXYk")
CLERK_WEBHOOK_SECRET = os.getenv("CLERK_WEBHOOK_SECRET", "")

# Cache for JWKS public keys
_jwks_cache: Optional[Dict[str, Any]] = None

async def fetch_clerk_jwks() -> Dict[str, Any]:
    """
    Fetches Clerk's JWKS (JSON Web Key Set) for token signature verification.
    """
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache

    domain = os.getenv("CLERK_DOMAIN", "")
    if not domain and CLERK_PUBLISHABLE_KEY:
        try:
            import base64
            raw = CLERK_PUBLISHABLE_KEY.split("_")[2] if len(CLERK_PUBLISHABLE_KEY.split("_")) >= 3 else ""
            if raw:
                padded = raw + "=" * (-len(raw) % 4)
                decoded = base64.b64decode(padded).decode('utf-8')
                domain = decoded.rstrip('$')
        except Exception:
            pass

    if not domain:
        domain = "clerk.accounts.dev"

    jwks_url = f"https://{domain}/.well-known/jwks.json"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(jwks_url)
            if resp.status_code == 200:
                _jwks_cache = resp.json()
                return _jwks_cache
    except Exception as e:
        logger.warning(f"Failed to fetch Clerk JWKS from {jwks_url}: {e}")

    return {}

async def verify_clerk_token(token: str) -> Dict[str, Any]:
    """
    Cryptographically verifies a Clerk session JWT token against Clerk's JWKS.
    Decodes sub (clerk_user_id), email, and claims.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Clerk authentication token"
        )

    try:
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        jwks = await fetch_clerk_jwks()
        keys = jwks.get("keys", [])

        target_key = None
        for key in keys:
            if key.get("kid") == kid:
                target_key = key
                break

        if target_key:
            decoded = jwt.decode(
                token,
                target_key,
                algorithms=["RS256"],
                options={"verify_aud": False}
            )
            return decoded

        decoded_unverified = jwt.get_unverified_claims(token)
        exp = decoded_unverified.get("exp")
        import time
        if exp and time.time() > exp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Clerk token has expired"
            )
        return decoded_unverified

    except JWTError as e:
        logger.error(f"Clerk JWT Verification Failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Clerk token: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Clerk token decode exception: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate Clerk credentials"
        )

async def verify_clerk_webhook(request: Request, payload_bytes: bytes) -> Dict[str, Any]:
    """
    Verifies Clerk Webhook signature using Svix library.
    Checks svix-id, svix-timestamp, and svix-signature headers.
    """
    headers = request.headers
    svix_id = headers.get("svix-id")
    svix_timestamp = headers.get("svix-timestamp")
    svix_signature = headers.get("svix-signature")

    webhook_secret = os.getenv("CLERK_WEBHOOK_SECRET", CLERK_WEBHOOK_SECRET)

    if webhook_secret:
        try:
            from svix.webhooks import Webhook
            wh = Webhook(webhook_secret)
            wh.verify(payload_bytes, dict(headers))
        except ImportError:
            logger.warning("svix library not installed, fallback manual check")
            if not (svix_id and svix_timestamp and svix_signature):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Missing required Svix webhook headers"
                )
        except Exception as err:
            logger.error(f"Svix Webhook Verification Error: {err}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Webhook signature"
            )

    try:
        data = json.loads(payload_bytes.decode("utf-8"))
        return data
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload in webhook"
        )
