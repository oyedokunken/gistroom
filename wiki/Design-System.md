# Design system

Tokens live in `apps/web/src/lib/tokens.ts` and `apps/web/src/app/globals.css`. See CLAUDE.md Section 13.

## Font coverage (Phase 0 check)

`npm run lint:font` reads the Graphik TTF `cmap`. Result: Graphik has 544 glyphs and none of the required characters.

| Group                                             | Covered by Graphik | Fallback                           |
| ------------------------------------------------- | ------------------ | ---------------------------------- |
| Naira sign                                        | no                 | Noto Sans latin-ext                |
| Yoruba and Igbo letters                           | no                 | Noto Sans latin-ext and vietnamese |
| Combining marks (dot below, grave, acute, macron) | no                 | Noto Sans vietnamese and latin     |
| Hausa hooked letters                              | no                 | Noto Sans latin-ext                |

The fallback family is `Noto Sans Gistroom`, declared in `globals.css` with `unicode-range`, files in `apps/web/public/fonts/noto-sans/`. The check fails if neither font covers a required glyph.

## Page position (ScrollWave)

No floating back to top button (Decisions D27). `components/ui/scroll-wave.tsx` draws 36 bars like a voice note. Green bars are played, the yellow bar is where you are. Drag or tap to seek. It is an ARIA slider: arrows move 5 percent (25 with Shift), Page keys 25, Home and End jump to the ends. It sits on the right edge from tablet up and as a strip above the dock on phones, and fades when idle. The footer wordmark is a button that scrolls to the top.
