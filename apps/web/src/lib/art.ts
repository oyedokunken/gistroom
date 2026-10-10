import { artMap } from "./art.generated";

export interface Art {
  src: string;
  alt: string;
  width: number;
  height: number;
}

/** Illustration by manifest id. Placeholders and approved art share the same lookup (Section 17). */
export function getArt(id: string): Art | undefined {
  return artMap[id];
}
