"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { session as copy } from "@/content/session";
import { loadPrejoin, savePrejoin, type PrejoinPrefs } from "@/lib/session/prefs";

type Perm = "unknown" | "granted" | "prompt" | "denied";

interface DeviceOption {
  value: string;
  label: string;
}

/** Stops every track of a stream, so the microphone and camera lights go off. */
function stop(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

/**
 * The check before a room: your name and picture, a microphone level that moves when you speak, a camera preview, the
 * choice of devices, and whether to arrive muted or without video. What you choose is remembered. Everything it opened is
 * closed again before you join, so the room can take the microphone cleanly.
 */
export function PreJoin({
  name,
  avatarUrl,
  joining,
  allowCamera,
  onJoin,
}: {
  name: string;
  avatarUrl: string | null;
  joining: boolean;
  allowCamera: boolean;
  onJoin: (prefs: PrejoinPrefs) => void;
}) {
  const [prefs, setPrefs] = useState<PrejoinPrefs>(() => loadPrejoin());
  const [perm, setPerm] = useState<Perm>("unknown");
  const [level, setLevel] = useState(0);
  const [mics, setMics] = useState<DeviceOption[]>([]);
  const [cams, setCams] = useState<DeviceOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<MediaStream | null>(null);
  const video = useRef<MediaStream | null>(null);
  const videoEl = useRef<HTMLVideoElement | null>(null);
  const raf = useRef<number | null>(null);
  const ctx = useRef<AudioContext | null>(null);

  const change = (next: PrejoinPrefs) => {
    setPrefs(next);
    savePrejoin(next);
  };

  const listDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    const pick = (kind: MediaDeviceKind) =>
      all
        .filter((d) => d.kind === kind && d.deviceId)
        .map((d, i) => ({
          value: d.deviceId,
          label: d.label || `${kind === "audioinput" ? "Microphone" : "Camera"} ${i + 1}`,
        }));
    setMics(pick("audioinput"));
    setCams(pick("videoinput"));
  }, []);

  const closeAudio = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    void ctx.current?.close().catch(() => undefined);
    ctx.current = null;
    stop(audio.current);
    audio.current = null;
    setLevel(0);
  }, []);

  const openAudio = useCallback(
    async (deviceId: string | null) => {
      closeAudio();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        });
        audio.current = stream;
        setPerm("granted");
        setError(null);
        const AudioCtx = window.AudioContext;
        const context = new AudioCtx();
        ctx.current = context;
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        context.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        let last = 0;
        const tick = (t: number) => {
          raf.current = requestAnimationFrame(tick);
          if (t - last < 66) return;
          last = t;
          analyser.getByteTimeDomainData(data);
          let peak = 0;
          for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
          setLevel(Math.min(1, peak / 64));
        };
        raf.current = requestAnimationFrame(tick);
        await listDevices();
      } catch (e) {
        const n = (e as { name?: string }).name;
        setPerm(n === "NotAllowedError" || n === "SecurityError" ? "denied" : "prompt");
        setError(n === "NotFoundError" ? copy.devices.micMissing : copy.devices.micDenied);
      }
    },
    [closeAudio, listDevices],
  );

  const openVideo = useCallback(
    async (deviceId: string | null) => {
      stop(video.current);
      video.current = null;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: { exact: deviceId } } : true,
        });
        video.current = stream;
        if (videoEl.current) videoEl.current.srcObject = stream;
        await listDevices();
      } catch {
        setError(copy.devices.camDenied);
      }
    },
    [listDevices],
  );

  // If the browser already allows the microphone, check it straight away. Otherwise wait for a tap.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (cancelled) return;
        setPerm(
          status.state === "granted" ? "granted" : status.state === "denied" ? "denied" : "prompt",
        );
        if (status.state === "granted") await openAudio(prefs.micId);
      } catch {
        if (!cancelled) setPerm("prompt");
      }
    })();
    return () => {
      cancelled = true;
    };
    // Checked once when the screen opens.
  }, []);

  // The camera preview follows the toggle.
  useEffect(() => {
    if (prefs.cameraOff || !allowCamera || perm !== "granted") {
      stop(video.current);
      video.current = null;
      if (videoEl.current) videoEl.current.srcObject = null;
      return;
    }
    void openVideo(prefs.camId);
  }, [prefs.cameraOff, prefs.camId, allowCamera, perm, openVideo]);

  // Everything is closed when you leave this screen.
  useEffect(
    () => () => {
      closeAudio();
      stop(video.current);
    },
    [closeAudio],
  );

  function join() {
    closeAudio();
    stop(video.current);
    video.current = null;
    onJoin(prefs);
  }

  return (
    <div className="flex w-full flex-col gap-4 text-left">
      <div className="flex items-center gap-3">
        <Avatar name={name} src={avatarUrl} size={48} />
        <p className="font-semibold text-text">{name}</p>
      </div>

      {perm === "granted" ? (
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2 text-sm font-semibold text-text">
            <Mic aria-hidden className="size-4" />
            {copy.prejoin.level}
          </span>
          <div
            role="meter"
            aria-label={copy.prejoin.level}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level * 100)}
            className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
          >
            <div
              className="h-full origin-left rounded-full bg-green-600 transition-transform duration-75"
              style={{ transform: `scaleX(${Math.max(0.02, level)})` }}
            />
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          onClick={() => void openAudio(prefs.micId)}
          icon={<Mic aria-hidden className="size-4" />}
        >
          {copy.prejoin.check}
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger-600">
          {error}
        </p>
      ) : null}

      {!prefs.cameraOff && allowCamera ? (
        <div className="relative overflow-hidden rounded-card bg-ink-950">
          <video
            ref={videoEl}
            autoPlay
            muted
            playsInline
            aria-label={copy.prejoin.preview}
            className="aspect-video w-full -scale-x-100 object-cover"
          />
        </div>
      ) : null}

      {mics.length > 1 ? (
        <Field label={copy.prejoin.microphone}>
          {(props) => (
            <Select
              id={props.id}
              value={prefs.micId ?? mics[0]?.value}
              onValueChange={(v) => {
                change({ ...prefs, micId: v });
                void openAudio(v);
              }}
              options={mics}
            />
          )}
        </Field>
      ) : null}
      {cams.length > 1 && !prefs.cameraOff ? (
        <Field label={copy.prejoin.camera}>
          {(props) => (
            <Select
              id={props.id}
              value={prefs.camId ?? cams[0]?.value}
              onValueChange={(v) => change({ ...prefs, camId: v })}
              options={cams}
            />
          )}
        </Field>
      ) : null}

      <div className="flex flex-col divide-y divide-border">
        <Switch
          label={copy.prejoin.joinMuted}
          help={copy.prejoin.joinMutedHelp}
          checked={prefs.muted}
          onChange={(v) => change({ ...prefs, muted: v })}
        />
        {allowCamera ? (
          <Switch
            label={copy.prejoin.cameraOff}
            help={copy.prejoin.cameraOffHelp}
            checked={prefs.cameraOff}
            onChange={(v) => change({ ...prefs, cameraOff: v })}
          />
        ) : null}
        <Switch
          label={copy.prejoin.skip}
          help={copy.prejoin.skipHelp}
          checked={prefs.skip}
          onChange={(v) => change({ ...prefs, skip: v })}
        />
      </div>

      <Button className="min-h-12 px-10" loading={joining} onClick={join}>
        {joining ? copy.prejoin.joining : copy.prejoin.join}
      </Button>
    </div>
  );
}
