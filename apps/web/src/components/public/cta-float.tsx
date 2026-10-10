"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { useCalm } from "@/lib/calm";
import type { CardIconName } from "./card-icon";

/** A custom PNG icon that drifts and tilts on top of the call to action scene, like the chips on the landing CTA. */
export function CtaFloat({ name, className }: { name: CardIconName; className?: string }) {
  const calm = useCalm();
  return (
    <motion.span
      aria-hidden
      className={className}
      animate={calm ? undefined : { y: [0, -10, 0], rotate: [-6, 2, -6] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
    >
      <Image
        src={`/images/icons/${name}.png`}
        alt=""
        width={112}
        height={112}
        className="size-full drop-shadow-lg"
      />
    </motion.span>
  );
}
