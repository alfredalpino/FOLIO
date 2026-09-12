# FOLIO

A private, local-first, e-ink-inspired reading machine.

**Bookshelf → Open book → Read → Close book.**

Books never leave your device. Vercel only delivers the app shell.

## Stack

- Next.js + TypeScript
- Foliate.js (EPUB / MOBI / AZW3 / FB2 / CBZ / PDF)
- IndexedDB (Dexie)
- PWA (manifest + service worker)

## Local development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), add an EPUB, then **Add to Home Screen** on your phone after deploying.

## Notes

- Your personal `books/` folder ships with the repo (Git LFS). Locally, FOLIO imports those files into on-device IndexedDB on first open. For Vercel, turn on Git LFS in project settings if book binaries must be present at runtime (do not put `git lfs pull` in the build script).
- Page turns are instant by default. Optional Kindle / E-Ink / Ghosting profiles exist in settings.
- Tap zones: left = previous, right = next, center = menu.
- Install: use **Install as app** when Chrome offers it, or Share → Add to Home Screen on iPhone.

## License

App code: MIT.
Foliate.js: MIT (vendored under `public/vendor/foliate-js`).
