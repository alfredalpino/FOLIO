import { createReadStream, existsSync, openSync, readSync, closeSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

const BOOK_EXT = /\.(epub|pdf|mobi|azw3|fb2|cbz)$/i;
const SKIP_DIR_NAMES = new Set(["node_modules", ".git"]);
const LFS_PREFIX = "version https://git-lfs.github.com/spec/v1";

export type LocalBookEntry = {
  path: string;
  name: string;
  folder: string;
  size: number;
  /** True when the on-disk file is a Git LFS pointer (needs remote resolve). */
  lfs: boolean;
};

export function localBooksRoot() {
  return path.resolve(process.cwd(), "books");
}

/** Serve the repo `books/` library in any environment where the folder exists. */
export function assertBooksAvailable() {
  return existsSync(localBooksRoot());
}

/** @deprecated use assertBooksAvailable */
export function assertDevLocalBooks() {
  return assertBooksAvailable();
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

function readLfsPointer(
  absolute: string,
): { oid: string; size: number } | null {
  try {
    const fd = openSync(absolute, "r");
    try {
      const buf = Buffer.alloc(256);
      const bytesRead = readSync(fd, buf, 0, 256, 0);
      const text = buf.subarray(0, bytesRead).toString("utf8");
      if (!text.startsWith(LFS_PREFIX)) return null;
      const oid = /oid sha256:([a-f0-9]+)/i.exec(text)?.[1];
      const sizeRaw = /size (\d+)/.exec(text)?.[1];
      if (!oid || !sizeRaw) return null;
      return { oid, size: Number(sizeRaw) };
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
}

function githubRepo() {
  if (process.env.FOLIO_GITHUB_REPO) return process.env.FOLIO_GITHUB_REPO;
  const owner = process.env.VERCEL_GIT_REPO_OWNER;
  const slug = process.env.VERCEL_GIT_REPO_SLUG;
  if (owner && slug) return `${owner}/${slug}`;
  return "alfredalpino/FOLIO";
}

function githubRef() {
  return (
    process.env.FOLIO_GITHUB_REF ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    "main"
  );
}

function githubToken() {
  return (
    process.env.FOLIO_GITHUB_TOKEN ||
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    ""
  );
}

async function openGitHubLfsStream(
  relativePath: string,
  expectedSize: number,
) {
  const token = githubToken();
  if (!token) {
    throw new Error(
      "Book binary unavailable (Git LFS pointer). Set FOLIO_GITHUB_TOKEN on the server.",
    );
  }

  const repo = githubRepo();
  const ref = githubRef();
  // Contents API path is books/... relative to repo root
  const apiPath = `books/${relativePath}`.replaceAll("//", "/");
  const metaUrl = `https://api.github.com/repos/${repo}/contents/${apiPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}?ref=${encodeURIComponent(ref)}`;

  const metaRes = await fetch(metaUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "folio-reader",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (!metaRes.ok) {
    throw new Error(
      `GitHub contents ${metaRes.status} for ${apiPath} (ref ${ref})`,
    );
  }

  const meta = (await metaRes.json()) as {
    download_url?: string | null;
    size?: number;
    type?: string;
  };

  if (!meta.download_url) {
    throw new Error(`No download_url for ${apiPath}`);
  }

  const fileRes = await fetch(meta.download_url, {
    headers: { "User-Agent": "folio-reader" },
    redirect: "follow",
    cache: "no-store",
  });

  if (!fileRes.ok || !fileRes.body) {
    throw new Error(`GitHub media ${fileRes.status} for ${apiPath}`);
  }

  const size =
    Number(fileRes.headers.get("content-length")) ||
    meta.size ||
    expectedSize;

  // Reject accidental pointer payloads
  if (size > 0 && size < 500) {
    throw new Error(`Resolved book looks like an LFS pointer (${size} bytes)`);
  }

  const ext = path.extname(relativePath).toLowerCase();
  const type =
    ext === ".pdf"
      ? "application/pdf"
      : ext === ".epub"
        ? "application/epub+zip"
        : "application/octet-stream";

  return {
    stream: fileRes.body as ReadableStream<Uint8Array>,
    size,
    type,
    name: path.basename(relativePath),
    source: "github-lfs" as const,
  };
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
      if (
        name === "manifest.json" ||
        name === "jobs.jsonl" ||
        name === "missing_urls.json"
      ) {
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
      const pointer = readLfsPointer(absolute);
      entries.push({
        path: relative,
        name,
        folder: folder || ".",
        size: pointer?.size ?? info.size,
        lfs: Boolean(pointer),
      });
    }
  }

  await walk(root, "");
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

export async function openLocalBookStream(relativePath: string) {
  const absolute = resolveLocalBookPath(relativePath);
  const info = await stat(absolute);
  const pointer = readLfsPointer(absolute);

  if (pointer) {
    return openGitHubLfsStream(relativePath, pointer.size);
  }

  // Tiny non-PDF/EPUB magic: still might be a truncated pointer we failed to parse
  if (info.size > 0 && info.size < 500) {
    const probe = readLfsPointer(absolute);
    if (probe) {
      return openGitHubLfsStream(relativePath, probe.size);
    }
  }

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
    source: "disk" as const,
  };
}

/** Client + server: detect Git LFS pointer payload. */
export function blobLooksLikeLfsPointer(bytes: ArrayBuffer | Uint8Array) {
  const view =
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.slice(0, 120));
  const head = new TextDecoder().decode(view.subarray(0, 80));
  return head.startsWith(LFS_PREFIX);
}
