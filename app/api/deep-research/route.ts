import { NextResponse } from "next/server";
import { DeepResearchService } from "@/lib/services/deep-research.service";
import type { DeepResearchConfig } from "@/lib/services/deep-research.types";

export const runtime = "nodejs"; // Ensure Node.js runtime (not Edge)
export const dynamic = "force-dynamic"; // This is a long-running operation

export async function POST(req: Request) {
  try {
    const { query, provider = "groq", model = "llama-3.3-70b-versatile" } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: "Query must be a non-empty string (min 3 chars)." },
        { status: 400 }
      );
    }

    // Validate provider and model
    if (!provider || typeof provider !== "string") {
      return NextResponse.json(
        { success: false, error: "Provider must be a non-empty string." },
        { status: 400 }
      );
    }

    if (!model || typeof model !== "string") {
      return NextResponse.json(
        { success: false, error: "Model must be a non-empty string." },
        { status: 400 }
      );
    }

    // Check for required API keys
    if (!process.env.TAVILY_API_KEY) {
      return NextResponse.json(
        { success: false, error: "TAVILY_API_KEY is required for web search functionality." },
        { status: 500 }
      );
    }

    // Create Deep Research configuration
    const config: DeepResearchConfig = {
      provider,
      model,
      max_iterations: 6,
      max_concurrent_agents: 3,
      search_depth: 'advanced',
      timeout_ms: Number(process.env.DEEP_RESEARCH_TIMEOUT_MS || 180000)
    };

    // Initialize Deep Research service
    const deepResearchService = new DeepResearchService(config, process.env.TAVILY_API_KEY);

    // Set timeout for the entire operation
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Deep research operation timed out'));
      }, config.timeout_ms);
    });

    // Run deep research with timeout
    const result = await Promise.race([
      deepResearchService.conductDeepResearch(query.trim()),
      timeoutPromise
    ]);

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 500 });
    }

  } catch (err: any) {
    console.error('Deep research API error:', err);
    return NextResponse.json({ 
      success: false, 
      error: String(err?.message || err),
      details: 'An unexpected error occurred during deep research processing'
    }, { status: 500 });
  }
}
