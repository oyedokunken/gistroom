/**
 * The only place outside the footer credit where the builder is named: the About page "Who makes it" section.
 * scripts/check-copy.mjs fails if the name appears anywhere else in public copy.
 */
export const maker = {
  title: "Who makes it",
  body: "Gistroom is built by @oyedokunken, one developer who wanted this to exist. You can see the rest of the work at oyedokun.dev.",
  link: { label: "Visit oyedokun.dev", href: "https://www.oyedokun.dev/" },
  photosAlt: "Portraits of Oyedokun Ken, who builds Gistroom",
} as const;
