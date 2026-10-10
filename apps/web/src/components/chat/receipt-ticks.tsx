import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";
import type { ReceiptStatus } from "@gistroom/shared";
import { chat } from "@/content/chat";
import { cn } from "@/lib/cn";

const label: Record<ReceiptStatus, string> = {
  SENDING: chat.sending,
  FAILED: chat.failedSend,
  SENT: chat.sent,
  DELIVERED: chat.delivered,
  READ: chat.read,
};

/** Lucide ticks for sent, delivered and read. Shape and a text label carry the meaning, not color alone (R19). */
export function ReceiptTicks({ status, className }: { status: ReceiptStatus; className?: string }) {
  const Icon =
    status === "SENDING"
      ? Clock
      : status === "FAILED"
        ? AlertCircle
        : status === "SENT"
          ? Check
          : CheckCheck;
  return (
    <span className={cn("inline-flex items-center", className)}>
      <Icon
        aria-hidden
        className={cn(
          "size-3.5",
          status === "READ" ? "text-yellow-400" : status === "FAILED" ? "text-white" : "opacity-80",
        )}
      />
      <span className="sr-only">{label[status]}</span>
    </span>
  );
}
