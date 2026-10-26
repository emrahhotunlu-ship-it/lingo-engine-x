import { validateDoc } from '../../data/validate';
import type { UnitVerdict } from './unit';
import { lexicalUnit } from './unitKnown';

// Ruhende Lesekarten (Kartenqualität 26.10.2026, Muster `held` aus `domain/repair/gate.ts`): Eine Karte aus einem Artikel oder dem Leser
// (`src:'read'`), deren Wort eine Gruppe ohne feste Einheit ist („adaptive attempts“), wird NICHT gelöscht und nicht verändert. Sie ruht:
// keine Abfrage, kein Angebot, keine Zählung, bis Emrah sie in der Lehrer-Liste („KI-Stichprobe“) mit „Doch lernen“ freigibt
// (`lu: {ok: true, by: 'user'}`, ergänzend über den einen Schreibweg) oder Claude sie beim Speichern bestätigt hat (`lu.ok`).

/** Vermerk an der Karte (neu, tolerant gelesen): Ergebnis der Einheiten-Prüfung beim Speichern bzw. Emrahs Freigabe. */
export type CardUnitMark = { ok: boolean; by: 'rule' | 'claude' | 'user'; t: number; better?: string };

/** `lu` einer Karte, falls lesbar. */
export function unitMarkOf(doc: Readonly<Record<string, unknown>>): CardUnitMark | null {
  const lu = doc.lu;
  if (!lu || typeof lu !== 'object') return null;
  const o = lu as Record<string, unknown>;
  if (typeof o.ok !== 'boolean') return null;
  const by = o.by === 'claude' || o.by === 'user' ? o.by : 'rule';
  return { ok: o.ok, by, t: typeof o.t === 'number' ? o.t : 0, ...(typeof o.better === 'string' && o.better ? { better: o.better } : {}) };
}

const cache = new Map<string, UnitVerdict>();

/** Urteil je Kartenwort (zwischengespeichert; die Prüfung ist rein). */
export function cardUnitVerdict(word: string): UnitVerdict {
  const k = word.trim().toLowerCase();
  const hit = cache.get(k);
  if (hit) return hit;
  const v = lexicalUnit(k);
  if (cache.size > 4000) cache.clear();
  cache.set(k, v);
  return v;
}

/** Lesekarte mit Wortgruppe? Nur diese Karten prüft die Sperre (Einzelwörter und andere Quellen nie). */
export const isReadGroup = (src: unknown, word: string): boolean => src === 'read' && /\s/.test(word.trim().replace(/^to\s+/i, ''));

/** Ruht die Karte? Dann das Urteil der Prüfung (mit Grund und üblicher Fassung), sonst `null`. */
export function unitHeld(doc: Readonly<Record<string, unknown>>): UnitVerdict | null {
  const word = typeof doc.word === 'string' ? doc.word : '';
  if (!isReadGroup(doc.src, word)) return null;
  if (unitMarkOf(doc)?.ok) return null;
  const v = cardUnitVerdict(word);
  return v.verdict === 'check' ? v : null;
}

/** Zeile der Lehrer-Liste / Rohdaten der Stichprobe. */
export type HeldUnitRow = { path: string; word: string; de: string; ex: string; reason: string; better?: string };

export function heldUnitRows(cards: ReadonlyArray<{ path: string; doc: Readonly<Record<string, unknown>> }>): HeldUnitRow[] {
  const out: HeldUnitRow[] = [];
  for (const c of cards) {
    const v = unitHeld(c.doc);
    if (!v) continue;
    const s = (k: string): string => (typeof c.doc[k] === 'string' ? c.doc[k] : '');
    out.push({ path: c.path, word: s('word'), de: s('de'), ex: s('ex'), reason: v.detail ? `${v.reason}: ${v.detail}` : v.reason, ...(v.better ? { better: v.better } : {}) });
  }
  return out;
}

/** „Doch lernen“: `lu` ergänzen (nur wenn noch nicht freigegeben und die Karte gültig ist; nie löschen, sonst nichts ändern). */
export function releaseUnitOp(path: string, cur: Readonly<Record<string, unknown>> | undefined, nowMs: number): { update: Record<string, unknown> } | null {
  if (!cur || unitMarkOf(cur)?.ok || !validateDoc(path, cur).ok) return null;
  return { update: { lu: { ok: true, by: 'user', t: nowMs } } };
}
