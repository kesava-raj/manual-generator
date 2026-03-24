"""
GitHub OAuth routes for AutoManual AI
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import httpx
import jwt
import os
from datetime import datetime, timezone, timedelta

from database import get_db
from models import User

router = APIRouter(prefix="/auth", tags=["auth"])

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
JWT_SECRET = os.getenv("JWT_SECRET", "automanual_secret")

# In production, Vercel provides VERCEL_URL if we want to use it
VERCEL_URL = os.getenv("VERCEL_URL")
DEFAULT_FRONTEND = f"https://{VERCEL_URL}" if VERCEL_URL else "http://localhost:5173"
FRONTEND_URL = os.getenv("FRONTEND_URL", DEFAULT_FRONTEND)


def create_jwt(user_id: str, username: str) -> str:
    """Create a JWT token for the user"""
    payload = {
        "sub": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def verify_jwt(token: str) -> dict:
    """Verify and decode a JWT token"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get("/github/login")
async def github_login(request: Request):
    """Redirect to GitHub OAuth authorization page"""
    # Dynamically detect the base URL (works for both localhost and Vercel)
    base_url = str(request.base_url).rstrip("/")
    
    scope = "read:user user:email repo"
    url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={GITHUB_CLIENT_ID}"
        f"&scope={scope}"
        f"&redirect_uri={base_url}/api/auth/github/callback"
    )
    return RedirectResponse(url=url)


@router.get("/github/callback")
async def github_callback(code: str, db: Session = Depends(get_db)):
    """Handle GitHub OAuth callback"""
    if not code:
        raise HTTPException(status_code=400, detail="No authorization code provided")

    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )

    token_data = token_response.json()
    access_token = token_data.get("access_token")

    if not access_token:
        raise HTTPException(status_code=400, detail="Failed to get access token")

    # Get user info from GitHub
    async with httpx.AsyncClient() as client:
        user_response = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
        )

    github_user = user_response.json()
    github_id = str(github_user.get("id"))
    username = github_user.get("login", "")
    email = github_user.get("email", "") or ""
    avatar_url = github_user.get("avatar_url", "")

    # Find or create user
    user = db.query(User).filter(User.github_id == github_id).first()

    if user:
        user.access_token = access_token
        user.username = username
        user.avatar_url = avatar_url
    else:
        user = User(
            github_id=github_id,
            username=username,
            email=email,
            avatar_url=avatar_url,
            access_token=access_token,
        )
        db.add(user)

    db.commit()
    db.refresh(user)

    # Create JWT
    token = create_jwt(user.id, user.username)

    # Redirect to frontend with token
    return RedirectResponse(
        url=f"{FRONTEND_URL}/auth/callback?token={token}"
    )


@router.get("/me")
async def get_current_user(request: Request, db: Session = Depends(get_db)):
    """Get current user info from JWT token in Authorization header"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    
    token = auth_header.split(" ")[1]
    payload = verify_jwt(token)
    user = db.query(User).filter(User.id == payload["sub"]).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatar_url": user.avatar_url,
        "github_id": user.github_id,
    }
