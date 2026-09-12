export type ReadingProfile = "paper" | "newspaper" | "night" | "terminal";
export type RefreshProfile = "paper" | "kindle" | "eink" | "ghosting";

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
  fontSize: number;
  lineHeight: number;
  margin: number;
  justify: boolean;
  volumeKeys: boolean;
  wakeLock: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: "settings",
  profile: "paper",
  refresh: "paper",
  fontSize: 100,
  lineHeight: 1.65,
  margin: 8,
  justify: true,
  volumeKeys: false,
  wakeLock: true,
};

export interface TocItem {
  label: string;
  href?: string;
  subitems?: TocItem[];
}
