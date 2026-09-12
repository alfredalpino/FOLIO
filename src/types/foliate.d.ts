/** Ambient types for Foliate.js loaded from /public/vendor at runtime. */
declare module "/vendor/foliate-js/view.js" {
  export function makeBook(file: File | Blob | string): Promise<{
    metadata?: Record<string, unknown>;
    getCover?: () => Promise<Blob | null | undefined>;
    toc?: unknown;
  }>;
}
