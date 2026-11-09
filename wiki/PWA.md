# PWA

Status: Built. Manifest, icons, service worker (Serwist), offline shell, offline send queue, install card and update prompt.

Manifest: `apps/web/src/app/manifest.ts`. Icons come from `npm run brand`.

- Serwist service worker: precache the shell and fonts, never cache authenticated API responses beyond a short window, never cache signed media URLs.
- Install card: capture `beforeinstallprompt`, never nag, wait 14 days after a dismissal.
- Update flow: a modal says a new version is ready (no toast).
