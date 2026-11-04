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
/** Großpaket C (P9): Schlüssel (Pfad unter src/) → Dateiname der nachgeladenen Rohtext-Datei; leer im Einzeldatei-Build und in Tests. */
declare module 'virtual:lx-raw-list' {
  const list: Record<string, string>;
  export default list;
}
