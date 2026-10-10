export interface Art {
  src: string;
  alt: string;
  width: number;
  height: number;
}

/** Approved illustrations by manifest id. Filled in as PNG art is approved (Section 17). */
const art: Record<string, Art> = {};

export function getArt(id: string): Art | undefined {
  return art[id];
}
