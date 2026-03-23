from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from database import init_db
from routes import auth, runs, github

app = FastAPI(title="AutoManual AI API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
@app.on_event("startup")
def on_startup():
    init_db()

# Mount static files for screenshots and docs
if os.getenv("VERCEL") != "1":
    os.makedirs("storage/screenshots", exist_ok=True)
    os.makedirs("storage/docs", exist_ok=True)
    app.mount("/storage", StaticFiles(directory="storage"), name="storage")
else:
    # On Vercel, serve from /tmp
    os.makedirs("/tmp/screenshots", exist_ok=True)
    os.makedirs("/tmp/docs", exist_ok=True)
    app.mount("/storage/screenshots", StaticFiles(directory="/tmp/screenshots"), name="screenshots")
    app.mount("/storage/docs", StaticFiles(directory="/tmp/docs"), name="docs")

# Include routers
app.include_router(auth.router)
app.include_router(runs.router)
app.include_router(github.router)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "2.0.0 (SaaS)"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
