"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
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
import { useProjects } from "@/hooks/useProjects";
import { useCreateAgent } from "@/hooks/useAgents";

export function CreateAgentDialog() {
  const [open, setOpen] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [brief, setBrief] = useState("");
  const { data: projects } = useProjects();
  const createAgent = useCreateAgent();

  function reset() {
    setAgentName("");
    setProjectId("");
    setLocalPath("");
    setBrief("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await createAgent.mutateAsync({
      agent_name: agentName,
      assigned_project_id: projectId,
      local_project_path: localPath,
      brief: brief || undefined,
    });
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Hire agent
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Hire a new agent</DialogTitle>
            <DialogDescription>Assign it to a project and a local path it should work from.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="agent_name">Name</Label>
              <Input id="agent_name" required value={agentName} onChange={(e) => setAgentName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project">Project</Label>
              <Select value={projectId} onValueChange={setProjectId} required>
                <SelectTrigger id="project" className="w-full">
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
              <Label htmlFor="local_path">Local project path</Label>
              <Input
                id="local_path"
                required
                placeholder="/Users/you/code/project"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brief">Brief</Label>
              <Textarea id="brief" placeholder="What should this agent focus on?" value={brief} onChange={(e) => setBrief(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createAgent.isPending || !agentName || !projectId || !localPath}>
              {createAgent.isPending ? "Hiring…" : "Hire"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
