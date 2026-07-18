"use client";

import Link from "next/link";
import { Flame, MoreVertical, Pause, Pencil, Play, Trash2, Users, Volume2 } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Skeleton,
} from "@pcc/ui";
import type { Agent, AgentStatus } from "@pcc/types";
import { useAgents, useDeleteAgent, useUpdateAgentStatus } from "@/hooks/useAgents";
import { useProjects } from "@/hooks/useProjects";
import { formatRelativeTime } from "@/lib/format";
import { CreateAgentDialog } from "@/components/CreateAgentDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ChangeVoiceDialog } from "@/components/ChangeVoiceDialog";
import { EditAgentDialog } from "@/components/EditAgentDialog";

const STATUS_BADGE: Record<AgentStatus, "default" | "secondary" | "destructive"> = {
  active: "default",
  paused: "secondary",
  fired: "destructive",
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function AgentCard({ agent, projectName }: { agent: Agent; projectName: string }) {
  const updateStatus = useUpdateAgentStatus();
  const deleteAgent = useDeleteAgent();

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/agents/${agent._id}`} className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{initials(agent.agent_name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{agent.agent_name}</p>
            <p className="text-xs text-muted-foreground">{projectName}</p>
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="size-8 px-0">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <EditAgentDialog
              agent={agent}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Pencil className="size-4" /> Edit
                </DropdownMenuItem>
              }
            />
            {agent.status === "active" ? (
              <DropdownMenuItem onSelect={() => updateStatus.mutate({ id: agent._id, status: "paused" })}>
                <Pause className="size-4" /> Pause
              </DropdownMenuItem>
            ) : agent.status === "paused" ? (
              <DropdownMenuItem onSelect={() => updateStatus.mutate({ id: agent._id, status: "active" })}>
                <Play className="size-4" /> Reactivate
              </DropdownMenuItem>
            ) : null}
            <ChangeVoiceDialog
              agent={agent}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Volume2 className="size-4" /> Change voice
                </DropdownMenuItem>
              }
            />
            {agent.status !== "fired" ? (
              <ConfirmDialog
                trigger={
                  <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
                    <Flame className="size-4" /> Fire
                  </DropdownMenuItem>
                }
                title={`Fire ${agent.agent_name}?`}
                description="Sets status to fired. The agent record stays around — use Delete to remove it entirely."
                confirmLabel="Fire"
                onConfirm={() => updateStatus.mutateAsync({ id: agent._id, status: "fired" })}
              />
            ) : null}
            <ConfirmDialog
              trigger={
                <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
                  <Trash2 className="size-4" /> Delete
                </DropdownMenuItem>
              }
              title={`Delete ${agent.agent_name}?`}
              description="Permanently removes this agent record. This can't be undone."
              confirmLabel="Delete"
              onConfirm={() => deleteAgent.mutateAsync(agent._id)}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center justify-between">
        <Badge variant={STATUS_BADGE[agent.status]}>{agent.status}</Badge>
        <span className="font-mono text-xs text-muted-foreground">{formatRelativeTime(agent.last_active)}</span>
      </div>
    </Card>
  );
}

export default function AgentStaffPage() {
  const { data: agents, isLoading } = useAgents();
  const { data: projects } = useProjects();
  const projectNameById = new Map((projects ?? []).map((p) => [p._id, p.project_name]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Agent Staff</h1>
        <CreateAgentDialog />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : !agents || agents.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No agents yet"
            description="Hire an agent and assign it to a project it should work on."
            action={<CreateAgentDialog />}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent._id} agent={agent} projectName={projectNameById.get(agent.assigned_project_id) ?? "Unknown project"} />
          ))}
        </div>
      )}
    </div>
  );
}
