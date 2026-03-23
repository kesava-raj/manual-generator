import httpx
import base64
import os

GITHUB_API_URL = "https://api.github.com"

async def get_repo_files(repo_full_name, token):
    headers = {"Authorization": f"token {token}"}
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{GITHUB_API_URL}/repos/{repo_full_name}/contents", headers=headers)
        if res.status_code == 200:
            return res.json()
    return []

async def find_relevant_code(repo_full_name, token, action_keyword):
    """
    Finds a relevant code snippet by searching the repository for keywords 
    extracted from the AI's action and reasoning.
    """
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            # 1. Search for code using keywords
            # Clean keyword for better search
            query = action_keyword.replace("Clicking", "").replace("button", "").strip()
            search_url = f"{GITHUB_API_URL}/search/code?q={query}+repo:{repo_full_name}"
            
            res = await client.get(search_url, headers=headers)
            
            if res.status_code == 200:
                items = res.json().get("items", [])
                if items:
                    # Pick the most likely candidate (often first result is good)
                    # Filter for common source extensions to avoid config files
                    source_files = [i for i in items if any(i['path'].endswith(ext) for ext in ['.js', '.jsx', '.ts', '.tsx', '.py', '.html'])]
                    target = source_files[0] if source_files else items[0]
                    
                    file_path = target["path"]
                    # 2. Get file content
                    content_res = await client.get(target["url"], headers=headers)
                    if content_res.status_code == 200:
                        content_data = content_res.json()
                        raw_content = base64.b64decode(content_data["content"]).decode("utf-8")
                        
                        # Return first 30 lines as a snippet with file path
                        lines = raw_content.split("\n")
                        snippet = "\n".join(lines[:30])
                        return f"// Source: {file_path}\n{snippet}"
        except Exception as e:
            print(f"[GitHub Service] Error during code mapping: {e}")
        
    return None
