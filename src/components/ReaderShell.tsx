"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addBookmark,
  getBook,
  getFileBlob,
  getProgress,
  getSettings,
  listBookmarks,
  removeBookmark,
  saveProgress,
} from "@/lib/db";
import { contentCSS, PROFILE_COLORS, refreshDuration } from "@/lib/profiles";
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
  const saveTimer = useRef<number | null>(null);

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

  const flash = useCallback(async (profile: AppSettings["refresh"]) => {
    const el = flashRef.current;
    if (!el) return;
    const ms = refreshDuration(profile);
    if (ms <= 0) return;
    el.dataset.mode = profile;
    el.classList.add("on");
    await new Promise((r) => window.setTimeout(r, ms));
    el.classList.remove("on");
  }, []);

  const applyReaderStyle = useCallback((view: FoliateView, s: AppSettings) => {
    const colors = PROFILE_COLORS[s.profile];
    document.documentElement.dataset.profile = s.profile;
    document.body.style.background = colors.bg;
    document.body.style.color = colors.fg;
    if (hostRef.current) hostRef.current.style.background = colors.bg;
    view.renderer?.setStyles?.(contentCSS(s));
    view.renderer?.setAttribute("flow", "paginated");
    // Never animate page turns — paper feel
    view.renderer?.removeAttribute("animated");
    const margin = 18 + s.margin * 4;
    view.renderer?.setAttribute("margin", `${margin}px`);
    view.renderer?.setAttribute("gap", "7%");
    view.renderer?.setAttribute(
      "max-inline-size",
      s.profile === "newspaper" ? "720px" : "640px",
    );
  }, []);

  const turn = useCallback(
    async (dir: "prev" | "next") => {
      const view = viewRef.current;
      if (!view) return;
      await flash(settings.refresh);
      if (dir === "next") await view.goRight();
      else await view.goLeft();
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

        await import(
          /* webpackIgnore: true */
          "/vendor/foliate-js/view.js" as string
        );

        if (cancelled || !hostRef.current) return;
        hostRef.current.innerHTML = "";
        const view = document.createElement("foliate-view") as FoliateView;
        hostRef.current.append(view);
        viewRef.current = view;

        const file =
          blob instanceof File
            ? blob
            : new File([blob], meta.fileName || "book.epub", {
                type: blob.type || "application/epub+zip",
              });

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
  }, [applyReaderStyle, bookId, handleZone]);

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

  if (error) {
    return (
      <main className="reader-error">
        <p>{error}</p>
        <Link href="/">Back to library</Link>
      </main>
    );
  }

  return (
    <div className="reader-root" data-profile={settings.profile}>
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
            <div className="side-panel">
              <h3>Typography</h3>
              <label className="field">
                <span>Size {settings.fontSize}%</span>
                <input
                  type="range"
                  min={80}
                  max={180}
                  step={5}
                  value={settings.fontSize}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      fontSize: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Margins</span>
                <input
                  type="range"
                  min={0}
                  max={16}
                  value={settings.margin}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      margin: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <p className="muted tiny">
                Profiles live on the library screen. Changes here apply instantly.
              </p>
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
