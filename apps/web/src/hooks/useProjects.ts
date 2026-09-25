"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@pcc/ui";
import type { Project } from "@pcc/types";
import { api, type CreateProjectInput, type UpdateProjectInput } from "@/lib/api-client";

const PROJECTS_KEY = ["projects"] as const;

export function useProjects() {
  return useQuery({ queryKey: PROJECTS_KEY, queryFn: api.projects.list });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => api.projects.create(input),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
      toast.success(`${project.project_name} added`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectInput }) => api.projects.update(id, input),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
      toast.success(`${project.project_name} updated`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.projects.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
      toast.success("Project deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * Drag-and-drop reorder. Optimistic: the cached roster is re-sorted immediately so the dropped
 * item doesn't snap back while the Sheets writes run, then rolled back if the save fails. `ids`
 * is the full new order for the reordered subset (e.g. every frontend project) — projects not in
 * `ids` keep their current relative position after them.
 */
export function useReorderProjects() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.projects.reorder(ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: PROJECTS_KEY });
      const previous = queryClient.getQueryData<Project[]>(PROJECTS_KEY);
      if (previous) {
        const position = new Map(ids.map((id, index) => [id, index]));
        const reordered = previous
          .map((p) => (position.has(p._id) ? { ...p, sort_order: position.get(p._id) } : p))
          .sort((a, b) => (position.get(a._id) ?? Infinity) - (position.get(b._id) ?? Infinity));
        queryClient.setQueryData<Project[]>(PROJECTS_KEY, reordered);
      }
      return { previous };
    },
    onError: (error: Error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(PROJECTS_KEY, context.previous);
      toast.error(`Couldn't save order: ${error.message}`);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useWakeProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.projects.wake(id),
    onSuccess: ({ project, wake }) => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
      if (wake.ok) {
        toast.success(`${project.project_name} is awake (${wake.attempts} attempt${wake.attempts === 1 ? "" : "s"})`);
      } else {
        toast.error(`${project.project_name} didn't wake up in time`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useWakeAllProjects() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.projects.wakeAll(),
    onSuccess: ({ total, woken }) => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
      if (total === 0) {
        toast.error("No Render-backed backend services to wake");
      } else if (woken === total) {
        toast.success(`All ${total} service${total === 1 ? "" : "s"} are awake`);
      } else {
        toast.error(`${woken} of ${total} service${total === 1 ? "" : "s"} woke up in time`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Mirrors `useWakeProject` exactly — see `Tasks/app-frontend.md` §3a. */
export function useAnalyzeSeo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.projects.analyzeSeo(id),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
      toast.success(`${project.project_name} SEO score: ${project.seo_score}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCheckProjectHealth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.projects.health(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeployStatus(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["deploy-status", id],
    queryFn: () => api.projects.deployStatus(id as string),
    enabled: enabled && Boolean(id),
  });
}

/**
 * Batch version of useDeployStatus, for aggregate counts (e.g. the Dashboard's "Frontend live"
 * card) rather than one card's own display. Shares the same `["deploy-status", id]` query key as
 * useDeployStatus, so visiting /frontend and the Dashboard don't double-fetch the same project.
 */
export function useDeployStatuses(projectIds: string[]) {
  return useQueries({
    queries: projectIds.map((id) => ({
      queryKey: ["deploy-status", id],
      queryFn: () => api.projects.deployStatus(id),
    })),
  });
}
