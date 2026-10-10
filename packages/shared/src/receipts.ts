export type ReceiptStatus = "SENDING" | "FAILED" | "SENT" | "DELIVERED" | "READ";

/**
 * Tick state for one of my messages, from the other person's cursors.
 * Cursors are the createdAt of the newest message they have received or read, so one number covers a whole run of messages.
 * When the other person has read receipts off, a read message still shows as delivered (Section 9.3).
 */
export function receiptStatus(input: {
  messageCreatedAt: Date;
  peerDeliveredAt: Date | null;
  peerReadAt: Date | null;
  peerSendsReadReceipts: boolean;
}): Exclude<ReceiptStatus, "SENDING" | "FAILED"> {
  const t = input.messageCreatedAt.getTime();
  if (input.peerSendsReadReceipts && input.peerReadAt && input.peerReadAt.getTime() >= t)
    return "READ";
  const delivered = input.peerDeliveredAt?.getTime() ?? 0;
  const read = input.peerReadAt?.getTime() ?? 0;
  if (Math.max(delivered, read) >= t) return "DELIVERED";
  return "SENT";
}

/** Cursors only move forward, so a late or repeated ack can never un-read anything. */
export function advanceCursor(current: Date | null, next: Date): Date | null {
  if (current && current.getTime() >= next.getTime()) return null;
  return next;
}
