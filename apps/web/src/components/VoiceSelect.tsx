"use client";

import { Volume2 } from "lucide-react";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pcc/ui";
import { useSpeechSynthesisVoices } from "@/hooks/useSpeechSynthesisVoices";

const PREVIEW_TEXT = "Hi, this is a preview of my voice.";

/** Radix `Select.Item` rejects an empty-string `value`, so "no voice chosen" needs a sentinel. */
const DEFAULT_VOICE_VALUE = "__default__";

export interface VoiceSelectProps {
  /** Currently selected `voiceURI`, or undefined/empty for "browser default". */
  voiceUri?: string;
  onChange: (voice: { voice_uri?: string; voice_name?: string }) => void;
  className?: string;
}

/** `Select` from `@pcc/ui` populated from the browser's available speech-synthesis voices, with a preview button so the user can hear a voice before saving it. */
export function VoiceSelect({ voiceUri, onChange, className }: VoiceSelectProps) {
  const voices = useSpeechSynthesisVoices();
  const selectedValue = voiceUri && voiceUri.length > 0 ? voiceUri : DEFAULT_VOICE_VALUE;
  const selectedVoice = voices.find((voice) => voice.voiceURI === voiceUri);

  function handleValueChange(value: string) {
    if (value === DEFAULT_VOICE_VALUE) {
      onChange({ voice_uri: undefined, voice_name: undefined });
      return;
    }
    const voice = voices.find((v) => v.voiceURI === value);
    onChange({ voice_uri: value, voice_name: voice?.name });
  }

  function handlePreview() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(PREVIEW_TEXT);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Select value={selectedValue} onValueChange={handleValueChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Browser default" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_VOICE_VALUE}>Browser default</SelectItem>
            {voices.map((voice) => (
              <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="secondary"
          className="size-9 shrink-0 px-0"
          onClick={handlePreview}
          aria-label="Preview voice"
        >
          <Volume2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
