from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Form, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import os
import json
import asyncio
import shutil
from datetime import datetime

from database import get_db, SessionLocal
from models import Run, Step

router = APIRouter(prefix="/run", tags=["runs"])

# Global SSE connections per run
run_events: dict = {}

def emit_event(run_id: str, event_type: str, data: dict):
    """Emit an SSE event for a run"""
    if run_id in run_events:
        run_events[run_id].append({
            "event": event_type,
            "data": json.dumps(data),
        })

@router.post("")
async def create_run(
    background_tasks: BackgroundTasks,
    url: str = Form(...),
    username: Optional[str] = Form(""),
    password: Optional[str] = Form(""),
    github_repo: Optional[str] = Form(""),
    logo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    """Create a new v2.0 exploration run with Logo and Auth support"""
    
    # Save Logo if provided
    logo_path = None
    if logo:
        base_dir = "/tmp/logos" if os.getenv("VERCEL") == "1" else "storage/logos"
        os.makedirs(base_dir, exist_ok=True)
        logo_path = os.path.join(base_dir, f"{logo.filename}")
        with open(logo_path, "wb") as buffer:
            shutil.copyfileobj(logo.file, buffer)

    run = Run(
        url=url,
        username_cred=username,
        status="running",
        github_repo=github_repo,
        logo_path=logo_path,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    run_events[run.id] = []

    # Start v2.0 Exploration
    background_tasks.add_task(
        run_exploration_v2, run.id, url, username, password
    )

    return {"id": run.id, "url": url, "status": "running"}

async def run_exploration_v2(run_id: str, url: str, username: str, password: str):
    """Background task for v2.0 explorer"""
    from services.explorer_v2 import explore_website_v2

    async def service_emit(et, d):
        emit_event(run_id, et, d)
            
    try:
        await explore_website_v2(run_id, url, username, password, service_emit)
    except Exception as e:
        print(f"[API] v2.0 Exploration failed: {e}")
        db = SessionLocal()
        run = db.query(Run).filter(Run.id == run_id).first()
        if run:
            run.status = "failed"
            db.commit()
        db.close()
        emit_event(run_id, "failed", {"error": str(e)})

@router.get("")
async def list_runs(db: Session = Depends(get_db)):
    runs = db.query(Run).order_by(Run.created_at.desc()).all()
    return [{"id": r.id, "url": r.url, "status": r.status, "created_at": r.created_at} for r in runs]

@router.get("/{run_id}")
async def get_run(run_id: str, db: Session = Depends(get_db)):
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run: raise HTTPException(status_code=404)
    return {"id": run.id, "url": run.url, "status": run.status}

@router.get("/{run_id}/steps")
async def get_steps(run_id: str, db: Session = Depends(get_db)):
    steps = db.query(Step).filter(Step.run_id == run_id).order_by(Step.step_number).all()
    return steps

@router.get("/{run_id}/stream")
async def stream_events(run_id: str):
    async def event_generator():
        if run_id not in run_events: run_events[run_id] = []
        last_index = 0
        while True:
            events = run_events.get(run_id, [])
            while last_index < len(events):
                event = events[last_index]
                yield f"event: {event['event']}\ndata: {event['data']}\n\n"
                last_index += 1
                if event["event"] in ("completed", "failed"): return
            await asyncio.sleep(1)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/{run_id}/download/user")
async def download_user_manual(run_id: str, mode: str = "branded"):
    filename = f"user_manual_{run_id}.docx" if mode == "branded" else f"generic_user_{run_id}.docx"
    base_dir = "/tmp/docs" if os.getenv("VERCEL") == "1" else "storage/docs"
    path = os.path.join(base_dir, filename)
    if not os.path.exists(path): raise HTTPException(status_code=404, detail=f"User manual ({mode}) not ready")
    return FileResponse(path, filename=f"{mode}_user_manual_{run_id[:8]}.docx")

@router.get("/{run_id}/download/tech")
async def download_tech_manual(run_id: str, mode: str = "branded"):
    filename = f"tech_manual_{run_id}.docx" if mode == "branded" else f"generic_tech_{run_id}.docx"
    base_dir = "/tmp/docs" if os.getenv("VERCEL") == "1" else "storage/docs"
    path = os.path.join(base_dir, filename)
    if not os.path.exists(path): raise HTTPException(status_code=404, detail=f"Technical manual ({mode}) not ready")
    return FileResponse(path, filename=f"{mode}_tech_manual_{run_id[:8]}.docx")
