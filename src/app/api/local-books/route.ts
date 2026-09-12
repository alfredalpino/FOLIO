import { assertDevLocalBooks, listLocalBooks } from "@/lib/local-books-fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!assertDevLocalBooks()) {
    return Response.json({ error: "Local books API disabled" }, { status: 404 });
  }

  const books = await listLocalBooks();
  return Response.json({
    books,
    count: books.length,
    totalBytes: books.reduce((sum, book) => sum + book.size, 0),
  });
}
