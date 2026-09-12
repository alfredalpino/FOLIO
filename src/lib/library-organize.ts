import type { BookRecord } from "./types";
import { canonicalAuthor, primaryAuthor } from "./book-meta";

export type LibraryView = "authors" | "genres" | "gallery";

export interface AuthorClub {
  author: string;
  key: string;
  books: BookRecord[];
}

export interface GenreClub {
  genre: string;
  authors: AuthorClub[];
  bookCount: number;
}

function sortBooks(books: BookRecord[]) {
  return [...books].sort((a, b) => a.title.localeCompare(b.title));
}

/** Sort authors A–Z by surname; multi-book clubs float slightly for presence */
function authorSortKey(name: string) {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] || name;
  return `${last.toLowerCase()} ${name.toLowerCase()}`;
}

export function clubByAuthor(books: BookRecord[]): AuthorClub[] {
  const map = new Map<string, AuthorClub>();
  for (const book of books) {
    const author = primaryAuthor(book.authors);
    const key = author.toLowerCase();
    const existing = map.get(key);
    if (existing) existing.books.push(book);
    else map.set(key, { author, key, books: [book] });
  }
  const clubs = [...map.values()].map((c) => ({
    ...c,
    books: sortBooks(c.books),
  }));
  clubs.sort((a, b) => authorSortKey(a.author).localeCompare(authorSortKey(b.author)));
  return clubs;
}

export function clubByGenre(books: BookRecord[]): GenreClub[] {
  const byGenre = new Map<string, BookRecord[]>();
  for (const book of books) {
    const genre = book.shelf || "General";
    const list = byGenre.get(genre) || [];
    list.push(book);
    byGenre.set(genre, list);
  }
  return [...byGenre.entries()]
    .map(([genre, list]) => ({
      genre,
      authors: clubByAuthor(list),
      bookCount: list.length,
    }))
    .sort((a, b) => a.genre.localeCompare(b.genre));
}

export function normalizeAuthorsOnBook(book: BookRecord): BookRecord {
  if (!book.authors.length) return book;
  const authors = book.authors.map(canonicalAuthor);
  if (authors.join("|") === book.authors.join("|")) return book;
  return { ...book, authors };
}
