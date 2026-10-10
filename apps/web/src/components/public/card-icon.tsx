import Image from "next/image";
import { cn } from "@/lib/cn";

export type CardIconName =
  | "friends"
  | "voice"
  | "media"
  | "starred"
  | "shield-slash"
  | "theme"
  | "install"
  | "offline"
  | "respect"
  | "no-hate"
  | "private"
  | "no-scams"
  | "children"
  | "law"
  | "block"
  | "report"
  | "invites"
  | "privacy"
  | "private-room"
  | "football"
  | "music-and-gbedu"
  | "politics-and-governance"
  | "tech-and-startups"
  | "business-and-money"
  | "relationships"
  | "faith-and-life"
  | "campus-life"
  | "nollywood-and-entertainment"
  | "food-and-chop"
  | "health-and-wellness"
  | "careers-and-jobs"
  | "education"
  | "comedy"
  | "diaspora-and-japa"
  | "fashion-and-owambe"
  | "gaming"
  | "open-gist"
  | "device-android"
  | "device-ios"
  | "device-desktop"
  | "alerts"
  | "speed"
  | "idea"
  | "honest"
  | "mascot-install"
  | "tools"
  | "mascot-gist"
  | "account"
  | "devices"
  | "moderator"
  | "switch";

/**
 * The custom Gistroom icon for a card. Every icon sits in the same square area, so cards line up. It lifts and
 * tilts a little on hover where the card is a group, and stands still for visitors who prefer reduced motion.
 */
export function CardIcon({ name, className }: { name: CardIconName; className?: string }) {
  return (
    <span
      data-card-icon
      className={cn(
        "inline-flex size-14 shrink-0 transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-6 motion-reduce:transition-none motion-reduce:group-hover:transform-none",
        className,
      )}
    >
      <Image
        src={`/images/icons/${name}.png`}
        alt=""
        width={56}
        height={56}
        className="size-full"
      />
    </span>
  );
}
