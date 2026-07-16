"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@pcc/ui";
import { api, type SaveSettingInput } from "@/lib/api-client";

const SETTINGS_KEY = ["settings"] as const;

export function useSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: api.settings.list });
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inputs: SaveSettingInput[]) => api.settings.save(inputs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      toast.success("Settings saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
