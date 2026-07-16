import type { WithTimestamps } from "./common";

export type CommandStatus = "pending" | "in_progress" | "done" | "failed";

export interface Command extends WithTimestamps {
  agent_id: string;
  instruction: string;
  status: CommandStatus;
  result?: string;
}
