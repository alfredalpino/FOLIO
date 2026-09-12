"use client";

import { useEffect, useState } from "react";
import { getCoverBlob } from "@/lib/db";
import { spineHue } from "@/lib/book-meta";

export function CoverThumb({
  id,
  title,
  authors,
  format,
  hasCover,
}: {
  id: string;
  title: string;
  authors: string[];
  format: string;
  hasCover: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    if (!hasCover) {
      setUrl(null);
      return;
    }
    void getCoverBlob(id).then((blob) => {
      if (!alive || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, hasCover]);

  const hue = spineHue(id + title);
  const author = authors[0] || format.toUpperCase();

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="cover-img" src={url} alt="" draggable={false} />
    );
  }

  return (
    <div
      className="cover-spine"
      style={{
        background: `linear-gradient(165deg, hsl(${hue} 22% 28%) 0%, hsl(${hue} 18% 16%) 100%)`,
      }}
      aria-hidden
    >
      <span className="cover-spine-title">{title}</span>
      <span className="cover-spine-author">{author}</span>
      <span className="cover-spine-format">{format}</span>
    </div>
  );
}
