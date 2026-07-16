import type { PingStatus } from "@pcc/types";
import type { StatusDotTone } from "@pcc/ui";

export function pingStatusToTone(status: PingStatus): StatusDotTone {
  switch (status) {
    case "success":
      return "up";
    case "timeout":
      return "sleeping";
    case "error":
      return "down";
  }
}
