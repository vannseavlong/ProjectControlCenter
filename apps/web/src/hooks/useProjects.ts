"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@pcc/ui";
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
