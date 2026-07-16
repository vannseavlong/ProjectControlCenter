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
  Textarea,
} from "@pcc/ui";
import { useCreateProject } from "@/hooks/useProjects";

interface AddProjectDialogProps {
  type: "backend" | "frontend";
}

const CONFIG = {
  backend: {
    platform: "render" as const,
    triggerLabel: "Add service",
    title: "Add a backend service",
    idLabel: "Render service ID",
    idField: "render_service_id" as const,
    idPlaceholder: "srv-xxxxxxxxxxxxxxxxxxxx",
  },
  frontend: {
    platform: "vercel" as const,
    triggerLabel: "Add site",
    title: "Add a frontend site",
    idLabel: "Vercel project ID",
    idField: "vercel_project_id" as const,
    idPlaceholder: "prj_xxxxxxxxxxxxxxxxxxxx",
  },
};

export function AddProjectDialog({ type }: AddProjectDialogProps) {
  const config = CONFIG[type];
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [url, setUrl] = useState("");
  const [platformId, setPlatformId] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const createProject = useCreateProject();

  function reset() {
    setProjectName("");
    setUrl("");
    setPlatformId("");
    setRepoUrl("");
    setNotes("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await createProject.mutateAsync({
      project_name: projectName,
      type,
      platform: config.platform,
      url: url || undefined,
      repo_url: repoUrl || undefined,
      notes: notes || undefined,
      [config.idField]: platformId || undefined,
    });
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          {config.triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{config.title}</DialogTitle>
            <DialogDescription>Editing lands once the backend ships a project PATCH route — for now this only adds.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="project_name">Name</Label>
              <Input id="project_name" required value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="url">URL</Label>
              <Input id="url" type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="platform_id">{config.idLabel}</Label>
              <Input id="platform_id" placeholder={config.idPlaceholder} value={platformId} onChange={(e) => setPlatformId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="repo_url">Repo URL</Label>
              <Input id="repo_url" type="url" placeholder="https://github.com/…" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createProject.isPending || !projectName}>
              {createProject.isPending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
