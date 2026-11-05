import { dayKey } from '../shared';
import type { VocabTarget } from '../prompts/common';
import type { WordJudgement } from '../prompts/judge';
import type { TransferFrame } from '../prompts/transfer';
import { frameFor, outcomeOfUse, situationFor, type UseInput } from './apply';
import { type CardSentence, sentencesOf, type Teach, usableSentences } from './card';
import { baseAnswer, headOf } from './flow';
import { type Answer, FLAG } from './planner';
import { hash32 } from './rand';
import type { Task } from './session';
import type { Lex, LexKind, Outcome } from './types';

// Großpaket A Schritt 5c (plan.md §7 „Anwenden“, Bilder s2-07 … s2-12): was die Anwenden- bzw. Eigener-Satz-Karte zeigt, rein gerechnet.
//  - Anwenden (`transfer`): die Gruppe der Sitzung (3–5 Wörter), Rahmen des Tages (Mail, Slack, Call, Präsentation; einmal pro Woche Alltag)
//    und eine feste Lage je Rahmen und Tag (Texte in i18n `vmSit_<Rahmen>_<n>`).
//  - Eigener Satz (`own`, Stufe 5/6): ein Wort, eine Arbeits-Lage (wechselt je Wort und Tag: „der nächste in einem anderen Zusammenhang“).
//  - Muster ohne Claude: je Wort Beispielsätze mit markiertem Wort und die Wortpartner (Selbstvergleich, keine Planwirkung).

type Doc = Record<string, unknown>;

/** Lagen je Rahmen (i18n `vmSit_<Rahmen>_0` … `_<n-1>`; Test in tests/unit/vocab/use.test.ts). */
export const SIT_COUNT = 4;
/** Arbeits-Rahmen für den eigenen Satz (Alltag nur beim Anwenden, einmal pro Woche). */
const WORK: readonly TransferFrame[] = ['mail', 'slack', 'call', 'pitch'];
/** Beispielsätze je Wort im Muster. */
const SHOW_MAX = 2;

/** Ein Satz mit markierter Stelle (Muster ohne Claude). */
export type Shown = { text: string; start: number; end: number };

export type UseTarget = {
  path: string;
  /** Kurze Kennung im Prompt (w1, w2 …), nie der Pfad. */
  key: string;
  /** Stichwort, wie es auf der Karte steht. */
  head: string;
  /** Grundform zum Benutzen (*to rely on sth* → *rely on*). */
  word: string;
  de: string;
  kind: LexKind;
  lv: number;
  /** Ankersatz (Englisch): ein eigener Text, der fast gleich ist, zählt nicht. */
  example: string | null;
  shows: Shown[];
  partners: string[];
};

export type UseModel = {
  form: 'transfer' | 'own';
  targets: UseTarget[];
  frame: TransferFrame;
  /** Index der Lage (`vmSit_<frame>_<sit>`). */
  sit: number;
  /** Keine passenden Termine: zählt nur als Beleg, ohne Planwirkung. */
  evidence: boolean;
};

/** Satz mit markierter Stelle aus einem Kartensatz (vom ersten bis zum letzten Lückenteil). */
export function shownOf(cs: CardSentence): Shown {
  let text = '';
  let start = -1;
  let end = -1;
  for (const seg of cs.gap.segs) {
    if (seg.t === 'gap' && start < 0) start = text.length;
    text += seg.s;
    if (seg.t === 'gap') end = text.length;
  }
  return { text, start: Math.max(0, start), end: Math.max(0, end) };
}

/** Wortpartner fürs Muster: nur die Partner des Dokuments (`col`). Nie `teach.colloc` – das sind die FALSCHEN Verbindungen einer Falle (W1, 05.11.2026). */
function partnersOf(doc: Doc): string[] {
  const col = doc.col;
  const fromDoc = Array.isArray(col)
    ? col.map((c) => (typeof c === 'string' ? c : c && typeof c === 'object' && (c as Doc).bad !== 1 && typeof (c as Doc).p === 'string' ? ((c as Doc).p as string) : '')).filter(Boolean)
    : [];
  return [...new Set(fromDoc)].slice(0, 3);
}

export function targetFor(x: { path: string; doc: Doc; lex: Lex; teach: Teach; nowMs: number; sbGate: unknown; i: number }): UseTarget | null {
  const head = headOf(x.path, x.doc);
  if (!head) return null;
  const { ok } = usableSentences(sentencesOf(x.doc, x.nowMs, x.sbGate), head, x.lex.k === 'pv');
  const de = typeof x.doc.de === 'string' ? x.doc.de.trim() : '';
  return {
    path: x.path,
    key: `w${x.i + 1}`,
    head,
    word: baseAnswer(head),
    de,
    kind: x.lex.k,
    lv: x.lex.lv,
    example: ok[0]?.sent.en ?? null,
    shows: ok.slice(0, SHOW_MAX).map(shownOf),
    partners: partnersOf(x.doc),
  };
}

/** Rahmen des eigenen Satzes: Arbeits-Lage, je Wort und Tag fest, wechselt von Tag zu Tag. */
export function ownFrame(path: string, day: string): TransferFrame {
  return WORK[hash32(`${path}|${day}|own`) % WORK.length]!;
}

/**
 * Karte zu einer Anwenden- oder Eigener-Satz-Aufgabe. `null` = keine Karte (Form passt nicht, kein Wort mit Stichwort).
 * `lookup` liefert Dokument, Lexem und Lehrerdaten je Pfad; `lastLife` = letzter Tag mit Alltags-Lage (`vmod/use.life`).
 */
export function modelOfUse(x: {
  task: Task;
  lookup: (path: string) => { doc: Doc; lex: Lex; teach: Teach } | null;
  nowMs: number;
  sbGate: unknown;
  lastLife: string | null;
}): UseModel | null {
  const { task } = x;
  if (task.form !== 'transfer' && task.form !== 'own') return null;
  const day = dayKey(x.nowMs);
  const paths = task.form === 'transfer' ? (task.group ?? [task.path]) : [task.path];
  const targets: UseTarget[] = [];
  for (const path of paths) {
    const it = x.lookup(path);
    if (!it) continue;
    const t = targetFor({ path, ...it, nowMs: x.nowMs, sbGate: x.sbGate, i: targets.length });
    if (t) targets.push(t);
  }
  if (!targets.length) return null;
  const frame = task.form === 'transfer' ? frameFor(day, x.lastLife) : ownFrame(task.path, day);
  return { form: task.form, targets, frame, sit: situationFor(frame, day, SIT_COUNT), evidence: task.why === 'evidence' };
}

/** Ziel im Prompt-Format. */
export const promptTarget = (t: UseTarget): VocabTarget => ({ key: t.key, word: t.word, meaning: t.de, kind: t.kind, example: t.example });

/** Wie viele Erklärungen offen stehen (Synthese §2.5: nie mehr als zwei Korrekturen auf einmal). */
export const OPEN_MAX = 2;

/** Reihenfolge der Zeilen und welche Erklärungen aufgeklappt sind: falsch vor fast richtig, dann der Rest in Zielreihenfolge. */
export function openWhys(words: readonly Pick<WordJudgement, 'key' | 'v'>[]): Set<string> {
  const rank = (v: WordJudgement['v']) => (v === 'wrong' ? 0 : v === 'odd' ? 1 : 9);
  const errs = words.filter((w) => rank(w.v) < 9).sort((a, b) => rank(a.v) - rank(b.v));
  return new Set(errs.slice(0, OPEN_MAX).map((w) => w.key));
}

/** Verlaufs-Ausgang einer Verwendung: die Note-Ausgänge aus `outcomeOfUse`; ohne Note `odd` (zu dünn) bzw. `dunno` (nicht benutzt). */
export function outcomeOfUseLog(u: Pick<UseInput, 'v' | 'err' | 'evade'>, k: LexKind): Outcome {
  return outcomeOfUse(u.v, u.err, k, u.evade) ?? (u.v === 'thin' ? 'odd' : 'dunno');
}

/** Antwort für Verlauf und Spiegel der alten Felder (`ms` = Schreibzeit des Textes; Kennzeichen „später geprüft“ bei nachgeholter Prüfung). */
export function answerOfUse(u: UseInput, k: LexKind, ms: number, later: boolean): Answer {
  const hit = u.at && (u.evade || (u.v === 'wrong' && u.err === 'word')) ? u.at : null;
  return { t: u.t, form: u.form, outcome: outcomeOfUseLog(u, k), hint: 0, ms: Math.max(0, Math.round(ms)), fk: 0, sentence: null, anchor: null, hit, ...(later ? { flags: FLAG.later } : {}) };
}
