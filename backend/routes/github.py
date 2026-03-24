"""
GitHub API routes — list repos, fetch file trees, read source code
"""
from fastapi import APIRouter, HTTPException, Query
import httpx

router = APIRouter(prefix="/github", tags=["github"])


@router.get("/repos")
async def list_repos(token: str = Query(..., description="GitHub access token")):
    """List user's GitHub repositories"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.github.com/user/repos",
            params={"sort": "updated", "per_page": 50, "type": "all"},
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
            },
        )

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch repos")

    repos = response.json()
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


@router.get("/tree")
async def get_file_tree(
    repo: str = Query(..., description="Repo full name (owner/name)"),
    token: str = Query(..., description="GitHub access token"),
):
    """Get the file tree for a repository"""
    async with httpx.AsyncClient() as client:
        # Get default branch
        repo_response = await client.get(
            f"https://api.github.com/repos/{repo}",
            headers={
                "Authorization": f"Bearer {token}",
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
                "Authorization": f"Bearer {token}",
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
    repo: str = Query(...),
    path: str = Query(...),
    token: str = Query(...),
):
    """Get contents of a specific file from a repo"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.github.com/repos/{repo}/contents/{path}",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.raw+json",
            },
        )

    if response.status_code != 200:
        raise HTTPException(status_code=404, detail="File not found")

    return {"path": path, "content": response.text}
