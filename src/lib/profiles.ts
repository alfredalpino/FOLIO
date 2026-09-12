import type {
  AppSettings,
  ReadingFont,
  ReadingProfile,
  RefreshProfile,
  TextAlign,
} from "./types";

export interface ProfileColors {
  bg: string;
  fg: string;
  muted: string;
  link: string;
  page: string;
  /** CSS filter for PDF / fixed-layout pages (Kindle-like night) */
  pdfFilter: string;
  dark: boolean;
}

export const PROFILE_COLORS: Record<ReadingProfile, ProfileColors> = {
  paper: {
    bg: "#f4f1ea",
    fg: "#1c1917",
    muted: "#78716c",
    link: "#44403c",
    page: "#fffcf5",
    pdfFilter: "none",
    dark: false,
  },
  sepia: {
    bg: "#e8dcc8",
    fg: "#3b2f2f",
    muted: "#7a6a55",
    link: "#5c4033",
    page: "#f4ecd8",
    pdfFilter: "sepia(0.35) contrast(0.95)",
    dark: false,
  },
  newspaper: {
    bg: "#ebe8df",
    fg: "#111111",
    muted: "#525252",
    link: "#262626",
    page: "#f7f5ef",
    pdfFilter: "grayscale(0.15) contrast(1.02)",
    dark: false,
  },
  slate: {
    bg: "#d7dce2",
    fg: "#1f2933",
    muted: "#616e7c",
    link: "#3e4c59",
    page: "#eef1f4",
    pdfFilter: "grayscale(0.2)",
    dark: false,
  },
  night: {
    bg: "#0f0e0d",
    fg: "#d6d3d1",
    muted: "#a8a29e",
    link: "#e7e5e4",
    page: "#171513",
    pdfFilter: "invert(1) hue-rotate(180deg) contrast(0.92)",
    dark: true,
  },
  softnight: {
    bg: "#1a1714",
    fg: "#cfc6b8",
    muted: "#9c9080",
    link: "#ddd2c0",
    page: "#221e19",
    pdfFilter: "invert(0.92) hue-rotate(180deg) sepia(0.15) contrast(0.9)",
    dark: true,
  },
  lighthouse: {
    bg: "#ffffff",
    fg: "#000000",
    muted: "#444444",
    link: "#111111",
    page: "#ffffff",
    pdfFilter: "contrast(1.05)",
    dark: false,
  },
  terminal: {
    bg: "#0c0c0c",
    fg: "#c8c8c8",
    muted: "#888888",
    link: "#aaaaaa",
    page: "#111111",
    pdfFilter: "invert(1) hue-rotate(180deg) contrast(0.95) saturate(0)",
    dark: true,
  },
};

export const FONT_STACKS: Record<ReadingFont, string> = {
  book: '"Literata", "Bookerly", "Iowan Old Style", Palatino, "Palatino Linotype", serif',
  classic: 'Georgia, "Times New Roman", Times, serif',
  literary: '"Libre Baskerville", "Palatino Linotype", Palatino, serif',
  news: '"Source Serif 4", "Merriweather", Georgia, serif',
  dyslexic: '"Atkinson Hyperlegible", "Verdana", "Helvetica Neue", sans-serif',
  modern: '"Source Sans 3", "Helvetica Neue", Helvetica, Arial, sans-serif',
  mono: '"IBM Plex Mono", "SF Mono", Menlo, Consolas, monospace',
};

export const FONT_LABELS: Record<ReadingFont, string> = {
  book: "Book (Literata)",
  classic: "Classic (Georgia)",
  literary: "Literary (Baskerville)",
  news: "News (Source Serif)",
  dyslexic: "Clear (Atkinson)",
  modern: "Modern (Sans)",
  mono: "Mono",
};

export const PROFILE_LABELS: Record<ReadingProfile, string> = {
  paper: "Cream",
  sepia: "Sepia",
  newspaper: "Newspaper",
  slate: "Slate",
  night: "Night",
  softnight: "Soft night",
  lighthouse: "Light",
  terminal: "Terminal",
};

export const ALIGN_LABELS: Record<TextAlign, string> = {
  left: "Left",
  justify: "Justify",
  center: "Center",
  right: "Right",
};

/** Migrate legacy settings that only had `justify: boolean`. */
export function normalizeSettings(raw: Partial<AppSettings>): AppSettings {
  const base = { ...raw };
  if (!base.align && typeof base.justify === "boolean") {
    base.align = base.justify ? "justify" : "left";
  }
  if (!base.font) base.font = "book";
  if (!base.align) base.align = "justify";
  if (base.letterSpacing == null) base.letterSpacing = 0;
  if (base.hyphenate == null) base.hyphenate = true;
  return base as AppSettings;
}

const FONT_IMPORT = `@import url("https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&family=Merriweather:ital,opsz,wght@0,18..144,400;0,18..144,700;1,18..144,400&family=Source+Sans+3:ital,wght@0,400;0,600;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap");`;

export function contentCSS(settings: AppSettings): string {
  const c = PROFILE_COLORS[settings.profile] || PROFILE_COLORS.sepia;
  const font = FONT_STACKS[settings.font] || FONT_STACKS.book;
  const denser =
    settings.profile === "newspaper" || settings.profile === "terminal";
  const align = settings.align || "justify";
  const hyphens = settings.hyphenate && align === "justify" ? "auto" : "manual";
  const tracking =
    settings.letterSpacing && settings.letterSpacing !== 0
      ? `letter-spacing: ${settings.letterSpacing}em !important;`
      : "";

  return `
    ${FONT_IMPORT}
    @namespace epub "http://www.idpf.org/2007/ops";
    html {
      color-scheme: ${c.dark ? "dark" : "light"};
      font-size: ${settings.fontSize}%;
    }
    html, body {
      color: ${c.fg} !important;
      background: ${c.page} !important;
      font-family: ${font} !important;
      ${tracking}
    }
    body {
      /* Kindle-like page inset inside the column */
      padding-inline: 0.15em;
      max-width: 100%;
    }
    body, p, div, span, li, h1, h2, h3, h4, h5, h6, blockquote, td, th {
      font-family: ${font} !important;
    }
    a, a:link { color: ${c.link} !important; }
    p, li, blockquote, dd {
      line-height: ${settings.lineHeight};
      text-align: ${align};
      text-justify: ${align === "justify" ? "inter-word" : "auto"};
      hyphens: ${hyphens};
      -webkit-hyphens: ${hyphens};
      orphans: 2;
      widows: 2;
      margin-block: ${denser ? "0.5em" : "0.75em"};
      ${tracking}
    }
    h1, h2, h3 {
      line-height: 1.25;
      letter-spacing: -0.01em;
      text-align: ${align === "justify" ? "left" : align};
      text-wrap: balance;
    }
    pre, code {
      white-space: pre-wrap !important;
      font-family: ${FONT_STACKS.mono} !important;
    }
    img, svg, video {
      max-width: 100%;
      height: auto;
    }
    /* Soften publisher CSS that fights the reader */
    * {
      max-width: 100%;
    }
  `;
}

export function pdfPageFilter(profile: ReadingProfile): string {
  return PROFILE_COLORS[profile]?.pdfFilter || "none";
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
