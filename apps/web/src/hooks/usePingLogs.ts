"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function usePingLogs() {
  return useQuery({ queryKey: ["ping-logs"], queryFn: api.pingLogs.list });
}
