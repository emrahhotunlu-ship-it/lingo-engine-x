import { z } from 'zod';
import { block, clip, correctionRules, fenced, header, langName, withFixedGate, type PromptTemplate, type UiLang } from '../shared';
import { asRecheck, blank, RECHECK_LINE, sharedRules, SPOKEN_RULE, targetLine, type VocabTarget } from './common';
import { checkExtra, checkFixed, isError, judgeOne, rawExtra, rawJudgement, type ExtraFix, type WordJudgement } from './judge';
import { clipped } from '../shared';

// vocab-transfer@1 (Großpaket A Schritt 5; plan.md §7 „Anwenden“, synthese.md §2.5): kurzer Text zu einer echten Lage (Mail, Slack, Call, Präsentation,
// einmal pro Woche Alltag) mit 3–5 eigenen Wörtern der Stufen 4–6. Claude urteilt je Zielwort (✓ ok · ~ odd · ✕ wrong · thin · unused) mit einem Satz
// Begründung, nennt höchstens einen weiteren Fehler und liefert eine minimal korrigierte Fassung. Die Note je Wort rechnet die App (domain), nie Claude.
// `default`, kein Zwischenspeicher (jede Antwort ist neu getippt); Einspruch „War das auch richtig?“ = `transferRecheck` (`complex`, kein Zwischenspeicher).
// Ein Neuversuch nur bei Schemaverletzung (A6.3); `lenient` für dessen Antwort: Widersprüche fallen sicher auf „keine Note“.

export const TRANSFER_FRAMES = ['mail', 'slack', 'call', 'pitch', 'life'] as const;
export type TransferFrame = (typeof TRANSFER_FRAMES)[number];

export const TRANSFER_TARGETS_MIN = 3;
export const TRANSFER_TARGETS_MAX = 5;
export const TRANSFER_TEXT_MAX = 1200;
export const TRANSFER_TASK_MAX = 300;
export const TRANSFER_FIXED_MAX = 1600;

export type TransferVars = {
  frame: TransferFrame;
  /** Lage, wie die App sie zeigt (Oberflächensprache), z. B. „Der Kunde will den Termin verschieben. Schlag einen neuen vor.“ */
  task: string;
  targets: VocabTarget[];
  text: string;
  /** Per Diktat gesprochen (zählt als gesprochener Beleg; Satzzeichen und Hörfehler sind keine Fehler). */
  spoken: boolean;
  uiLang: UiLang;
  /** Einspruch: zweite, genauere Prüfung. */
  recheck?: boolean;
};

export type TransferOut = {
  /** Je Zielwort ein Urteil, in der Reihenfolge von `targets`. */
  words: WordJudgement[];
  extra: ExtraFix | null;
  /** Minimal korrigierte Fassung; "" wenn nichts zu korrigieren ist. */
  fixed: string;
  fixedUnsure?: boolean;
};

const FRAME_EN: Record<TransferFrame, string> = {
  mail: 'an email to a client (polite, neutral to formal)',
  slack: 'a Slack message to a colleague (short, friendly, casual)',
  call: 'a spoken answer to an objection in a client call (polite, clear, spoken style)',
  pitch: 'a sentence or two for a presentation (clear, confident, neutral)',
  life: 'a message in everyday or family life (casual)',
};

export const TRANSFER_EXAMPLE =
  '{"words":[{"key":"w1","v":"ok","err":null,"at":"…","why":"…"},{"key":"w2","v":"odd","err":"colloc","at":"…","why":"…"},{"key":"w3","v":"unused","err":null,"at":"","why":""}],"extra":null,"fixed":"…"}';

const ID = 'vocab-transfer';
const VERSION = 1;

const needsFix = (o: Pick<TransferOut, 'words' | 'extra'>): boolean => o.words.some(isError) || o.extra !== null;

/** Einträge Claudes einem Zielwort zuordnen: über `key`, hilfsweise über das Stichwort selbst. */
function entryFor(list: ReadonlyArray<Record<string, unknown>>, t: VocabTarget): Record<string, unknown> | undefined {
  const norm = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
  return list.find((e) => norm(e.key) === t.key.toLowerCase()) ?? list.find((e) => norm(e.key) === t.word.trim().toLowerCase() || norm(e.word) === t.word.trim().toLowerCase());
}

const rawWord = z.object(rawJudgement);

function schemaFor(v: TransferVars, lenient: boolean): z.ZodType<TransferOut> {
  const opts = (path: PropertyKey[]) => ({ text: v.text, lang: v.uiLang, lenient, path });
  const inner = z
    .object({
      words: z.array(z.record(z.string(), z.unknown())),
      extra: rawExtra,
      fixed: z.preprocess(blank, clipped(0, TRANSFER_FIXED_MAX)),
    })
    .transform((raw, ctx): TransferOut => {
      const words = v.targets.map((t, i): WordJudgement => {
        const e = entryFor(raw.words, t);
        const parsed = e ? rawWord.safeParse(e) : null;
        if (!parsed?.success) {
          if (!lenient) ctx.addIssue({ code: 'custom', path: ['words', i], message: `give exactly one valid entry for ${t.key} ("${t.word}")` });
          return { key: t.key, v: 'unused', err: null, at: '', why: '' };
        }
        return judgeOne(t, parsed.data, ctx, opts(['words', i]));
      });
      const extra = checkExtra(raw.extra, words, ctx, opts(['extra']));
      const fixed = checkFixed(raw.fixed, v.targets, words, needsFix({ words, extra }), ctx, opts(['fixed']));
      return { words, extra, fixed };
    });
  return withFixedGate<TransferOut>(inner, { needs: needsFix, lenient });
}

export const transfer: PromptTemplate<TransferVars, TransferOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: false,
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'A German-speaking learner (B2, aiming for C1, business English) wrote a short text for a real situation and had to use the target words below. Judge how each target word is used.',
      `Text type: ${FRAME_EN[v.frame]}`,
      `Situation (shown to the learner in ${langName(v.uiLang)}): ${clip(v.task, TRANSFER_TASK_MAX)}`,
      'Target words (the learner saw them in base form; choosing the right form is part of the task):',
      ...v.targets.map(targetLine),
      'Learner text:',
      fenced(block(v.text, TRANSFER_TEXT_MAX)),
      ...(v.spoken ? [SPOKEN_RULE] : []),
      ...(v.recheck ? [RECHECK_LINE] : []),
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object in this format:',
      TRANSFER_EXAMPLE,
      'Rules:',
      `- words: exactly one entry per target key (${v.targets.map((t) => t.key).join(', ')}), in this order.`,
      '- v: "ok" = used in the right sense, correct and natural here; "odd" = understandable but unnatural, or a small error at the word (wrong form, preposition, partner word or tone); "wrong" = wrong sense, or a different or confused word instead of the target; "thin" = correct but in a trivial sentence that shows no real use ("I like leverage.") or copied from the card example; "unused" = the target does not appear.',
      '- Check the sense of each word in this context, not only that it appears. A correct use in a different but valid sense of the word is "ok".',
      '- err: only for "odd" and "wrong", one of sense, word, form, prep, colloc, register, other; otherwise null.',
      '- at: the exact words of the learner text where the target (or the attempt) stands, copied character by character; "" for unused.',
      '- why: one short sentence for every target except unused. If it is right, name what exactly works; if not, say what is wrong and why.',
      '- extra: at most one other clear error in the text (not at a target word) as {"from": exact words from the text, "to": the correction, "why": one sentence}; null if there is none or if two target words already have errors. Never more than two corrections in total.',
      '- fixed: "" if no target is "odd" or "wrong" and extra is null. Otherwise the learner text with the errors fixed:',
      ...correctionRules(),
      '  Keep every target word the learner used correctly. Do not rewrite the text in your own style, do not add new or rarer words, keep the length.',
      '- Tone: the text type sets the tone. A word that is too formal or too casual for it is "odd" with err "register".',
      ...sharedRules(),
    ].join('\n');
  },
  schema: (v) => schemaFor(v, false),
  lenient: (v) => schemaFor(v, true),
};

/** Einspruch „War das auch richtig?“: einmal, nur auf Antippen, `complex`, ohne Zwischenspeicher; die Variablen tragen `recheck: true`. */
export const transferRecheck = asRecheck(transfer);
