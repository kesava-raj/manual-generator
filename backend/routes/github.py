from fastapi import APIRouter, HTTPException, Query, Depends, Request
import httpx
from sqlalchemy.orm import Session
from database import get_db
from models import User
from routes.auth import verify_jwt

router = APIRouter(prefix="/github", tags=["github"])

@router.get("/repos")
async def list_repos(request: Request, db: Session = Depends(get_db)):
    """List user's GitHub repositories using stored access token"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        # Fallback for old frontend behavior (query param)
        token_str = request.query_params.get("token")
        if not token_str:
            raise HTTPException(status_code=401, detail="Missing authorization")
    else:
        token_str = auth_header.split(" ")[1]

    try:
        # 1. Verify our App's JWT
        payload = verify_jwt(token_str)
        user_id = payload.get("sub")
        print(f"[DEBUG] Fetching repos for user_id: {user_id}")
        
        # 2. Get real GitHub token from DB
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            print(f"[DEBUG] No user found in DB for ID: {user_id}")
            raise HTTPException(status_code=401, detail="User not found in database")
            
        if not user.access_token:
            print(f"[DEBUG] User {user_id} found, but access_token is MISSING")
            raise HTTPException(status_code=401, detail="GitHub not connected for this user")
        
        gh_token = user.access_token
        print(f"[DEBUG] Using GitHub token (last 4): ...{gh_token[-4:] if gh_token else 'NONE'}")
        
        # 3. Call GitHub
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.github.com/user/repos",
                params={"sort": "updated", "per_page": 100, "type": "all"},
                headers={
                    "Authorization": f"Bearer {gh_token}",
                    "Accept": "application/json",
                },
            )

        print(f"[DEBUG] GitHub API Response Status: {response.status_code}")
        if response.status_code != 200:
            print(f"[DEBUG] GitHub API Error Body: {response.text}")
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch repos from GitHub")

        repos = response.json()
        print(f"[DEBUG] Successfully found {len(repos)} repositories.")
        return [
            {
                "full_name": r["full_name"],
                "name": r["name"],
                "description": r.get("description", ""),
                "language": r.get("language", ""),
                "updated_at": r.get("updated_at", ""),
                "html_url": r.get("html_url", ""),
                "private": r.get("private", False),
            }
            for r in repos
        ]
    except Exception as e:
        print(f"[DEBUG] ERROR in list_repos: {str(e)}")
        # Return the error as a 401 but with the message inside so the frontend can show it
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=401, detail=f"Backend Error: {str(e)}")


@router.get("/tree")
async def get_file_tree(
    request: Request,
    repo: str = Query(..., description="Repo full name (owner/name)"),
    db: Session = Depends(get_db),
):
    """Get the file tree for a repository using stored access token"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    
    token_str = auth_header.split(" ")[1]
    payload = verify_jwt(token_str)
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user or not user.access_token:
        raise HTTPException(status_code=401, detail="GitHub not connected")
    
    gh_token = user.access_token

    async with httpx.AsyncClient() as client:
        # Get default branch
        repo_response = await client.get(
            f"https://api.github.com/repos/{repo}",
            headers={
                "Authorization": f"Bearer {gh_token}",
                "Accept": "application/json",
            },
        )

        if repo_response.status_code != 200:
            raise HTTPException(status_code=404, detail="Repository not found")

        default_branch = repo_response.json().get("default_branch", "main")

        # Get recursive tree
        tree_response = await client.get(
            f"https://api.github.com/repos/{repo}/git/trees/{default_branch}",
            params={"recursive": "1"},
            headers={
                "Authorization": f"Bearer {gh_token}",
                "Accept": "application/json",
            },
        )

    if tree_response.status_code != 200:
        raise HTTPException(status_code=404, detail="Failed to fetch file tree")

    tree = tree_response.json().get("tree", [])

    # Filter to relevant source files only
    source_extensions = {
        ".py", ".js", ".jsx", ".ts", ".tsx", ".html", ".css",
        ".vue", ".svelte", ".rb", ".go", ".java", ".php",
    }

    return [
        {"path": item["path"], "type": item["type"], "size": item.get("size", 0)}
        for item in tree
        if item["type"] == "blob"
        and any(item["path"].endswith(ext) for ext in source_extensions)
    ]

@router.get("/file")
async def get_file_content(
    request: Request,
    repo: str = Query(...),
    path: str = Query(...),
    db: Session = Depends(get_db),
):
    """Get contents of a specific file using stored access token"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    
    token_str = auth_header.split(" ")[1]
    payload = verify_jwt(token_str)
    user = db.query(User).filter(User.id == payload["sub"]).first()
    gh_token = user.access_token if user else None
    
    if not gh_token:
        raise HTTPException(status_code=401, detail="GitHub not connected")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.github.com/repos/{repo}/contents/{path}",
            headers={
                "Authorization": f"Bearer {gh_token}",
                "Accept": "application/vnd.github.raw+json",
            },
        )

    if response.status_code != 200:
        raise HTTPException(status_code=404, detail="File not found")

    return {"path": path, "content": response.text}
