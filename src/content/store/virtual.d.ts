// Virtuelle Module des Inhaltsspeichers (scripts/content/vite-plugin.mjs).
declare module 'virtual:content/manifest' {
  const manifest: Record<string, { count: number; rawBytes: number; packedBytes: number }>;
  export default manifest;
}
declare module 'virtual:content/loaders' {
  export const loaders: Record<string, () => Promise<{ default: string }>>;
  /** Mehr-Datei-Build: Dateiname je Bündel (flach, neben dem Skript); im Einzeldatei-Build `null`. */
  export const remote: Record<string, string> | null;
}
