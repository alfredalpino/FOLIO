import type { AppSettings, ReadingProfile, RefreshProfile } from "./types";

export interface ProfileColors {
  bg: string;
  fg: string;
  muted: string;
  link: string;
  font: string;
}

export const PROFILE_COLORS: Record<ReadingProfile, ProfileColors> = {
  paper: {
    bg: "#f6f3eb",
    fg: "#1c1917",
    muted: "#78716c",
    link: "#44403c",
    font: '"Literata", "Iowan Old Style", "Palatino Linotype", Palatino, serif',
  },
  newspaper: {
    bg: "#f0eee6",
    fg: "#111111",
    muted: "#525252",
    link: "#262626",
    font: '"Source Serif 4", "Times New Roman", Times, serif',
  },
  night: {
    bg: "#1c1917",
    fg: "#e7e5e4",
    muted: "#a8a29e",
    link: "#d6d3d1",
    font: '"Literata", "Iowan Old Style", Palatino, serif',
  },
  terminal: {
    bg: "#0c0c0c",
    fg: "#c8c8c8",
    muted: "#888888",
    link: "#aaaaaa",
    font: '"IBM Plex Mono", "SF Mono", Menlo, monospace',
  },
};

export function contentCSS(settings: AppSettings): string {
  const c = PROFILE_COLORS[settings.profile];
  const denser = settings.profile === "newspaper" || settings.profile === "terminal";
  return `
    @namespace epub "http://www.idpf.org/2007/ops";
    html {
      color-scheme: ${settings.profile === "night" || settings.profile === "terminal" ? "dark" : "light"};
      font-size: ${settings.fontSize}%;
    }
    html, body {
      color: ${c.fg} !important;
      background: ${c.bg} !important;
      font-family: ${c.font} !important;
    }
    body, p, div, span, li, h1, h2, h3, h4, h5, h6, blockquote {
      font-family: ${c.font} !important;
    }
    a, a:link { color: ${c.link} !important; }
    p, li, blockquote, dd {
      line-height: ${settings.lineHeight};
      text-align: ${settings.justify ? "justify" : "start"};
      hyphens: auto;
      -webkit-hyphens: auto;
      margin-block: ${denser ? "0.55em" : "0.85em"};
    }
    h1, h2, h3 { line-height: 1.25; letter-spacing: -0.01em; }
    pre { white-space: pre-wrap !important; font-family: "IBM Plex Mono", Menlo, monospace !important; }
    img { max-width: 100%; }
  `;
}

export function refreshDuration(profile: RefreshProfile): number {
  switch (profile) {
    case "kindle":
      return 90;
    case "eink":
      return 140;
    case "ghosting":
      return 60;
    case "paper":
    default:
      return 0;
  }
}

export function fmtLangMap(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    if (!keys.length) return "";
    const first = (value as Record<string, unknown>)[keys[0]];
    return typeof first === "string" ? first : "";
  }
  return "";
}

export function fmtContributors(value: unknown): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "name" in item) {
        return fmtLangMap((item as { name: unknown }).name);
      }
      return fmtLangMap(item);
    })
    .filter(Boolean);
}
