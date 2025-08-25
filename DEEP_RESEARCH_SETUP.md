# Deep Research Agent Setup (Windows)

This guide helps you set up and run the Deep Research Agent end-to-end in this project.

The frontend calls a Next.js API route (`app/api/deep-research/route.ts`) which spawns a Python process that runs the multi-agent workflow (`python/run_deep_research.py`).

## 1) Create a Python virtual environment

```powershell
# From the repository root
python -m venv .venv
# Activate the venv (PowerShell)
.venv\Scripts\Activate.ps1
```

## 2) Install Python dependencies

```powershell
pip install --upgrade pip
pip install -r python/requirements-deep-research.txt
```

## 3) Configure environment variables

Create `.env.local` in the repo root (copy from `env.template`) and set:

```
GROQ_API_KEY=your_groq_api_key
TAVILY_API_KEY=your_tavily_api_key
# Optional overrides
DEEP_RESEARCH_TIMEOUT_MS=180000
# For Windows, set the venv python so Next.js uses it to spawn the script:
PYTHON_PATH=C:\\full\\path\\to\\repo\\.venv\\Scripts\\python.exe
```

Notes:
- The Next.js API route passes these env vars to the Python process.
- When running the Python script directly (manual test), you must have `GROQ_API_KEY` and `TAVILY_API_KEY` set in your shell environment or use the Next.js route.

## 4) Manual smoke test (optional)

If you want to test the agent directly from Python (bypassing Next.js), run in a shell where the env vars are available:

```powershell
# Ensure env vars exist in this shell first (do not commit secrets)
$env:GROQ_API_KEY = "..."
$env:TAVILY_API_KEY = "..."
python python/run_deep_research.py --query "What are practical techniques for few-shot text-to-SQL?"
```

Expected output: a single line JSON with `success: true` and fields `final_report`, `research_brief`, etc.

## 5) Start the web app and test UI

```powershell
# Start Next.js (use your package manager of choice)
npm run dev
# or: pnpm dev
```

Open http://localhost:3000/explorer, switch to the "Deep Research" tab, enter a query, and click Run.

## Troubleshooting

- Missing dependencies: run `pip install -r python/requirements-deep-research.txt` inside the venv.
- Python not found: set `PYTHON_PATH` in `.env.local` to the venv's python.
- Timeout errors: increase `DEEP_RESEARCH_TIMEOUT_MS` in `.env.local`.
- ImportError (langgraph / langchain_groq): ensure the venv is active and deps are installed.
- Tavily 401: verify `TAVILY_API_KEY` is valid at https://app.tavily.com.
- Groq auth: verify `GROQ_API_KEY` at https://console.groq.com/keys.

## File references

- API route: `app/api/deep-research/route.ts`
- React UI: `app/explorer/components/DeepResearch.tsx`
- Python runner: `python/run_deep_research.py`
- Agent code: `src/deep_research_from_scratch/`
- Requirements: `python/requirements-deep-research.txt`
