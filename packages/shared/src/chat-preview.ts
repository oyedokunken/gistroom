/** Preview text for a conversation row. Never leaks a body that was deleted for everyone. */
export function previewText(input: {
  type: string;
  body: string | null;
  deletedForEveryone: boolean;
  mine: boolean;
}): string {
  const prefix = input.mine ? "You: " : "";
  if (input.deletedForEveryone) return `${prefix}This message was deleted`;
  switch (input.type) {
    case "IMAGE":
      return `${prefix}Photo`;
    case "VIDEO":
      return `${prefix}Video`;
    case "VOICE":
      return `${prefix}Voice note`;
    case "FILE":
      return `${prefix}File`;
    case "SYSTEM":
      return "Friendship anniversary";
    case "ROOM_INVITE":
      return `${prefix}Room invite`;
    default:
      return `${prefix}${(input.body ?? "").replace(/\s+/g, " ").trim()}`;
  }
}
