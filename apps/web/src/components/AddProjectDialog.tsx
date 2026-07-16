"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Plus } from "lucide-react";
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
import type { Project } from "@pcc/types";
import { useCreateProject, useUpdateProject } from "@/hooks/useProjects";

interface AddProjectDialogProps {
  type: "backend" | "frontend";
  /** When present, the dialog edits this project (PATCH) instead of creating a new one (POST) — trigger renders as an edit icon button. */
  editingProject?: Project;
}

const CONFIG = {
  backend: {
    platform: "render" as const,
    triggerLabel: "Add service",
    addTitle: "Add a backend service",
    editTitle: "Edit backend service",
    idLabel: "Render service ID",
    idField: "render_service_id" as const,
    idPlaceholder: "srv-xxxxxxxxxxxxxxxxxxxx",
  },
  frontend: {
    platform: "vercel" as const,
    triggerLabel: "Add site",
    addTitle: "Add a frontend site",
    editTitle: "Edit frontend site",
    idLabel: "Vercel project ID",
    idField: "vercel_project_id" as const,
    idPlaceholder: "prj_xxxxxxxxxxxxxxxxxxxx",
  },
};

/**
 * Owns the form fields and submit handler. Rendered as `DialogContent`'s child, which Radix only
 * mounts while the dialog is open (`Presence` unmounts it on close) — so every time the dialog
 * opens, this remounts fresh and its `useState` initializers re-read `editingProject`, instead of
 * needing an effect to resync stale field values from a prior open.
 */
function ProjectForm({
  type,
  editingProject,
  onDone,
}: {
  type: "backend" | "frontend";
  editingProject?: Project;
  onDone: () => void;
}) {
  const config = CONFIG[type];
  const isEditing = Boolean(editingProject);
  const [projectName, setProjectName] = useState(editingProject?.project_name ?? "");
  const [url, setUrl] = useState(editingProject?.url ?? "");
  const [platformId, setPlatformId] = useState(editingProject?.[config.idField] ?? "");
  const [repoUrl, setRepoUrl] = useState(editingProject?.repo_url ?? "");
  const [notes, setNotes] = useState(editingProject?.notes ?? "");
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const isPending = createProject.isPending || updateProject.isPending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isEditing && editingProject) {
      await updateProject.mutateAsync({
        id: editingProject._id,
        input: {
          project_name: projectName,
          url: url || undefined,
          repo_url: repoUrl || undefined,
          notes: notes || undefined,
          [config.idField]: platformId || undefined,
        },
      });
    } else {
      await createProject.mutateAsync({
        project_name: projectName,
        type,
        platform: config.platform,
        url: url || undefined,
        repo_url: repoUrl || undefined,
        notes: notes || undefined,
        [config.idField]: platformId || undefined,
      });
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{isEditing ? config.editTitle : config.addTitle}</DialogTitle>
        {!isEditing ? <DialogDescription>Fill in the details for this project.</DialogDescription> : null}
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
        <Button type="submit" disabled={isPending || !projectName}>
          {isPending ? (isEditing ? "Saving…" : "Adding…") : isEditing ? "Save changes" : "Add"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddProjectDialog({ type, editingProject }: AddProjectDialogProps) {
  const isEditing = Boolean(editingProject);
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEditing ? (
          <Button variant="ghost" className="h-8 px-2 text-xs" aria-label={`Edit ${editingProject?.project_name}`}>
            <Pencil className="size-3.5" />
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            {CONFIG[type].triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <ProjectForm type={type} editingProject={editingProject} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
