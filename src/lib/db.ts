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

class PaperDB extends Dexie {
  books!: EntityTable<BookRecord, "id">;
  files!: EntityTable<FileRecord, "id">;
  covers!: EntityTable<CoverRecord, "id">;
  progress!: EntityTable<ProgressRecord, "id">;
  bookmarks!: EntityTable<BookmarkRecord, "id">;
  settings!: EntityTable<AppSettings, "id">;

  constructor() {
    super("paper-reader");
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

export const db = new PaperDB();

export async function hashFile(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40);
}

export async function listBooks(): Promise<BookRecord[]> {
  return db.books.toArray();
}

export async function getBook(id: string) {
  return db.books.get(id);
}

export async function getFileBlob(id: string) {
  const row = await db.files.get(id);
  return row?.blob ?? null;
}

export async function getCoverBlob(id: string) {
  const row = await db.covers.get(id);
  return row?.blob ?? null;
}

export async function saveImportedBook(
  book: BookRecord,
  file: Blob,
  cover: Blob | null,
) {
  await db.transaction("rw", db.books, db.files, db.covers, async () => {
    await db.books.put(book);
    await db.files.put({ id: book.id, blob: file });
    if (cover) await db.covers.put({ id: book.id, blob: cover });
  });
}

export async function updateBook(book: BookRecord) {
  await db.books.put(book);
}

export async function deleteBook(id: string) {
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
  return db.progress.get(id);
}

export async function listBookmarks(bookId: string) {
  return db.bookmarks.where("bookId").equals(bookId).toArray();
}

export async function addBookmark(bookmark: BookmarkRecord) {
  await db.bookmarks.put(bookmark);
}

export async function removeBookmark(id: string) {
  await db.bookmarks.delete(id);
}

export async function getSettings(): Promise<AppSettings> {
  const existing = await db.settings.get("settings");
  if (existing) return { ...DEFAULT_SETTINGS, ...existing };
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<AppSettings>) {
  const current = await getSettings();
  const next = { ...current, ...patch, id: "settings" as const };
  await db.settings.put(next);
  return next;
}

export async function storageEstimate() {
  if (navigator.storage?.estimate) return navigator.storage.estimate();
  return { usage: 0, quota: 0 };
}
