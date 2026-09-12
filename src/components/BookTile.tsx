"use client";

import Link from "next/link";
import { CoverThumb } from "@/components/CoverThumb";
import { formatBytes } from "@/lib/book-meta";
import type { BookRecord } from "@/lib/types";

function pct(n: number) {
  return `${Math.round((n || 0) * 100)}%`;
}

export function BookTile({
  book,
  onRemove,
  compact = false,
}: {
  book: BookRecord;
  onRemove?: () => void;
  compact?: boolean;
}) {
  return (
    <li className={compact ? "book-tile compact" : "book-tile"}>
      <Link className="book-tile-link" href={`/read/${book.id}`}>
        <div className="book-cover-wrap">
          <CoverThumb
            id={book.id}
            title={book.title}
            authors={book.authors}
            format={book.format}
            hasCover={book.hasCover}
          />
          {book.progress > 0.001 ? (
            <span className="book-progress">{pct(book.progress)}</span>
          ) : null}
        </div>
        <span className="book-tile-title">{book.title}</span>
        {!compact ? (
          <>
            <span className="book-tile-meta">
              {book.authors[0] || book.format.toUpperCase()}
              {book.shelf ? ` · ${book.shelf}` : ""}
            </span>
            <span className="book-tile-sub muted tiny">
              {book.format.toUpperCase()} · {formatBytes(book.size)}
            </span>
          </>
        ) : null}
      </Link>
      {onRemove ? (
        <button
          type="button"
          className="ghost-btn tile-remove"
          aria-label={`Remove ${book.title}`}
          onClick={onRemove}
        >
          Remove
        </button>
      ) : null}
    </li>
  );
}
