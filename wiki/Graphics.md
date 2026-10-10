# Graphics

Rules are in CLAUDE.md Section 17. This page records how the pipeline runs today.

## Brand

`npm run brand` rebuilds everything from `scripts/brand.mjs`:

- SVG sources in `design/masters/logo/` (mark, inverted, mono, wordmark, horizontal and stacked lockups).
- PNG exports, favicon (16, 32, 48), PWA icons (192, 512, maskable 512 with art inside the central 80 percent), Apple touch icon, push badge and the default Open Graph image, all in `apps/web/public/brand/`.
- Text in the wordmark and the OG image is rendered by resvg from the real Graphik TTF files, never a lookalike.

The mark is a speech bubble that forms a lowercase g, with three sound bars in the bowl (green, yellow, green).

## Illustrations

- `scripts/graphics/assets.mjs` is the single list of illustrations, with prompts and alt text.
- `npm run graphics:placeholders` writes `design/assets.manifest.json`, `design/PROMPTS.md` and `apps/web/src/content/alt.ts`, and renders a pattern placeholder PNG at the final ratio for every asset still marked PLACEHOLDER. It never overwrites an asset marked DRAFT or APPROVED.
- `npm run lint:graphics` fails on a missing file, missing alt text, a file over budget (180 KB, 250 KB for hero layers) or a missing brand export. With `RELEASE_BUILD=true` it also fails on any PLACEHOLDER.

## Still to generate

All 33 illustrations are placeholders. Generate them from `design/PROMPTS.md` with the image tool of your choice, save the master PNGs in `design/masters/`, then I run the optimizer (not written yet) and flip the status. Placeholders ship only the 640 pixel variant.
