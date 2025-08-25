import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const runtime = "nodejs"; // Ensure Node.js runtime (not Edge)
export const dynamic = "force-dynamic"; // This is a long-running operation

function getPythonCommand() {
  // Allow override
  if (process.env.PYTHON_PATH && process.env.PYTHON_PATH.trim()) return process.env.PYTHON_PATH;
  // Default
  return process.platform === "win32" ? "python" : "python3";
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: "Query must be a non-empty string (min 3 chars)." },
        { status: 400 }
      );
    }

    const scriptPath = path.join(process.cwd(), "python", "run_deep_research.py");
    const pythonCmd = getPythonCommand();

    const env = {
      ...process.env,
      // Explicitly pass required keys
      GROQ_API_KEY: process.env.GROQ_API_KEY || "",
      TAVILY_API_KEY: process.env.TAVILY_API_KEY || "",
    } as NodeJS.ProcessEnv;

    const child = spawn(pythonCmd, [scriptPath, "--query", query], {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      const timeoutMs = Number(process.env.DEEP_RESEARCH_TIMEOUT_MS || 180000); // 3 minutes default
      const to = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
        resolve({ code: 124, stdout, stderr: stderr + "\nProcess timed out" });
      }, timeoutMs);

      child.on("error", (err) => {
        clearTimeout(to);
        resolve({ code: 127, stdout, stderr: String(err) });
      });

      child.on("close", (code) => {
        clearTimeout(to);
        resolve({ code, stdout, stderr });
      });
    });

    // Try to parse JSON from stdout; use the last JSON-looking line
    let payload: any = null;
    const lines = result.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (line.startsWith("{") && line.endsWith("}")) {
        try {
          payload = JSON.parse(line);
          break;
        } catch {}
      }
    }

    if (!payload) {
      // Fallback: include stderr for debugging
      return NextResponse.json(
        {
          success: false,
          error: "Failed to parse deep research output",
          details: result.stderr || result.stdout,
        },
        { status: 500 }
      );
    }

    if (payload.success === false) {
      return NextResponse.json(payload, { status: 500 });
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: String(err?.message || err) }, { status: 500 });
  }
}
