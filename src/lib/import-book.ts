import { hashFile, saveImportedBook, getBook } from "./db";
import { fmtContributors, fmtLangMap } from "./profiles";
import { inferShelf, resolveDisplayTitle } from "./book-meta";
import type { BookRecord } from "./types";

type FoliateBook = {
  metadata?: Record<string, unknown>;
  getCover?: () => Promise<Blob | null | undefined>;
};

async function loadMakeBook(): Promise<
  (file: File | Blob) => Promise<FoliateBook>
> {
  const mod = (await import(
    /* webpackIgnore: true */
    "/vendor/foliate-js/view.js" as string
  )) as { makeBook: (file: File | Blob) => Promise<FoliateBook> };
  return mod.makeBook;
}

function detectFormat(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (name.endsWith(".mobi")) return "mobi";
  if (name.endsWith(".azw3") || name.endsWith(".kf8")) return "azw3";
  if (name.endsWith(".fb2")) return "fb2";
  if (name.endsWith(".cbz")) return "cbz";
  return "epub";
}

function recordFromFileName(file: File, id: string): BookRecord {
  const resolved = resolveDisplayTitle("", file.name);
  return {
    id,
    title: resolved.title,
    authors: resolved.authors,
    language: "",
    publisher: "",
    published: "",
    description: "",
    fileName: file.name,
    format: detectFormat(file),
    size: file.size,
    addedAt: new Date().toISOString(),
    lastReadAt: "",
    progress: 0,
    chapterLabel: "",
    hasCover: false,
    shelf: inferShelf(file.name, resolved.title, resolved.authors),
  };
}

export async function importBookFile(file: File): Promise<BookRecord> {
  if (file.size < 500) {
    throw new Error(`File too small to be a book (${file.size} bytes)`);
  }

  const id = await hashFile(file);
  const existing = await getBook(id);
  if (existing) return existing;

  let coverBlob: Blob | null = null;
  let record: BookRecord;

  try {
    const makeBook = await loadMakeBook();
    const book = await makeBook(file);
    const m = book.metadata || {};

    try {
      coverBlob = (await book.getCover?.()) || null;
    } catch {
      coverBlob = null;
    }

    const metaTitle = fmtLangMap(m.title);
    const subtitle = m.subtitle ? String(m.subtitle) : "";
    const resolved = resolveDisplayTitle(metaTitle, file.name);
    const metaAuthors = fmtContributors(m.author);
    const authors =
      metaAuthors.length > 0 && !resolved.usedFileName
        ? metaAuthors
        : resolved.authors.length
          ? resolved.authors
          : metaAuthors;

    let title = resolved.title;
    if (subtitle && !resolved.usedFileName && !title.includes(subtitle)) {
      title = `${title}: ${subtitle}`;
    }

    record = {
      id,
      title,
      authors,
      language: Array.isArray(m.language)
        ? String(m.language[0] || "")
        : fmtLangMap(m.language),
      publisher: fmtContributors(m.publisher)[0] || "",
      published: m.published ? String(m.published) : "",
      description: fmtLangMap(m.description),
      fileName: file.name,
      format: detectFormat(file),
      size: file.size,
      addedAt: new Date().toISOString(),
      lastReadAt: "",
      progress: 0,
      chapterLabel: "",
      hasCover: Boolean(coverBlob),
      shelf: inferShelf(file.name, title, authors),
    };
  } catch (error) {
    // Still persist the binary so the library works offline even if Foliate
    // cannot parse metadata on this device (common for some PDFs on mobile).
    console.warn("Foliate parse failed; saving with filename metadata", file.name, error);
    record = recordFromFileName(file, id);
  }

  await saveImportedBook(record, file, coverBlob);
  return record;
}

export async function importBookFiles(files: FileList | File[]) {
  const list = [...files].filter(
    (f) =>
      /\.(epub|pdf|mobi|azw3|fb2|cbz)$/i.test(f.name) ||
      f.type === "application/epub+zip" ||
      f.type === "application/pdf",
  );
  const imported: BookRecord[] = [];
  for (const file of list) {
    imported.push(await importBookFile(file));
  }
  return imported;
}
