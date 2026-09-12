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

/** Bumped so phones stuck on the broken v2 empty-loop re-seed once correctly. */
const SEED_FLAG = "folio-local-books-seeded-v3";
const SEED_PROGRESS = "folio-local-books-seed-progress-v3";
const LFS_PREFIX = "version https://git-lfs.github.com/spec/v1";
let seedInFlight: Promise<void> | null = null;

function migrateLegacyFlags() {
  if (typeof window === "undefined") return;
  // Do not migrate seeded-v2 → v3: v2 was often set after failed empty imports
  // and must not block the one-time fixed reseed.
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

function looksLikeLfsPointer(blob: Blob) {
  // Pointers are ~120–140 bytes; never treat huge files as pointers.
  if (blob.size >= 500) return false;
  return blob
    .slice(0, 80)
    .text()
    .then((text) => text.startsWith(LFS_PREFIX))
    .catch(() => false);
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

  // Finished seed (success or hard-fail): never auto-download again.
  // Clear site data or open with ?seed=1 to reload from GitHub.
  if (seeded && !forceSeed) {
    return;
  }

  // Books already on device and no interrupted seed → stay offline.
  if (libraryCount > 0 && !inProgress && !forceSeed) {
    window.localStorage.setItem(SEED_FLAG, "1");
    return;
  }

  // Otherwise: empty library, or resume after a mid-seed refresh.

  const listRes = await fetch("/api/local-books");
  if (!listRes.ok) {
    setStatus("Library catalog unavailable");
    window.localStorage.setItem(SEED_FLAG, "1");
    return;
  }
  const payload = (await listRes.json()) as {
    books: Array<{ path: string; name: string; size?: number; lfs?: boolean }>;
    error?: string;
  };
  const entries = payload.books || [];
  if (!entries.length) {
    window.localStorage.setItem(SEED_FLAG, "1");
    setStatus("");
    return;
  }

  let imported = 0;
  let failed = 0;
  const startAt = Number(window.localStorage.getItem(SEED_PROGRESS) || "0");

  for (let i = Math.max(0, startAt); i < entries.length; i += 1) {
    const entry = entries[i];
    setStatus(`Loading library ${i + 1}/${entries.length}…`);
    try {
      const fileRes = await fetch(
        `/api/local-books/file?path=${encodeURIComponent(entry.path)}`,
      );
      if (!fileRes.ok) {
        failed += 1;
        window.localStorage.setItem(SEED_PROGRESS, String(i + 1));
        continue;
      }
      const blob = await fileRes.blob();
      if (blob.size < 500 || (await looksLikeLfsPointer(blob))) {
        failed += 1;
        console.error("Skipping LFS pointer / empty payload", entry.name, blob.size);
        window.localStorage.setItem(SEED_PROGRESS, String(i + 1));
        continue;
      }
      const file = new File([blob], entry.name, {
        type: blob.type || "application/octet-stream",
      });
      await importBookFile(file);
      imported += 1;
    } catch (error) {
      failed += 1;
      console.error("Failed to import", entry.name, error);
    }
    window.localStorage.setItem(SEED_PROGRESS, String(i + 1));
    if (imported > 0 && (imported % 2 === 0 || i === entries.length - 1)) {
      await refresh();
    }
  }

  // Always mark finished so refresh does not replay the countdown.
  window.localStorage.setItem(SEED_FLAG, "1");
  window.localStorage.removeItem(SEED_PROGRESS);

  if (imported > 0) {
    await normalizeLibraryBooks(true);
    await refresh();
    setStatus(
      failed
        ? `Loaded ${imported} books (${failed} skipped)`
        : `Loaded ${imported} books`,
    );
    window.setTimeout(() => setStatus(""), 2800);
  } else {
    setStatus(
      "Could not load books from the server. Open with ?seed=1 after fixing FOLIO_GITHUB_TOKEN, or add files manually.",
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
    migrateLegacyFlags();
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
    // Seed IndexedDB from the repo `books/` directory when the library is empty.
    void seedLocalBooks(
      () => get().refresh(),
      (status) => set({ status }),
      books.length,
    ).catch((error) => {
      console.error(error);
      set({ status: "" });
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
