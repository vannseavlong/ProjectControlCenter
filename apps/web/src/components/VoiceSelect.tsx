"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pcc/ui";
import { GOOGLE_TTS_VOICES } from "@/lib/google-tts-voices";
import { playSynthesizedSpeech } from "@/lib/tts-client";

const PREVIEW_TEXT = "Hi, this is a preview of my voice.";

/** Radix `Select.Item` rejects an empty-string `value`, so "no voice chosen" needs a sentinel. */
const DEFAULT_VOICE_VALUE = "__default__";

export interface VoiceSelectProps {
  /** Google TTS voice id (e.g. "en-US-Neural2-F"), or undefined/empty for the API's default voice. Field name kept as `voiceUri` to match the existing `agents.voice_uri` column — no schema change for this switch from browser voices to Google TTS. */
  voiceUri?: string;
  onChange: (voice: { voice_uri?: string; voice_name?: string }) => void;
  className?: string;
}

/** `Select` from `@pcc/ui` populated from the curated Google Cloud TTS voice list, with a preview button that synthesizes and plays a sample line through `/api/tts`. */
export function VoiceSelect({ voiceUri, onChange, className }: VoiceSelectProps) {
  const [previewing, setPreviewing] = useState(false);
  const selectedValue = voiceUri && voiceUri.length > 0 ? voiceUri : DEFAULT_VOICE_VALUE;

  function handleValueChange(value: string) {
    if (value === DEFAULT_VOICE_VALUE) {
      onChange({ voice_uri: undefined, voice_name: undefined });
      return;
    }
    const voice = GOOGLE_TTS_VOICES.find((v) => v.name === value);
    onChange({ voice_uri: value, voice_name: voice?.label });
  }

  async function handlePreview() {
    setPreviewing(true);
    try {
      await playSynthesizedSpeech(PREVIEW_TEXT, voiceUri);
    } catch {
      // Preview is a nice-to-have; a failed preview (e.g. GOOGLE_TTS_API_KEY not configured yet) shouldn't block picking a voice.
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Select value={selectedValue} onValueChange={handleValueChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Default voice" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_VOICE_VALUE}>Default voice</SelectItem>
            {GOOGLE_TTS_VOICES.map((voice) => (
              <SelectItem key={voice.name} value={voice.name}>
                {voice.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="secondary"
          className="size-9 shrink-0 px-0"
          onClick={() => void handlePreview()}
          disabled={previewing}
          aria-label="Preview voice"
        >
          <Volume2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
