import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "FOLIO",
    short_name: "FOLIO",
    description:
      "Ubaid’s private, local-first Kindle. Books stay on your device.",
    start_url: "/?utm_source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#000000",
    theme_color: "#000000",
    lang: "en",
    dir: "ltr",
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
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/icons/screenshot-wide.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
        label: "FOLIO library",
      },
      {
        src: "/icons/screenshot-narrow.png",
        sizes: "720x1280",
        type: "image/png",
        form_factor: "narrow",
        label: "FOLIO on phone",
      },
    ],
    prefer_related_applications: false,
  } as MetadataRoute.Manifest;
}
