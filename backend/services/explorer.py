import os
import asyncio
import json
import base64
from datetime import datetime, timezone
from playwright.async_api import async_playwright
import google.generativeai as genai
from database import SessionLocal
from models import Run, Step
from services import github_service

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

async def explore_website(run_id: str, url: str, username: str, password: str, emit_event_fn):
    """
    Autonomous exploration loop using Gemini 1.5 Pro/Flash's multimodal capabilities
    and Playwright for interaction.
    """
    if not GEMINI_API_KEY:
        emit_event_fn(run_id, "failed", {"error": "GEMINI_API_KEY not configured in environment"})
        return

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await context.new_page()
        
        db = SessionLocal()
        run = db.query(Run).filter(Run.id == run_id).first()
        
        try:
            # Step 1: Initial Navigation
            emit_event_fn(run_id, "activity", {"message": f"🚀 Initializing exploration for {url}"})
            await page.goto(url, wait_until="networkidle")
            await asyncio.sleep(2)
            
            # Simple Exploration Loop
            max_steps = 10
            for i in range(1, max_steps + 1):
                emit_event_fn(run_id, "activity", {"message": f"🧠 Gemini is analyzing step {i}..."})
                
                # Take current screenshot for Gemini
                screenshot_path = await capture_screenshot(page, run_id, i)
                with open(screenshot_path, "rb") as f:
                    image_data = f.read()
                
                prompt = """
                You are an AI browser agent. Look at this screenshot of a web application.
                Your goal is to explore the application and identify the next logical step to document it.
                
                Analyze the UI and decide on an action (click, type, or scroll).
                Provide your reasoning and the specific CSS selector or text to interact with.
                
                Output your response strictly in JSON format:
                {
                    "action": "click | type | scroll | finish",
                    "target": "CSS Selector or text",
                    "value": "text to type (if any)",
                    "reasoning": "Why this action helps explore the app",
                    "description": "Short description of what you are doing (e.g. Clicking Login button)"
                }
                """

                # Gemini Multimodal Request
                response = await asyncio.to_thread(
                    model.generate_content,
                    [prompt, {"mime_type": "image/png", "data": image_data}]
                )

                try:
                    # Clean the response text for JSON parsing
                    text_response = response.text.replace('```json', '').replace('```', '').strip()
                    action_data = json.loads(text_response)
                    
                    if action_data["action"] == "finish":
                        emit_event_fn(run_id, "activity", {"message": "✅ Gemini finished exploration."})
                        break

                    # Execute action
                    reasoning = action_data["reasoning"]
                    description = action_data["description"]
                    
                    emit_event_fn(run_id, "activity", {"message": f"👉 {description}"})
                    
                    if action_data["action"] == "click":
                        await page.click(action_data["target"], timeout=5000)
                    elif action_data["action"] == "type":
                        await page.fill(action_data["target"], action_data["value"])
                        await page.keyboard.press("Enter")
                    
                    await asyncio.sleep(2)
                    
                    # Try to map source code if github repo is provided
                    mapped_code = None
                    if run.github_repo:
                        # Use the description and reasoning as keywords for searching code
                        search_keywords = f"{description} {action_data['action']}"
                        # Note: We need the GitHub token, which should be associated with the run or user.
                        # For now, we'll try to find it or use a placeholder if not available.
                        # Assuming the token might be in the environment for simplicity or passed in.
                        github_token = os.getenv("GITHUB_TOKEN") 
                        if github_token:
                            mapped_code = await github_service.find_relevant_code(
                                run.github_repo, 
                                github_token, 
                                search_keywords
                            )

                    # Record step in DB
                    new_step = Step(
                        run_id=run_id,
                        step_number=i,
                        action=action_data["action"].capitalize(),
                        description=description,
                        ai_reasoning=reasoning,
                        url=page.url,
                        screenshot_path=screenshot_path,
                        mapped_code=mapped_code
                    )
                    db.add(new_step)
                    db.commit()
                    
                    emit_event_fn(run_id, "step", {
                        "step_number": i, 
                        "action": action_data["action"].capitalize(), 
                        "reasoning": reasoning,
                        "description": description,
                        "mapped_code": mapped_code
                    })

                except Exception as eval_err:
                    print(f"Failed to parse or execute Gemini action: {eval_err}")
                    emit_event_fn(run_id, "activity", {"message": f"⚠️ Optimization required: {str(eval_err)}"})
                    # Fallback or break
                    break
                    
            run.status = "completed"
            run.completed_at = datetime.now(timezone.utc)
            db.commit()
            emit_event_fn(run_id, "completed", {"message": "Documentation generated successfully"})
            
            # Trigger Doc Generation
            from services.docgen import generate_manual
            steps = db.query(Step).filter(Step.run_id == run_id).order_by(Step.step_number).all()
            await generate_manual(run, steps)
            
        except Exception as e:
            print(f"Error in exploration: {e}")
            if run:
                run.status = "failed"
                db.commit()
            emit_event_fn(run_id, "failed", {"error": str(e)})
        finally:
            await browser.close()
            db.close()

async def capture_screenshot(page, run_id, step_num):
    base_dir = "/tmp/screenshots" if os.getenv("VERCEL") == "1" else "storage/screenshots"
    os.makedirs(f"{base_dir}/{run_id}", exist_ok=True)
    path = f"{base_dir}/{run_id}/step_{step_num:03}.png"
    await page.screenshot(path=path)
    return path
