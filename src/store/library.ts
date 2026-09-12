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

const SEED_FLAG = "paper-local-books-seeded-v2";
const SEED_PROGRESS = "paper-local-books-seed-progress-v2";
let seedInFlight: Promise<void> | null = null;

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

async function runSeed(refresh: () => Promise<void>, setStatus: (s: string) => void) {
  const params = new URLSearchParams(window.location.search);
  if (params.get("seed") === "1") {
    window.localStorage.removeItem(SEED_FLAG);
    window.localStorage.removeItem(SEED_PROGRESS);
  }

  if (window.localStorage.getItem(SEED_FLAG) === "1") return;

  const listRes = await fetch("/api/local-books");
  if (!listRes.ok) return;
  const payload = (await listRes.json()) as {
    books: Array<{ path: string; name: string }>;
  };
  const entries = payload.books || [];
  if (!entries.length) {
    window.localStorage.setItem(SEED_FLAG, "1");
    return;
  }

  const startAt = Number(window.localStorage.getItem(SEED_PROGRESS) || "0");
  for (let i = Math.max(0, startAt); i < entries.length; i += 1) {
    const entry = entries[i];
    setStatus(`Loading library ${i + 1}/${entries.length}…`);
    const fileRes = await fetch(
      `/api/local-books/file?path=${encodeURIComponent(entry.path)}`,
    );
    if (!fileRes.ok) {
      window.localStorage.setItem(SEED_PROGRESS, String(i + 1));
      continue;
    }
    const blob = await fileRes.blob();
    const file = new File([blob], entry.name, {
      type: blob.type || "application/octet-stream",
    });
    try {
      await importBookFile(file);
    } catch (error) {
      console.error("Failed to import", entry.name, error);
    }
    window.localStorage.setItem(SEED_PROGRESS, String(i + 1));
    if (i % 2 === 1 || i === entries.length - 1) {
      await refresh();
    }
  }

  window.localStorage.setItem(SEED_FLAG, "1");
  window.localStorage.removeItem(SEED_PROGRESS);
  await normalizeLibraryBooks(true);
  await refresh();
  setStatus("");
}

async function seedLocalBooks(refresh: () => Promise<void>, setStatus: (s: string) => void) {
  if (typeof window === "undefined") return;
  if (seedInFlight) return seedInFlight;

  const execute = async () => {
    if (typeof navigator !== "undefined" && "locks" in navigator) {
      await navigator.locks.request("paper-local-book-seed", () =>
        runSeed(refresh, setStatus),
      );
      return;
    }
    await runSeed(refresh, setStatus);
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
    // Agent-seeded local books land in IndexedDB without any Drive UI.
    void seedLocalBooks(
      () => get().refresh(),
      (status) => set({ status }),
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
