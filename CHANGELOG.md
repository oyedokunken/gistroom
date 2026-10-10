# Changelog

All notable changes to Gistroom. Format follows Keep a Changelog.

## [Unreleased]

### Changed

- Light mode is the default. Theme control offers Light, Dark and System (D24).
- Attribution: Gistroom is built by @oyedokunken (D25).
- Hero: text left and image right on desktop at equal height, image first on mobile.
- Mobile header: the capsule contracts into the mic bubble on scroll, the dock has an entrance, press blob and a pulsing center button. The footer waveform plays on touch screens.

### Added

- Monorepo with npm workspaces: `apps/web`, `apps/realtime`, `packages/shared`, `packages/db`.
- Quality gates: copy checker, UI rules checker, font coverage check, graphics manifest check, safe database wrapper.
- Prisma baseline schema and migration for the full data model.
- Graphik font setup with a Noto Sans fallback for Nigerian letters.
- Core UI components: Button, IconButton, Input, Textarea, Field, Modal, Sheet, Select, Tabs, Tooltip, Badge, Avatar, Skeleton, EmptyState, ConnectionBanner.
- FeedbackProvider with showInfo, showError, showSuccess and confirm (no toasts).
- Nonce based CSP and static security headers through the Next 16 proxy file; pages render per request so scripts carry the nonce.
- Brand build (`npm run brand`): logo mark, wordmark and lockups, favicon, PWA icons, push badge and default Open Graph image.
- Illustration manifest, prompts with the style lock, generated alt text and 33 pattern placeholders; budgets enforced by `lint:graphics`.
- Web App Manifest, icons and default Open Graph metadata.
- Landing v1: the Voice Dock header (capsule with sliding highlight, live room pill, mic bubble with scroll reactive rings, radial menu, mobile thumb zone dock with More sheet), hero with parallax layers, speaking rings, sound bars and drifting sample gist, footer with oversized wordmark and scroll to top ring button.
- `/api/public/stats` live room count (reports zero on any failure), `/api/csp-report`, Organization and WebSite JSON-LD.
- Health endpoints and the realtime service skeleton.
- GitHub Actions CI, Dependabot, Render blueprint, Vercel config, README architecture diagrams, security policy, contributing guide, license notice and the wiki skeleton.
