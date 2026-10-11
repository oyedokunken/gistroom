# Graphics

Rules are in CLAUDE.md Section 17. This page records how the pipeline runs today.

## Brand

`npm run brand` rebuilds everything from `scripts/brand.mjs`:

- SVG sources in `design/masters/logo/` (mark, inverted, mono, wordmark, horizontal and stacked lockups).
- PNG exports, favicon (16, 32, 48), PWA icons (192, 512, maskable 512 with art inside the central 80 percent), Apple touch icon, push badge and the default Open Graph image, all in `apps/web/public/brand/`.
- Text in the wordmark and the OG image is rendered by resvg from the real Graphik TTF files, never a lookalike.

The mark is a speech bubble that forms a lowercase g, with three sound bars in the bowl (green, yellow, green).

## Illustrations

- Every shipped image is real code drawn art: avatars, icons, scenes and the maker portraits, built by the scripts in `scripts/graphics/` and listed in `design/assets.manifest.json`.
- The pattern tile placeholders and their generator were deleted on 2026-10-11. Empty states use the custom icon set instead of a placeholder picture.
- `npm run lint:graphics` fails on a missing file, missing alt text, a file over budget (180 KB, 250 KB for hero layers, 400 KB animated) or a missing brand export. With `RELEASE_BUILD=true` it also fails on any PLACEHOLDER.
