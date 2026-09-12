# PAPER

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

- Your personal `books/` folder is gitignored and is never uploaded.
- Page turns are instant by default (Paper refresh). Optional Kindle / E-Ink / Ghosting profiles exist in settings.
- Tap zones: left = previous, right = next, center = menu.

## License

App code: MIT.
Foliate.js: MIT (vendored under `public/vendor/foliate-js`).
