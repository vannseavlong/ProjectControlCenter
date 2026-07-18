"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@pcc/ui";
import type { Agent } from "@pcc/types";
import { useProjects } from "@/hooks/useProjects";
import { useUpdateAgent } from "@/hooks/useAgents";

interface EditAgentDialogProps {
  trigger: ReactNode;
  agent: Agent;
}

/**
 * Staffing edit — rename, reposition to a different project, repoint the local working path, or
 * rewrite the brief. Same dialog composition as `ChangeVoiceDialog` (reset-on-open, one PATCH on
 * save) but for the fields that dialog leaves untouched.
 */
export function EditAgentDialog({ trigger, agent }: EditAgentDialogProps) {
  const [open, setOpen] = useState(false);
  const [agentName, setAgentName] = useState(agent.agent_name);
  const [projectId, setProjectId] = useState(agent.assigned_project_id);
  const [localPath, setLocalPath] = useState(agent.local_project_path);
  const [brief, setBrief] = useState(agent.brief ?? "");
  const { data: projects } = useProjects();
  const updateAgent = useUpdateAgent();

  function handleOpenChange(next: boolean) {
    if (next) {
      setAgentName(agent.agent_name);
      setProjectId(agent.assigned_project_id);
      setLocalPath(agent.local_project_path);
      setBrief(agent.brief ?? "");
    }
    setOpen(next);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await updateAgent.mutateAsync({
      id: agent._id,
      agent_name: agentName,
      assigned_project_id: projectId,
      local_project_path: localPath,
      brief,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{`Edit ${agent.agent_name}`}</DialogTitle>
            <DialogDescription>Update this agent&apos;s name, project assignment, local path, or brief.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit_agent_name">Name</Label>
              <Input id="edit_agent_name" required value={agentName} onChange={(e) => setAgentName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_project">Project</Label>
              <Select value={projectId} onValueChange={setProjectId} required>
                <SelectTrigger id="edit_project" className="w-full">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {(projects ?? []).map((project) => (
                    <SelectItem key={project._id} value={project._id}>
                      {project.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_local_path">Local project path</Label>
              <Input
                id="edit_local_path"
                required
                placeholder="/Users/you/code/project"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_brief">Brief</Label>
              <Textarea
                id="edit_brief"
                placeholder="What should this agent focus on?"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={updateAgent.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateAgent.isPending || !agentName || !projectId || !localPath}>
              {updateAgent.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
