"use client";

import { useEffect, useState } from "react";

/**
 * `speechSynthesis.getVoices()` is frequently empty on first call — most browsers populate the
 * list asynchronously and fire `voiceschanged` once it's ready (timing varies by browser/OS, and
 * some fire it multiple times as voice packs load). The `useState` lazy initializer calls it once
 * synchronously on mount (some browsers/voice sets are already available immediately, so this can
 * be all that's needed), and the effect below subscribes to `voiceschanged` to catch the async
 * population — so callers always end up with the full list without polling. (The synchronous call
 * lives in the lazy initializer rather than duplicated in the effect body, since setting state
 * unconditionally inside an effect trips `react-hooks/set-state-in-effect`.)
 */
export function useSpeechSynthesisVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
    return window.speechSynthesis.getVoices();
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const synth = window.speechSynthesis;

    function handleVoicesChanged() {
      setVoices(synth.getVoices());
    }

    synth.addEventListener("voiceschanged", handleVoicesChanged);
    return () => synth.removeEventListener("voiceschanged", handleVoicesChanged);
  }, []);

  return voices;
}
