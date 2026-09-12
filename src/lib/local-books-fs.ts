import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

const BOOK_EXT = /\.(epub|pdf|mobi|azw3|fb2|cbz)$/i;
const SKIP_DIR_NAMES = new Set(["node_modules", ".git"]);

export type LocalBookEntry = {
  path: string;
  name: string;
  folder: string;
  size: number;
};

export function localBooksRoot() {
  return path.resolve(process.cwd(), "books");
}

export function assertDevLocalBooks() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_BOOKS !== "1") {
    return false;
  }
  return true;
}

export function resolveLocalBookPath(relativePath: string) {
  const root = localBooksRoot();
  const cleaned = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
  const absolute = path.resolve(root, cleaned);
  if (!absolute.startsWith(root + path.sep) && absolute !== root) {
    throw new Error("Invalid book path");
  }
  if (!BOOK_EXT.test(absolute)) {
    throw new Error("Unsupported book format");
  }
  return absolute;
}

export async function listLocalBooks(): Promise<LocalBookEntry[]> {
  const root = localBooksRoot();
  const entries: LocalBookEntry[] = [];

  async function walk(dir: string, folder: string) {
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (name.startsWith(".")) continue;
      if (SKIP_DIR_NAMES.has(name)) continue;
      if (name === "manifest.json" || name === "jobs.jsonl" || name === "missing_urls.json") {
        continue;
      }
      const absolute = path.join(dir, name);
      let info;
      try {
        info = await stat(absolute);
      } catch {
        continue;
      }
      if (info.isDirectory()) {
        // Skip exploded epub directories that aren't real book files
        if (name.toLowerCase().endsWith(".epub")) {
          continue;
        }
        await walk(absolute, folder ? `${folder}/${name}` : name);
        continue;
      }
      if (!BOOK_EXT.test(name)) continue;
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      entries.push({
        path: relative,
        name,
        folder: folder || ".",
        size: info.size,
      });
    }
  }

  await walk(root, "");
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

export async function openLocalBookStream(relativePath: string) {
  const absolute = resolveLocalBookPath(relativePath);
  const info = await stat(absolute);
  const ext = path.extname(absolute).toLowerCase();
  const type =
    ext === ".pdf"
      ? "application/pdf"
      : ext === ".epub"
        ? "application/epub+zip"
        : "application/octet-stream";
  const nodeStream = createReadStream(absolute);
  return {
    stream: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
    size: info.size,
    type,
    name: path.basename(absolute),
  };
}
