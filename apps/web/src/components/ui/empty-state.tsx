import type { ReactNode } from "react";
import Image from "next/image";
import { getArt } from "@/lib/art";

export interface EmptyStateProps {
  /** Asset id from design/assets.manifest.json. Renders without art until the PNG is approved. */
  artId?: string;
  title: string;
  body?: string;
  action?: ReactNode;
}

export function EmptyState({ artId, title, body, action }: EmptyStateProps) {
  const art = artId ? getArt(artId) : undefined;
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-6 py-12 text-center">
      {art ? (
        <Image
          src={art.src}
          alt={art.alt}
          width={art.width}
          height={art.height}
          sizes="(max-width: 640px) 60vw, 320px"
          className="h-auto w-full max-w-[16rem]"
        />
      ) : null}
      <h2 className="text-xl font-bold text-text">{title}</h2>
      {body ? <p className="text-text-muted">{body}</p> : null}
      {action}
    </div>
  );
}
