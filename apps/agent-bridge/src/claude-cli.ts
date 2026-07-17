import { spawn } from "node:child_process";
import { config } from "./config";
import { logger } from "./logger";

export interface ClaudeRunResult {
  success: boolean;
  text: string;
  timedOut: boolean;
  exitCode: number | null;
  /** The CLI's `session_id` for this turn, when one was returned — undefined if the process never
   * produced a JSON result at all (launch failure, timeout). Persisted by execute.ts as the
   * agent's `claude_session_id` so the *next* command for this agent can `--resume` from here. */
  sessionId: string | undefined;
  /** `total_cost_usd` from the CLI's JSON result, when present — logged for cost visibility. */
  totalCostUsd: number | undefined;
}

interface ClaudePrintResult {
  result?: unknown;
  is_error?: unknown;
  session_id?: unknown;
  total_cost_usd?: unknown;
}

/** Internal shape used while a single spawn is in flight — `invalidSession` never escapes
 * `runClaudeCommand`, it's just how `spawnClaude` reports "this --resume ID doesn't exist" up to
 * the retry logic above it. */
interface SpawnOutcome extends ClaudeRunResult {
  invalidSession: boolean;
}

/**
 * `claude -p "<prompt>" --output-format json --permission-mode bypassPermissions [--resume <id>]`
 * in `cwd`. Confirmed live against the actual CLI (2.1.211) in this environment before writing
 * this:
 * - `--output-format json` returns one JSON object on stdout with a `result` string, an
 *   `is_error` boolean, a `session_id` (UUID) string, and a `total_cost_usd` number; exit code is
 *   0 for a completed turn (even ones the model itself flags `is_error: true` for, e.g. hitting a
 *   limit) and non-zero for CLI-level failures (bad args, empty prompt, etc).
 * - `--resume <id>` (confirmed as `-r, --resume [value]` in `claude --help`) against a session ID
 *   that actually exists correctly continues that conversation: `session_id` in the result stays
 *   the same, and the model has full context from the earlier turn (verified live — asked it to
 *   recall a value from the prior message via a `--resume` call, it did, and cache-read token
 *   counts confirmed the prior context was reused rather than re-derived).
 * - `--resume <id>` against an ID that doesn't exist (expired/deleted/never existed) exits with
 *   code 1, writes a plain-text `No conversation found with session ID: <id>` to stderr, and
 *   produces *no* stdout at all — not even the usual JSON envelope. This is a CLI-level launch
 *   failure before any turn runs, so there's nothing to parse as JSON; `isInvalidSessionError()`
 *   below detects this by exit code + stderr text and triggers the one-shot fresh-session
 *   fallback rather than failing the whole command.
 *
 * `--permission-mode bypassPermissions` (not `--dangerously-skip-permissions`) is the deliberate
 * choice: this daemon runs fully unattended, so there is no one present to answer a permission
 * prompt — every command sent to an agent is executed with full tool access in that agent's
 * `local_project_path`, no per-tool confirmation. That's the whole point of assigning a project
 * to an "active" agent in this system; see the README's Security note.
 */
export async function runClaudeCommand(
  cwd: string,
  prompt: string,
  resumeSessionId?: string,
): Promise<ClaudeRunResult> {
  if (resumeSessionId) {
    const resumed = await spawnClaude(cwd, prompt, resumeSessionId);
    if (!resumed.invalidSession) {
      return stripInvalidSessionFlag(resumed);
    }
    logger.warn("stored claude_session_id is stale or invalid, falling back to a fresh session", {
      cwd,
      stale_session_id: resumeSessionId,
    });
    return stripInvalidSessionFlag(await spawnClaude(cwd, prompt, undefined));
  }

  return stripInvalidSessionFlag(await spawnClaude(cwd, prompt, undefined));
}

/** `invalidSession` is `spawnClaude`'s internal signal to the retry logic above — never meant to
 * be part of the public `ClaudeRunResult` shape callers (execute.ts, logs) see. */
function stripInvalidSessionFlag(outcome: SpawnOutcome): ClaudeRunResult {
  const { invalidSession: _invalidSession, ...result } = outcome;
  void _invalidSession;
  return result;
}

function spawnClaude(
  cwd: string,
  prompt: string,
  resumeSessionId: string | undefined,
): Promise<SpawnOutcome> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const args = ["-p", prompt, "--output-format", "json", "--permission-mode", "bypassPermissions"];
    if (resumeSessionId) {
      args.push("--resume", resumeSessionId);
    }

    const child = spawn(config.claudeBin, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });

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
        sessionId: undefined,
        totalCostUsd: undefined,
        invalidSession: false,
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
          sessionId: undefined,
          totalCostUsd: undefined,
          invalidSession: false,
        });
        return;
      }

      if (resumeSessionId && isInvalidSessionError(stdout, stderr, exitCode)) {
        resolve({
          success: false,
          text: "",
          timedOut: false,
          exitCode,
          sessionId: undefined,
          totalCostUsd: undefined,
          invalidSession: true,
        });
        return;
      }

      resolve({
        ...parseOutput(stdout, stderr, exitCode),
        timedOut: false,
        exitCode,
        invalidSession: false,
      });
    });
  });
}

/**
 * See the doc comment on `runClaudeCommand` for what this detects and why: an unknown `--resume`
 * ID is a CLI-level failure with no JSON on stdout, so this is a plain-text match on stderr rather
 * than a parsed field.
 */
function isInvalidSessionError(stdout: string, stderr: string, exitCode: number | null): boolean {
  if (exitCode === 0) return false;
  return `${stdout}\n${stderr}`.toLowerCase().includes("no conversation found");
}

function parseOutput(
  stdout: string,
  stderr: string,
  exitCode: number | null,
): Pick<ClaudeRunResult, "success" | "text" | "sessionId" | "totalCostUsd"> {
  const trimmed = stdout.trim();
  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as ClaudePrintResult;
      if (typeof parsed.result === "string") {
        const isError = parsed.is_error === true;
        return {
          success: exitCode === 0 && !isError,
          text: parsed.result,
          sessionId: typeof parsed.session_id === "string" ? parsed.session_id : undefined,
          totalCostUsd: typeof parsed.total_cost_usd === "number" ? parsed.total_cost_usd : undefined,
        };
      }
    } catch {
      // Not JSON (or not the shape we expect) — fall through to raw output below.
    }
  }

  const combined = [trimmed, stderr.trim()].filter(Boolean).join("\n--- stderr ---\n");
  return {
    success: exitCode === 0,
    text: combined || `claude exited with code ${exitCode} and produced no output`,
    sessionId: undefined,
    totalCostUsd: undefined,
  };
}
