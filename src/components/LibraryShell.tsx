"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookTile } from "@/components/BookTile";
import { CoverThumb } from "@/components/CoverThumb";
import { ReadingSettingsForm } from "@/components/ReadingSettingsForm";
import { shelfOrder } from "@/lib/book-meta";
import { useLibrary } from "@/store/library";
import type { BookRecord } from "@/lib/types";

type Tab = "home" | "library" | "more";
type SortKey = "recent" | "title" | "author" | "progress";
type FormatFilter = "all" | "epub" | "pdf";

function pct(n: number) {
  return `${Math.round((n || 0) * 100)}%`;
}

function byRecent(books: BookRecord[]) {
  return [...books].sort((a, b) => {
    const aKey = a.lastReadAt || a.addedAt;
    const bKey = b.lastReadAt || b.addedAt;
    return bKey.localeCompare(aKey);
  });
}

function sortBooks(books: BookRecord[], sort: SortKey) {
  const list = [...books];
  if (sort === "title") return list.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "author") {
    return list.sort((a, b) => {
      const byAuthor = (a.authors[0] || "").localeCompare(b.authors[0] || "");
      return byAuthor || a.title.localeCompare(b.title);
    });
  }
  if (sort === "progress") return list.sort((a, b) => b.progress - a.progress);
  return byRecent(list);
}

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
    </svg>
  );
}

function IconLibrary({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 4h3v16H5V4Zm5.5 0h3v16h-3V4ZM16 4h3v16h-3V4Z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.2 : 0}
      />
    </svg>
  );
}

function IconMore({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.7}
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="k-search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      <span className="sr-only">Search</span>
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        enterKeyHint="search"
      />
    </label>
  );
}

function CoverRail({
  title,
  books,
  onRemove,
}: {
  title: string;
  books: BookRecord[];
  onRemove: (book: BookRecord) => void;
}) {
  if (!books.length) return null;
  return (
    <section className="k-rail">
      <header className="k-rail-head">
        <h2>{title}</h2>
      </header>
      <ul className="k-rail-track">
        {books.map((book) => (
          <BookTile
            key={book.id}
            book={book}
            variant="rail"
            onRemove={() => onRemove(book)}
          />
        ))}
      </ul>
    </section>
  );
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
  const [tab, setTab] = useState<Tab>("home");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All");
  const [format, setFormat] = useState<FormatFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [filtersOpen, setFiltersOpen] = useState(false);

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
    return sortBooks(list, sort);
  }, [books, genre, format, query, sort]);

  const continueReading = useMemo(
    () =>
      [...books]
        .filter((b) => b.lastReadAt && b.progress < 0.98)
        .sort((a, b) => b.lastReadAt.localeCompare(a.lastReadAt)),
    [books],
  );

  const recentAdds = useMemo(
    () =>
      [...books]
        .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
        .slice(0, 16),
    [books],
  );

  const shelfRails = useMemo(() => {
    return shelfOrder()
      .map((shelf) => ({
        shelf,
        books: books.filter((b) => (b.shelf || "General") === shelf).slice(0, 12),
      }))
      .filter((row) => row.books.length > 0)
      .slice(0, 4);
  }, [books]);

  const askRemove = (book: BookRecord) => {
    if (confirm(`Remove “${book.title}” from this device?`)) {
      void remove(book.id);
    }
  };

  if (!ready) {
    return (
      <main className="k-app">
        <p className="k-loading">Opening FOLIO…</p>
      </main>
    );
  }

  return (
    <main className="k-app">
      {tab === "home" ? (
        <div className="k-page">
          <header className="k-top">
            <h1>Home</h1>
          </header>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search FOLIO"
          />
          {genres.length > 1 ? (
            <div className="k-pills" role="tablist" aria-label="Shelves">
              {genres.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={genre === name ? "k-pill on" : "k-pill"}
                  onClick={() => {
                    setGenre(name);
                    if (name !== "All") setTab("library");
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}

          {status ? <p className="k-status">{status}</p> : null}

          {books.length === 0 ? (
            <p className="k-empty">
              {status ||
                "Loading your library onto this device… Keep this tab open on Wi‑Fi."}
            </p>
          ) : null}

          {continueReading[0] ? (
            <section className="k-continue">
              <h2>Continue</h2>
              <Link className="k-continue-card" href={`/read/${continueReading[0].id}`}>
                <div className="k-continue-cover">
                  <CoverThumb
                    id={continueReading[0].id}
                    title={continueReading[0].title}
                    authors={continueReading[0].authors}
                    format={continueReading[0].format}
                    hasCover={continueReading[0].hasCover}
                  />
                </div>
                <div className="k-continue-copy">
                  <span className="k-continue-title">{continueReading[0].title}</span>
                  <span className="k-continue-meta">
                    {pct(continueReading[0].progress)}
                    {continueReading[0].chapterLabel
                      ? ` · ${continueReading[0].chapterLabel}`
                      : ""}
                  </span>
                </div>
              </Link>
            </section>
          ) : null}

          {query.trim() ? (
            <CoverRail
              title="Search results"
              books={filtered.slice(0, 20)}
              onRemove={askRemove}
            />
          ) : (
            <>
              <CoverRail
                title="From your library"
                books={recentAdds}
                onRemove={askRemove}
              />
              {continueReading.length > 1 ? (
                <CoverRail
                  title="Pick up where you left off"
                  books={continueReading.slice(0, 12)}
                  onRemove={askRemove}
                />
              ) : null}
              {shelfRails.map((row) => (
                <CoverRail
                  key={row.shelf}
                  title={row.shelf}
                  books={row.books}
                  onRemove={askRemove}
                />
              ))}
            </>
          )}
        </div>
      ) : null}

      {tab === "library" ? (
        <div className="k-page">
          <header className="k-top">
            <h1>Library</h1>
            <div className="k-top-actions">
              <button
                type="button"
                className={filtersOpen ? "k-icon-btn on" : "k-icon-btn"}
                aria-label="Filters"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((v) => !v)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 7h16M7 12h10M10 17h4"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <label className="k-icon-btn" aria-label="Sort">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M8 5v14M8 5l-3 3M8 5l3 3M16 19V5M16 19l-3-3M16 19l3-3"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  aria-label="Sort books"
                >
                  <option value="recent">Recent</option>
                  <option value="title">Title</option>
                  <option value="author">Author</option>
                  <option value="progress">Progress</option>
                </select>
              </label>
            </div>
          </header>

          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search FOLIO"
          />

          {filtersOpen ? (
            <div className="k-filters">
              <div className="k-filter-block">
                <p className="k-filter-label">Shelf</p>
                <div className="k-pills">
                  {genres.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={genre === name ? "k-pill on" : "k-pill"}
                      onClick={() => setGenre(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="k-filter-block">
                <p className="k-filter-label">Format</p>
                <div className="k-pills">
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
                      className={format === value ? "k-pill on" : "k-pill"}
                      onClick={() => setFormat(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {status ? <p className="k-status">{status}</p> : null}

          {filtered.length === 0 ? (
            <p className="k-empty">
              {books.length === 0
                ? status ||
                  "Loading your library onto this device… Keep this tab open on Wi‑Fi."
                : "No books match these filters."}
            </p>
          ) : (
            <ul className="k-grid">
              {filtered.map((book) => (
                <BookTile
                  key={book.id}
                  book={book}
                  variant="cover"
                  onRemove={() => askRemove(book)}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "more" ? (
        <div className="k-page">
          <header className="k-top">
            <h1>More</h1>
          </header>
          <SearchField
            value={query}
            onChange={(v) => {
              setQuery(v);
              if (v.trim()) setTab("library");
            }}
            placeholder="Search FOLIO"
          />

          <section className="k-more-block">
            <h2>Your library</h2>
            <button
              type="button"
              className="k-more-row"
              onClick={() => inputRef.current?.click()}
            >
              <span>Add books</span>
              <span className="k-more-meta">EPUB, PDF…</span>
            </button>
            <button
              type="button"
              className="k-more-row"
              onClick={() => {
                window.location.href = "/?seed=1";
              }}
            >
              <span>Reload from GitHub</span>
              <span className="k-more-meta">Re-import catalog</span>
            </button>
            <div className="k-more-row static">
              <span>On this device</span>
              <span className="k-more-meta">
                {books.length} books · {usageLabel}
              </span>
            </div>
          </section>

          <section className="k-more-block">
            <h2>Reading</h2>
            <div className="k-more-settings">
              <ReadingSettingsForm
                settings={settings}
                onChange={(patch) => void updateSettings(patch)}
              />
            </div>
          </section>

          <section className="k-more-block">
            <h2>About</h2>
            <p className="k-about">
              FOLIO is Ubaid’s local Kindle — books stay in this browser’s storage
              until you clear site data.
            </p>
          </section>

          {status ? <p className="k-status">{status}</p> : null}
        </div>
      ) : null}

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

      <nav className="k-tabbar" aria-label="Primary">
        {(
          [
            ["home", "Home", IconHome],
            ["library", "Library", IconLibrary],
            ["more", "More", IconMore],
          ] as const
        ).map(([id, label, Icon]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              className={active ? "k-tab on" : "k-tab"}
              aria-current={active ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              <Icon active={active} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="drop-veil" aria-hidden>
        Drop books to import
      </div>
    </main>
  );
}
