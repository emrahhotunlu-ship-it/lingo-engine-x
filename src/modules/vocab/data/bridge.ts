import { dayKey, type Writer } from '../shared';
import type { UseInput } from '../domain/apply';
import { sentencesOf, usableSentences } from '../domain/card';
import { Catalog } from '../domain/catalog';
import { baseAnswer, headOf } from '../domain/flow';
import { FLAG, mayPlan } from '../domain/planner';
import { OS_TEXT_MAX, type LexKind, type VocabCfg } from '../domain/types';
import { answerOfUse } from '../domain/use';
import type { VlogTuple } from '../domain/vlog';
import type { UseErr, UseVerdict } from '../prompts/common';
import { lexOf } from './lex';
import { writeBridgeUse } from './store';

// Wörter-Modul, Tür für die Brücken-Sätze (Großpaket P „Politur“, P4 „Anwenden als Brücke“, 13.11.2026). Rein ergänzend: neue Datei, nichts Bestehendes
// ändert sich. Nachgeladen über `api.loadBridgeWords` / `api.reportBridgeUse` (nie statisch: Planer-Code bleibt aus der Einstiegsdatei).
//
//  1. `bridgeWordsOf`: die eingeführten, nicht pausierten Lexeme mit dem, was Anwenden für die Zielwahl braucht (Stufe, Einführungstag, letzter
//     Übungstag laut Verlauf `vlog`, eigene geprüfte Sätze, gelernte Bedeutung, Kartensatz). Nur lesen.
//  2. `bookBridgeUse`: Rückfluss eines von Claude beurteilten eigenen Satzes (Verlaufsform `own`, Kennzeichen „von außen“):
//     - „richtig“ ab Stufe 5 zählt als eigener geprüfter Satz für Stufe 7 (`ev.o`), höchstens einmal je Wort und Lerntag, und steht in „Deine Sätze“;
//     - „falsch“ und „fast richtig“ stehen im Verlauf;
//     - Planwirkung (Note, Termin) nur, wenn das Wort NICHT im heute eingefrorenen Pflichtplan steht und `mayPlan` es erlaubt (heute fällig oder
//       Abrufwahrscheinlichkeit < 0,95, heute noch nicht gebucht) – ein freiwilliger Beleg zählt nie zur Pflicht (Kap. 15);
//     - idempotent über die Zeit der Prüfung (`sync ≥ t` → nichts), gerechnet auf dem FRISCHEN Dokument, nie in ein ungültiges geschrieben.

type Doc = Record<string, unknown>;

export type BridgeLex = {
  path: string;
  /** Stichwort, wie es auf der Karte steht. */
  head: string;
  /** Grundform zum Benutzen (*to rely on sth* → *rely on*). */
  word: string;
  /** Gelernte Bedeutung (Deutsch). */
  de: string;
  kind: LexKind;
  lv: number;
  /** Kartensatz (Ankersatz): ein eigener Satz, der fast gleich ist, zählt nicht. */
  example: string | null;
  /** Eigene geprüfte Sätze bisher (`ev.o`). */
  own: number;
  intro: string | null;
  /** Letzter Lerntag, an dem das Wort geübt wurde: Verlauf `vlog`, sonst die Tagesmarken des Lexems. */
  practiced: string | null;
};

const later = (a: string | null, b: string | null): string | null => (a && b ? (a > b ? a : b) : (a ?? b));

/** Lexeme für die Zielwahl der Brücken-Sätze. `vlog` = Verlauf der letzten Lerntage (leer, wenn er nicht lesbar war: dann gelten die Tagesmarken). */
export function bridgeWordsOf(docs: Iterable<readonly [string, Doc]>, vlog: readonly VlogTuple[], nowMs: number): BridgeLex[] {
  const lastDay = new Map<string, string>();
  for (const tp of vlog) {
    // Die Einführung selbst ist kein Üben; alles andere (auch ohne Planwirkung) zählt.
    if (tp[3] === 'intro') continue;
    const d = dayKey(tp[0]);
    const cur = lastDay.get(tp[1]);
    if (!cur || d > cur) lastDay.set(tp[1], d);
  }
  const out: BridgeLex[] = [];
  for (const [path, doc] of docs) {
    if (!/^(vocab|chunk)\//.test(path) || doc.hidden === true) continue;
    const lex = lexOf(doc);
    if (!lex || lex.of || lex.intro === null) continue;
    const head = headOf(path, doc);
    const word = baseAnswer(head);
    if (!head || !word) continue;
    const { ok } = usableSentences(sentencesOf(doc, nowMs, null), head, lex.k === 'pv');
    out.push({
      path,
      head,
      word,
      de: typeof doc.de === 'string' ? doc.de.trim() : '',
      kind: lex.k,
      lv: lex.lv,
      example: ok[0]?.sent.en ?? null,
      own: lex.ev.o,
      intro: lex.intro,
      practiced: later(lastDay.get(path) ?? null, later(lex.day, lex.dayU)),
    });
  }
  return out;
}

export type BridgeUseInput = {
  path: string;
  /** Zeitpunkt der Prüfung (ms): Idempotenz-Schlüssel der Buchung und des Verlaufseintrags. */
  t: number;
  /** Claudes Urteil am Zielwort (wie beim eigenen Satz der Wörter-App). */
  v: UseVerdict;
  err: UseErr | null;
  /** Fundstelle (bei „ausgewichen“ das Ersatzwort). */
  at: string;
  evade: boolean;
  /** Der eigene Satz (für „Deine Sätze“, nur bei „richtig“ gespeichert). */
  sentence: string;
  /** Schreibzeit in ms. */
  ms: number;
};

/** `planned` = die Buchung hat den Plan verändert (Note); `ev` = als eigener geprüfter Satz gezählt; `own` = Stand danach. */
export type BridgeUseResult = { planned: boolean; ev: boolean; own: number; lv: number };

const inTodayPlan = (dayDoc: Doc | null | undefined, path: string, t: number): boolean =>
  !!dayDoc && dayDoc.d === dayKey(t) && Array.isArray(dayDoc.plan) && dayDoc.plan.some((x) => Array.isArray(x) && x[0] === path);

/** Rückfluss eines beurteilten eigenen Satzes; `null` = nichts gebucht (Lexem unbekannt, schon gebucht, Dokument ungültig). */
export async function bookBridgeUse(
  deps: { writer: Writer; device: string },
  i: BridgeUseInput,
  o: { docs: Iterable<readonly [string, Doc]>; cfg: VocabCfg; dayDoc: Doc | null },
): Promise<BridgeUseResult | null> {
  const items = [];
  let k = 0;
  for (const [path, doc] of o.docs) {
    const lex = lexOf(doc);
    if (lex) items.push({ path, lex, order: k++ });
  }
  const cat = new Catalog(items);
  const lex = cat.get(i.path)?.lex ?? null;
  if (!lex || lex.intro === null) return null;
  const mayChange = !inTodayPlan(o.dayDoc, i.path, i.t) && mayPlan(lex, i.t);
  const sent = i.sentence.trim();
  const u: UseInput = { t: i.t, form: 'own', v: i.v, err: i.err, at: i.at, evade: i.evade, spoken: false, lvAt: lex.lv, evidenceOnly: !mayChange, ...(sent && sent.length <= OS_TEXT_MAX ? { sent } : {}) };
  const a = { ...answerOfUse(u, lex.k, i.ms, false), flags: FLAG.ext };
  const r = await writeBridgeUse(deps, i.path, a, u, { cfg: o.cfg, cat, med: {}, planned: mayChange });
  return r ? { planned: r.booked.length > 0, ev: r.ev !== null, own: r.lex.ev.o, lv: r.lex.lv } : null;
}
