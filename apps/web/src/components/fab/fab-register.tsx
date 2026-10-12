"use client";

import { useFab, type FabPlace } from "@/lib/fab";

/** Drop this into a page to say which place it is. The floating button follows. It renders nothing. */
export function FabRegister({ place }: { place: FabPlace }) {
  useFab(place);
  return null;
}
