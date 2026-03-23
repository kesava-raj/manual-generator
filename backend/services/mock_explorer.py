import asyncio
from sqlalchemy.orm import Session
from models import Run, Step
from datetime import datetime
import os
import random

# Mock data for a high-quality demo run
MOCK_STEPS = [
    {
        "action": "Navigate to Home Page",
        "description": "The agent starts the exploration at the main landing page of the application.",
        "ai_reasoning": "Initial entry point to discover the core features of the web app.",
        "url": "https://example.com/",
        "keyword": "home"
    },
    {
        "action": "Click 'Features' Tab",
        "description": "The agent navigates to the features section to understand the core value proposition.",
        "ai_reasoning": "I need to identify the key functionalities offered by this platform.",
        "url": "https://example.com/features",
        "keyword": "features"
    },
    {
        "action": "Open Login Modal",
        "description": "The agent identifies the login trigger and opens the authentication interface.",
        "ai_reasoning": "Accessing protected areas requires identifying the login mechanism.",
        "url": "https://example.com/features#login",
        "keyword": "login"
    },
    {
        "action": "Enter Credentials & Submit",
        "description": "The agent fills in the provided credentials into the email and password fields.",
        "ai_reasoning": "Executing the login flow to reach the dashboard and internal tools.",
        "url": "https://example.com/dashboard",
        "keyword": "auth"
    }
]

async def run_mock_exploration(db: Session, run_id: str, emit_event):
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        return
        
    run.status = "running"
    db.commit()
    
    await emit_event("activity", {"message": "Starting specialized mock exploration for product demo..."})
    await asyncio.sleep(2)
    
    for i, m_step in enumerate(MOCK_STEPS):
        step_num = i + 1
        await emit_event("activity", {"message": f"Step {step_num}: {m_step['action']}"})
        await emit_event("activity", {"message": f"Reasoning: {m_step['ai_reasoning']}"})
        
        # Simulate thinking and source mapping
        await asyncio.sleep(3)
        await emit_event("activity", {"message": f"Mapping UI interaction to repository '{run.github_repo}'..."})
        
        # Create the step in DB
        new_step = Step(
            run_id=run.id,
            step_number=step_num,
            action=m_step["action"],
            description=m_step["description"],
            ai_reasoning=m_step["ai_reasoning"],
            url=m_step["url"],
            # screenshot_path will be fake for now or we can use a generic image
            screenshot_path=f"storage/screenshots/{run.id}_step_{step_num}.jpg",
            mapped_code=f"// Mock Mapped Code for {m_step['keyword']}\nclass {m_step['keyword'].capitalize()}Controller:\n    def handle(self):\n        pass"
        )
        
        # Ensure screenshot dir exists
        os.makedirs("storage/screenshots", exist_ok=True)
        # We don't actually have a screenshot, but we'll fulfill the path
        with open(new_step.screenshot_path, "w") as f:
            f.write("mock screenshot data")
            
        db.add(new_step)
        run.total_steps = step_num
        db.commit()
        
        await emit_event("step", {
            "id": new_step.id,
            "step_number": new_step.step_number,
            "action": new_step.action,
            "description": new_step.description,
            "ai_reasoning": new_step.ai_reasoning,
            "url": new_step.url
        })
        
    run.status = "completed"
    run.completed_at = datetime.now()
    db.commit()
    
    # Generate the actual manual
    from services.docgen import generate_manual
    await emit_event("activity", {"message": "Finalizing premium manual generation..."})
    doc_path = await generate_manual(run, run.steps)
    
    await emit_event("completed", {"run_id": run_id, "doc_url": f"/api/docs/{run_id}.docx"})
