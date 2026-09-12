"use client";

import Link from "next/link";
import { CoverThumb } from "@/components/CoverThumb";
import type { BookRecord } from "@/lib/types";

function pct(n: number) {
  return `${Math.round((n || 0) * 100)}%`;
}

export function BookTile({
  book,
  onRemove,
  variant = "cover",
}: {
  book: BookRecord;
  onRemove?: () => void;
  /** cover = library grid; rail = home carousel */
  variant?: "cover" | "rail";
}) {
  const finished = book.progress >= 0.98;
  const started = book.progress > 0.001 && !finished;

  return (
    <li className={`k-book k-book-${variant}`}>
      <Link className="k-book-link" href={`/read/${book.id}`}>
        <div className="k-book-cover">
          <CoverThumb
            id={book.id}
            title={book.title}
            authors={book.authors}
            format={book.format}
            hasCover={book.hasCover}
          />
          {finished ? <span className="k-ribbon">Read</span> : null}
          {started ? (
            <span className="k-progress-pill">{pct(book.progress)}</span>
          ) : null}
        </div>
        {variant === "rail" ? (
          <span className="k-book-caption">{book.title}</span>
        ) : null}
      </Link>
      {onRemove ? (
        <button
          type="button"
          className="k-book-remove"
          aria-label={`Remove ${book.title}`}
          onClick={onRemove}
        >
          ×
        </button>
      ) : null}
    </li>
  );
}
