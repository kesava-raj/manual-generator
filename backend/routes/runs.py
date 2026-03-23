"""
Run management routes for AutoManual AI
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import os
import json
import asyncio

from database import get_db
from models import Run, Step

router = APIRouter(prefix="/api/run", tags=["runs"])


class CreateRunRequest(BaseModel):
    url: str
    username: Optional[str] = ""
    password: Optional[str] = ""
    github_repo: Optional[str] = ""
    user_id: Optional[str] = ""
    is_mock: Optional[bool] = False


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
    req: CreateRunRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Create a new exploration run (Normal or Mock)"""
    if not req.url:
        raise HTTPException(status_code=400, detail="URL is required")

    url = req.url.strip()
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url

    run = Run(
        url=url,
        username_cred=req.username or "",
        status="running",
        github_repo=req.github_repo or "",
        user_id=req.user_id or None,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    print(f"[API] Created {'MOCK ' if req.is_mock else 'NORMAL '}run {run.id} for {url}")

    # Initialize SSE event queue for this run
    run_events[run.id] = []

    # Start exploration in background
    if req.is_mock:
        from services.mock_explorer import run_mock_exploration
        from database import SessionLocal
        
        async def run_mock():
            db_task = SessionLocal()
            try:
                async def service_emit(et, d):
                    emit_event(run.id, et, d)
                await run_mock_exploration(db_task, run.id, service_emit)
            finally:
                db_task.close()
        
        background_tasks.add_task(run_mock)
    else:
        background_tasks.add_task(
            run_exploration, run.id, url, req.username or "", req.password or ""
        )

    return {"id": run.id, "url": url, "status": "running"}


async def run_exploration(run_id: str, url: str, username: str, password: str):
    """Background task to run the actual exploration"""
    from services.explorer import explore_website

    try:
        # We need a proper way to get emit_event for the service
        async def service_emit(et, d):
            emit_event(run_id, et, d)
            
        await explore_website(run_id, url, username, password, service_emit)
    except Exception as e:
        print(f"[API] Exploration failed for {run_id}: {e}")
        # Update run status to failed
        from database import SessionLocal

        db = SessionLocal()
        run = db.query(Run).filter(Run.id == run_id).first()
        if run:
            run.status = "failed"
            db.commit()
        db.close()


@router.get("")
async def list_runs(db: Session = Depends(get_db)):
    """List all runs"""
    runs = db.query(Run).order_by(Run.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "url": r.url,
            "status": r.status,
            "total_steps": r.total_steps,
            "github_repo": r.github_repo,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
        for r in runs
    ]


@router.get("/{run_id}")
async def get_run(run_id: str, db: Session = Depends(get_db)):
    """Get run details"""
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    step_count = db.query(Step).filter(Step.run_id == run_id).count()

    return {
        "id": run.id,
        "url": run.url,
        "status": run.status,
        "total_steps": run.total_steps,
        "current_steps": step_count,
        "github_repo": run.github_repo,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
    }


@router.get("/{run_id}/steps")
async def get_steps(run_id: str, db: Session = Depends(get_db)):
    """Get all steps for a run"""
    steps = (
        db.query(Step)
        .filter(Step.run_id == run_id)
        .order_by(Step.step_number)
        .all()
    )
    return [
        {
            "id": s.id,
            "run_id": s.run_id,
            "step_number": s.step_number,
            "action": s.action,
            "description": s.description,
            "ai_reasoning": s.ai_reasoning,
            "url": s.url,
            "screenshot_path": s.screenshot_path,
            "source_file": s.source_file,
            "mapped_code": s.mapped_code,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in steps
    ]


@router.get("/{run_id}/stream")
async def stream_events(run_id: str):
    """SSE endpoint for real-time agent activity"""

    async def event_generator():
        # Initialize queue if not exists
        if run_id not in run_events:
            run_events[run_id] = []

        last_index = 0
        while True:
            events = run_events.get(run_id, [])
            while last_index < len(events):
                event = events[last_index]
                yield f"event: {event['event']}\ndata: {event['data']}\n\n"
                last_index += 1

                # Check if exploration is done
                if event["event"] in ("completed", "failed"):
                    return

            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{run_id}/download")
async def download_document(run_id: str, db: Session = Depends(get_db)):
    """Download generated document"""
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    doc_path = os.path.join("storage", "docs", f"{run_id}.docx")
    if not os.path.exists(doc_path):
        raise HTTPException(status_code=404, detail="Document not yet generated")

    return FileResponse(
        doc_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=f"manual-{run_id[:8]}.docx",
    )
