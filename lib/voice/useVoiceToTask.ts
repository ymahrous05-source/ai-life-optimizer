"use client";

// =====================================================================
// useVoiceToTask()
// Wraps the browser Web Speech API (SpeechRecognition) to capture a
// voice note, then hands the transcript off to a caller-supplied parser
// (typically a Server Action wrapping parseVoiceTranscriptToTask).
// Gracefully degrades on browsers without speech recognition support.
// =====================================================================
import { useCallback, useEffect, useRef, useState } from "react";

// Minimal ambient typing — the Web Speech API has no official TS lib yet.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export type VoiceCaptureStatus = "idle" | "listening" | "processing" | "error" | "unsupported";

interface UseVoiceToTaskOptions {
  lang?: string;
  onTranscriptReady: (transcript: string) => Promise<void>;
}

export function useVoiceToTask({ lang = "en-US", onTranscriptReady }: UseVoiceToTaskOptions) {
  const [status, setStatus] = useState<VoiceCaptureStatus>("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? window.SpeechRecognition ?? window.webkitSpeechRecognition
        : undefined;

    if (!SpeechRecognitionCtor) {
      setStatus("unsupported");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalTranscript += result[0].transcript;
        else interim += result[0].transcript;
      }
      setLiveTranscript(finalTranscript || interim);

      if (finalTranscript) {
        setStatus("processing");
        onTranscriptReady(finalTranscript)
          .then(() => setStatus("idle"))
          .catch((err) => {
            setErrorMessage(err instanceof Error ? err.message : "Failed to process voice note");
            setStatus("error");
          });
      }
    };

    recognition.onerror = (event) => {
      setErrorMessage(event.error);
      setStatus("error");
    };

    recognition.onend = () => {
      setStatus((prev) => (prev === "listening" ? "idle" : prev));
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setErrorMessage(null);
    setLiveTranscript("");
    setStatus("listening");
    recognitionRef.current.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { status, liveTranscript, errorMessage, startListening, stopListening };
}
