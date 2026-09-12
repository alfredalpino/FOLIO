import { assertBooksAvailable, listLocalBooks } from "@/lib/local-books-fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  if (!assertBooksAvailable()) {
    return Response.json({ error: "Books library unavailable" }, { status: 404 });
  }

  const books = await listLocalBooks();
  return Response.json({
    books,
    count: books.length,
    totalBytes: books.reduce((sum, book) => sum + book.size, 0),
  });
}
