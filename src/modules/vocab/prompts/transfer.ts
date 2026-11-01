import { z } from 'zod';
import { block, clip, correctionRules, fenced, header, langName, withFixedGate, type PromptTemplate, type UiLang } from '../shared';
import { asRecheck, blank, falseFriendRule, hasTarget, recheckLines, sharedRules, SPOKEN_RULE, targetLine, verdictRules, type FirstVerdict, type VocabTarget } from './common';
import { checkExtra, checkFixed, isError, judgeOne, rawExtra, rawJudgement, type ExtraFix, type WordJudgement } from './judge';
import { clipped } from '../shared';

// vocab-transfer@1 (Großpaket A Schritt 5; plan.md §7 „Anwenden“, synthese.md §2.5): kurzer Text zu einer echten Lage (Mail, Slack, Call, Präsentation,
// einmal pro Woche Alltag) mit 3–5 eigenen Wörtern der Stufen 4–6. Claude urteilt je Zielwort (✓ ok · ~ odd · ✕ wrong · thin · unused) mit einem Satz
// Begründung, nennt höchstens einen weiteren Fehler (nur wenn alle Zielwörter fehlerfrei sind), liefert eine minimal korrigierte Fassung und eine
// verdeckte flüssige Fassung (`better`, erst nach „Nochmal selbst schreiben“ sichtbar). Die Note je Wort rechnet die App (domain/apply.ts), nie Claude.
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
  /** Einspruch: das erste Urteil je Zielwort (zweite, unabhängige Prüfung; `sample` hat kein Gedächtnis). */
  first?: FirstVerdict[];
};

export type TransferOut = {
  /** Je Zielwort ein Urteil, in der Reihenfolge von `targets`. */
  words: WordJudgement[];
  extra: ExtraFix | null;
  /** Minimal korrigierte Fassung; "" wenn nichts zu korrigieren ist. */
  fixed: string;
  fixedUnsure?: boolean;
  /** Verdeckte Vergleichsfassung: der eigene Text flüssig, mit ALLEN Zielwörtern im gelernten Sinn; "" ohne (oder wenn eines fehlt). */
  better: string;
};

const FRAME_EN: Record<TransferFrame, string> = {
  mail: 'an email to a client (polite, neutral to formal)',
  slack: 'a Slack message to a colleague (short, friendly, casual)',
  call: 'a spoken answer to an objection in a client call (polite, clear, spoken style)',
  pitch: 'two to four sentences for a presentation (clear, confident, neutral)',
  life: 'a message in everyday or family life (casual)',
};

export const TRANSFER_EXAMPLE =
  '{"words":[{"key":"w1","v":"ok","err":null,"at":"…","why":"…"},{"key":"w2","v":"odd","err":"colloc","at":"…","why":"…"},{"key":"w3","v":"unused","err":null,"at":"","why":""}],"extra":null,"fixed":"…","better":"…"}';

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
  const opts = (path: PropertyKey[]) => ({ text: v.text, lang: v.uiLang, lenient, spoken: v.spoken, path });
  const inner = z
    .object({
      words: z.array(z.record(z.string(), z.unknown())),
      extra: rawExtra,
      fixed: z.preprocess(blank, clipped(0, TRANSFER_FIXED_MAX)),
      better: z.preprocess(blank, clipped(0, TRANSFER_FIXED_MAX)),
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
      // Vergleichsfassung: nur mit allen Zielwörtern und anders als der eigene Text; sonst leer (kein Neuversuch nötig).
      const b = raw.better.trim();
      const better = b && v.targets.every((t) => hasTarget(b, t)) && b !== v.text.trim() ? b : '';
      return { words, extra, fixed, better };
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
      ...(v.first ? recheckLines(v.first) : []),
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object in this format:',
      TRANSFER_EXAMPLE,
      'Rules:',
      `- words: exactly one entry per target key (${v.targets.map((t) => t.key).join(', ')}), in this order. Judge every target honestly, even if more than two have errors.`,
      ...verdictRules('text'),
      '- extra: at most one other clear error in the text (not at a target word) as {"from": exact words from the text, "to": the correction, "why": one sentence}; null if there is none or if any target is "odd" or "wrong".',
      '- fixed: "" if no target is "odd" or "wrong" and extra is null. Otherwise the learner text with the errors fixed:',
      ...correctionRules(),
      '  Keep every target word the learner used correctly. Do not rewrite the text in your own style, do not add new or rarer words, keep the length. Besides the errors you explain, fix only clear errors; never change style, and do not report these extra fixes anywhere.',
      '- better: the learner text rewritten as a fluent American professional would write it for this situation, using ALL target words in the meaning given. Keep the learner\'s ideas and length; use only the learner\'s words, the targets and very common words. Give it also when everything is "ok".',
      falseFriendRule(),
      ...sharedRules(),
    ].join('\n');
  },
  schema: (v) => schemaFor(v, false),
  lenient: (v) => schemaFor(v, true),
};

/** Einspruch „War das auch richtig?“: einmal, nur auf Antippen, `complex`, ohne Zwischenspeicher; das erste Urteil (`first`) ist Pflicht. */
export const transferRecheck = asRecheck<TransferVars, TransferOut, FirstVerdict[]>(transfer);
