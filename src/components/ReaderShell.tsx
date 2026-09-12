"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addBookmark,
  getBook,
  getFileBlob,
  getProgress,
  getReflowBlob,
  getSettings,
  listBookmarks,
  removeBookmark,
  saveProgress,
  saveReflowBlob,
  saveSettings,
  setPreferReflow,
} from "@/lib/db";
import {
  contentCSS,
  pdfPageFilter,
  PROFILE_COLORS,
} from "@/lib/profiles";
import { runWaveform } from "@/lib/eink-waveform";
import { convertPdfToReflowEpub } from "@/lib/pdf-reflow";
import { ReadingSettingsForm } from "@/components/ReadingSettingsForm";
import type {
  AppSettings,
  BookmarkRecord,
  BookRecord,
  TocItem,
} from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";

type FoliateView = HTMLElement & {
  open: (file: File | Blob | string) => Promise<void>;
  init: (opts?: {
    lastLocation?: string | null;
    showTextStart?: boolean;
  }) => Promise<void>;
  goTo: (target: unknown) => Promise<void>;
  goToFraction: (fraction: number) => Promise<void>;
  prev: () => Promise<void>;
  next: () => Promise<void>;
  goLeft: () => Promise<void>;
  goRight: () => Promise<void>;
  book?: { toc?: TocItem[]; metadata?: Record<string, unknown> };
  renderer?: HTMLElement & {
    setStyles?: (css: string) => void;
    setAttribute: (name: string, value: string) => void;
  };
  lastLocation?: { cfi?: string; fraction?: number };
};

declare global {
  interface Window {
    wakeLock?: WakeLockSentinel | null;
  }
}

export function ReaderShell({ bookId }: { bookId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<FoliateView | null>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | null>(null);
  const turningRef = useRef(false);

  const [book, setBook] = useState<BookRecord | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<"none" | "toc" | "bookmarks" | "settings">(
    "none",
  );
  const [fraction, setFraction] = useState(0);
  const [chapter, setChapter] = useState("");
  const [toc, setToc] = useState<TocItem[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [error, setError] = useState("");
  const [booting, setBooting] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [usingReflow, setUsingReflow] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertStatus, setConvertStatus] = useState("");
  const [convertError, setConvertError] = useState("");

  const flash = useCallback(async (profile: AppSettings["refresh"]) => {
    if (!flashRef.current) return;
    await runWaveform(
      { flash: flashRef.current, ghost: ghostRef.current },
      profile,
    );
  }, []);

  const applyReaderStyle = useCallback((view: FoliateView, s: AppSettings) => {
    const colors = PROFILE_COLORS[s.profile] || PROFILE_COLORS.sepia;
    document.documentElement.dataset.profile = s.profile;
    document.body.style.background = colors.bg;
    document.body.style.color = colors.fg;
    if (hostRef.current) hostRef.current.style.background = colors.bg;
    view.renderer?.setStyles?.(contentCSS(s));
    view.renderer?.setAttribute("flow", "paginated");
    view.renderer?.removeAttribute("animated");
    const margin = 16 + s.margin * 4;
    view.renderer?.setAttribute("margin", `${margin}px`);
    view.renderer?.setAttribute("gap", "6%");
    // Kindle-ish measure: denser for newspaper, book column otherwise
    const maxInline =
      s.profile === "newspaper"
        ? "720px"
        : s.profile === "lighthouse"
          ? "680px"
          : "620px";
    view.renderer?.setAttribute("max-inline-size", maxInline);
    view.style.setProperty("--folio-pdf-filter", pdfPageFilter(s.profile));
  }, []);

  const turn = useCallback(
    async (dir: "prev" | "next") => {
      const view = viewRef.current;
      if (!view || turningRef.current) return;
      turningRef.current = true;
      try {
        // Flash first so the clear covers the old page (e-ink feel)
        await flash(settings.refresh);
        if (dir === "next") await view.goRight();
        else await view.goLeft();
      } finally {
        turningRef.current = false;
      }
    },
    [flash, settings.refresh],
  );

  const handleZone = useCallback(
    (clientX: number) => {
      const w = window.innerWidth || 1;
      const ratio = clientX / w;
      if (ratio < 0.28) void turn("prev");
      else if (ratio > 0.72) void turn("next");
      else {
        setMenuOpen((v) => !v);
        setPanel("none");
      }
    },
    [turn],
  );

  useEffect(() => {
    let cancelled = false;
    let wake: WakeLockSentinel | null = null;

    async function boot() {
      setBooting(true);
      try {
        const [meta, blob, progress, s, marks] = await Promise.all([
          getBook(bookId),
          getFileBlob(bookId),
          getProgress(bookId),
          getSettings(),
          listBookmarks(bookId),
        ]);
        if (cancelled) return;
        if (!meta || !blob) {
          setError("Book not found on this device.");
          setBooting(false);
          return;
        }
        setBook(meta);
        setSettings(s);
        setBookmarks(marks);
        setFraction(progress?.fraction || meta.progress || 0);
        setChapter(progress?.chapterLabel || meta.chapterLabel || "");
        setConvertError("");

        await import(
          /* webpackIgnore: true */
          "/vendor/foliate-js/view.js" as string
        );

        if (cancelled || !hostRef.current) return;
        hostRef.current.innerHTML = "";
        const view = document.createElement("foliate-view") as FoliateView;
        hostRef.current.append(view);
        viewRef.current = view;

        const wantReflow =
          meta.format === "pdf" && meta.preferReflow && meta.hasReflow;
        const reflowBlob = wantReflow ? await getReflowBlob(bookId) : null;
        const openBlob = reflowBlob || blob;
        const openAsReflow = Boolean(reflowBlob);
        setUsingReflow(openAsReflow);

        const file =
          openBlob instanceof File
            ? openBlob
            : new File(
                [openBlob],
                openAsReflow
                  ? (meta.fileName || "book").replace(/\.pdf$/i, "") +
                      ".reflow.epub"
                  : meta.fileName || "book.epub",
                {
                  type: openAsReflow
                    ? "application/epub+zip"
                    : openBlob.type || "application/epub+zip",
                },
              );

        await view.open(file);
        applyReaderStyle(view, s);

        view.addEventListener("relocate", ((e: Event) => {
          const detail = (e as CustomEvent).detail as {
            cfi?: string;
            fraction?: number;
            tocItem?: { label?: string };
          };
          const frac = detail.fraction || 0;
          const label = detail.tocItem?.label || "";
          setFraction(frac);
          if (label) setChapter(label);
          if (saveTimer.current) window.clearTimeout(saveTimer.current);
          saveTimer.current = window.setTimeout(() => {
            void saveProgress({
              id: bookId,
              cfi: detail.cfi || "",
              fraction: frac,
              chapterLabel: label,
              updatedAt: new Date().toISOString(),
            });
          }, 500);
        }) as EventListener);

        // Tap handling inside book iframes
        view.addEventListener("load", ((e: Event) => {
          const { doc } = (e as CustomEvent).detail as {
            doc: Document;
          };
          doc.addEventListener("click", (ev) => {
            const target = ev.target as HTMLElement | null;
            if (target?.closest?.("a[href]")) return;
            const sel = doc.getSelection?.();
            if (sel && !sel.isCollapsed) return;
            handleZone(ev.clientX);
          });
        }) as EventListener);

        setToc(view.book?.toc || []);
        await view.init({
          lastLocation: progress?.cfi || null,
          showTextStart: !progress?.cfi,
        });

        if (s.wakeLock && "wakeLock" in navigator) {
          try {
            wake = await navigator.wakeLock.request("screen");
          } catch {
            /* ignore */
          }
        }

        setBooting(false);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Could not open this book.");
          setBooting(false);
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      void wake?.release();
      viewRef.current = null;
    };
  }, [applyReaderStyle, bookId, handleZone, reloadKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        void turn("next");
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        void turn("prev");
      } else if (e.key === "Escape") {
        setMenuOpen(false);
        setPanel("none");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  useEffect(() => {
    if (!settings.volumeKeys) return;
    const onVolume = (e: KeyboardEvent) => {
      // Some Android browsers surface volume as media keys
      if (e.key === "AudioVolumeUp" || e.code === "AudioVolumeUp") {
        e.preventDefault();
        void turn("next");
      } else if (e.key === "AudioVolumeDown" || e.code === "AudioVolumeDown") {
        e.preventDefault();
        void turn("prev");
      }
    };
    window.addEventListener("keydown", onVolume);
    return () => window.removeEventListener("keydown", onVolume);
  }, [settings.volumeKeys, turn]);

  useEffect(() => {
    const view = viewRef.current;
    if (view) applyReaderStyle(view, settings);
  }, [applyReaderStyle, settings]);

  async function bookmarkHere() {
    const view = viewRef.current;
    const cfi = view?.lastLocation?.cfi;
    if (!cfi) return;
    const mark: BookmarkRecord = {
      id: crypto.randomUUID(),
      bookId,
      cfi,
      label: chapter || `Bookmark · ${Math.round(fraction * 100)}%`,
      createdAt: new Date().toISOString(),
    };
    await addBookmark(mark);
    setBookmarks(await listBookmarks(bookId));
  }

  async function convertPdfReflow() {
    if (!book || book.format !== "pdf" || converting) return;
    setConverting(true);
    setConvertError("");
    setConvertStatus("Reading PDF text layer…");
    try {
      const blob = await getFileBlob(bookId);
      if (!blob) throw new Error("PDF file missing on this device.");
      const result = await convertPdfToReflowEpub(
        blob,
        {
          title: book.title,
          authors: book.authors,
          language: book.language,
        },
        {
          onProgress: (done, total) => {
            setConvertStatus(`Extracting page ${done} / ${total}…`);
          },
        },
      );
      setConvertStatus(
        `Building reflowable EPUB (${result.chapterCount} sections)…`,
      );
      await saveReflowBlob(bookId, result.epub);
      const next = await getBook(bookId);
      if (next) setBook(next);
      setConvertStatus("Opening reflow…");
      setBooting(true);
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      setConvertError(
        err instanceof Error ? err.message : "Could not convert this PDF.",
      );
    } finally {
      setConverting(false);
      setConvertStatus("");
    }
  }

  async function togglePdfLayout(preferReflow: boolean) {
    if (!book?.hasReflow) return;
    await setPreferReflow(bookId, preferReflow);
    const next = await getBook(bookId);
    if (next) setBook(next);
    setBooting(true);
    setReloadKey((k) => k + 1);
  }

  if (error) {
    return (
      <main className="reader-error">
        <p>{error}</p>
        <Link href="/">Back to library</Link>
      </main>
    );
  }

  return (
    <div
      className="reader-root"
      data-profile={settings.profile}
      data-refresh={settings.refresh}
      data-format={usingReflow ? "epub" : book?.format || "epub"}
    >
      <div ref={ghostRef} className="page-ghost" aria-hidden />
      <div ref={flashRef} className="page-flash" aria-hidden />
      <div
        ref={hostRef}
        className="reader-host"
        onClick={(e) => {
          if (e.target === hostRef.current) handleZone(e.clientX);
        }}
      />

      {booting ? <div className="reader-boot">Opening…</div> : null}

      <div className="tap-hint" aria-hidden>
        <span />
        <span />
        <span />
      </div>

      {menuOpen ? (
        <div className="reader-menu" role="dialog" aria-label="Reading controls">
          <div className="menu-card">
            <p className="menu-progress">{Math.round(fraction * 100)}%</p>
            {chapter ? <p className="menu-chapter">{chapter}</p> : null}
            {book ? <p className="menu-title">{book.title}</p> : null}

            <div className="menu-actions">
              <button type="button" onClick={() => setPanel("toc")}>
                Contents
              </button>
              <button type="button" onClick={() => setPanel("bookmarks")}>
                Bookmarks
              </button>
              <button type="button" onClick={() => void bookmarkHere()}>
                Bookmark page
              </button>
              <button type="button" onClick={() => setPanel("settings")}>
                Settings
              </button>
              {book?.format === "pdf" ? (
                <>
                  {!book.hasReflow ? (
                    <button
                      type="button"
                      disabled={converting}
                      onClick={() => void convertPdfReflow()}
                    >
                      {converting
                        ? convertStatus || "Converting…"
                        : "Convert PDF → reflow"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void togglePdfLayout(!usingReflow)}
                    >
                      {usingReflow
                        ? "Switch to PDF page mode"
                        : "Switch to reflow text"}
                    </button>
                  )}
                  {convertError ? (
                    <p className="muted convert-error">{convertError}</p>
                  ) : null}
                  {usingReflow ? (
                    <p className="muted">
                      Reflow on — fonts &amp; justify apply like EPUB.
                    </p>
                  ) : null}
                </>
              ) : null}
              <Link href="/" className="close-book">
                Close book
              </Link>
            </div>
            <button
              type="button"
              className="menu-dismiss"
              onClick={() => {
                setMenuOpen(false);
                setPanel("none");
              }}
            >
              Resume
            </button>
          </div>

          {panel === "toc" ? (
            <div className="side-panel">
              <h3>Contents</h3>
              <TocList
                items={toc}
                onGo={(href) => {
                  void viewRef.current?.goTo(href);
                  setMenuOpen(false);
                  setPanel("none");
                }}
              />
            </div>
          ) : null}

          {panel === "bookmarks" ? (
            <div className="side-panel">
              <h3>Bookmarks</h3>
              {bookmarks.length === 0 ? (
                <p className="muted">None yet.</p>
              ) : (
                <ul className="bookmark-list">
                  {bookmarks.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => {
                          void viewRef.current?.goTo(b.cfi);
                          setMenuOpen(false);
                          setPanel("none");
                        }}
                      >
                        {b.label}
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => {
                          void removeBookmark(b.id).then(async () =>
                            setBookmarks(await listBookmarks(bookId)),
                          );
                        }}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {panel === "settings" ? (
            <div className="side-panel settings-side">
              <h3>Reading</h3>
              <ReadingSettingsForm
                compact
                settings={settings}
                onChange={(patch) => {
                  setSettings((prev) => ({ ...prev, ...patch }));
                  void saveSettings(patch);
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TocList({
  items,
  onGo,
  depth = 0,
}: {
  items: TocItem[];
  onGo: (href: string) => void;
  depth?: number;
}) {
  if (!items?.length) return <p className="muted">No table of contents.</p>;
  return (
    <ul className="toc-list" style={{ paddingLeft: depth ? 12 : 0 }}>
      {items.map((item, i) => (
        <li key={`${item.label}-${i}`}>
          {item.href ? (
            <button type="button" onClick={() => onGo(item.href!)}>
              {item.label}
            </button>
          ) : (
            <span>{item.label}</span>
          )}
          {item.subitems?.length ? (
            <TocList items={item.subitems} onGo={onGo} depth={depth + 1} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
