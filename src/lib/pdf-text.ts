/**
 * Extract a text layer from digital PDFs via pdf.js.
 * Scanned page-image PDFs return little/no text — callers should check
 * `hasUsableText` before attempting reflow.
 */

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfPageText {
  pageNumber: number;
  width: number;
  height: number;
  lines: string[];
  paragraphs: string[];
  charCount: number;
}

export interface PdfTextExtraction {
  pageCount: number;
  pages: PdfPageText[];
  totalChars: number;
  /** Rough heuristic: enough chars per page to treat as text PDF */
  hasUsableText: boolean;
  titleHint: string;
}

type PdfJsLib = {
  getDocument: (src: {
    data: ArrayBuffer;
    cMapUrl?: string;
    cMapPacked?: boolean;
    standardFontDataUrl?: string;
  }) => { promise: Promise<PdfDocumentProxy> };
  GlobalWorkerOptions: { workerSrc: string };
};

type PdfDocumentProxy = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPageProxy>;
  getMetadata?: () => Promise<{ info?: Record<string, unknown> }>;
  destroy: () => Promise<void>;
};

type PdfPageProxy = {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<{
    items: Array<{
      str?: string;
      transform?: number[];
      width?: number;
      height?: number;
      hasEOL?: boolean;
    }>;
  }>;
};

let pdfjsPromise: Promise<PdfJsLib> | null = null;

export async function loadPdfJs(): Promise<PdfJsLib> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const mod = (await import(
        /* webpackIgnore: true */
        "/vendor/foliate-js/vendor/pdfjs/pdf.mjs" as string
      )) as Partial<PdfJsLib> & { default?: Partial<PdfJsLib> };
      const fromGlobal = (globalThis as unknown as { pdfjsLib?: PdfJsLib })
        .pdfjsLib;
      const candidate = mod.getDocument
        ? (mod as PdfJsLib)
        : mod.default?.getDocument
          ? (mod.default as PdfJsLib)
          : fromGlobal;
      if (!candidate?.getDocument || !candidate.GlobalWorkerOptions) {
        throw new Error("pdf.js failed to load");
      }
      candidate.GlobalWorkerOptions.workerSrc =
        "/vendor/foliate-js/vendor/pdfjs/pdf.worker.mjs";
      return candidate;
    })();
  }
  return pdfjsPromise;
}

function itemsToLines(
  items: PdfTextItem[],
  pageHeight: number,
): string[] {
  if (!items.length) return [];

  const sorted = [...items].sort((a, b) => {
    // PDF y grows upward; visual top is higher y
    const dy = b.y - a.y;
    if (Math.abs(dy) > 2) return dy;
    return a.x - b.x;
  });

  const avgH =
    sorted.reduce((s, it) => s + (it.height || 10), 0) / sorted.length || 12;
  const lineTol = Math.max(avgH * 0.45, 3);

  type Line = { y: number; parts: PdfTextItem[] };
  const lines: Line[] = [];

  for (const it of sorted) {
    if (!it.str) continue;
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= lineTol) {
      last.parts.push(it);
      last.y = (last.y * (last.parts.length - 1) + it.y) / last.parts.length;
    } else {
      lines.push({ y: it.y, parts: [it] });
    }
  }

  return lines.map((line) => {
    const parts = [...line.parts].sort((a, b) => a.x - b.x);
    let out = "";
    let prev: PdfTextItem | null = null;
    for (const p of parts) {
      if (!p.str) continue;
      if (prev) {
        const gap = p.x - (prev.x + prev.width);
        const spaceW = Math.max(prev.height, p.height) * 0.28;
        if (gap > spaceW && !out.endsWith(" ") && !p.str.startsWith(" ")) {
          out += " ";
        }
      }
      out += p.str;
      prev = p;
    }
    return out.replace(/\s+/g, " ").trim();
  }).filter(Boolean);
}

function linesToParagraphs(lines: string[], pageHeight: number): string[] {
  if (!lines.length) return [];

  const paras: string[] = [];
  let buf = "";

  const flush = () => {
    const t = buf.replace(/\s+/g, " ").trim();
    if (t) paras.push(t);
    buf = "";
  };

  for (const line of lines) {
    const endsSentence = /[.!?]["')\]]?\s*$/.test(line);
    const looksHeading =
      line.length < 80 &&
      !/[.!?]$/.test(line) &&
      (line === line.toUpperCase() || /^(\d+\.|Chapter|CHAPTER|Part|PART)\b/.test(line));

    if (looksHeading) {
      flush();
      paras.push(line);
      continue;
    }

    if (!buf) {
      buf = line;
    } else if (/-\s*$/.test(buf)) {
      // hyphenated line break
      buf = buf.replace(/-\s*$/, "") + line.replace(/^\s+/, "");
    } else {
      buf += " " + line;
    }

    // Soft paragraph break when short lines end a sentence (common in books)
    if (endsSentence && line.length < 55 && pageHeight > 0) {
      flush();
    }
  }
  flush();
  return paras;
}

function pageItemsFromContent(
  items: Array<{
    str?: string;
    transform?: number[];
    width?: number;
    height?: number;
  }>,
): PdfTextItem[] {
  const out: PdfTextItem[] = [];
  for (const it of items) {
    if (!it.str || !it.transform) continue;
    const [, , , , e, f] = it.transform;
    out.push({
      str: it.str,
      x: e,
      y: f,
      width: it.width || 0,
      height: it.height || 10,
    });
  }
  return out;
}

export async function extractPdfText(
  blob: Blob,
  opts?: { maxPages?: number; onProgress?: (done: number, total: number) => void },
): Promise<PdfTextExtraction> {
  const pdfjs = await loadPdfJs();
  const data = await blob.arrayBuffer();
  const doc = await pdfjs.getDocument({
    data,
    cMapUrl: "/vendor/foliate-js/vendor/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/vendor/foliate-js/vendor/pdfjs/standard_fonts/",
  }).promise;

  try {
    const pageCount = doc.numPages;
    const limit = Math.min(pageCount, opts?.maxPages ?? pageCount);
    const pages: PdfPageText[] = [];
    let totalChars = 0;
    let titleHint = "";

    try {
      const meta = await doc.getMetadata?.();
      const infoTitle = meta?.info?.Title;
      if (typeof infoTitle === "string" && infoTitle.trim()) {
        titleHint = infoTitle.trim();
      }
    } catch {
      /* ignore */
    }

    for (let i = 1; i <= limit; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = pageItemsFromContent(content.items);
      const lines = itemsToLines(items, viewport.height);
      const paragraphs = linesToParagraphs(lines, viewport.height);
      const charCount = paragraphs.reduce((s, p) => s + p.length, 0);
      totalChars += charCount;
      pages.push({
        pageNumber: i,
        width: viewport.width,
        height: viewport.height,
        lines,
        paragraphs,
        charCount,
      });
      opts?.onProgress?.(i, limit);
    }

    const avg = pageCount > 0 ? totalChars / limit : 0;
    // ~120+ chars/page on average ⇒ likely a real text layer
    const hasUsableText = avg >= 120 && totalChars >= 400;

    return {
      pageCount,
      pages,
      totalChars,
      hasUsableText,
      titleHint,
    };
  } finally {
    await doc.destroy();
  }
}
