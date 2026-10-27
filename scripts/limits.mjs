// Grenzen für Bau, Prüfung und Veröffentlichung: die EINZIGE Quelle dieser Zahlen in scripts/ (Stufe 1, P0 S1-TOR Nr. 2).
// check-platform.mjs, publish-manifest.mjs und check-budget.mjs lesen nur hier. Wer eine Grenze ändert, ändert sie nur hier.
//
// Gewählt ist jeweils der STRENGSTE Wert aus Artefakt-Tool und bisheriger Prüfung, Megabyte dezimal (1 MB = 1.000.000 Byte),
// damit „15 MB“ des Artefakt-Tools sicher eingehalten ist, gleich wie das Tool rechnet:
//  - Artefakt-Tool: Seite und Textdateien je 16 MB, Binärdateien je 15 MB → hier für JEDE Datei 15 MB.
//  - Artefakt-Tool: höchstens 255 Dateien und 64 MB je Veröffentlichung (eine Version darf mehr halten, wir veröffentlichen aber in einem Zug).

/** Höchstens so viele Dateien je Veröffentlichung (Artefakt-Tool, ein Aufruf). */
export const MAX_FILES_PER_PUBLISH = 255;
/** Jede einzelne Datei (Seite, Skript, Stylesheet, Schrift, Inhalts-Bündel) muss KLEINER sein. */
export const MAX_FILE_BYTES = 15 * 1000 * 1000;
/** Summe aller Dateien einer Veröffentlichung höchstens so groß. */
export const MAX_PUBLISH_BYTES = 64 * 1000 * 1000;

// Ziele (Warnung, kein Abbruch in check:platform; das harte Tor ist scripts/check-budget.mjs mit scripts/budget.json).
/** Mehr-Datei: Ziel weniger als 100 Dateien (Stufe-1-Plan P0 Nr. 1, Konzept 14.2). */
export const TARGET_MAX_FILES = 100;
/** Mehr-Datei: Warnung ab dieser Gesamtgröße (Tarek 3.3). */
export const WARN_TOTAL_BYTES = 9 * 1000 * 1000;

// Einzeldatei-Rückfall (`npm run build:single`): Budget aus Lernplattform 3.0 §9, unverändert übernommen.
/** Einzeldatei: Hinweis ab 6 MiB. */
export const SINGLE_WARN_BYTES = 6 * 1024 * 1024;
/** Einzeldatei: blockiert ab 9 MiB. */
export const SINGLE_FAIL_BYTES = 9 * 1024 * 1024;

/** Lesbare Größe für Meldungen (dezimal, passend zu den Grenzen oben). */
export const mb = (bytes) => `${(bytes / 1e6).toFixed(2)} MB`;
