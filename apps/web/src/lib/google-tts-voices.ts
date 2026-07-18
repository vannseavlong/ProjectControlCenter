/**
 * Pure voice-catalog data — no env/API-key access — so client components (VoiceSelect) can import
 * it directly without pulling server-only code (see google-tts.ts) into the client bundle.
 */

export interface GoogleTtsVoice {
  /** Google's own voice id, e.g. "en-US-Neural2-F" — passed straight through to the API. */
  name: string;
  label: string;
  languageCode: string;
}

/**
 * Curated subset of Google's Neural2 voices — natural-sounding and covered by the always-free 1M
 * chars/month tier (unlike Studio voices, which are paid from character one).
 */
export const GOOGLE_TTS_VOICES: GoogleTtsVoice[] = [
  { name: "en-US-Neural2-C", label: "Neural2 C — US English, Female", languageCode: "en-US" },
  { name: "en-US-Neural2-F", label: "Neural2 F — US English, Female", languageCode: "en-US" },
  { name: "en-US-Neural2-H", label: "Neural2 H — US English, Female", languageCode: "en-US" },
  { name: "en-US-Neural2-A", label: "Neural2 A — US English, Male", languageCode: "en-US" },
  { name: "en-US-Neural2-D", label: "Neural2 D — US English, Male", languageCode: "en-US" },
  { name: "en-US-Neural2-J", label: "Neural2 J — US English, Male", languageCode: "en-US" },
  { name: "en-GB-Neural2-A", label: "Neural2 A — British English, Female", languageCode: "en-GB" },
  { name: "en-GB-Neural2-B", label: "Neural2 B — British English, Male", languageCode: "en-GB" },
];

export const DEFAULT_GOOGLE_TTS_VOICE = GOOGLE_TTS_VOICES[0]!.name;
