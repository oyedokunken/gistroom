import { notFound } from "next/navigation";
import { ChatPreview } from "@/components/dev/chat-preview";

/** Visual check of the chat UI with sample data. Not available in production. */
export default function DevChatPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_PAGES !== "true") notFound();
  return <ChatPreview />;
}
