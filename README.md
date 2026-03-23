# 🤖 AutoManual AI

Generate software manuals automatically. Point it at any website, and AutoManual AI will explore it, capture screenshots, and produce a step-by-step `.docx` manual.

## Quick Start

```bash
# 1. Install all dependencies
npm install
npm run install:all

# 2. Install Playwright browsers (first time only)
cd worker && npx playwright install chromium && cd ..

# 3. Start the application
npm start
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
├── frontend/       → React.js + Vite + TailwindCSS (port 5173)
├── backend/        → Express.js + SQLite API (port 3001)
├── worker/         → Playwright automation engine
├── storage/
│   ├── screenshots/  → Captured screenshots per run
│   └── docs/         → Generated .docx manuals
└── package.json    → Root scripts (concurrently)
```

## How It Works

1. **Enter a URL** — Provide a website URL and optional login credentials
2. **Auto Explore** — Playwright navigates the site using BFS exploration
3. **Capture** — Screenshots and actions are recorded at each step
4. **Generate** — A `.docx` manual is created with all steps and screenshots

## Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS, React Router, Axios
- **Backend**: Express.js, better-sqlite3, docx
- **Worker**: Playwright (Chromium)
