import { listBooks, updateBook } from "./db";
import {
  canonicalAuthor,
  inferShelf,
  isGarbageTitle,
  parseFileNameMeta,
  resolveDisplayTitle,
} from "./book-meta";
import type { BookRecord } from "./types";

const FLAG = "folio-meta-normalized-v1";

function needsNormalize(book: BookRecord) {
  if (!book.shelf) return true;
  if (isGarbageTitle(book.title)) return true;
  if (!book.authors.length) return true;
  if (/\(z-library|adabizouq|1lib\.sk|z-lib\.sk/i.test(book.title)) return true;
  if (/enenmy/i.test(book.title)) return true;
  if (book.authors.some((a) => canonicalAuthor(a) !== a)) return true;
  return false;
}

export function normalizeBookRecord(book: BookRecord): BookRecord {
  const resolved = resolveDisplayTitle(book.title, book.fileName);
  const parsed = parseFileNameMeta(book.fileName);
  const title = resolved.usedFileName
    ? resolved.title
    : applyTyposSafe(book.title);
  let authors =
    resolved.usedFileName && parsed.authors.length
      ? parsed.authors
      : book.authors.length && !book.authors.every((a) => isGarbageTitle(a))
        ? book.authors
        : parsed.authors.length
          ? parsed.authors
          : book.authors;
  authors = authors.map(canonicalAuthor);
  const shelf = inferShelf(book.fileName, title, authors);
  return { ...book, title, authors, shelf };
}

function applyTyposSafe(title: string) {
  return title.replace(/\bEnenmy\b/gi, "Enemy");
}

export async function normalizeLibraryBooks(force = false): Promise<number> {
  if (typeof window === "undefined") return 0;
  if (!force && window.localStorage.getItem(FLAG) === "1") {
    const books = await listBooks();
    let changed = 0;
    for (const book of books) {
      if (!needsNormalize(book)) continue;
      await updateBook(normalizeBookRecord(book));
      changed += 1;
    }
    return changed;
  }

  const books = await listBooks();
  let changed = 0;
  for (const book of books) {
    const next = normalizeBookRecord(book);
    if (
      next.title !== book.title ||
      next.shelf !== book.shelf ||
      next.authors.join("|") !== book.authors.join("|")
    ) {
      await updateBook(next);
      changed += 1;
    }
  }
  window.localStorage.setItem(FLAG, "1");
  return changed;
}
