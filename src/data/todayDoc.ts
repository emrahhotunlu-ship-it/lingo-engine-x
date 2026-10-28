import { create } from 'zustand';
import { dayKey } from '../domain/date';
import { jsonEqual } from '../domain/equal';
import type { Db } from '../platform/types';
import { logWarn } from '../platform/diagnostics';
import { todaySchema } from './schemas';
import type { Writer } from './writer';

// Startbild `app/today` (Relaunch Stufe 1 P6, docs/relaunch/stufe1-plan.md §4.3): ein kleines, abgeleitetes Abbild des Tages für den
// schnellen Start. Quelle bleibt `app/profile.plan`/`pflicht`; dieses Dokument wird
// - beim Start EINMAL mit `get` gelesen (nie abonniert, steht nicht in `LIVE_DOCS`),
// - beim Zeichnen jedes Mal gegen den FRISCH berechneten Lerntag geprüft (Wechsel 04:00): falscher Tag, fehlend oder ungültig → Skelett,
// - nur als Ganzes über `writer.transform(… { replace })` geschrieben, und nur, wenn sich der Inhalt ohne `at` ändert (N2).
// Wann geschrieben wird, entscheiden die Aufrufer (`features/today/startDoc.ts`): `ensureDay` und Nutzeraktionen, nie ein Snapshot oder Zeitgeber.

export const TODAY_PATH = 'app/today';
/** Form-Version des Dokuments. */
export const TODAY_DOC_V = 1;
/** Höchstgröße (Plan §4.3, data-guard G3). */
export const TODAY_DOC_MAX_BYTES = 2048;

export type TodayDocBlock = {
  /** Zustand: erledigt, jetzt dran, offen. */
  st: 'done' | 'now' | 'open';
  /** Erledigt von `of` (Fortschritt des Schritts; ohne Fortschritt 0/1 bzw. 1/1). */
  n: number;
  of: number;
  /** Art des Blocks (`UnitBlockKind`, alter Plan: `review`/`legacy`). */
  k: string;
  /** Block-Nummer der Einheit (alter Plan: 0). */
  bl: number;
  /** Minuten des Schritts. */
  m: number;
  /** Format eines Format-Tags (Schritt 3), sonst fehlt es. */
  f?: string;
  /** Pflichtpunkt (`review`, `ch:u-…`). */
  id: string;
};

export type TodayDoc = {
  v: number;
  d: string;
  th?: { k: 'ch' | 'intro' | 'topic'; id: string; nm?: { de?: string | null; en?: string | null } | null; ch?: number | null };
  b?: Record<string, TodayDocBlock>;
  rest?: number;
  ring?: number;
  go?: { k: string; id: string };
  at?: number;
};

const bytes = (v: unknown): number => new TextEncoder().encode(JSON.stringify(v)).length;
export const todayDocBytes = bytes;

/** Gleich bis auf `at` (N2): dann wird nicht geschrieben. */
export function sameIgnoringAt(a: Readonly<Record<string, unknown>> | null | undefined, b: Readonly<Record<string, unknown>> | null | undefined): boolean {
  if (!a || !b) return false;
  const { at: _a, ...ra } = a;
  const { at: _b, ...rb } = b;
  void _a;
  void _b;
  return jsonEqual(ra, rb);
}

const blockOk = (x: unknown): x is TodayDocBlock => {
  if (!x || typeof x !== 'object') return false;
  const b = x as Record<string, unknown>;
  return (
    typeof b.id === 'string' &&
    (b.st === 'done' || b.st === 'now' || b.st === 'open') &&
    typeof b.k === 'string' &&
    [b.n, b.of, b.bl, b.m].every((v) => typeof v === 'number' && Number.isFinite(v)) &&
    (b.f === undefined || typeof b.f === 'string')
  );
};
const blockKeys = (doc: TodayDoc): string[] =>
  Object.keys(doc.b ?? {})
    .filter((k) => /^b\d+$/.test(k))
    .sort((x, y) => Number(x.slice(1)) - Number(y.slice(1)));

/** Blöcke in Reihenfolge `b1…bN` (nur vollständige). */
export function todayDocBlocks(doc: TodayDoc): TodayDocBlock[] {
  const b = doc.b ?? {};
  return blockKeys(doc)
    .map((k) => b[k])
    .filter(blockOk);
}

/**
 * Gültig für den Lerntag `today`? Schema, Form-Version, Tag und mindestens ein Block mit Ziel. `today` berechnet der Aufrufer bei JEDEM
 * Zeichnen frisch (`dayKey(Date.now())`), nie einmal beim Laden. Sonst `null` → Skelett, nie Zahlen eines anderen Tages.
 */
export function todayDocFor(raw: unknown, today: string): TodayDoc | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = todaySchema.safeParse(raw);
  if (!parsed.success) return null;
  const doc = parsed.data as unknown as TodayDoc;
  if (doc.v !== TODAY_DOC_V || doc.d !== today) return null;
  if (typeof doc.rest !== 'number' || typeof doc.ring !== 'number' || !doc.go || typeof doc.go.id !== 'string') return null;
  const blocks = todayDocBlocks(doc);
  // Ein unvollständiger Block macht das ganze Bild ungültig (lieber Skelett als falsche Zahlen).
  if (!blocks.length || blocks.length !== blockKeys(doc).length || !blocks.some((b) => b.id === doc.go?.id)) return null;
  return doc;
}

/**
 * Das Dokument als Ganzes ersetzen – nur, wenn es sich ohne `at` vom FRISCHEN Stand unterscheidet (Vergleich in `compute`, N2).
 * Nie `update` (verschmölze alte Blöcke). Ein ungültiges Dokument wird ganz ersetzt.
 */
export async function writeTodayDoc(writer: Writer, next: TodayDoc): Promise<'created' | 'updated' | 'unchanged'> {
  const data = next as unknown as Record<string, unknown>;
  if (bytes(data) > TODAY_DOC_MAX_BYTES) {
    logWarn('today:doc', { code: 'too_large', message: `app/today ${bytes(data)} B > ${TODAY_DOC_MAX_BYTES} B – nicht geschrieben` }, TODAY_PATH);
    return 'unchanged';
  }
  const out = await writer.transform(TODAY_PATH, (cur) => (sameIgnoringAt(cur, data) ? null : { replace: data }));
  // Den Store nur bei echter Änderung anfassen (data-guard Hinweis 5): sonst zeichnete jeder Anlass die Startseite ohne Grund neu.
  if (!sameIgnoringAt(useTodayDoc.getState().doc, data)) useTodayDoc.setState({ doc: data });
  return out;
}

// ------------------------------------------------------------------ Lesen beim Start (ein `get`, kein Abo)

type DocState = {
  /** `idle` = noch nicht gelesen, `loading`, `done` (auch: fehlt/Fehler). */
  status: 'idle' | 'loading' | 'done';
  /** Roh gelesen (Prüfung beim Zeichnen mit `todayDocFor`). */
  doc: Readonly<Record<string, unknown>> | null;
};

export const useTodayDoc = create<DocState>(() => ({ status: 'idle', doc: null }));

/** Beim Start EINMAL `app/today` holen (ein einzelnes `get`, vor den großen Abos). */
export function loadTodayDoc(db: Db): void {
  if (useTodayDoc.getState().status !== 'idle') return;
  useTodayDoc.setState({ status: 'loading' });
  db.doc(TODAY_PATH)
    .get()
    .then((snap) => {
      // Eine eigene Schreibung kann schneller gewesen sein: dann gilt sie.
      if (useTodayDoc.getState().doc) return useTodayDoc.setState({ status: 'done' });
      useTodayDoc.setState({ status: 'done', doc: snap.exists ? (snap.data()) : null });
    })
    .catch((err: unknown) => {
      logWarn('today:doc', err, TODAY_PATH);
      useTodayDoc.setState({ status: 'done' });
    });
}

/** Hook: gültiges Startbild für den JETZT berechneten Lerntag (bei jedem Zeichnen frisch, Wechsel 04:00) oder `null`. */
export function useValidTodayDoc(): TodayDoc | null {
  const raw = useTodayDoc((s) => s.doc);
  return todayDocFor(raw, currentDay());
}

/** Lerntag JETZT (außerhalb des Zeichnens berechnet, damit der Aufruf nie aus einem gemerkten Wert kommt). */
export function currentDay(): string {
  return dayKey(Date.now());
}

/** Nur für Tests. */
export function resetTodayDocForTests(): void {
  useTodayDoc.setState({ status: 'idle', doc: null }, true);
}
