import { useEffect, useState } from "react";

/** M mutes and unmutes, V turns the camera on and off, when you are not typing. */
export function useRoomShortcuts({
  inRoom,
  toggleMic,
  toggleCamera,
}: {
  inRoom: boolean;
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
}) {
  useEffect(() => {
    if (!inRoom) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "m") void toggleMic();
      if (e.key.toLowerCase() === "v") void toggleCamera();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // The handlers read the latest state through the live session.
  }, [inRoom]);
}

/** The window width, so the stage grid follows the screen and the number of people. */
export function useViewportWidth(): number {
  const [viewportWidth, setViewportWidth] = useState(1024);
  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return viewportWidth;
}
