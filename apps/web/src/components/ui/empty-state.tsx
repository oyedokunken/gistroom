import type { ReactNode } from "react";
import { CardIcon, type CardIconName } from "@/components/public/card-icon";

export interface EmptyStateProps {
  /** One of the custom Gistroom icons. */
  icon?: CardIconName;
  title: string;
  body?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-6 py-12 text-center">
      {icon ? <CardIcon name={icon} className="size-20" /> : null}
      <h2 className="text-xl font-bold text-text">{title}</h2>
      {body ? <p className="text-text-muted">{body}</p> : null}
      {action}
    </div>
  );
}
