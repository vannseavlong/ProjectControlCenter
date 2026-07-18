import { NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/google-tts";
import { DEFAULT_GOOGLE_TTS_VOICE, GOOGLE_TTS_VOICES } from "@/lib/google-tts-voices";
import { apiError, withApiErrorHandling } from "@/lib/api-response";

interface TtsInput {
  text?: unknown;
  voice_name?: unknown;
}

/** Synthesizes speech for the Voice Console via Google Cloud TTS and streams back MP3 bytes — replaces the browser's robotic SpeechSynthesis. */
export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const body = (await request.json().catch(() => null)) as TtsInput | null;
    if (!body || typeof body.text !== "string" || body.text.trim().length === 0) {
      return apiError(400, "`text` must be a non-empty string");
    }

    const voiceName =
      typeof body.voice_name === "string" && GOOGLE_TTS_VOICES.some((v) => v.name === body.voice_name)
        ? body.voice_name
        : DEFAULT_GOOGLE_TTS_VOICE;

    const audio = await synthesizeSpeech(body.text, voiceName);
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  });
}
