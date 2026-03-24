import os
import asyncio
import json
import base64
from datetime import datetime, timezone
import google.generativeai as genai
from database import SessionLocal
from models import Run, Step
from services import github_service

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

async def explore_website_v2(run_id: str, url: str, username: str, password: str, emit_event_fn):
    """
    v2.0 Autonomous exploration loop:
    - Authenticated login 
    - Recursive UI discovery (Tabs, Menus)
    - Dual-track logging (Visual vs Technical)
    """
    if not GEMINI_API_KEY:
        emit_event_fn(run_id, "failed", {"error": "GEMINI_API_KEY not configured"})
        return

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        emit_event_fn(run_id, "failed", {"error": "Runtime Constraint: Playwright is not installed in this environment (Vercel Serverless). Please use the Railway Worker for crawls."})
        return

    genai.configure(api_key=GEMINI_API_KEY)
    # Using Pro for complex v2 reasoning
    model = genai.GenerativeModel('gemini-1.5-pro')
    
    async with async_playwright() as p:
        # Check for Remote Browser (CDP)
        ws_endpoint = os.getenv("BROWSER_WS_ENDPOINT")
        if ws_endpoint:
            emit_event_fn(run_id, "visual_activity", {"message": "🌐 Connecting to remote cloud browser..."})
            browser = await p.chromium.connect_over_cdp(ws_endpoint)
        else:
            emit_event_fn(run_id, "visual_activity", {"message": "💻 Launching local browser instance..."})
            browser = await p.chromium.launch(headless=True)
            
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()
        
        db = SessionLocal()
        run = db.query(Run).filter(Run.id == run_id).first()
        
        try:
            emit_event_fn(run_id, "visual_activity", {"message": f"🌐 Navigating to {url}"})
            await page.goto(url, wait_until="networkidle")
            await asyncio.sleep(3)

            # --- PHASE 1: AUTHENTICATION ---
            if username and password:
                emit_event_fn(run_id, "visual_activity", {"message": "🔐 Authenticating session..."})
                # Check if we are on a login page or if we need to find one
                login_screenshot = await capture_screenshot(page, run_id, "login_check")
                with open(login_screenshot, "rb") as f:
                    login_img = f.read()
                
                auth_prompt = f"""
                Look at this screenshot. I need to log in with username '{username}' and password '{password}'.
                Identify the login fields and the submit button.
                Output JSON: {{ "user_selector": "css", "pass_selector": "css", "submit_selector": "css", "found": true/false }}
                """
                auth_res = await asyncio.to_thread(model.generate_content, [auth_prompt, {"mime_type": "image/png", "data": login_img}])
                try:
                    auth_json = json.loads(auth_res.text.replace('```json', '').replace('```', '').strip())
                    if auth_json.get("found"):
                        await page.fill(auth_json["user_selector"], username)
                        await page.fill(auth_json["pass_selector"], password)
                        await page.click(auth_json["submit_selector"])
                        await page.wait_for_load_state("networkidle")
                        emit_event_fn(run_id, "visual_activity", {"message": "✅ Authentication successful"})
                    else:
                        emit_event_fn(run_id, "visual_activity", {"message": "⚠️ No login fields found, proceeding as guest"})
                except:
                    emit_event_fn(run_id, "visual_activity", {"message": "⚠️ Interaction failed during login, proceeding..."})

            # --- PHASE 2: RECURSIVE DISCOVERY ---
            max_steps = 15
            visited_urls = {page.url}
            
            for i in range(1, max_steps + 1):
                emit_event_fn(run_id, "visual_activity", {"message": f"👁️ Scanning UI state {i}..."})
                
                screenshot_path = await capture_screenshot(page, run_id, i)
                with open(screenshot_path, "rb") as f:
                    image_data = f.read()
                
                # Fetch minimal DOM for Technical Agent
                dom_summary = await page.evaluate("() => document.body.innerText.substring(0, 1000)")

                discovery_prompt = """
                You are MyProBuddy v2.0 Agent. 
                1. ANALYZE the UI: Identify all tabs, primary buttons, and hidden sub-menus.
                2. DECIDE: Which element should we document next to provide a complete guide?
                3. TECHNICAL: What is the 'Button Responsibility' (business logic) of the target?
                
                Output JSON:
                {
                    "visual_action": "click | type | scroll | finish",
                    "target_selector": "CSS Selector",
                    "description": "User-friendly description (e.g. Navigating to Billing Tab)",
                    "responsibility": "Technical logic (e.g. Triggers the subscription middleware)",
                    "is_new_module": true/false,
                    "reasoning": "Why this step is critical for the manual"
                }
                """

                response = await asyncio.to_thread(model.generate_content, [discovery_prompt, {"mime_type": "image/png", "data": image_data}])
                
                try:
                    data = json.loads(response.text.replace('```json', '').replace('```', '').strip())
                    
                    if data["visual_action"] == "finish":
                        emit_event_fn(run_id, "visual_activity", {"message": "🏁 Exploration goals met."})
                        break

                    # Dual-Track Logging
                    emit_event_fn(run_id, "visual_activity", {"message": f"👉 Action: {data['description']}"})
                    emit_event_fn(run_id, "tech_activity", {"message": f"⚙️ Logic: {data['responsibility']}"})
                    
                    # Execute Action
                    await page.click(data["target_selector"], timeout=8000)
                    await asyncio.sleep(2)

                    # Technical Mapping (GitHub Integration)
                    mapped_code = None
                    if run.github_repo:
                        emit_event_fn(run_id, "tech_activity", {"message": f"🔍 Mapping code for '{data['target_selector']}' in {run.github_repo}"})
                        github_token = os.getenv("GITHUB_TOKEN") 
                        if github_token:
                            search_query = f"{data['description']} {data['responsibility']}"
                            mapped_code = await github_service.find_relevant_code(run.github_repo, github_token, search_query)
                            if mapped_code:
                                emit_event_fn(run_id, "tech_activity", {"message": f"🔗 Found match in source: {list(mapped_code.keys())[0]}"})

                    # Persistence
                    new_step = Step(
                        run_id=run_id,
                        step_number=i,
                        action=data["visual_action"].capitalize(),
                        description=data["description"],
                        ai_reasoning=data["reasoning"],
                        url=page.url,
                        screenshot_path=screenshot_path,
                        mapped_code=mapped_code
                    )
                    db.add(new_step)
                    db.commit()

                    emit_event_fn(run_id, "step", {
                        "step_number": i,
                        "action": data["visual_action"],
                        "description": data["description"],
                        "responsibility": data["responsibility"],
                        "mapped_code": mapped_code
                    })

                except Exception as eval_err:
                    emit_event_fn(run_id, "visual_activity", {"message": f"⚠️ Analysis gap: {str(eval_err)}"})
                    break

            # Complete Run
            run.status = "completed"
            run.completed_at = datetime.now(timezone.utc)
            db.commit()
            emit_event_fn(run_id, "completed", {"message": "v2.0 Documentation compiled successfully"})
            
            # Trigger Dual-Manual Generation
            from services.doc_generator_v2 import generate_dual_manuals
            steps = db.query(Step).filter(Step.run_id == run_id).order_by(Step.step_number).all()
            await generate_dual_manuals(run, steps, mode="all")

        except Exception as e:
            if run:
                run.status = "failed"
                db.commit()
            emit_event_fn(run_id, "failed", {"error": str(e)})
        finally:
            await browser.close()
            db.close()

async def capture_screenshot(page, run_id, step_id):
    base_dir = "/tmp/screenshots" if os.getenv("VERCEL") == "1" else "storage/screenshots"
    os.makedirs(f"{base_dir}/{run_id}", exist_ok=True)
    path = f"{base_dir}/{run_id}/v2_step_{step_id}.png"
    await page.screenshot(path=path)
    return path
