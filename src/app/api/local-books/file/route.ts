import { assertDevLocalBooks, openLocalBookStream } from "@/lib/local-books-fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!assertDevLocalBooks()) {
    return Response.json({ error: "Local books API disabled" }, { status: 404 });
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
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not found";
    return Response.json({ error: message }, { status: 404 });
  }
}
