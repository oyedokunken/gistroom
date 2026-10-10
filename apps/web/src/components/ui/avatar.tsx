"use client";

import Image from "next/image";
import { useState } from "react";
import { Mic } from "lucide-react";
import { cn } from "@/lib/cn";
import { ui } from "@/content/ui";

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: number;
  online?: boolean;
  /** Speaking uses a ring plus an icon, never color alone (R19). */
  speaking?: boolean;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function Avatar({ name, src, size = 44, online, speaking, className }: AvatarProps) {
  // If the picture cannot load, the person still gets their initials.
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(src) && !broken;
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <span
        className={cn(
          "inline-flex size-full items-center justify-center overflow-hidden rounded-full bg-green-100 font-semibold text-green-700",
          speaking && "ring-4 ring-green-600 ring-offset-2 ring-offset-surface",
        )}
        style={{ fontSize: Math.max(12, size * 0.38) }}
      >
        {showImage && src ? (
          <Image
            src={src}
            alt=""
            width={size}
            height={size}
            onError={() => setBroken(true)}
            className="size-full object-cover"
          />
        ) : (
          <span aria-hidden>{initials(name)}</span>
        )}
        <span className="sr-only">{name}</span>
      </span>
      {online !== undefined ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 size-3 rounded-full border-2 border-surface",
            online ? "bg-green-600" : "bg-ink-500",
          )}
        >
          <span className="sr-only">{online ? ui.presence.online : ui.presence.offline}</span>
        </span>
      ) : null}
      {speaking ? (
        <span className="absolute -right-1 -top-1 rounded-full bg-green-600 p-1 text-white">
          <Mic aria-hidden className="size-3" />
        </span>
      ) : null}
    </span>
  );
}
