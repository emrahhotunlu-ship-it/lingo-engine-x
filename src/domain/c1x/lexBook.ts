import type { OutItem } from '../nbdrill/outDoc';
import type { AnswerEvent, ExerciseId, Grade, Lang } from '../srs/types';
import type { C1Item, C1Score } from './types';

// Buchung der betroffenen Wortkarten (Lernplattform 3.0 §3.4, Pflichtauflösung 5, P13). Eine c1x-Aufgabe mit `lex[]` bucht je betroffener Karte
// HÖCHSTENS EINE FSRS-Wiederholung je Karte und Lerntag über alle Quellen (Trainer und c1x zusammen), nur für vorhandene Karten (nie neu anlegen)
// und nur für feste Aufgaben (`src: 'seed'`):
//   getippte Arten (`ocl`, `wf`)       volle Wiederholung (Gewicht 1,0 über `cloze`), Note wie berechnet, falsch → „Nochmal“, fast → „Schwer“,
//   Auswahlarten (`mcc`, `cnet`, `pair`)  nur, wenn die Karte HEUTE NICHT FÄLLIG ist (sie ersetzen den freien Abruf im Trainer nie), nie „Leicht“
//                                       (Gewicht 0,55 über `ctx_mc`), falsch → „Nochmal“,
//   zweite Sicht, `kwt`, `err`, `reg`, `para`: keine Kartenbuchung.

export type LexCard = {
  /** `vocab/<id>` oder `chunk/<id>`. */
  key: string;
  kind: 'v' | 'chunk';
  id: string;
  /** Fälligkeit (ms) und letzte Antwort (ms, 0 = nie). */
  due: number;
  last: number;
};

export type LexCtx = {
  /** Die Karte zu einem Wort bzw. einer Wendung, sonst `null` (es wird nie eine Karte angelegt). */
  cardOf: (word: string) => LexCard | null;
  /** Lerntag von heute (Wechsel 04:00) und der Lerntag eines Zeitpunkts (dieselbe Funktion). */
  today: string;
  dayOf: (ms: number) => string;
  /** Ende des heutigen Lerntags (ms): „heute fällig“ heißt `due < dayEnd`. */
  dayEnd: number;
  /** Schon gebuchte Kartenschlüssel in dieser Sitzung (noch nicht gespeichert). */
  booked?: ReadonlySet<string>;
};

export type LexBooking = { card: LexCard; ex: ExerciseId; grade: Grade };

const TYPED = new Set<C1Item['kind']>(['ocl', 'wf']);
const CHOICE = new Set<C1Item['kind']>(['mcc', 'cnet', 'pair']);

/** Die Kartenbuchungen einer beantworteten Aufgabe (leer, wenn keine zulässig ist). `grade` = die berechnete Note der Antwort. */
export function lexBookings(item: C1Item, score: C1Score, grade: Grade, ctx: LexCtx, opts: { again?: boolean } = {}): LexBooking[] {
  if (item.src !== 'seed' || opts.again || !item.lex?.length) return [];
  const typed = TYPED.has(item.kind);
  const choice = CHOICE.has(item.kind);
  if (!typed && !choice) return [];
  const out: LexBooking[] = [];
  const seen = new Set<string>(ctx.booked ?? []);
  for (const word of item.lex) {
    const card = ctx.cardOf(word);
    if (!card || seen.has(card.key)) continue;
    // Höchstens eine Wiederholung je Karte und Lerntag über alle Quellen: war die Karte heute schon dran, bleibt sie unberührt.
    if (card.last > 0 && ctx.dayOf(card.last) === ctx.today) continue;
    // Auswahl ersetzt nie den freien Abruf: nur Karten, die heute nicht fällig sind.
    if (choice && card.due < ctx.dayEnd) continue;
    const g: Grade = score.verdict === 'wrong' ? 1 : score.verdict === 'near' ? 2 : choice ? (Math.min(grade, 3) as Grade) : grade;
    seen.add(card.key);
    out.push({ card, ex: typed ? 'cloze' : 'ctx_mc', grade: g });
  }
  return out;
}

/** Die Antwort als `AnswerEvent` für den Schreibweg der Karten (`recordAnswer`). `t` muss je Gerät streng steigen (`nextT`). */
export function lexEvent(b: LexBooking, i: { t: number; day: string; lang: Lang; ctx: 'rev' | 'duty' | 'xtra'; ms: number; given: string; ans: string; dev?: 't' | 'k' }): AnswerEvent {
  return {
    t: i.t,
    day: i.day,
    kind: b.card.kind,
    id: b.card.id,
    ex: b.ex,
    grade: b.grade,
    given: i.given,
    ans: i.ans,
    ms: Math.max(0, Math.round(i.ms)),
    lang: i.lang,
    ctx: i.ctx,
    ...(i.dev ? { dev: i.dev } : {}),
  };
}

/** Verlaufseintrag in `out/<Monat>` für die Lexik-Arten (`mcc`, `wf`, `cnet`), sonst `null`. */
export function lexOut(item: C1Item, score: C1Score, i: { t: number; day: string; ms: number }): OutItem | null {
  if (item.area !== 'lex' || (item.kind !== 'mcc' && item.kind !== 'wf' && item.kind !== 'cnet')) return null;
  return { id: `${item.id}-${i.t}`, k: item.kind, d: i.day, t: i.t, ok: score.verdict === 'correct', text: (item.lex ?? []).join(', '), ms: i.ms };
}
