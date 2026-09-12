import Dexie, { type EntityTable } from "dexie";
import type {
  AppSettings,
  BookRecord,
  BookmarkRecord,
  CoverRecord,
  FileRecord,
  ProgressRecord,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { normalizeSettings } from "./profiles";

const LEGACY_DB = "paper-reader";
const DB_NAME = "folio-reader";

class FolioDB extends Dexie {
  books!: EntityTable<BookRecord, "id">;
  files!: EntityTable<FileRecord, "id">;
  covers!: EntityTable<CoverRecord, "id">;
  progress!: EntityTable<ProgressRecord, "id">;
  bookmarks!: EntityTable<BookmarkRecord, "id">;
  settings!: EntityTable<AppSettings, "id">;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
      books: "id, title, lastReadAt, addedAt",
      files: "id",
      covers: "id",
      progress: "id",
      bookmarks: "id, bookId",
      settings: "id",
    });
  }
}

export const db = new FolioDB();

let migration: Promise<void> | null = null;

async function databaseExists(name: string) {
  if (typeof indexedDB === "undefined") return false;
  if (typeof indexedDB.databases === "function") {
    const list = await indexedDB.databases();
    return list.some((entry) => entry.name === name);
  }
  return true;
}

/** One-time copy from the legacy `paper-reader` IndexedDB into FOLIO. */
export async function ensureFolioDb() {
  if (!migration) {
    migration = (async () => {
      await db.open();
      const hasLegacy = await databaseExists(LEGACY_DB);
      if (!hasLegacy) return;

      const existing = await db.books.count();
      if (existing > 0) return;

      const legacy = new FolioDB(LEGACY_DB);
      try {
        await legacy.open();
        const [books, files, covers, progress, bookmarks, settings] =
          await Promise.all([
            legacy.books.toArray(),
            legacy.files.toArray(),
            legacy.covers.toArray(),
            legacy.progress.toArray(),
            legacy.bookmarks.toArray(),
            legacy.settings.toArray(),
          ]);
        await db.transaction(
          "rw",
          [db.books, db.files, db.covers, db.progress, db.bookmarks, db.settings],
          async () => {
            if (books.length) await db.books.bulkPut(books);
            if (files.length) await db.files.bulkPut(files);
            if (covers.length) await db.covers.bulkPut(covers);
            if (progress.length) await db.progress.bulkPut(progress);
            if (bookmarks.length) await db.bookmarks.bulkPut(bookmarks);
            if (settings.length) await db.settings.bulkPut(settings);
          },
        );
      } catch (error) {
        console.error("FOLIO library migration failed", error);
      } finally {
        legacy.close();
      }
    })();
  }
  await migration;
}

export async function hashFile(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40);
}

export async function listBooks(): Promise<BookRecord[]> {
  await ensureFolioDb();
  return db.books.toArray();
}

export async function getBook(id: string) {
  await ensureFolioDb();
  return db.books.get(id);
}

export async function getFileBlob(id: string) {
  await ensureFolioDb();
  const row = await db.files.get(id);
  return row?.blob ?? null;
}

export async function getCoverBlob(id: string) {
  await ensureFolioDb();
  const row = await db.covers.get(id);
  return row?.blob ?? null;
}

export async function saveImportedBook(
  book: BookRecord,
  file: Blob,
  cover: Blob | null,
) {
  await ensureFolioDb();
  await db.transaction("rw", db.books, db.files, db.covers, async () => {
    await db.books.put(book);
    await db.files.put({ id: book.id, blob: file });
    if (cover) await db.covers.put({ id: book.id, blob: cover });
  });
}

export async function updateBook(book: BookRecord) {
  await ensureFolioDb();
  await db.books.put(book);
}

export async function deleteBook(id: string) {
  await ensureFolioDb();
  await db.transaction(
    "rw",
    db.books,
    db.files,
    db.covers,
    db.progress,
    db.bookmarks,
    async () => {
      await db.books.delete(id);
      await db.files.delete(id);
      await db.covers.delete(id);
      await db.progress.delete(id);
      await db.bookmarks.where("bookId").equals(id).delete();
    },
  );
}

export async function saveProgress(record: ProgressRecord) {
  await ensureFolioDb();
  await db.progress.put(record);
  const book = await db.books.get(record.id);
  if (book) {
    await db.books.put({
      ...book,
      progress: record.fraction,
      chapterLabel: record.chapterLabel,
      lastReadAt: record.updatedAt,
    });
  }
}

export async function getProgress(id: string) {
  await ensureFolioDb();
  return db.progress.get(id);
}

export async function listBookmarks(bookId: string) {
  await ensureFolioDb();
  return db.bookmarks.where("bookId").equals(bookId).toArray();
}

export async function addBookmark(bookmark: BookmarkRecord) {
  await ensureFolioDb();
  await db.bookmarks.put(bookmark);
}

export async function removeBookmark(id: string) {
  await ensureFolioDb();
  await db.bookmarks.delete(id);
}

export async function getSettings(): Promise<AppSettings> {
  await ensureFolioDb();
  const existing = await db.settings.get("settings");
  if (existing) {
    return normalizeSettings({ ...DEFAULT_SETTINGS, ...existing });
  }
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<AppSettings>) {
  await ensureFolioDb();
  const current = await getSettings();
  const next = normalizeSettings({
    ...current,
    ...patch,
    id: "settings" as const,
  });
  await db.settings.put(next);
  return next;
}

export async function storageEstimate() {
  if (navigator.storage?.estimate) return navigator.storage.estimate();
  return { usage: 0, quota: 0 };
}
