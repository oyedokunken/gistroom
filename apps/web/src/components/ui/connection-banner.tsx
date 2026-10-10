import { WifiOff } from "lucide-react";
import { ui } from "@/content/ui";

export type ConnectionState = "online" | "offline" | "reconnecting";

/** Inline banner for connection state. Not a toast (R4). */
export function ConnectionBanner({ state }: { state: ConnectionState }) {
  if (state === "online") return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 bg-yellow-100 px-4 py-2 text-sm font-medium text-ink-950"
    >
      <WifiOff aria-hidden className="size-4" />
      {state === "offline" ? ui.offlineBanner : ui.reconnectingBanner}
    </div>
  );
}
