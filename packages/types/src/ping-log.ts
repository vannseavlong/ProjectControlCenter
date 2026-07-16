import type { WithTimestamps } from "./common";

export type PingStatus = "success" | "timeout" | "error";

export interface PingLog extends WithTimestamps {
  project_id: string;
  status: PingStatus;
  response_time_ms?: number;
}
