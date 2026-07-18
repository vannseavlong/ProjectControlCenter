"use client";

/** Requests synthesized speech from POST /api/tts and plays it. Throws on a non-2xx response — callers decide how to surface that. */
export async function playSynthesizedSpeech(text: string, voiceName?: string): Promise<void> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice_name: voiceName }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `TTS request failed (${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.addEventListener("ended", () => URL.revokeObjectURL(url));
  audio.addEventListener("error", () => URL.revokeObjectURL(url));
  await audio.play();
}
