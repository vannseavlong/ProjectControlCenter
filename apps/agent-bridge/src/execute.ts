import { agentsTable, commandQueueTable } from "@pcc/db";
import type { Agent, Command, CommandStatus } from "@pcc/types";
import { runClaudeCommand } from "./claude-cli";
import { config } from "./config";
import { logger } from "./logger";

/**
 * Combines the agent's persistent `brief` with this command's one-off `instruction`. Every
 * `claude -p` call is a fresh, memory-less process (no `--resume`/session continuity across
 * commands — see README's "Known limitations"), so the brief has to be re-supplied every time or
 * the agent would have no standing context at all beyond the single instruction.
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
  const result = await runClaudeCommand(agent.local_project_path, prompt);
  const status: CommandStatus = result.success ? "done" : "failed";

  await finish(commandId, status, result.text);
  await agentsTable().update({
    where: { _id: agent._id },
    data: { last_active: new Date().toISOString() },
  });

  logger.info("command finished", {
    ...logFields,
    status,
    timed_out: result.timedOut,
    exit_code: result.exitCode,
  });
}
