"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Smile } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { chat } from "@/content/chat";

// The picker and its data load only when someone opens it (Section 9.3, budgets in Section 24).
const Picker = dynamic(() => import("./emoji-picker").then((m) => m.EmojiPicker), {
  ssr: false,
  loading: () => <Skeleton className="h-[22rem] w-[20rem]" />,
});

/** Emoji come from the library at runtime. Native glyphs, so no images are fetched from a CDN (CSP). */
export function EmojiButton({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton label={open ? chat.closeEmoji : chat.emoji} aria-expanded={open}>
          <Smile aria-hidden className="size-5" />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        keepOpenOnFocusOutside
        className="overflow-hidden p-0"
      >
        <Picker onPick={onPick} />
      </PopoverContent>
    </Popover>
  );
}
