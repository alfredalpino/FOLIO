export type ReadingProfile =
  | "paper"
  | "sepia"
  | "newspaper"
  | "slate"
  | "night"
  | "softnight"
  | "lighthouse"
  | "terminal";

export type RefreshProfile = "paper" | "kindle" | "eink" | "ghosting";

export type ReadingFont =
  | "book"
  | "classic"
  | "literary"
  | "news"
  | "dyslexic"
  | "modern"
  | "mono";

export type TextAlign = "left" | "justify" | "center" | "right";

export interface BookRecord {
  id: string;
  title: string;
  authors: string[];
  language: string;
  publisher: string;
  published: string;
  description: string;
  fileName: string;
  format: string;
  size: number;
  addedAt: string;
  lastReadAt: string;
  progress: number;
  chapterLabel: string;
  hasCover: boolean;
  /** Soft collection used for shelf filters */
  shelf?: string;
  /**
   * When true, open the locally converted reflowable EPUB instead of the
   * fixed-layout PDF pages (text-layer PDFs only).
   */
  preferReflow?: boolean;
  /** True after a successful PDF → EPUB reflow conversion is stored. */
  hasReflow?: boolean;
}

export interface ProgressRecord {
  id: string;
  cfi: string;
  fraction: number;
  chapterLabel: string;
  updatedAt: string;
}

export interface BookmarkRecord {
  id: string;
  bookId: string;
  cfi: string;
  label: string;
  createdAt: string;
}

export interface FileRecord {
  id: string;
  blob: Blob;
}

export interface CoverRecord {
  id: string;
  blob: Blob;
}

export interface AppSettings {
  id: "settings";
  profile: ReadingProfile;
  refresh: RefreshProfile;
  font: ReadingFont;
  fontSize: number;
  lineHeight: number;
  margin: number;
  align: TextAlign;
  /** Extra letter-spacing in em (Kindle “boldness” adjacent control) */
  letterSpacing: number;
  hyphenate: boolean;
  volumeKeys: boolean;
  wakeLock: boolean;
  /** @deprecated use align — kept for migration */
  justify?: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: "settings",
  profile: "sepia",
  refresh: "paper",
  font: "book",
  fontSize: 112,
  lineHeight: 1.55,
  margin: 10,
  align: "justify",
  letterSpacing: 0,
  hyphenate: true,
  volumeKeys: false,
  wakeLock: true,
};

export interface TocItem {
  label: string;
  href?: string;
  subitems?: TocItem[];
}
