import { assertBooksAvailable, openLocalBookStream } from "@/lib/local-books-fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Large PDFs from GitHub LFS need a long-lived Node function. */
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!assertBooksAvailable()) {
    return Response.json({ error: "Books library unavailable" }, { status: 404 });
  }

  const url = new URL(request.url);
  const relativePath = url.searchParams.get("path");
  if (!relativePath) {
    return Response.json({ error: "Missing path" }, { status: 400 });
  }

  try {
    const file = await openLocalBookStream(relativePath);
    return new Response(file.stream, {
      headers: {
        "Content-Type": file.type,
        "Content-Length": String(file.size),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "Cache-Control": "private, max-age=3600",
        "X-Folio-Book-Source": file.source,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not found";
    const status = /FOLIO_GITHUB_TOKEN|LFS pointer|GitHub/i.test(message)
      ? 503
      : 404;
    return Response.json({ error: message }, { status });
  }
}
