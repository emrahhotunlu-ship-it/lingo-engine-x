import type { ReadState } from '../schemas';

// Lesezeit und Lesezustand (docs/umbau/lesen-plan.md §2.2): rein. Die Oberfläche ruft nur beim Pausieren/Verlassen auf,
// nie bei jedem Bildlauf. Berührt weder Pflicht noch Serie noch `app/profile`: das Ergebnis ist nur ein `ReadState`-Patch.

/** Obergrenze der gezählten Zeit je Sitzung im Leser (Plan: 20 Minuten). */
export const SESSION_CAP_SEC = 20 * 60;

/** Zeitzähler: gezählt wird nur, solange die Seite sichtbar ist; Zeit mit offenem Nachschlage-Fenster wird abgezogen. */
export type ReadClock = { activeMs: number; since: number | null; lookupAtSince: number };

export const newClock = (): ReadClock => ({ activeMs: 0, since: null, lookupAtSince: 0 });

/** Zähler starten (Seite sichtbar). `lookupMs` = Gesamtzeit mit offenem Nachschlage-Fenster bis jetzt. */
export function resumeClock(c: ReadClock, now: number, lookupMs: number): ReadClock {
  return c.since === null ? { ...c, since: now, lookupAtSince: lookupMs } : c;
}

/** Zähler anhalten (Seite verdeckt/verlassen). */
export function pauseClock(c: ReadClock, now: number, lookupMs: number): ReadClock {
  if (c.since === null) return c;
  const span = Math.max(0, now - c.since - Math.max(0, lookupMs - c.lookupAtSince));
  return { activeMs: c.activeMs + span, since: null, lookupAtSince: 0 };
}

/** Gezählte Sekunden dieser Sitzung (laufender Abschnitt eingerechnet), gedeckelt. */
export function clockSeconds(c: ReadClock, now: number, lookupMs: number): number {
  const running = c.since === null ? 0 : Math.max(0, now - c.since - Math.max(0, lookupMs - c.lookupAtSince));
  return Math.min(SESSION_CAP_SEC, Math.floor((c.activeMs + running) / 1000));
}

/**
 * „Gelesen“ gilt erst, wenn das Ende zu sehen war UND genug Zeit verging (2 Sekunden je Satz, höchstens 60): Wer einen Artikel
 * nur öffnet und bis ans Ende wischt, hat ihn nicht gelesen. `done` ist Zustand, kein Knopf (Kap. 2 Nr. 2).
 */
export function canFinish(total: number, secTotal: number): boolean {
  return total > 0 && secTotal >= Math.min(60, total * 2);
}

export type SessionFacts = {
  /** Bisheriger Zustand aus dem Monatsindex (zum Aufsummieren). */
  prior: ReadState | null | undefined;
  /** Sekunden dieser Sitzung (`clockSeconds`). */
  sec: number;
  /** Oberster sichtbarer Satz beim Pausieren (laufende Nummer). */
  pos: number;
  /** Zahl der Sätze, die der Leser in dieser Sitzung selbst aufgedeckt hat. */
  opened: number;
  /** In dieser Sitzung gespeicherte Karten. */
  saved: number;
  /** Beantwortete Prüffragen / davon richtig (nur wenn beantwortet). */
  answered?: { n: number; ok: number } | null;
  /** Das Artikelende war zu sehen. */
  reachedEnd: boolean;
  total: number;
  now: number;
};

/**
 * Patch für den Lesezustand dieses Artikels. `null`, wenn sich nichts Nennenswertes getan hat (weniger als 3 Sekunden, nichts
 * aufgedeckt, nichts gespeichert, nichts beantwortet, Ende nicht neu erreicht): dann wird nichts geschrieben.
 */
export function buildStatePatch(f: SessionFacts): ReadState | null {
  const p = f.prior ?? {};
  const newEnd = f.reachedEnd && !p.done;
  if (f.sec < 3 && f.opened === 0 && f.saved === 0 && !f.answered && !newEnd) return null;
  const patch: ReadState = { sec: (p.sec ?? 0) + f.sec };
  if (!p.t0) patch.t0 = f.now;
  patch.pos = f.reachedEnd ? f.total : Math.max(0, Math.min(f.total, Math.round(f.pos)));
  if (f.opened > 0) patch.open = Math.min(f.total, (p.open ?? 0) + f.opened);
  if (f.saved > 0) patch.saved = (p.saved ?? 0) + f.saved;
  if (f.answered) patch.q = { n: f.answered.n, ok: f.answered.ok };
  if (f.reachedEnd) patch.done = true;
  return patch;
}
