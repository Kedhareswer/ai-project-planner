#!/usr/bin/env python3
"""
Run the Deep Research agent from the command line.

Usage:
  python python/run_deep_research.py --query "Your research question" --provider groq --model llama-3.3-70b-versatile

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


async def run_agent(query: str, provider: str = "groq", model: str = "llama-3.3-70b-versatile"):
    """Run the compiled deep research agent and print JSON to stdout."""
    try:
        # Initialize all models with user-selected provider and model
        from deep_research_from_scratch.utils import init_models
        from deep_research_from_scratch.research_agent_scope import init_scope_models
        from deep_research_from_scratch.multi_agent_supervisor import init_supervisor_models
        from deep_research_from_scratch.research_agent_full import init_writer_model
        from deep_research_from_scratch.research_agent import init_research_models
        
        # Initialize all models with the same provider/model
        init_models(provider, model)
        init_scope_models(provider, model)
        init_supervisor_models(provider, model)
        init_writer_model(provider, model)
        init_research_models(provider, model)
        
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
    parser.add_argument("--provider", "-p", help="AI provider (groq, openai, anthropic, etc.)", default="groq")
    parser.add_argument("--model", "-m", help="Model name for the provider", default="llama-3.3-70b-versatile")
    args = parser.parse_args()

    query = args.query
    if not query:
        # Read from stdin if provided
        if not sys.stdin.isatty():
            query = sys.stdin.read().strip()

    if not query:
        print(json.dumps({"success": False, "error": "Missing query. Provide --query or stdin."}))
        sys.exit(2)

    # Validate environment variables based on provider
    required_env_vars = ["TAVILY_API_KEY"]  # Always need Tavily
    
    # Add provider-specific API key requirements
    provider_env_map = {
        "groq": "GROQ_API_KEY",
        "openai": "OPENAI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "gemini": "GEMINI_API_KEY",
        "mistral": "MISTRAL_API_KEY",
        "aiml": "AIML_API_KEY"
    }
    
    if args.provider in provider_env_map:
        required_env_vars.append(provider_env_map[args.provider])
    
    missing = [name for name in required_env_vars if not os.getenv(name)]
    if missing:
        print(json.dumps({"success": False, "error": f"Missing environment variables: {', '.join(missing)}"}))
        sys.exit(3)

    # Windows event loop policy is fine with asyncio.run for standard scripts
    asyncio.run(run_agent(query, args.provider, args.model))


if __name__ == "__main__":
    main()
