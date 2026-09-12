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

- Your personal `books/` folder ships with the repo (Git LFS). On first open (empty library), FOLIO downloads each book once into on-device IndexedDB, then stays offline until you clear site data. Refresh never re-downloads. Locally, real LFS-checked-out files are served from disk; on Vercel, LFS pointers are resolved from the public GitHub repo (optional `FOLIO_GITHUB_TOKEN` only if the repo is private again). Force a reseed with `?seed=1`.
- Page turns are instant by default. Optional Kindle / E-Ink / Ghosting profiles exist in settings.
- Tap zones: left = previous, right = next, center = menu.
- PWA: Chrome/Edge show their own **Install app** control in the address bar / browser menu when the app is installable (HTTPS, manifest, service worker). On iPhone: Share → Add to Home Screen.

## License

App code: MIT.
Foliate.js: MIT (vendored under `public/vendor/foliate-js`).
