"use client";

import { create } from "zustand";
import {
  deleteBook,
  getSettings,
  listBooks,
  saveSettings,
  storageEstimate,
} from "@/lib/db";
import { importBookFiles } from "@/lib/import-book";
import type { AppSettings, BookRecord } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";

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

export const useLibrary = create<LibraryState>((set, get) => ({
  ready: false,
  books: [],
  settings: DEFAULT_SETTINGS,
  status: "",
  usageLabel: "",
  hydrate: async () => {
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
