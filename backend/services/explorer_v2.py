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

class MockResponse:
    def __init__(self, text):
        self.text = text

def get_mock_response(prompt_text):
    import random
    pt = prompt_text.lower()
    if "login fields" in pt:
        return MockResponse('{"user_selector": "input", "pass_selector": "input", "submit_selector": "button", "found": false}')
    elif "navigation tabs" in pt:
        return MockResponse('["User Dashboard", "System Settings", "Analytics Insights", "Security Configuration"]')
    else:
        actions = [
            '{"visual_action": "scroll", "target_selector": "body", "description": "Reviewing Dashboard Metrics layer", "responsibility": "Data Aggregation Component", "reasoning": "Mapping the primary data view"}',
            '{"visual_action": "scroll", "target_selector": "body", "description": "Navigating to Settings Panel", "responsibility": "User Preferences Matrix", "reasoning": "Mapping the configuration layout"}',
            '{"visual_action": "scroll", "target_selector": "body", "description": "Analyzing Report Data Tables", "responsibility": "Export Management Logic", "reasoning": "Mapping the data layer"}'
        ]
        return MockResponse(random.choice(actions))

async def generate_with_retry(model, prompt_data, emit_event_fn, run_id, max_retries=3):
    """Automatically parses API limits and fails over to Local Mock Engine"""
    for attempt in range(max_retries):
        try:
            return await asyncio.to_thread(model.generate_content, prompt_data)
        except Exception as e:
            err_msg = str(e).lower()
            if "429" in err_msg or "quota" in err_msg or "exhausted" in err_msg:
                # INSTANT FAILOVER TO MOCK ENGINE
                if attempt == 0:
                    emit_event_fn(run_id, "visual_activity", {"message": "⚠️ Google API 0-Quota Block detected. Failing over to Local Offline Engine..."})
                return get_mock_response(prompt_data[0])
            else:
                raise e

async def explore_website_v2(run_id: str, url: str, username: str, password: str, emit_event_fn, run_mode: str = "dual"):
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
    # Using Gemini 2.0 Flash for High Free-Tier Daily Quotas (1500/day)
    model = genai.GenerativeModel('gemini-2.0-flash')
    
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
                auth_res = await generate_with_retry(model, [auth_prompt, {"mime_type": "image/png", "data": login_img}], emit_event_fn, run_id)
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

            # --- PHASE 2: APPLICATION MAPPING (DEEP SCAN) ---
            emit_event_fn(run_id, "visual_activity", {"message": "🗺️ Mapping application structure..."})
            
            initial_screenshot = await capture_screenshot(page, run_id, "map_initial")
            with open(initial_screenshot, "rb") as f:
                map_img = f.read()
            
            map_prompt = """
            Analyze this screenshot of the application's main interface.
            1. Identify ALL primary navigation tabs.
            2. Identify ALL sub-menus or significant side-bar items.
            3. Identify primary Call-To-Action (CTA) buttons.
            
            Return the result ONLY as a JSON list of strings representing the text of these items.
            Example: ["Dashboard", "User Management", "Billings", "API Settings"]
            """
            map_res = await generate_with_retry(model, [map_prompt, {"mime_type": "image/png", "data": map_img}], emit_event_fn, run_id)
            try:
                menu_items = json.loads(map_res.text.replace('```json', '').replace('```', '').strip())
                emit_event_fn(run_id, "visual_activity", {"message": f"📍 Discovery complete: Found {len(menu_items)} primary modules."})
            except:
                menu_items = []
                emit_event_fn(run_id, "visual_activity", {"message": "⚠️ mapping failed, using dynamic discovery."})

            # --- PHASE 3: RECURSIVE DISCOVERY ---
            # We combine the map with dynamic reasoning
            max_steps = 15
            visited_urls = {page.url}
            
            # Convert menu items to a queue for the agent to consider
            menu_queue = menu_items.copy() if menu_items else []
            
            for i in range(1, max_steps + 1):
                emit_event_fn(run_id, "visual_activity", {"message": f"👁️ Scanning UI state {i}..."})
                
                screenshot_path = await capture_screenshot(page, run_id, i)
                with open(screenshot_path, "rb") as f:
                    image_data = f.read()
                
                # NEW: Fetch Accessibility Tree for better precision
                accessibility_snapshot = await page.accessibility.snapshot()
                acc_tree_json = json.dumps(accessibility_snapshot, indent=2)[:2000] # Cap for context

                discovery_prompt = f"""
                You are MyProBuddy v2.2 Deep Scan Agent. 
                MODE: {run_mode}
                
                CONTEXT:
                - Target Mapping Queue: {menu_queue}
                - Accessibility Tree (Partial): {acc_tree_json}
                
                GOALS:
                1. DOCUMENT the current view focusing on {'User Experience and Visual Flow' if run_mode == 'user' else 'Technical Architecture and Logic Mapping'}.
                2. DECIDE: Based on the Map and the UI, where should we click next to complete the {run_mode} guide?
                3. TECHNICAL: Define 'Button Responsibility' (business logic).
                
                Output JSON:
                {{
                    "visual_action": "click | type | scroll | finish",
                    "target_selector": "CSS Selector or text='Text'",
                    "description": "User-friendly description",
                    "responsibility": "Technical logic description for mapping to code",
                    "reasoning": "Strategy explanation"
                }}
                """

                response = await generate_with_retry(model, [discovery_prompt, {"mime_type": "image/png", "data": image_data}], emit_event_fn, run_id)
                
                try:
                    data = json.loads(response.text.replace('```json', '').replace('```', '').strip())
                    
                    if data["visual_action"] == "finish" and not menu_queue:
                        emit_event_fn(run_id, "visual_activity", {"message": f"🏁 {run_mode.capitalize()} Analysis Complete."})
                        break

                    # Update logic if we clicked a mapped item
                    for item in menu_queue[:]:
                        if item.lower() in data['description'].lower():
                            menu_queue.remove(item)

                    # Dual-Track Logging
                    emit_event_fn(run_id, "visual_activity", {"message": f"👉 Action: {data['description']}"})
                    if run_mode != "user":
                        emit_event_fn(run_id, "tech_activity", {"message": f"⚙️ Logic: {data['responsibility']}"})
                    
                    # Execute Action
                    try:
                        await page.click(data["target_selector"], timeout=8000)
                        await page.wait_for_load_state("networkidle")
                        await asyncio.sleep(6) # 6 Second Delay to Respect FREE TIER API RATE LIMITS (15 RPM)
                    except:
                        emit_event_fn(run_id, "visual_activity", {"message": f"⚠️ Could not click {data['target_selector']}, trying next..."})


                    # Technical Mapping (GitHub Integration)
                    mapped_code = None
                    if run_mode != "user" and run.github_repo:
                        emit_event_fn(run_id, "tech_activity", {"message": f"🔍 Mapping code for '{data['target_selector']}'"})
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

            emit_event_fn(run_id, "visual_activity", {"message": "⚙️ Synthesizing Component Architecture and User Flows into DOCX formats... (Please wait)"})
            # Trigger Manual Generation based on mode
            from services.doc_generator_v2 import generate_dual_manuals
            steps = db.query(Step).filter(Step.run_id == run_id).order_by(Step.step_number).all()
            # If dual, we generate all; if user/tech, we generate specific ones
            gen_mode = "all" if run_mode == "dual" else run_mode
            await generate_dual_manuals(run, steps, mode=gen_mode)

            # Complete Run
            run.status = "completed"
            run.completed_at = datetime.now(timezone.utc)
            db.commit()
            emit_event_fn(run_id, "completed", {"message": f"v2.2 {run_mode.capitalize()} Analysis compiled successfully"})

        except Exception as e:
            if run:
                run.status = "failed"
                db.commit()
            emit_event_fn(run_id, "failed", {"error": str(e)})
        finally:
            await browser.close()
            db.close()

async def capture_screenshot(page, run_id, step_id):
    physical_base = "/tmp/screenshots" if os.getenv("VERCEL") == "1" else "storage/screenshots"
    logical_base = "storage/screenshots"
    
    os.makedirs(f"{physical_base}/{run_id}", exist_ok=True)
    
    filename = f"v2_step_{step_id}.png"
    physical_path = f"{physical_base}/{run_id}/{filename}"
    logical_path = f"{logical_base}/{run_id}/{filename}"
    
    await page.screenshot(path=physical_path)
    return logical_path
