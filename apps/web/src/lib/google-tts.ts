import { getGoogleTtsApiKey } from "./env";
import { DEFAULT_GOOGLE_TTS_VOICE, GOOGLE_TTS_VOICES } from "./google-tts-voices";

export { DEFAULT_GOOGLE_TTS_VOICE, GOOGLE_TTS_VOICES } from "./google-tts-voices";
export type { GoogleTtsVoice } from "./google-tts-voices";

const GOOGLE_TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";

/** Google's synthesize endpoint rejects input over 5000 bytes; stay comfortably under that for any UTF-8 reply. */
const MAX_INPUT_LENGTH = 4500;

interface SynthesizeResponse {
  audioContent?: string;
}

/** Synthesizes speech via Google Cloud TTS, returning MP3 bytes. `voiceName` must be one of GOOGLE_TTS_VOICES' `name`s. */
export async function synthesizeSpeech(text: string, voiceName: string = DEFAULT_GOOGLE_TTS_VOICE): Promise<Buffer> {
  const voice = GOOGLE_TTS_VOICES.find((v) => v.name === voiceName) ?? GOOGLE_TTS_VOICES[0]!;
  const input = text.length > MAX_INPUT_LENGTH ? text.slice(0, MAX_INPUT_LENGTH) : text;

  const response = await fetch(GOOGLE_TTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getGoogleTtsApiKey(),
    },
    body: JSON.stringify({
      input: { text: input },
      voice: { languageCode: voice.languageCode, name: voice.name },
      audioConfig: { audioEncoding: "MP3" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Google TTS request failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as SynthesizeResponse;
  if (!data.audioContent) {
    throw new Error("Google TTS response had no audioContent");
  }
  return Buffer.from(data.audioContent, "base64");
}
