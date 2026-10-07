import { getWriter } from '../../data';
import { invalidIdsOf, useLive } from '../../data/live';
import { learningDayEnd, dayKey } from '../../domain/date';
import { lexBookings, lexEvent, lexOut, type LexCard } from '../../domain/c1x/lexBook';
import type { C1Item, C1Score } from '../../domain/c1x/types';
import { buildTrainCards } from '../../domain/metrics';
import { buildChunkCards } from '../../domain/srs/chunkCards';
import type { Grade, Lang } from '../../domain/srs/types';
import { logError } from '../../platform/diagnostics';
import { saveOut } from '../nbdrill/shared';
import { nextT, recordAnswer } from '../progress/persist';
import { saveCard } from '../vocab/persist';

// Buchung der betroffenen Wortkarten einer c1x-Aufgabe mit `lex[]` (Lernplattform 3.0 §3.4, Pflichtauflösung 5, P20). Die reine Regel steht in
// `domain/c1x/lexBook.ts`; hier läuft nur das Schreiben: je betroffener Karte HÖCHSTENS EINE Wiederholung je Lerntag (über alle Quellen: der Trainer schreibt
// `fsrs.last`, diese Datei merkt sich zusätzlich die in dieser Sitzung schon gebuchten Karten), nie eine neue Karte anlegen, dazu der Verlaufseintrag in
// `out/<Monat>` für `mcc`/`wf`/`cnet` mit Lexik-Bereich.

type Doc = Record<string, unknown>;

let bookedDay = '';
const booked = new Set<string>();

const norm = (s: string): string => s.trim().toLowerCase();

/** Die vorhandene Karte zu einem Wort bzw. einer Wendung (Vokabel mit Dokument oder Wendung), sonst `null`. */
function cardOf(word: string, nowMs: number): LexCard | null {
  const live = useLive.getState();
  const vocab = buildTrainCards(live.collections.vocab ?? new Map<string, Doc>(), nowMs, invalidIdsOf(live.invalid, 'vocab'));
  const chunks = buildChunkCards(live.collections.chunk ?? new Map<string, Doc>(), nowMs, invalidIdsOf(live.invalid, 'chunk'));
  const w = norm(word);
  const hit = [...vocab, ...chunks].find((c) => c.inDb && (norm(c.word) === w || norm(c.lemma) === w));
  if (!hit) return null;
  return { key: hit.key, kind: hit.kind === 'chunk' ? 'chunk' : 'v', id: hit.id, due: hit.fsrs.due, last: hit.fsrs.last ?? 0 };
}

export type LexWriteInput = {
  item: C1Item;
  score: C1Score;
  /** Die berechnete Note der Antwort. */
  grade: Grade;
  day: string;
  lang: Lang;
  ms: number;
  given: string;
  dev: 't' | 'k';
  /** Zweite Sicht einer schon gesehenen Aufgabe: keine Kartenbuchung. */
  again?: boolean;
  /** Einstufung, Check, Kapitelprüfung: keine Buchung. */
  measure?: boolean;
};

/** Bucht die Karten und den Verlaufseintrag. Fehler stehen im Protokoll und halten die Runde nie auf. */
export async function bookLex(i: LexWriteInput): Promise<number> {
  if (i.measure || i.item.probe || i.item.pool) return 0;
  const nowMs = Date.now();
  if (bookedDay !== i.day) {
    bookedDay = i.day;
    booked.clear();
  }
  const out = lexOut(i.item, i.score, { t: nextT(), day: i.day, ms: i.ms });
  if (out && i.item.src === 'seed') void saveOut(out);
  const list = lexBookings(i.item, i.score, i.grade, { cardOf: (w) => cardOf(w, nowMs), today: i.day, dayOf: (ms) => dayKey(ms), dayEnd: learningDayEnd(nowMs), booked }, { ...(i.again ? { again: true } : {}) });
  let n = 0;
  for (const b of list) {
    booked.add(b.card.key);
    const ans = i.item.kind === 'mcc' ? (i.item.options[i.item.answer] ?? '') : i.item.kind === 'ocl' || i.item.kind === 'wf' ? (i.item.accept[0] ?? '') : '';
    const a = lexEvent(b, { t: nextT(), day: i.day, lang: i.lang, ctx: 'xtra', ms: i.ms, given: i.given, ans, dev: i.dev });
    try {
      if (getWriter()) await saveCard(a, null);
      recordAnswer(a, false);
      n++;
    } catch (err) {
      logError('c1x:lex', err, b.card.key);
    }
  }
  return n;
}
