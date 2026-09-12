"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookTile } from "@/components/BookTile";
import { CoverThumb } from "@/components/CoverThumb";
import { ReadingSettingsForm } from "@/components/ReadingSettingsForm";
import { shelfOrder } from "@/lib/book-meta";
import {
  clubByAuthor,
  clubByGenre,
  type LibraryView,
} from "@/lib/library-organize";
import { useLibrary } from "@/store/library";
import type { BookRecord } from "@/lib/types";

type FormatFilter = "all" | "epub" | "pdf";

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
  const [genre, setGenre] = useState<string>("All");
  const [format, setFormat] = useState<FormatFilter>("all");
  const [view, setView] = useState<LibraryView>("authors");
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

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

  const genres = useMemo(() => {
    const present = new Set(books.map((b) => b.shelf || "General"));
    return ["All", ...shelfOrder().filter((s) => present.has(s))];
  }, [books]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...books];
    if (genre !== "All") {
      list = list.filter((b) => (b.shelf || "General") === genre);
    }
    if (format !== "all") {
      list = list.filter((b) => b.format === format);
    }
    if (q) {
      list = list.filter((b) => {
        const hay =
          `${b.title} ${b.authors.join(" ")} ${b.shelf || ""} ${b.fileName}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [books, genre, format, query]);

  const authorClubs = useMemo(() => clubByAuthor(filtered), [filtered]);
  const genreClubs = useMemo(() => clubByGenre(filtered), [filtered]);
  const multiAuthorCount = authorClubs.filter((c) => c.books.length > 1).length;

  if (!ready) {
    return (
      <main className="ledger">
        <p className="muted">Opening your library…</p>
      </main>
    );
  }

  return (
    <main className="ledger shelf-layout" data-profile={settings.profile}>
      <header className="ledger-brand">
        <div className="brand-row">
          <p className="brand">FOLIO</p>
          <button
            type="button"
            className="settings-gear"
            aria-label="Settings"
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen(true)}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
        </div>
        <p className="tagline">A private reading machine.</p>
        <p className="library-stats muted tiny">
          {books.length} books · {clubByAuthor(books).length} writers
          {multiAuthorCount
            ? ` · ${multiAuthorCount} authors with collections`
            : ""}
        </p>
      </header>

      {cont ? (
        <section className="ledger-section continue-section">
          <h2>Continue</h2>
          <Link className="continue-card" href={`/read/${cont.id}`}>
            <div className="continue-cover">
              <CoverThumb
                id={cont.id}
                title={cont.title}
                authors={cont.authors}
                format={cont.format}
                hasCover={cont.hasCover}
              />
            </div>
            <div className="continue-copy">
              <span className="continue-title">{cont.title}</span>
              <span className="continue-meta">
                {pct(cont.progress)}
                {cont.chapterLabel ? ` · ${cont.chapterLabel}` : ""}
                {cont.authors[0] ? ` · ${cont.authors[0]}` : ""}
              </span>
            </div>
          </Link>
        </section>
      ) : null}

      <section className="ledger-section shelf-section">
        <div className="section-row">
          <h2>Gallery</h2>
          <span className="muted">
            {filtered.length}
            {filtered.length !== books.length ? ` of ${books.length}` : ""}{" "}
            titles
          </span>
        </div>

        <div className="shelf-toolbar">
          <label className="search-field">
            <span className="sr-only">Search</span>
            <input
              type="search"
              placeholder="Search title, author, or genre"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <div className="toolbar-label muted tiny">Genres</div>
          <div className="filter-row genre-row" role="tablist" aria-label="Genre">
            {genres.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={genre === name}
                className={genre === name ? "chip on" : "chip"}
                onClick={() => setGenre(name)}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="filter-row compact">
            <div className="chip-group" role="tablist" aria-label="View">
              {(
                [
                  ["authors", "By writer"],
                  ["genres", "By genre"],
                  ["gallery", "All covers"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={view === value}
                  className={view === value ? "chip on" : "chip"}
                  onClick={() => setView(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="chip-group" role="group" aria-label="Format">
              {(
                [
                  ["all", "All"],
                  ["epub", "EPUB"],
                  ["pdf", "PDF"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={format === value ? "chip on" : "chip"}
                  onClick={() => setFormat(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="shelf-actions">
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
        </div>

        {filtered.length === 0 ? (
          <p className="muted empty-copy">
            {books.length === 0
              ? status
                ? status
                : "Loading your library onto this device… Keep this tab open on Wi‑Fi."
              : "No books match these filters."}
          </p>
        ) : null}

        {filtered.length > 0 && view === "authors" ? (
          <div className="author-gallery">
            {authorClubs.map((club) => (
              <section key={club.key} className="author-club">
                <header className="author-club-head">
                  <h3>{club.author}</h3>
                  <span className="muted tiny">
                    {club.books.length}{" "}
                    {club.books.length === 1 ? "book" : "books"}
                    {club.books[0]?.shelf ? ` · ${club.books[0].shelf}` : ""}
                  </span>
                </header>
                <ul
                  className={
                    club.books.length > 1
                      ? "bookshelf author-rail"
                      : "bookshelf author-rail single"
                  }
                >
                  {club.books.map((book) => (
                    <BookTile
                      key={book.id}
                      book={book}
                      compact={club.books.length > 1}
                      onRemove={() => {
                        if (confirm(`Remove “${book.title}” from this device?`)) {
                          void remove(book.id);
                        }
                      }}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}

        {filtered.length > 0 && view === "genres" ? (
          <div className="genre-gallery">
            {genreClubs.map((g) => (
              <section key={g.genre} className="genre-club">
                <header className="genre-club-head">
                  <h3>{g.genre}</h3>
                  <span className="muted tiny">
                    {g.bookCount} titles · {g.authors.length} writers
                  </span>
                </header>
                {g.authors.map((club) => (
                  <div key={`${g.genre}-${club.key}`} className="author-club nested">
                    <header className="author-club-head compact">
                      <h4>{club.author}</h4>
                      <span className="muted tiny">
                        {club.books.length}{" "}
                        {club.books.length === 1 ? "book" : "books"}
                      </span>
                    </header>
                    <ul className="bookshelf author-rail">
                      {club.books.map((book) => (
                        <BookTile
                          key={book.id}
                          book={book}
                          compact
                          onRemove={() => {
                            if (
                              confirm(`Remove “${book.title}” from this device?`)
                            ) {
                              void remove(book.id);
                            }
                          }}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        ) : null}

        {filtered.length > 0 && view === "gallery" ? (
          <ul className="bookshelf">
            {filtered
              .slice()
              .sort((a, b) => a.title.localeCompare(b.title))
              .map((book) => (
                <BookTile
                  key={book.id}
                  book={book}
                  onRemove={() => {
                    if (confirm(`Remove “${book.title}” from this device?`)) {
                      void remove(book.id);
                    }
                  }}
                />
              ))}
          </ul>
        ) : null}
      </section>

      {settingsOpen ? (
        <div
          className="settings-overlay"
          role="presentation"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Reading settings"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-dialog-head">
              <h2>Settings</h2>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setSettingsOpen(false)}
              >
                Close
              </button>
            </div>
            <ReadingSettingsForm
              settings={settings}
              onChange={(patch) => void updateSettings(patch)}
            />
            <p className="muted tiny settings-usage">{usageLabel}</p>
          </div>
        </div>
      ) : null}

      <div className="drop-veil" aria-hidden>
        Drop books to import
      </div>
    </main>
  );
}
