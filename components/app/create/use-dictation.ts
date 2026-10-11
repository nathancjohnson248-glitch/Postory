"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

/**
 * Browser speech-to-text (Web Speech API). Only offered where the browser
 * supports it; nothing is sent to Postory's servers until the user generates.
 */
export function useDictation(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const callback = useRef(onText);

  useEffect(() => {
    callback.current = onText;
  }, [onText]);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = false;
    r.lang = navigator.language || "en-US";
    r.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) if (event.results[i].isFinal) text += event.results[i][0].transcript;
      if (text.trim()) callback.current(text.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = (event) => {
      setListening(false);
      setError(event.error === "not-allowed" ? "Microphone access was blocked." : "Dictation stopped.");
    };
    recognition.current = r;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection must run on the client
    setSupported(true);
    return () => r.stop();
  }, []);

  const toggle = useCallback(() => {
    const r = recognition.current;
    if (!r) return;
    setError(null);
    if (listening) {
      r.stop();
      setListening(false);
    } else {
      try {
        r.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    }
  }, [listening]);

  return { supported, listening, error, toggle };
}
