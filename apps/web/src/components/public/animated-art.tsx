"use client";

import Image from "next/image";
import { useCalm } from "@/lib/calm";

/**
 * An animated scene served as animated WebP, with the still PNG for everyone who prefers less motion.
 * The picture element swaps to the PNG by itself for the reduced motion media query, no script needed.
 * The "Reduce animations" choice swaps it too. GIF is never used (Section 17).
 */
export function AnimatedArt({
  id,
  alt,
  width,
  height,
  className,
  priority,
  sizes = "(max-width: 768px) 100vw, 560px",
}: {
  id: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const calm = useCalm();
  const still = `/images/scenes/${id}.png`;
  if (calm) {
    return (
      <Image
        src={still}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
        className={className}
      />
    );
  }
  return (
    <picture className="contents">
      <source media="(prefers-reduced-motion: reduce)" srcSet={still} />
      {/* Next/Image would re-encode the animation to a still, so the animated file is served as it is. */}
      <img
        src={`/images/scenes/${id}.webp`}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={className}
      />
    </picture>
  );
}
