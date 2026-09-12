import { buildStoreZip } from "./epub-zip";
import {
  extractPdfText,
  type PdfPageText,
  type PdfTextExtraction,
} from "./pdf-text";

export interface PdfReflowResult {
  epub: Blob;
  extraction: PdfTextExtraction;
  chapterCount: number;
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtml(s: string) {
  return escapeXml(s);
}

/** Group consecutive pages into chapters (~8 pages or heading breaks). */
function chunkPages(pages: PdfPageText[]): PdfPageText[][] {
  const chapters: PdfPageText[][] = [];
  let buf: PdfPageText[] = [];

  const push = () => {
    if (buf.length) chapters.push(buf);
    buf = [];
  };

  for (const page of pages) {
    const first = page.paragraphs[0] || "";
    const headingBreak =
      buf.length > 0 &&
      (/^(Chapter|CHAPTER|Part|PART)\b/.test(first) ||
        (/^[A-Z0-9][A-Z0-9 \-:'"]{8,60}$/.test(first) && first.length < 70));

    if (headingBreak || buf.length >= 8) push();
    buf.push(page);
  }
  push();
  return chapters.length ? chapters : [pages];
}

function chapterHtml(
  title: string,
  pages: PdfPageText[],
  chapterIndex: number,
): string {
  const body: string[] = [];
  body.push(`<h1>${escapeHtml(title)}</h1>`);

  for (const page of pages) {
    if (!page.paragraphs.length) continue;
    body.push(`<!-- PDF page ${page.pageNumber} -->`);
    for (const para of page.paragraphs) {
      const short = para.length < 70 && !/[.!?]$/.test(para);
      if (short && /^[A-Z0-9]/.test(para)) {
        body.push(`<h2>${escapeHtml(para)}</h2>`);
      } else {
        body.push(`<p>${escapeHtml(para)}</p>`);
      }
    }
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${escapeXml(title)}</title>
  <style>
    body { margin: 1em; line-height: 1.5; }
    h1 { font-size: 1.4em; margin: 0 0 0.8em; }
    h2 { font-size: 1.15em; margin: 1.2em 0 0.5em; }
    p { margin: 0 0 0.75em; text-indent: 1.2em; }
    h1 + p, h2 + p { text-indent: 0; }
  </style>
</head>
<body id="chapter-${chapterIndex}">
${body.join("\n")}
</body>
</html>`;
}

/**
 * Convert a text-layer PDF into a reflowable EPUB that Foliate can open
 * with font / size / justify / hyphenation.
 */
export async function convertPdfToReflowEpub(
  blob: Blob,
  meta: { title: string; authors?: string[]; language?: string },
  opts?: { onProgress?: (done: number, total: number) => void },
): Promise<PdfReflowResult> {
  const extraction = await extractPdfText(blob, {
    onProgress: opts?.onProgress,
  });

  if (!extraction.hasUsableText) {
    throw new Error(
      "This PDF has little or no extractable text (likely a scan). Reflow needs a text layer or OCR.",
    );
  }

  const title =
    meta.title?.trim() ||
    extraction.titleHint ||
    "Untitled PDF";
  const authors = meta.authors?.length ? meta.authors : ["Unknown"];
  const lang = meta.language?.trim() || "en";
  const bookId = `folio-reflow-${Date.now()}`;

  const chapters = chunkPages(extraction.pages.filter((p) => p.charCount > 0));
  const chapterFiles = chapters.map((pages, i) => {
    const name =
      pages[0]?.paragraphs[0]?.slice(0, 48) || `Section ${i + 1}`;
    const safeName = name.replace(/\s+/g, " ").trim() || `Section ${i + 1}`;
    const href = `xhtml/chap_${String(i + 1).padStart(3, "0")}.xhtml`;
    const html = chapterHtml(safeName, pages, i + 1);
    return { href, title: safeName, html };
  });

  if (!chapterFiles.length) {
    throw new Error("No text chapters could be built from this PDF.");
  }

  const manifestItems = chapterFiles
    .map(
      (c, i) =>
        `<item id="chap${i + 1}" href="${c.href}" media-type="application/xhtml+xml"/>`,
    )
    .join("\n    ");

  const spine = chapterFiles
    .map((_, i) => `<itemref idref="chap${i + 1}"/>`)
    .join("\n    ");

  const navLis = chapterFiles
    .map(
      (c, i) =>
        `<li><a href="${c.href}">${escapeXml(c.title)}</a></li>`,
    )
    .join("\n        ");

  const authorMeta = authors
    .map((a) => `<dc:creator>${escapeXml(a)}</dc:creator>`)
    .join("\n    ");

  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0" xml:lang="${escapeXml(lang)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${escapeXml(bookId)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    ${authorMeta}
    <dc:language>${escapeXml(lang)}</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${manifestItems}
  </manifest>
  <spine>
    ${spine}
  </spine>
</package>`;

  const nav = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(lang)}">
<head><meta charset="utf-8"/><title>Contents</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
    <ol>
      ${navLis}
    </ol>
  </nav>
</body>
</html>`;

  const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  const entries = [
    { name: "mimetype", data: "application/epub+zip" },
    { name: "META-INF/container.xml", data: container },
    { name: "OEBPS/content.opf", data: opf },
    { name: "OEBPS/nav.xhtml", data: nav },
    ...chapterFiles.map((c) => ({
      name: `OEBPS/${c.href}`,
      data: c.html,
    })),
  ];

  const epub = buildStoreZip(entries);
  return {
    epub,
    extraction,
    chapterCount: chapterFiles.length,
  };
}
