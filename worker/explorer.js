const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const StateManager = require('./stateManager');

// Parse CLI arguments
const [,, runId, targetUrl, username, password] = process.argv;

if (!runId || !targetUrl) {
  console.error('Usage: node explorer.js <runId> <url> [username] [password]');
  process.exit(1);
}

const MAX_STEPS = 25;
const SCREENSHOT_DIR = path.join(__dirname, '..', 'storage', 'screenshots', runId);
const DB_PATH = path.join(__dirname, '..', 'storage', 'db.json');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const stateManager = new StateManager();

/**
 * Read/write to the shared JSON database
 */
function getDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { runs: [], steps: [] };
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

/**
 * Save a step to the database
 */
function saveStep(stepNumber, action, description, url, screenshotPath) {
  const data = getDB();
  const step = {
    id: data.steps.length + 1,
    run_id: runId,
    step_number: stepNumber,
    action,
    description,
    url,
    screenshot_path: screenshotPath,
    created_at: new Date().toISOString(),
  };
  data.steps.push(step);
  saveDB(data);
  console.log(`  Step ${stepNumber}: ${action} - ${description.substring(0, 60)}`);
}

/**
 * Capture a screenshot and return the relative path
 */
async function captureScreenshot(page, stepNumber) {
  const filename = `step_${String(stepNumber).padStart(3, '0')}.png`;
  const fullPath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: fullPath, fullPage: false });
  return `storage/screenshots/${runId}/${filename}`;
}

/**
 * Get visible text on the page (truncated for hashing)
 */
async function getPageText(page) {
  try {
    return await page.evaluate(() => {
      return document.body ? document.body.innerText.substring(0, 1000) : '';
    });
  } catch {
    return '';
  }
}

/**
 * Extract clickable elements from the page
 */
async function extractClickableElements(page) {
  try {
    return await page.evaluate(() => {
      const elements = [];
      const selectors = ['a[href]', 'button', '[role="button"]', 'input[type="submit"]', '[onclick]'];

      for (const selector of selectors) {
        const nodes = document.querySelectorAll(selector);
        for (const node of nodes) {
          const rect = node.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;

          const style = window.getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

          const text = (node.innerText || node.value || node.getAttribute('aria-label') || '').trim().substring(0, 100);
          if (!text) continue;

          const href = node.getAttribute('href');
          if (href && (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:'))) continue;

          elements.push({
            tag: node.tagName.toLowerCase(),
            text: text,
            href: href || '',
            selector: generateUniqueSelector(node),
            type: node.tagName.toLowerCase() === 'a' ? 'link' : 'button',
          });
        }
      }

      function generateUniqueSelector(el) {
        if (el.id) return `#${el.id}`;

        const tag = el.tagName.toLowerCase();
        const text = (el.innerText || '').trim().substring(0, 30);

        if (text) {
          return `${tag}:has-text("${text.replace(/"/g, '\\"')}")`;
        }

        const parent = el.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
          const index = siblings.indexOf(el);
          const parentSel = parent.id ? `#${parent.id}` : parent.tagName.toLowerCase();
          return `${parentSel} > ${tag}:nth-of-type(${index + 1})`;
        }

        return tag;
      }

      const seen = new Set();
      return elements.filter(el => {
        const key = `${el.text}::${el.href}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 20);
    });
  } catch (err) {
    console.error('  Error extracting elements:', err.message);
    return [];
  }
}

/**
 * Attempt to log in if credentials are provided
 */
async function attemptLogin(page) {
  if (!username && !password) return false;

  try {
    const usernameField = await page.$('input[type="email"], input[type="text"][name*="user"], input[name*="email"], input[name*="login"], input[id*="user"], input[id*="email"]');
    const passwordField = await page.$('input[type="password"]');

    if (usernameField && passwordField) {
      console.log('  Found login form, attempting login...');
      await usernameField.fill(username);
      await passwordField.fill(password);

      const submitBtn = await page.$('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Sign in"), button:has-text("Login")');
      if (submitBtn) {
        await submitBtn.click();
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(2000);
        return true;
      }
    }
  } catch (err) {
    console.error('  Login attempt failed:', err.message);
  }
  return false;
}

/**
 * Main exploration function using BFS
 */
async function explore() {
  console.log(`\n🔍 Starting exploration for run ${runId}`);
  console.log(`   URL: ${targetUrl}`);
  console.log(`   Max steps: ${MAX_STEPS}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  let stepNumber = 0;

  try {
    // Step 1: Navigate to the target URL
    console.log('📌 Navigating to target URL...');
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    stepNumber++;
    const screenshotPath = await captureScreenshot(page, stepNumber);
    saveStep(stepNumber, 'Navigate', `Opened ${targetUrl}`, page.url(), screenshotPath);

    const pageText = await getPageText(page);
    const initialHash = stateManager.generateStateHash(page.url(), pageText);
    stateManager.markVisited(initialHash);

    // Step 2: Attempt login if credentials provided
    if (username || password) {
      const loggedIn = await attemptLogin(page);
      if (loggedIn) {
        stepNumber++;
        const loginScreenshot = await captureScreenshot(page, stepNumber);
        saveStep(stepNumber, 'Login', 'Logged in with provided credentials', page.url(), loginScreenshot);

        const afterLoginText = await getPageText(page);
        const loginHash = stateManager.generateStateHash(page.url(), afterLoginText);
        stateManager.markVisited(loginHash);
      }
    }

    // Step 3: BFS Exploration
    console.log('\n🔄 Starting BFS exploration...\n');

    const initialElements = await extractClickableElements(page);
    stateManager.enqueue(initialElements.map(el => ({
      ...el,
      sourceUrl: page.url(),
    })));

    console.log(`  Found ${initialElements.length} clickable elements on initial page`);

    while (!stateManager.isEmpty() && stepNumber < MAX_STEPS) {
      const action = stateManager.dequeue();
      if (!action) break;

      try {
        console.log(`\n  ▶ Attempting: ${action.type} "${action.text.substring(0, 40)}"`);

        const beforeUrl = page.url();

        try {
          const element = await page.$(action.selector);
          if (!element) {
            console.log('    ⚠ Element not found, skipping');
            continue;
          }

          const isVisible = await element.isVisible().catch(() => false);
          if (!isVisible) {
            console.log('    ⚠ Element not visible, skipping');
            continue;
          }

          await element.click({ timeout: 5000 });
        } catch {
          try {
            await page.click(`text="${action.text.substring(0, 30)}"`, { timeout: 3000 });
          } catch {
            console.log('    ⚠ Click failed, skipping');
            continue;
          }
        }

        await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1500);

        const currentText = await getPageText(page);
        const currentHash = stateManager.generateStateHash(page.url(), currentText);

        if (stateManager.isVisited(currentHash)) {
          console.log('    ↩ State already visited, skipping');
          if (page.url() !== beforeUrl) {
            await page.goBack({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(1000);
          }
          continue;
        }

        stateManager.markVisited(currentHash);

        stepNumber++;
        const screenshotPath = await captureScreenshot(page, stepNumber);
        const description = page.url() !== beforeUrl
          ? `Navigated to ${page.url()} by clicking "${action.text.substring(0, 50)}"`
          : `Clicked "${action.text.substring(0, 50)}" on ${page.url()}`;

        saveStep(
          stepNumber,
          action.type === 'link' ? 'Click Link' : 'Click Button',
          description,
          page.url(),
          screenshotPath
        );

        const newElements = await extractClickableElements(page);
        const newActions = newElements
          .map(el => ({ ...el, sourceUrl: page.url() }))
          .filter(el => {
            const elHash = `${el.text}::${el.href}`;
            return !stateManager.isVisited(elHash);
          });

        if (newActions.length > 0) {
          stateManager.enqueue(newActions.slice(0, 10));
          console.log(`    ✅ Found ${newActions.length} new elements`);
        }

        if (page.url() !== beforeUrl && !stateManager.isEmpty()) {
          await page.goBack({ timeout: 5000 }).catch(async () => {
            await page.goto(beforeUrl, { timeout: 10000 }).catch(() => {});
          });
          await page.waitForTimeout(1000);
        }
      } catch (actionErr) {
        console.error(`    ❌ Action failed: ${actionErr.message}`);
        try {
          await page.goBack({ timeout: 5000 }).catch(() => {});
        } catch {}
      }
    }

    console.log(`\n✅ Exploration complete! Total steps: ${stepNumber}`);
    console.log(`   States visited: ${stateManager.visitedCount()}`);
  } catch (err) {
    console.error(`\n❌ Exploration failed: ${err.message}`);
    try {
      stepNumber++;
      const errorPath = await captureScreenshot(page, stepNumber);
      saveStep(stepNumber, 'Error', `Exploration failed: ${err.message}`, page.url(), errorPath);
    } catch {}
    process.exit(1);
  } finally {
    await browser.close();
  }

  process.exit(0);
}

explore().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
