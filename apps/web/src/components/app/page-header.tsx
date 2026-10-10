import type { ReactNode } from "react";

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-text">{title}</h1>
      {action}
    </div>
  );
}
