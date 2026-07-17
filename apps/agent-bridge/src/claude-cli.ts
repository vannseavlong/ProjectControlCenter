import { spawn } from "node:child_process";
import { config } from "./config";

export interface ClaudeRunResult {
  success: boolean;
  text: string;
  timedOut: boolean;
  exitCode: number | null;
}

interface ClaudePrintResult {
  result?: unknown;
  is_error?: unknown;
}

/**
 * `claude -p "<prompt>" --output-format json --permission-mode bypassPermissions` in `cwd`.
 * Confirmed live against the actual CLI (2.1.195) in this environment before writing this:
 * `--output-format json` returns one JSON object on stdout with a `result` string and an
 * `is_error` boolean; exit code is 0 for a completed turn (even ones the model itself flags
 * `is_error: true` for, e.g. hitting a limit) and non-zero for CLI-level failures (bad args,
 * empty prompt, etc).
 *
 * `--permission-mode bypassPermissions` (not `--dangerously-skip-permissions`) is the deliberate
 * choice: this daemon runs fully unattended, so there is no one present to answer a permission
 * prompt — every command sent to an agent is executed with full tool access in that agent's
 * `local_project_path`, no per-tool confirmation. That's the whole point of assigning a project
 * to an "active" agent in this system; see the README's Security note.
 */
export async function runClaudeCommand(cwd: string, prompt: string): Promise<ClaudeRunResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const child = spawn(
      config.claudeBin,
      [
        "-p",
        prompt,
        "--output-format",
        "json",
        "--permission-mode",
        "bypassPermissions",
      ],
      { cwd, stdio: ["ignore", "pipe", "pipe"] },
    );

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, config.commandTimeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        success: false,
        text: `Failed to launch "${config.claudeBin}" in ${cwd}: ${err.message}`,
        timedOut: false,
        exitCode: null,
      });
    });

    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (timedOut) {
        resolve({
          success: false,
          text: `Command timed out after ${config.commandTimeoutMs}ms and was killed. Output captured before kill:\n${stdout || stderr || "(none)"}`,
          timedOut: true,
          exitCode,
        });
        return;
      }

      resolve({ ...parseOutput(stdout, stderr, exitCode), timedOut: false, exitCode });
    });
  });
}

function parseOutput(
  stdout: string,
  stderr: string,
  exitCode: number | null,
): Pick<ClaudeRunResult, "success" | "text"> {
  const trimmed = stdout.trim();
  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as ClaudePrintResult;
      if (typeof parsed.result === "string") {
        const isError = parsed.is_error === true;
        return { success: exitCode === 0 && !isError, text: parsed.result };
      }
    } catch {
      // Not JSON (or not the shape we expect) — fall through to raw output below.
    }
  }

  const combined = [trimmed, stderr.trim()].filter(Boolean).join("\n--- stderr ---\n");
  return {
    success: exitCode === 0,
    text: combined || `claude exited with code ${exitCode} and produced no output`,
  };
}
