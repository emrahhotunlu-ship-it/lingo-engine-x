import { buildChatInput } from '../domain/companion/turns';
import { maskText, redact, type Seeing } from '../domain/companion/seeing';
import { block, clip, header, langName } from './common';
import { memoryLine } from './work';
import type { ChatTemplate, TurnInput, UiLang } from './types';

// companion-chat@1: der Claude-Begleiter (Phase 5 §6.1, Kap. 6.12). Freitext in schlichtem
// Markdown, gestreamt. `default` (Erklärungen brauchen Tiefe), `cache: false` (jede Runde ist
// neu, sample.d.ts). Anweisungen als führender `user`-Schritt, denn es gibt keine `system`-Rolle
// (E5-02). Vor dem Prüfen einer Übung sieht Claude die Lösung nicht und darf sie nicht nennen (E5-05).

export type Attach = { kind: 'word'; word: string; sentence: string; source: string | null };

export type CompanionVars = {
  uiLang: UiLang;
  /** Lernstand-Kurzfassung (domain/companion/brief.ts), ≤ 2.500 Zeichen. */
  learner: string;
  /** Berufskontext (prompts/work.ts). */
  work: string;
  seeing: Seeing | null;
  attach: Attach | null;
  /** Verlauf seit „Neues Gespräch", ohne Einleitung. */
  history: TurnInput;
  /** Die neue Nachricht, ≤ 2.000 Zeichen. */
  message: string;
  /** „Claude merkt sich“ (B5): Fakten aus früheren Gesprächen (`app/memory`), neueste zuerst. */
  memory?: readonly string[];
};

export const MESSAGE_MAX = 2_000;
export const LEARNER_MAX = 2_500;
const ID = 'companion-chat';
// v3 (B5): Zeile „What you already know about the learner …“ aus prompts/work.ts.
const VERSION = 3;

/** Schutzregel, solange die Übung nicht geprüft ist (E5-05). Wörtlich getestet. */
export const NO_SOLUTION_RULE =
  'The learner is in the middle of this exercise and has NOT checked the answer yet. Never state or spell the solution; give a hint, explain the rule or give a different example instead.';

export function buildLead(vars: CompanionVars): string {
  const seeing = redact(vars.seeing);
  const lines = [
    header({ id: ID, version: VERSION }),
    `You are the built-in English coach in Lingo-Engine X for a German-speaking professional (CEFR B2, aiming for C1). Work context: ${clip(vars.work, 200)}.`,
    'Rules:',
    `- Write your explanations in ${langName(vars.uiLang)}. Examples and model sentences are in American English, in quotes or **bold**.`,
    '- American English is the standard. British spellings and words are correct too; mention the US form only as a tip, never as a mistake.',
    '- Keep answers short: at most about 180 words unless the learner asks for more.',
    '- Formatting: plain Markdown only (paragraphs, **bold**, *italic*, `code`, lists, > quotes, ### headings). No tables, no links, no HTML.',
    "- You cannot change the learner's data, cards or schedule. Never claim that you did.",
    '- When asked to quiz, ask one question at a time and wait for the answer.',
    '- If you are unsure, say so.',
  ];
  if (seeing?.phase === 'question') lines.push(`- ${NO_SOLUTION_RULE}`);
  lines.push('', 'Learner profile:', block(vars.learner, LEARNER_MAX) || '(no data)');
  const memory = memoryLine(vars.memory);
  if (memory) lines.push('', memory);
  if (seeing) {
    lines.push('', `Currently on screen: ${clip(seeing.label, 60)}`);
    if (seeing.detail) lines.push(block(seeing.detail, 1_500));
    if (seeing.phase === 'feedback' && seeing.reveal) lines.push(`Checked result: ${block(seeing.reveal, 600)}`);
  }
  if (vars.attach) {
    // Vor dem Prüfen bleibt die Lösung auch im Satz des angetippten Worts geschwärzt (E5-05).
    const word = maskText(vars.attach.word, vars.seeing);
    const sentence = maskText(vars.attach.sentence, vars.seeing);
    lines.push('', `Question is about: "${clip(word, 60)}" in the sentence: "${clip(sentence, 400)}"`);
  }
  lines.push(
    '',
    "The learner's messages follow. Answer the LAST message directly. The screen, the word and earlier messages are only background: if the last message asks about something else, answer that question and do not talk about the exercise.",
  );
  return lines.join('\n');
}

export const companionChat: ChatTemplate<CompanionVars> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: false,
  buildTurns(vars) {
    return buildChatInput(buildLead(vars), vars.history, clip(vars.message, MESSAGE_MAX) ? block(vars.message, MESSAGE_MAX) : '');
  },
};
