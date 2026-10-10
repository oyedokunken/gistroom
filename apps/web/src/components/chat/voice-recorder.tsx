"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { LIMITS } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { IconButton } from "@/components/ui/icon-button";
import { chat } from "@/content/chat";
import { baseMime, formatDuration, pickVoiceMime, toWaveform } from "@/lib/chat/voice";

export interface RecordedVoice {
  blob: Blob;
  mime: string;
  durationMs: number;
  waveform: number[];
}

const PRIMED_KEY = "gr_mic_primed";
const SAMPLE_MS = 100;

/** Hook that owns the microphone, the recorder and the loudness samples. */
export function useVoiceRecorder(onDone: (voice: RecordedVoice) => void) {
  const { confirm, showError } = useFeedback();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const samples = useRef<number[]>([]);
  const started = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const audioCtx = useRef<AudioContext | null>(null);
  const keep = useRef(true);

  const cleanup = useCallback(() => {
    window.clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    void audioCtx.current?.close().catch(() => undefined);
    stream.current = null;
    audioCtx.current = null;
    recorder.current = null;
    setRecording(false);
    setElapsed(0);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    const mime = pickVoiceMime();
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      showError(chat.media.voiceUnsupported);
      return;
    }
    let primed = false;
    try {
      primed = window.localStorage.getItem(PRIMED_KEY) === "1";
    } catch {
      primed = false;
    }
    if (!primed) {
      const ok = await confirm({
        title: chat.media.micPrimerTitle,
        message: chat.media.micPrimerBody,
        confirmLabel: chat.media.micPrimerConfirm,
      });
      if (!ok) return;
      try {
        window.localStorage.setItem(PRIMED_KEY, "1");
      } catch {
        // Without storage the primer simply shows again next time.
      }
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      chunks.current = [];
      samples.current = [];
      keep.current = true;

      const ctx = new AudioContext();
      audioCtx.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(media).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);

      const rec = new MediaRecorder(media, { mimeType: mime });
      recorder.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        const durationMs = Date.now() - started.current;
        const blob = new Blob(chunks.current, { type: baseMime(mime) });
        const wave = toWaveform(samples.current);
        const send = keep.current && blob.size > 0 && durationMs > 600;
        cleanup();
        if (send) onDone({ blob, mime: baseMime(mime), durationMs, waveform: wave });
      };
      started.current = Date.now();
      rec.start(250);
      setRecording(true);
      timer.current = window.setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
        samples.current.push(peak);
        const ms = Date.now() - started.current;
        setElapsed(ms);
        if (ms >= LIMITS.VOICE_NOTE_MAX_SEC * 1000) rec.stop();
      }, SAMPLE_MS);
    } catch {
      cleanup();
      showError(chat.media.micBlocked);
    }
  }, [cleanup, confirm, onDone, showError]);

  const stop = useCallback(() => {
    keep.current = true;
    recorder.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    keep.current = false;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    else cleanup();
  }, [cleanup]);

  return { recording, elapsed, start, stop, cancel };
}

/** The bar that replaces the text box while you record. */
export function VoiceRecorderBar({
  elapsed,
  onStop,
  onCancel,
}: {
  elapsed: number;
  onStop: () => void;
  onCancel: () => void;
}) {
  return (
    <div role="group" aria-label={chat.media.voiceRecording} className="flex items-center gap-2">
      <IconButton label={chat.media.voiceCancel} onClick={onCancel}>
        <Trash2 aria-hidden className="size-5 text-danger-600" />
      </IconButton>
      <div className="flex min-h-11 flex-1 items-center gap-3 rounded-[1.375rem] bg-surface-2 px-4">
        <span aria-hidden className="size-3 rounded-full bg-danger-600 motion-safe:animate-pulse" />
        <span role="timer" className="tabular font-semibold text-text">
          {formatDuration(elapsed)}
        </span>
        <span className="text-sm text-text-muted">{chat.media.voiceRecording}</span>
      </div>
      <IconButton
        label={chat.media.voiceStop}
        onClick={onStop}
        className="bg-green-600 text-white hover:bg-green-700"
      >
        <Send aria-hidden className="size-5" />
      </IconButton>
    </div>
  );
}
