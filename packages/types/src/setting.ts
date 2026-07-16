import type { WithTimestamps } from "./common";

export interface SettingRow extends WithTimestamps {
  key: string;
  value?: string;
  secret: boolean;
}
