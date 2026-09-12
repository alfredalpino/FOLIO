"use client";

import { create } from "zustand";
import {
  deleteBook,
  getSettings,
  listBooks,
  saveSettings,
  storageEstimate,
} from "@/lib/db";
import { importBookFile, importBookFiles } from "@/lib/import-book";
import { normalizeLibraryBooks } from "@/lib/normalize-library";
import type { AppSettings, BookRecord } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";

/**
 * v4: empty library always retries; success flag only set after ≥1 import.
 * Older v3 flags blocked reseeding after failed LFS-pointer imports.
 */
const SEED_FLAG = "folio-local-books-seeded-v4";
const SEED_PROGRESS = "folio-local-books-seed-progress-v4";
const LFS_PREFIX = "version https://git-lfs.github.com/spec/v1";
const DEFAULT_GITHUB_REPO = "alfredalpino/FOLIO";
const DEFAULT_GITHUB_REF = "main";

let seedInFlight: Promise<void> | null = null;

function clearLegacySeedLocks() {
  if (typeof window === "undefined") return;
  // Drop flags that previously locked an empty library forever.
  for (const key of [
    "folio-local-books-seeded-v3",
    "folio-local-books-seeded-v2",
    "folio-local-books-seeded-v1",
    "paper-local-books-seeded-v2",
    "folio-local-books-seed-progress-v3",
    "folio-local-books-seed-progress-v2",
  ]) {
    window.localStorage.removeItem(key);
  }
  const pairs: Array<[string, string]> = [
    ["paper-meta-normalized-v5", "folio-meta-normalized-v1"],
    ["paper-meta-normalized-v4", "folio-meta-normalized-v1"],
    ["paper-meta-normalized-v3", "folio-meta-normalized-v1"],
  ];
  for (const [from, to] of pairs) {
    const value = window.localStorage.getItem(from);
    if (value != null && window.localStorage.getItem(to) == null) {
      window.localStorage.setItem(to, value);
    }
  }
}

interface LibraryState {
  ready: boolean;
  books: BookRecord[];
  settings: AppSettings;
  status: string;
  usageLabel: string;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  addFiles: (files: FileList | File[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
}

function formatUsage(usage?: number, quota?: number) {
  if (!usage) return "Storage estimate unavailable";
  const used = (usage / 1048576).toFixed(1);
  if (!quota) return `${used} MB used locally`;
  return `${used} MB of ~${(quota / 1048576).toFixed(0)} MB used locally`;
}

async function looksLikeLfsPointer(blob: Blob) {
  if (blob.size >= 500) return false;
  try {
    const text = await blob.slice(0, 80).text();
    return text.startsWith(LFS_PREFIX);
  } catch {
    return false;
  }
}

function githubMediaUrl(repo: string, ref: string, relativePath: string) {
  const encoded = `books/${relativePath}`
    .replaceAll("//", "/")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `https://media.githubusercontent.com/media/${repo}/${ref}/${encoded}`;
}

async function fetchBookBlob(opts: {
  path: string;
  name: string;
  lfs?: boolean;
  expectedSize?: number;
  repo: string;
  ref: string;
}): Promise<Blob> {
  const tryUrls: string[] = [];

  // Public GitHub LFS CDN — avoids Vercel timeouts on large books.
  if (opts.lfs !== false) {
    tryUrls.push(githubMediaUrl(opts.repo, opts.ref, opts.path));
  }
  // Same-origin proxy (local disk in dev, or GitHub fallback on server).
  tryUrls.push(`/api/local-books/file?path=${encodeURIComponent(opts.path)}`);

  let lastError: Error | null = null;
  for (const url of tryUrls) {
    try {
      const res = await fetch(url, { redirect: "follow", cache: "no-store" });
      if (!res.ok) {
        lastError = new Error(`${url} → ${res.status}`);
        continue;
      }
      const blob = await res.blob();
      if (blob.size < 500 || (await looksLikeLfsPointer(blob))) {
        lastError = new Error(`${url} returned LFS pointer / tiny payload (${blob.size})`);
        continue;
      }
      if (opts.expectedSize && opts.expectedSize > 1000) {
        // Allow slight mismatch; reject gross truncation.
        if (blob.size < opts.expectedSize * 0.5) {
          lastError = new Error(
            `${url} truncated (${blob.size} < ${opts.expectedSize})`,
          );
          continue;
        }
      }
      return blob;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError || new Error(`Failed to fetch ${opts.name}`);
}

async function runSeed(
  refresh: () => Promise<void>,
  setStatus: (s: string) => void,
  libraryCount: number,
) {
  const params = new URLSearchParams(window.location.search);
  const forceSeed = params.get("seed") === "1";
  if (forceSeed) {
    window.localStorage.removeItem(SEED_FLAG);
    window.localStorage.removeItem(SEED_PROGRESS);
  }

  const seeded = window.localStorage.getItem(SEED_FLAG) === "1";
  const inProgress = window.localStorage.getItem(SEED_PROGRESS);

  // Offline-first: library already on device and seed finished → never re-download.
  if (libraryCount > 0 && seeded && !forceSeed && !inProgress) {
    return;
  }

  // Has books, interrupted progress cleared, not forced → mark done.
  if (libraryCount > 0 && !inProgress && !forceSeed) {
    window.localStorage.setItem(SEED_FLAG, "1");
    return;
  }

  // Empty library: always attempt (ignore stale "seeded" from failed runs).
  // Resume via SEED_PROGRESS when a prior pass was interrupted.

  const listRes = await fetch("/api/local-books", { cache: "no-store" });
  if (!listRes.ok) {
    setStatus("Library catalog unavailable. Check your connection.");
    return;
  }

  const payload = (await listRes.json()) as {
    books: Array<{
      path: string;
      name: string;
      size?: number;
      lfs?: boolean;
    }>;
    github?: { repo?: string; ref?: string };
  };

  const repo = payload.github?.repo || DEFAULT_GITHUB_REPO;
  const ref = payload.github?.ref || DEFAULT_GITHUB_REF;

  // Smallest first so titles appear before multi‑MB downloads finish.
  const entries = [...(payload.books || [])].sort(
    (a, b) => (a.size || 0) - (b.size || 0),
  );

  if (!entries.length) {
    setStatus("No books found in the server catalog.");
    return;
  }

  let imported = 0;
  let failed = 0;
  const startAt = Number(window.localStorage.getItem(SEED_PROGRESS) || "0");

  for (let i = Math.max(0, startAt); i < entries.length; i += 1) {
    const entry = entries[i];
    const mb = entry.size ? ` · ${(entry.size / 1048576).toFixed(1)} MB` : "";
    setStatus(`Loading library ${i + 1}/${entries.length}${mb}…`);
    try {
      const blob = await fetchBookBlob({
        path: entry.path,
        name: entry.name,
        lfs: entry.lfs,
        expectedSize: entry.size,
        repo,
        ref,
      });
      const file = new File([blob], entry.name, {
        type: blob.type || "application/octet-stream",
      });
      await importBookFile(file);
      imported += 1;
      await refresh();
    } catch (error) {
      failed += 1;
      console.error("Failed to import", entry.name, error);
    }
    window.localStorage.setItem(SEED_PROGRESS, String(i + 1));
  }

  window.localStorage.removeItem(SEED_PROGRESS);

  if (imported > 0) {
    window.localStorage.setItem(SEED_FLAG, "1");
    await normalizeLibraryBooks(true);
    await refresh();
    setStatus(
      failed
        ? `Loaded ${imported} books (${failed} skipped)`
        : `Loaded ${imported} books — saved on this device`,
    );
    window.setTimeout(() => setStatus(""), 3200);
  } else {
    // Do NOT set SEED_FLAG — next refresh / visit can retry.
    setStatus(
      "Could not import books. Stay on this page on Wi‑Fi, or add files with + Add books.",
    );
  }
}

async function seedLocalBooks(
  refresh: () => Promise<void>,
  setStatus: (s: string) => void,
  libraryCount: number,
) {
  if (typeof window === "undefined") return;
  if (seedInFlight) return seedInFlight;

  const execute = async () => {
    if (typeof navigator !== "undefined" && "locks" in navigator) {
      await navigator.locks.request("folio-local-book-seed", () =>
        runSeed(refresh, setStatus, libraryCount),
      );
      return;
    }
    await runSeed(refresh, setStatus, libraryCount);
  };

  seedInFlight = execute().finally(() => {
    seedInFlight = null;
  });
  return seedInFlight;
}

export const useLibrary = create<LibraryState>((set, get) => ({
  ready: false,
  books: [],
  settings: DEFAULT_SETTINGS,
  status: "",
  usageLabel: "",
  hydrate: async () => {
    clearLegacySeedLocks();
    const changed = await normalizeLibraryBooks();
    const [books, settings, estimate] = await Promise.all([
      listBooks(),
      getSettings(),
      storageEstimate(),
    ]);
    set({
      ready: true,
      books,
      settings,
      usageLabel: formatUsage(estimate.usage, estimate.quota),
      status: changed ? `Organized ${changed} titles` : "",
    });
    if (changed) {
      window.setTimeout(() => {
        if (get().status.startsWith("Organized")) set({ status: "" });
      }, 2200);
    }
    void seedLocalBooks(
      () => get().refresh(),
      (status) => set({ status }),
      books.length,
    ).catch((error) => {
      console.error(error);
      set({
        status: "Library seed failed. Refresh to retry.",
      });
    });
  },
  refresh: async () => {
    const books = await listBooks();
    const estimate = await storageEstimate();
    set({
      books,
      usageLabel: formatUsage(estimate.usage, estimate.quota),
    });
  },
  addFiles: async (files) => {
    set({ status: "Importing…" });
    try {
      const imported = await importBookFiles(files);
      // Manual adds should not be wiped by a later seed; mark seeded.
      if (imported.length) {
        window.localStorage.setItem(SEED_FLAG, "1");
        window.localStorage.removeItem(SEED_PROGRESS);
      }
      await get().refresh();
      set({
        status:
          imported.length === 1
            ? `Added “${imported[0].title}”`
            : `Added ${imported.length} books`,
      });
    } catch (error) {
      console.error(error);
      set({ status: "Import failed. Try another EPUB." });
    }
    window.setTimeout(() => set({ status: "" }), 2500);
  },
  remove: async (id) => {
    await deleteBook(id);
    await get().refresh();
  },
  updateSettings: async (patch) => {
    const settings = await saveSettings(patch);
    set({ settings });
  },
}));
