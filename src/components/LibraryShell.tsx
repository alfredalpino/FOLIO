"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { InstallAppButton } from "@/components/InstallAppButton";
import { useLibrary } from "@/store/library";
import type { BookRecord, ReadingProfile, RefreshProfile } from "@/lib/types";

function pct(n: number) {
  return `${Math.round((n || 0) * 100)}%`;
}

function continueBook(books: BookRecord[]) {
  return [...books]
    .filter((b) => b.lastReadAt)
    .sort((a, b) => b.lastReadAt.localeCompare(a.lastReadAt))[0];
}

export function LibraryShell() {
  const {
    ready,
    books,
    settings,
    status,
    usageLabel,
    hydrate,
    addFiles,
    remove,
    updateSettings,
  } = useLibrary();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      document.body.classList.add("dropping");
    };
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) document.body.classList.remove("dropping");
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      document.body.classList.remove("dropping");
      if (e.dataTransfer?.files?.length) void addFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [addFiles]);

  const cont = useMemo(() => continueBook(books), [books]);
  const recent = useMemo(
    () =>
      [...books]
        .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
        .slice(0, 8),
    [books],
  );
  const all = useMemo(
    () => [...books].sort((a, b) => a.title.localeCompare(b.title)),
    [books],
  );

  if (!ready) {
    return (
      <main className="ledger">
        <p className="muted">Opening your library…</p>
      </main>
    );
  }

  return (
    <main className="ledger" data-profile={settings.profile}>
      <header className="ledger-brand">
        <p className="brand">PAPER</p>
        <p className="tagline">A private reading machine.</p>
        <InstallAppButton />
      </header>

      {cont ? (
        <section className="ledger-section">
          <h2>Continue reading</h2>
          <Link className="continue-card" href={`/read/${cont.id}`}>
            <span className="continue-title">{cont.title}</span>
            <span className="continue-meta">
              {pct(cont.progress)}
              {cont.chapterLabel ? ` · ${cont.chapterLabel}` : ""}
              {cont.authors[0] ? ` · ${cont.authors[0]}` : ""}
            </span>
          </Link>
        </section>
      ) : null}

      <section className="ledger-section">
        <div className="section-row">
          <h2>Your library</h2>
          <span className="muted">{books.length} books</span>
        </div>
        <button
          type="button"
          className="add-btn"
          onClick={() => inputRef.current?.click()}
        >
          + Add books
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".epub,.pdf,.mobi,.azw3,.fb2,.cbz,application/epub+zip,application/pdf"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {status ? <p className="status">{status}</p> : null}
      </section>

      {recent.length ? (
        <section className="ledger-section">
          <h2>Recently added</h2>
          <ul className="book-list">
            {recent.map((book) => (
              <li key={book.id}>
                <Link href={`/read/${book.id}`}>
                  <span>{book.title}</span>
                  <span className="muted">
                    {book.authors[0] || book.format.toUpperCase()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="ledger-section">
        <h2>All books</h2>
        {all.length === 0 ? (
          <p className="muted empty-copy">
            Select an EPUB on your phone. It stays here — never uploaded.
          </p>
        ) : (
          <ul className="book-list dense">
            {all.map((book) => (
              <li key={book.id}>
                <Link href={`/read/${book.id}`}>
                  <span>
                    {book.title}
                    {book.progress > 0.001 ? (
                      <em className="progress-em"> · {pct(book.progress)}</em>
                    ) : null}
                  </span>
                  <span className="muted">{book.authors.join(", ") || "—"}</span>
                </Link>
                <button
                  type="button"
                  className="ghost-btn"
                  aria-label={`Remove ${book.title}`}
                  onClick={() => {
                    if (confirm(`Remove “${book.title}” from this device?`)) {
                      void remove(book.id);
                    }
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ledger-section settings-block">
        <h2>Reading</h2>
        <label className="field">
          <span>Profile</span>
          <select
            value={settings.profile}
            onChange={(e) =>
              void updateSettings({
                profile: e.target.value as ReadingProfile,
              })
            }
          >
            <option value="paper">Paper</option>
            <option value="newspaper">Newspaper</option>
            <option value="night">Night</option>
            <option value="terminal">Terminal</option>
          </select>
        </label>
        <label className="field">
          <span>Page refresh</span>
          <select
            value={settings.refresh}
            onChange={(e) =>
              void updateSettings({
                refresh: e.target.value as RefreshProfile,
              })
            }
          >
            <option value="paper">Paper (instant)</option>
            <option value="kindle">Kindle</option>
            <option value="eink">E-Ink flash</option>
            <option value="ghosting">Ghosting</option>
          </select>
        </label>
        <label className="field check">
          <input
            type="checkbox"
            checked={settings.wakeLock}
            onChange={(e) =>
              void updateSettings({ wakeLock: e.target.checked })
            }
          />
          <span>Keep screen awake while reading</span>
        </label>
        <label className="field check">
          <input
            type="checkbox"
            checked={settings.volumeKeys}
            onChange={(e) =>
              void updateSettings({ volumeKeys: e.target.checked })
            }
          />
          <span>Volume keys turn pages (Android)</span>
        </label>
        <p className="muted tiny">{usageLabel}. Airplane mode works.</p>
      </section>

      <footer className="ledger-foot">
        <p>
          Local-first. No account. No cloud library. Your phone is the hardware.
        </p>
      </footer>

      <div className="drop-veil" aria-hidden>
        Drop books to import
      </div>
    </main>
  );
}
