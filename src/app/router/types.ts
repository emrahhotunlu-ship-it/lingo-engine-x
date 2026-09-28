// Routen-Vertrag des App-Rahmens (docs/neubau/architektur.md §2.3, §2.8).
//
// Es gibt KEINE gemeinsame Routen-Datei: Jeder Bereich (`src/areas/<bereich>.tsx`) trägt seine
// Bildschirme per Deklarations-Zusammenführung in `RouteParams` ein:
//
//   declare module '../app/router/types' {
//     interface RouteParams { lesson: { id: string } }
//   }
//
// Daraus entsteht `Route` als Union mit Namens-Diskriminator; `go({ name: 'lesson', id })` bleibt
// typgeprüft. Jede Route ist reines JSON (Deep-Links, Fortsetzen und Tests nutzen dieselbe Form).

/** Parameter je Bildschirm. Bildschirme ohne Parameter tragen `NoParams` ein. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- wird von den Bereichen erweitert
export interface RouteParams {}

/** Bildschirm ohne Parameter (z. B. `today: NoParams`). */
export type NoParams = object;

// Alle Schlüssel sind Zeichenketten (Bildschirm-Namen); `Extract` hält den Typ auch bei leerer Liste.
export type RouteName = Extract<keyof RouteParams, string>;

export type Route = { [K in RouteName]: { name: K } & RouteParams[K] }[RouteName];

/** Die Route eines bestimmten Bildschirms. */
export type RouteOf<K extends RouteName> = Extract<Route, { name: K }>;

/**
 * Ebene eines Bildschirms (§2.1 Nr. 4): Reiter-Wurzel (mit Kopf und Reiterleiste), Seite (auf dem
 * Stapel des aktiven Reiters) oder Übung (Vollbild-Ebene über der Herkunft).
 */
export type ScreenKind = 'tab' | 'page' | 'exercise';

/** Gemeinsame Parameter-Typen mehrerer Bereiche. */
export type UnitCtx = 'duty' | 'extra';
/** `preply` nur noch als alter Deep-Link lesbar (führt zu „Gespräche“, 28.09.2026). */
export type SpeakSeg = 'scenes' | 'business' | 'preply';
