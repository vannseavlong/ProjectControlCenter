"use client";

import { useState, type ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@pcc/ui";
import type { Agent } from "@pcc/types";
import { useUpdateAgentVoice } from "@/hooks/useAgents";
import { VoiceSelect } from "@/components/VoiceSelect";

interface ChangeVoiceDialogProps {
  trigger: ReactNode;
  agent: Agent;
}

/**
 * "Needs a dialog, not an instant action" — same `DropdownMenuItem` + Radix `Dialog` composition
 * as `ConfirmDialog` (see `apps/web/src/components/ConfirmDialog.tsx`, used for Fire/Delete in
 * `AgentCard`), but with a `VoiceSelect` + Save instead of a single confirm button, since picking
 * a voice needs its own control rather than a yes/no.
 */
export function ChangeVoiceDialog({ trigger, agent }: ChangeVoiceDialogProps) {
  const [open, setOpen] = useState(false);
  const [voiceUri, setVoiceUri] = useState(agent.voice_uri);
  const [voiceName, setVoiceName] = useState(agent.voice_name);
  const updateVoice = useUpdateAgentVoice();

  function handleOpenChange(next: boolean) {
    if (next) {
      // Reset to the agent's currently-saved voice each time the dialog is reopened, in case a
      // previous open was cancelled without saving.
      setVoiceUri(agent.voice_uri);
      setVoiceName(agent.voice_name);
    }
    setOpen(next);
  }

  async function handleSave() {
    await updateVoice.mutateAsync({ id: agent._id, voice_uri: voiceUri, voice_name: voiceName });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Change ${agent.agent_name}'s voice`}</DialogTitle>
          <DialogDescription>Pick the voice this agent uses for spoken replies in the Voice Console.</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <VoiceSelect
            voiceUri={voiceUri}
            onChange={({ voice_uri, voice_name }) => {
              setVoiceUri(voice_uri);
              setVoiceName(voice_name);
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={updateVoice.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateVoice.isPending}>
            {updateVoice.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
