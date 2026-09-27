import type { Persona, Turn } from '../domain/speak/types';
import { clip, header } from './common';
import type { ChatTemplate, ModelTier } from './types';

// roleplay-turn@1 (Plan §6.2, D1): die KI-Figur antwortet im Rollenspiel – als gestreamter Text,
// nie als JSON. Die Figur korrigiert NIE (die Analyse läuft getrennt). Stufe `quick` (D1):
// `sample.d.ts` empfiehlt sie für „conversational replies where snappiness matters“; `default`
// denkt vor der ersten Silbe 5–60 s nach und zerstört am Handy den Gesprächsfluss.
// Abweichung vom Wortlaut von Kap. 10 – learning-scientist bestätigt einmal, Emrah wird informiert.

export const FIGURE_TIER: ModelTier = 'quick';

export type RoleplayTurnVars = {
  title: string;
  situation: string;
  /** Ziel des Lernenden – die Figur kennt es nicht als Auftrag, nur als Hintergrund für Druck. */
  goal: string;
  persona: Persona;
  stake: string;
  objection: string;
  /** Berufskontext des Lernenden (≤ 300). */
  ctx: string;
  focusWords: readonly string[];
  /** Verlauf inkl. Eröffnung (Figur) und dem neuen eigenen Zug am Ende. */
  turns: readonly Turn[];
};

export const RP_HISTORY_MAX = 16;
export const RP_MY_MAX = 600;
export const RP_PERSONA_MAX = 800;
export const RP_CTX_MAX = 300;

const ID = 'roleplay-turn';
const VERSION = 1;

/** Regieanweisungen, Namenspräfix, Markdown und umschließende Anführungszeichen entfernen. */
/** Wörter, die mit Doppelpunkt einen Satz einleiten und kein Sprechername sind. */
const LEAD_WORDS = new Set(['look', 'listen', 'honestly', 'frankly', 'okay', 'ok', 'well', 'fine', 'sure', 'right', 'yes', 'no', 'so', 'now', 'first', 'second', 'third', 'finally', 'again', 'seriously', 'note', 'fact', 'truth', 'point', 'problem', 'question', 'answer', 'reality', 'option', 'result', 'basically', 'remember', 'here', 'thing', 'bottom', 'summary', 'update', 'agreed', 'correct', 'exactly', 'please', 'wait', 'careful', 'warning', 'important']);

export function cleanFigureText(text: string): string {
  let s = text.replace(/\r/g, '');
  // Regieanweisungen: *leans back*, _pauses_, [sighs], (smiles) – nur kurze, eigenständige Klammern.
  s = s.replace(/\*[^*\n]{1,80}\*(?!\*)/g, (m) => (/^\*\*/.test(m) ? m : ' '));
  s = s.replace(/(^|\s)_[^_\n]{1,80}_(?=\s|$)/g, ' ');
  s = s.replace(/\[[^\]\n]{1,80}\]/g, ' ');
  // Runde Klammern nur am Anfang, nach Satzende oder ganz am Ende – mitten im Satz ist die
  // Klammer Inhalt („40k a year (about a third of our budget) for this").
  s = s.replace(/(^|[.!?])(\s*)\((?:[a-z][^)\n]{0,78})\)(?=\s|$)/g, '$1 ');
  s = s.replace(/\s\((?:[a-z][^)\n]{0,78})\)\s*$/, ' ');
  // Markdown-Reste.
  s = s.replace(/\*\*/g, '').replace(/^#+\s*/gm, '');
  s = s.replace(/\s+/g, ' ').trim();
  // Namenspräfix „Reinhard Vogt:“ / „Dr. Martin Kessler (CFO):“ – mindestens zwei Namensteile.
  s = s.replace(/^((?:Dr\.|Mr\.|Ms\.|Mrs\.|Prof\.)\s+)?[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3}(?:\s*\([^)]{1,40}\))?\s*:\s+/, (m, title: string | undefined) =>
    title || /\s/.test(m.replace(/\s*:\s+$/, '').trim()) ? '' : m,
  );
  // Einteiliges Namenspräfix „Sandra: Look, …“ – nur vor einem neuen Satz (Großbuchstabe oder
  // Anführungszeichen) und nicht bei Einleitungswörtern wie „Look: This …“.
  s = s.replace(/^([A-Z][a-z'’-]{1,20}):\s+(?=["“„'‘]?[A-Z])/, (m, word: string) => (LEAD_WORDS.has(word.toLowerCase()) ? m : ''));
  // Umschließende Anführungszeichen.
  const q = /^["“„'‘](.*)["”“'’]$/.exec(s);
  if (q?.[1] && !/["“”„]/.test(q[1])) s = q[1].trim();
  return s.trim();
}

export const roleplayTurn: ChatTemplate<RoleplayTurnVars> = {
  id: ID,
  version: VERSION,
  tier: FIGURE_TIER,
  cache: false,
  buildTurns(v) {
    const p = v.persona;
    const rules = [
      header({ id: ID, version: VERSION }),
      `You play ${clip(p.name, 80)}, ${clip(p.role, 80)} at ${clip(p.org, 120)}, in a spoken business role-play with a German-speaking professional who is practicing English (B2, aiming for C1).`,
      `Scene: ${clip(v.title, 160)}. ${clip(v.situation, 700)}`,
      `Your character: ${clip(p.traits, 300)}`,
      `What you want: ${clip(v.stake, 300)}`,
      `Your objection: ${clip(v.objection, 300)}`,
      `The other person's aim (never mention it): ${clip(v.goal, 300)}`,
      `Their professional background: ${clip(v.ctx, RP_CTX_MAX) || '(unknown)'}`,
      v.focusWords.length ? `Where natural, use some of these words yourself: ${v.focusWords.slice(0, 8).map((w) => clip(w, 40)).join(', ')}.` : '',
      'Rules:',
      '- Stay in character. Reply with ONLY your next spoken line: 1–4 sentences, at most 80 words, American English, natural C1 business speech.',
      '- Never correct, praise or comment on their English. Never explain the exercise. No stage directions, no name prefix, no quotes, no Markdown, no lists.',
      '- Push back according to your objection and ask a pointed follow-up question when an answer stays vague. Concede only to concrete, convincing arguments.',
      '- If they write in German or another language, stay in character and politely ask them to continue in English.',
      '- Do not invent facts about their company; ask instead.',
      'The conversation follows. Your earlier lines are the assistant turns.',
    ]
      .filter(Boolean)
      .join('\n');
    const history = v.turns.slice(-RP_HISTORY_MAX).map(
      (t): Claude.sample.SampleMessage => ({
        role: t.role === 'persona' ? 'assistant' : 'user',
        content: clip(t.text, t.role === 'persona' ? RP_PERSONA_MAX : RP_MY_MAX) || '…',
      }),
    );
    return [{ role: 'user', content: rules }, ...history];
  },
  clean: cleanFigureText,
};
