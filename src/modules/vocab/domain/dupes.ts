import type { LexKind } from './types';

// Doppel als eigene, bestätigte Phase (plan.md §9.2 Schritt 2; N3). Nur VORSCHLAGEN, nie automatisch zusammenlegen:
//  Vorschlag nur, wenn (a) gleiches Stichwort, (b) gleiche Art, (c) gleiche deutsche Bedeutung nach Vereinheitlichung oder eine Seite ohne,
//  (d) gleiche Wortart oder eine fehlt. Nur MELDEN (kein Vorschlag): britische Schreibung, Artikel, Platzhalter.
//  Nie: Bindestrich gegen Leerzeichen (follow-up ↔ follow up), anderer Sinn (address Rede ↔ address Problem).
// Führend ist das Dokument mit den meisten Antworten, bei Gleichstand das mit dem jüngeren `last`, dann die kleinere Kennung.

export type DupeInput = { path: string; head: string; k: LexKind; de: string | null; pos: string | null; reps: number; last: number };
export type DupePair = { lead: string; other: string; kind: 'propose' | 'report'; why: 'same' | 'british' | 'article' | 'placeholder' };

const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
/** Stichwort: klein, Leerraum vereinheitlicht, führendes „to “ weg. Bindestrich bleibt (follow-up ≠ follow up). */
export function headwordOf(s: string): string {
  return norm(s).replace(/^to /, '');
}
const normDe = (s: string | null) => (s ? norm(s).replace(/^(der|die|das|ein|eine|etw\.|jdn\.|sich) /, '').replace(/[.;,]+$/, '') : '');
const ARTICLE = /^(a|an|the) /;
const PLACE = /\b(sb|sth|someone|something|somebody)\b/g;
const british = (h: string) => h.replace(/is(e|ed|es|ing|ation)\b/g, 'iz$1').replace(/our\b/g, 'or');

function leadOf(a: DupeInput, b: DupeInput): [DupeInput, DupeInput] {
  if (a.reps !== b.reps) return a.reps > b.reps ? [a, b] : [b, a];
  if (a.last !== b.last) return a.last > b.last ? [a, b] : [b, a];
  return a.path < b.path ? [a, b] : [b, a];
}

export function findDupes(items: readonly DupeInput[]): DupePair[] {
  const out: DupePair[] = [];
  const seen = new Set<string>();
  const add = (a: DupeInput, b: DupeInput, kind: DupePair['kind'], why: DupePair['why']) => {
    const [l, o] = leadOf(a, b);
    const key = `${l.path}|${o.path}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ lead: l.path, other: o.path, kind, why });
  };
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i] as DupeInput;
      const b = items[j] as DupeInput;
      const ha = headwordOf(a.head);
      const hb = headwordOf(b.head);
      if (ha === hb) {
        const sameDe = !a.de || !b.de || normDe(a.de) === normDe(b.de);
        const samePos = !a.pos || !b.pos || a.pos === b.pos;
        if (a.k === b.k && sameDe && samePos) add(a, b, 'propose', 'same');
        continue;
      }
      if (british(ha) === british(hb)) add(a, b, 'report', 'british');
      else if (ha.replace(ARTICLE, '') === hb.replace(ARTICLE, '')) add(a, b, 'report', 'article');
      else if (ha.replace(PLACE, '').replace(/\s+/g, ' ').trim() === hb.replace(PLACE, '').replace(/\s+/g, ' ').trim()) add(a, b, 'report', 'placeholder');
    }
  }
  return out;
}
