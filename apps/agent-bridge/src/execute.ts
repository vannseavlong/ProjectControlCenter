import { agentsTable, commandQueueTable } from "@pcc/db";
import type { Agent, Command, CommandStatus } from "@pcc/types";
import { runClaudeCommand } from "./claude-cli";
import { config } from "./config";
import { logger } from "./logger";

/**
 * Combines the agent's persistent `brief` with this command's one-off `instruction`. Even with
 * session continuity (`--resume`, see claude-cli.ts), the brief is still re-supplied on every
 * call: a resumed session already has the prior conversation's context, but re-stating the
 * standing brief is cheap and guards against the resume falling back to a fresh session (stale/
 * invalid `claude_session_id` — see README's "Known limitations"), in which case the brief would
 * be the agent's only context.
 */
function buildPrompt(agent: Agent, instruction: string): string {
  const parts: string[] = [];
  if (agent.brief?.trim()) {
    parts.push(`You are "${agent.agent_name}", a Claude Code agent assigned to this project. Your standing brief:\n${agent.brief.trim()}`);
  }
  parts.push(`Instruction:\n${instruction}`);
  return parts.join("\n\n");
}

function truncateResult(text: string): string {
  if (text.length <= config.maxResultLength) return text;
  return `${text.slice(0, config.maxResultLength)}\n\n[agent-bridge truncated ${text.length - config.maxResultLength} characters — Sheets cells have a ~50,000 character limit]`;
}

async function finish(commandId: string, status: CommandStatus, result: string): Promise<void> {
  await commandQueueTable().update({
    where: { _id: commandId },
    data: { status, result: truncateResult(result) },
  });
}

export async function executeCommand(command: Command): Promise<void> {
  const commandId = command._id;
  const logFields = { agent_id: command.agent_id, command_id: commandId };

  const agent = await agentsTable().findOne({ where: { _id: command.agent_id } });
  if (!agent) {
    logger.error("agent no longer exists, marking command failed", logFields);
    await finish(commandId, "failed", `Agent ${command.agent_id} no longer exists.`);
    return;
  }

  // claimNextPending() already filters to active agents, but the agent could have been
  // paused/fired in the moments between the claim and this read — re-check rather than trust a
  // stale filter, and release the row back to "pending" (not "failed") since nothing was
  // attempted yet and it should simply wait for the agent to become active again.
  if (agent.status !== "active") {
    logger.warn("agent no longer active, releasing command back to pending", {
      ...logFields,
      agent_status: agent.status,
    });
    await commandQueueTable().update({ where: { _id: commandId }, data: { status: "pending" } });
    return;
  }

  logger.info("executing command", { ...logFields, local_project_path: agent.local_project_path });

  const prompt = buildPrompt(agent, command.instruction);
  const result = await runClaudeCommand(agent.local_project_path, prompt, agent.claude_session_id);
  const status: CommandStatus = result.success ? "done" : "failed";

  await finish(commandId, status, result.text);

  // A `session_id` came back means the CLI actually launched and produced a resumable
  // conversation — even a task-level failure (model says "I couldn't find X") still leaves that
  // session in place, so persist it. Only skip persisting when no session_id was returned at all
  // (launch failure or timeout before any turn completed), so we don't overwrite a previously-good
  // claude_session_id with nothing.
  await agentsTable().update({
    where: { _id: agent._id },
    data: {
      last_active: new Date().toISOString(),
      ...(result.sessionId ? { claude_session_id: result.sessionId } : {}),
    },
  });

  logger.info("command finished", {
    ...logFields,
    status,
    timed_out: result.timedOut,
    exit_code: result.exitCode,
    cost_usd: result.totalCostUsd,
  });
}
