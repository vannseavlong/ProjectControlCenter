"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Mic, Pencil } from "lucide-react";
import { Avatar, AvatarFallback, Badge, Button, Card, EmptyState, Skeleton } from "@pcc/ui";
import type { AgentStatus } from "@pcc/types";
import { useAgents } from "@/hooks/useAgents";
import { useProjects } from "@/hooks/useProjects";
import { formatRelativeTime } from "@/lib/format";
import { EditAgentDialog } from "@/components/EditAgentDialog";

const STATUS_BADGE: Record<AgentStatus, "default" | "secondary" | "destructive"> = {
  active: "default",
  paused: "secondary",
  fired: "destructive",
};

function initials(name: string): string {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: agents, isLoading } = useAgents();
  const { data: projects } = useProjects();

  const agent = agents?.find((a) => a._id === params.id);
  const project = projects?.find((p) => p._id === agent?.assigned_project_id);

  return (
    <div className="space-y-4">
      <Link href="/agents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Agent Staff
      </Link>

      {isLoading ? (
        <Card className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </Card>
      ) : !agent ? (
        <Card>
          <EmptyState title="Agent not found" description="It may have been deleted." />
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="size-12">
                <AvatarFallback className="text-base">{initials(agent.agent_name)}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-semibold">{agent.agent_name}</h1>
                <p className="text-sm text-muted-foreground">{project?.project_name ?? "Unknown project"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={STATUS_BADGE[agent.status]}>{agent.status}</Badge>
              <EditAgentDialog
                agent={agent}
                trigger={
                  <Button variant="secondary">
                    <Pencil className="size-4" /> Edit
                  </Button>
                }
              />
              <Button asChild>
                <Link href={`/voice?agent=${agent._id}`}>
                  <Mic className="size-4" /> Talk to this agent
                </Link>
              </Button>
            </div>
          </Card>

          <Card className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Brief</h2>
            <p className="text-sm text-muted-foreground">{agent.brief || "No brief set."}</p>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="space-y-1">
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Local project path</h2>
              <p className="font-mono text-sm">{agent.local_project_path}</p>
            </Card>
            <Card className="space-y-1">
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Last active</h2>
              <p className="font-mono text-sm">{formatRelativeTime(agent.last_active)}</p>
            </Card>
          </div>

          <Card>
            <h2 className="mb-2 text-sm font-semibold text-foreground">Recent activity</h2>
            <EmptyState
              title="No activity feed yet"
              description="Agent execution runs through agent-bridge, which hasn't landed — this will fill in once that's wired up."
            />
          </Card>
        </>
      )}
    </div>
  );
}
