# Changelog

All notable changes to Gistroom. Format follows Keep a Changelog.

## [Unreleased]

### Added

- Monorepo with npm workspaces: `apps/web`, `apps/realtime`, `packages/shared`, `packages/db`.
- Quality gates: copy checker, UI rules checker, font coverage check, graphics manifest check, safe database wrapper.
- Prisma baseline schema and migration for the full data model.
- Graphik font setup with a Noto Sans fallback for Nigerian letters.
- Core UI components: Button, IconButton, Input, Textarea, Field, Modal, Sheet, Select, Tabs, Tooltip, Badge, Avatar, Skeleton, EmptyState, ConnectionBanner.
- FeedbackProvider with showInfo, showError, showSuccess and confirm (no toasts).
- Nonce based CSP and static security headers through the Next 16 proxy file; pages render per request so scripts carry the nonce.
- Placeholder landing page, health endpoints and the realtime service skeleton.
