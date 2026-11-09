"use client";

import { useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { roomCards as copy } from "@/content/room-cards";
import { copyText } from "@/lib/clipboard";

/**
 * Copies the link to a room's page. The link is the plain page address, never an invite, so it shows nothing about a
 * private room to someone who is not on its list. A private room says so next to the button. If the browser blocks the
 * clipboard, a small dialog shows the link to copy by hand. Feedback is inline text, not a toast.
 */
export function CopyRoomLink({
  slug,
  visibility,
  className,
}: {
  slug: string;
  visibility: "PUBLIC" | "PRIVATE";
  className?: string;
}) {
  const [done, setDone] = useState(false);
  const [manual, setManual] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const url = () => `${window.location.origin}/rooms/${slug}`;

  async function copyNow() {
    const ok = await copyText(url());
    if (ok) {
      setDone(true);
      window.setTimeout(() => setDone(false), 3000);
    } else {
      setManual(true);
    }
  }

  return (
    <div className={className}>
      <Button variant="secondary" onClick={() => void copyNow()} className="gap-2">
        {done ? <Check aria-hidden className="size-4" /> : <Link2 aria-hidden className="size-4" />}
        {copy.copy.action}
      </Button>
      <p role="status" aria-live="polite" className="mt-2 text-sm text-text-muted">
        {done
          ? copy.copy.done
          : visibility === "PRIVATE"
            ? copy.copy.privateNote
            : copy.copy.publicNote}
      </p>
      <Modal
        open={manual}
        onOpenChange={setManual}
        icon={Link2}
        title={copy.copy.failedTitle}
        description={copy.copy.failedBody}
        footer={
          <Button variant="secondary" onClick={() => setManual(false)}>
            {copy.copy.close}
          </Button>
        }
      >
        <div className="flex w-full flex-col gap-2">
          <Input
            ref={input}
            readOnly
            aria-label={copy.copy.inputLabel}
            defaultValue={manual ? url() : ""}
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button variant="ghost" onClick={() => input.current?.select()}>
            {copy.copy.selectAll}
          </Button>
          {visibility === "PRIVATE" ? (
            <p className="text-sm text-text-muted">{copy.copy.privateNote}</p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
