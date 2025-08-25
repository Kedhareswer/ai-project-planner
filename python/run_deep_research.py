#!/usr/bin/env python3
"""
Run the Deep Research agent from the command line.

Usage:
  python python/run_deep_research.py --query "Your research question"

Environment:
  - GROQ_API_KEY
  - TAVILY_API_KEY

Outputs a single line of JSON with fields: success, final_report, research_brief, notes, raw_notes, error
"""

import os
import sys
import json
import asyncio
import argparse
from pathlib import Path

# Ensure project root and src are importable
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from langchain_core.messages import HumanMessage  # type: ignore
from deep_research_from_scratch.research_agent_full import agent  # type: ignore


async def run_agent(query: str):
    """Run the compiled deep research agent and print JSON to stdout."""
    try:
        initial_state = {
            "messages": [HumanMessage(content=query)]
        }
        result = await agent.ainvoke(initial_state)  # returns state dict
        output = {
            "success": True,
            "final_report": result.get("final_report", ""),
            "research_brief": result.get("research_brief", ""),
            "notes": result.get("notes", []),
            "raw_notes": result.get("raw_notes", []),
        }
        print(json.dumps(output, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Run Deep Research Agent")
    parser.add_argument("--query", "-q", help="Research question or topic", default=None)
    args = parser.parse_args()

    query = args.query
    if not query:
        # Read from stdin if provided
        if not sys.stdin.isatty():
            query = sys.stdin.read().strip()

    if not query:
        print(json.dumps({"success": False, "error": "Missing query. Provide --query or stdin."}))
        sys.exit(2)

    # Validate environment variables
    missing = [name for name in ("GROQ_API_KEY", "TAVILY_API_KEY") if not os.getenv(name)]
    if missing:
        print(json.dumps({"success": False, "error": f"Missing environment variables: {', '.join(missing)}"}))
        sys.exit(3)

    # Windows event loop policy is fine with asyncio.run for standard scripts
    asyncio.run(run_agent(query))


if __name__ == "__main__":
    main()
