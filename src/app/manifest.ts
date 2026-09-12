import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PAPER",
    short_name: "PAPER",
    description:
      "A private, local-first, e-ink-inspired reading machine that runs on your phone.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f6f3eb",
    theme_color: "#f6f3eb",
    categories: ["books", "education", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    file_handlers: [
      {
        action: "/",
        accept: {
          "application/epub+zip": [".epub"],
          "application/pdf": [".pdf"],
        },
      },
    ],
  } as MetadataRoute.Manifest;
}
