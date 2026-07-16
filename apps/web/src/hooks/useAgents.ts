"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AgentStatus } from "@pcc/types";
import { toast } from "@pcc/ui";
import { api, type CreateAgentInput } from "@/lib/api-client";

const AGENTS_KEY = ["agents"] as const;

export function useAgents() {
  return useQuery({ queryKey: AGENTS_KEY, queryFn: api.agents.list });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAgentInput) => api.agents.create(input),
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: AGENTS_KEY });
      toast.success(`${agent.agent_name} hired`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateAgentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AgentStatus }) => api.agents.updateStatus(id, status),
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: AGENTS_KEY });
      const verb = agent.status === "fired" ? "fired" : agent.status === "paused" ? "paused" : "reactivated";
      toast.success(`${agent.agent_name} ${verb}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.agents.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENTS_KEY });
      toast.success("Agent deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
