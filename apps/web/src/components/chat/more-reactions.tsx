"use client";

import dynamic from "next/dynamic";
import { SmilePlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { chat } from "@/content/chat";

// The picker and its data load only when someone asks for more than the quick ten.
const Picker = dynamic(() => import("./emoji-picker").then((m) => m.EmojiPicker), {
  ssr: false,
  loading: () => <Skeleton className="h-[22rem] w-full" />,
});

/** The full emoji picker, for the reaction that is not among the quick ten. */
export function MoreReactions({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (emoji: string) => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      icon={SmilePlus}
      title={chat.reactionMoreTitle}
      className="w-[min(94vw,24rem)]"
    >
      <div className="flex justify-center">
        <Picker
          onPick={(emoji) => {
            onPick(emoji);
            onOpenChange(false);
          }}
        />
      </div>
    </Modal>
  );
}
