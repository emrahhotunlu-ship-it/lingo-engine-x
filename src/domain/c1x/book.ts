import { gradeAnswer, type HelpLevel } from '../grade';
import type { Ctx, GrammarAnswer } from '../learn/types';
import type { Lang } from '../srs/types';
import { gradeKeyOf, noteNameOf, type C1Form } from './notes';
import { nOptionsOf, type C1Task } from './runtime';
import type { C1Input, C1Item, C1Response, C1Score } from './types';

// Buchung einer c1x-Antwort (Lernplattform 3.0 §3.4, P13). Aus Aufgabe, Wertung und Umständen entsteht das `GrammarAnswer`, das der eine Schreibweg
// (`domain/grammar/write.ts`) bucht:
//   ok          nur bei voller Punktzahl; „1 von 2“ ist „Fast“ (Note 2), hebt BKT nie und wird ein Fehlersatz,
//   BKT         Ratewahrscheinlichkeit je Art (`nOpt`); ein getippter Anteil (`free`) zählt als getippt; Hilfe-Deckel wie LP2,
//   `pats`      Ergebnisse ohne getippten Anteil (Auswahl, Bausteine) und jede zweite Sicht setzen das Hilfe-Bit; Fest also nur über getippte Treffer,
//   Claude      Aufgaben mit `src: 'ai'` buchen nie BKT und nie `pats` (der Schreibweg beachtet das), nur `seen` und im Fehlerfall einen Fehlersatz,
//   Note        nach `GRADE_TABLE` (`c1_<name>`): Auswahl und Bausteine nie „Leicht“.

export type C1Run = {
  /** Eingabeform für den Notenschlüssel (kwt: tiles/part/typed, err: tap/tapfix/typed, reg: chips/text, para: pick/text). */
  form: C1Form;
  inp: C1Input;
  /** Millisekunden bis „Prüfen“ bzw. bis zur Wahl. */
  timeMs: number;
  /** Millisekunden bis zum ersten getippten Zeichen (getippte Formen). */
  firstKeyMs?: number;
  /** Genutzte Hilfe: 0 keine, 1 Tipp, 2 Stufe 2 (Chips/erster Buchstabe), 3 Lösung gezeigt. */
  help: HelpLevel;
  /** Gelöschte Zeichen, Länge der Lösung in Zeichen, Zahl der Bausteine. */
  deletions?: number;
  chars?: number;
  units?: number;
  /** Zweite Sicht einer schon gesehenen Aufgabe (`seen`). */
  again?: boolean;
  /** „Weiß ich nicht“. */
  dontKnow?: boolean;
  /** Einspruch „Ich lag richtig“ (nur getippte Formen). */
  override?: boolean;
  day: string;
  t: number;
  lang: Lang;
  ctx: Ctx;
  /** Anzeige der Antwort im Protokoll (sonst aus `response`). */
  given?: string;
};

/** Lesbare Fassung der Antwort für Protokoll und Fehlersatz. */
export function givenOf(item: C1Item, r: C1Response): string {
  switch (r.kind) {
    case 'mcc':
      return item.kind === 'mcc' ? (item.options[r.pick] ?? '') : '';
    case 'ocl':
    case 'wf':
    case 'kwt':
      return r.text;
    case 'err': {
      if (r.tap === 'none') return '(no mistake)';
      const word = item.kind === 'err' ? (item.text.split(/\s+/)[r.tap] ?? '') : '';
      return r.fix !== undefined ? `${word} → ${r.fix}` : word;
    }
    case 'pair':
      return `${r.links[0] ?? '-'}/${r.links[1] ?? '-'}${r.transfer ? ` ${r.transfer}` : ''}`;
    case 'cnet':
      return r.picks.join(', ');
    case 'reg':
      return r.text ?? (r.picks ?? []).join(' | ');
    case 'para':
      return r.text ?? (item.kind === 'para' && r.pick !== undefined ? (item.options[r.pick] ?? '') : '');
  }
}

/** Die Note der Antwort (1–4) aus Wertung, Zeit, Hilfe und Eingabeform. */
export function c1Grade(item: C1Item, score: C1Score, run: C1Run): GrammarAnswer['grade'] {
  return gradeAnswer({
    key: gradeKeyOf(noteNameOf(item.kind, run.form)),
    verdict: run.override ? 'correct' : score.verdict,
    timeMs: run.timeMs,
    ...(run.firstKeyMs !== undefined ? { firstKeyMs: run.firstKeyMs } : {}),
    help: run.dontKnow ? 3 : run.help,
    ...(run.chars !== undefined ? { chars: run.chars } : {}),
    ...(run.deletions !== undefined ? { deletions: run.deletions } : {}),
    ...(run.units !== undefined ? { units: run.units } : {}),
    profile: run.inp === 'touch' ? 'touch' : 'keys',
  });
}

/** Das gebuchte `GrammarAnswer` (Schreibweg `grammarWrite`, Protokoll, Zähler). */
export function bookAnswer(task: C1Task, score: C1Score, response: C1Response, run: C1Run): GrammarAnswer {
  const item = task.c1;
  const verdict = run.dontKnow ? 'wrong' : run.override ? 'correct' : score.verdict;
  // Ein Einspruch („Ich lag richtig“) zählt als volle Punktzahl, aber höchstens „Gut“ (Note nach `gradeAnswer` bei `correct`).
  const pts: [number, number] = run.override && !run.dontKnow ? [score.max, score.max] : [run.dontKnow ? 0 : score.got, score.max];
  const nOpt = nOptionsOf(item);
  return {
    kind: 'g',
    t: run.t,
    day: run.day,
    lang: run.lang,
    ctx: run.ctx,
    task: task,
    given: run.given ?? givenOf(item, response),
    dontKnow: run.dontKnow === true,
    verdict,
    grade: c1Grade(item, score, run),
    ms: Math.max(0, Math.round(run.timeMs)),
    help: { level: run.help >= 3 ? 2 : (run.help as 0 | 1 | 2) },
    judged: 'local',
    ...(run.override ? { override: true } : {}),
    dev: run.inp === 'touch' ? 't' : 'k',
    pts,
    c1k: item.kind,
    free: score.free && !run.dontKnow,
    ...(run.again ? { again: true } : {}),
    ...(nOpt !== undefined ? { nOpt } : {}),
  };
}
