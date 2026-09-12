import { assertBooksAvailable, listLocalBooks } from "@/lib/local-books-fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    process.env.VERCEL_GIT_COMMIT_REF ||
    "main"
  );
}

export async function GET() {
  if (!assertBooksAvailable()) {
    return Response.json({ error: "Books library unavailable" }, { status: 404 });
  }

  const books = await listLocalBooks();
  return Response.json({
    books,
    count: books.length,
    totalBytes: books.reduce((sum, book) => sum + book.size, 0),
    github: {
      repo: githubRepo(),
      ref: githubRef(),
    },
  });
}
