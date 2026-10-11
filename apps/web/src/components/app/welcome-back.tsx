"use client";

import { HandHeart, Mic, Search } from "lucide-react";
import Link from "next/link";
import { Button, buttonStyles } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { appNav } from "@/content/app";

/** Shown once after someone signs in. It points at the Gistroom button in the corner. */
export function WelcomeBack({
  name,
  open,
  onOpenChange,
}: {
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      icon={HandHeart}
      title={appNav.welcomeBack.title(first)}
      description={appNav.welcomeBack.body}
      footer={
        <>
          <Link
            href="/app/friends?tab=find"
            onClick={() => onOpenChange(false)}
            className={buttonStyles("secondary")}
          >
            <Search aria-hidden className="size-4" />
            {appNav.welcomeBack.find}
          </Link>
          <Link
            href="/app/rooms?new=1"
            onClick={() => onOpenChange(false)}
            className={buttonStyles("secondary")}
          >
            <Mic aria-hidden className="size-4" />
            {appNav.welcomeBack.room}
          </Link>
          <Button onClick={() => onOpenChange(false)}>{appNav.welcomeBack.close}</Button>
        </>
      }
    />
  );
}
