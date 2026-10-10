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
