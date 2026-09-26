import { TOPICS } from '../content';

// Lernstand-Kurzfassung für den Begleiter und die Stundenvorbereitung (Phase 5 §6.1).
// Aus Daten, die ohnehin live geladen sind (kein neues Abo), höchstens 2.500 Zeichen.

type Doc = Readonly<Record<string, unknown>>;

export const BRIEF_MAX = 2_500;

export type BriefInput = {
  assess: Doc | null | undefined;
  grammar: ReadonlyMap<string, Doc> | undefined;
  vocab: ReadonlyMap<string, Doc> | undefined;
  uiLang: 'de' | 'en';
  /** Pflicht heute erledigt? `null` = unbekannt. */
  pflichtDone: boolean | null;
};

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

function oneLine(s: string, max: number): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  const chars = Array.from(flat);
  return chars.length <= max ? flat : chars.slice(0, max - 1).join('') + '…';
}

export type OpenError = { wrong: string; right: string; topic: string };

/** Offene Grammatikfehler (nicht erledigt), neueste zuerst. */
export function openGrammarErrors(grammar: ReadonlyMap<string, Doc> | undefined, max: number): OpenError[] {
  const out: Array<OpenError & { t: number }> = [];
  const seen = new Set<string>();
  for (const [id, g] of grammar ?? []) {
    const errs = Array.isArray(g.errors) ? (g.errors as unknown[]) : [];
    for (const e of errs) {
      const o = obj(e);
      if (o.done === true) continue;
      const wrong = str(o.given) || str(o.q);
      const right = str(o.ans);
      if (!wrong || !right || wrong === right || seen.has(wrong.toLowerCase())) continue;
      seen.add(wrong.toLowerCase());
      out.push({ wrong: oneLine(wrong, 200), right: oneLine(right, 200), topic: id, t: num(o.t) ?? 0 });
    }
  }
  return out
    .sort((a, b) => b.t - a.t)
    .slice(0, max)
    .map(({ wrong, right, topic }) => ({ wrong, right, topic }));
}

/** Hartnäckige Wörter (≥ 4 Fehler), die meisten Fehler zuerst. */
export function stubbornWords(vocab: ReadonlyMap<string, Doc> | undefined, max: number): string[] {
  const rows: Array<{ w: string; l: number }> = [];
  for (const v of vocab?.values() ?? []) {
    const l = num(v.lapses) ?? 0;
    const w = str(v.word);
    if (w && l >= 4 && v.hidden !== true) rows.push({ w, l });
  }
  return rows
    .sort((a, b) => b.l - a.l || a.w.localeCompare(b.w))
    .slice(0, max)
    .map((r) => r.w);
}

/** Die schwächsten Grammatikthemen nach Beherrschung `p` (Voreinstellung p0, falls nie geübt). */
export function weakestTopics(grammar: ReadonlyMap<string, Doc> | undefined, uiLang: 'de' | 'en', max: number): Array<{ id: string; name: string; p: number }> {
  return TOPICS.map((t) => {
    const p = num(grammar?.get(t.id)?.p) ?? t.p0;
    return { id: t.id, name: uiLang === 'en' ? (t.name_en ?? t.name) : t.name, p };
  })
    .sort((a, b) => a.p - b.p || a.id.localeCompare(b.id))
    .slice(0, max);
}

export function learnerBrief(i: BriefInput): string {
  const lines: string[] = [];
  const a = obj(i.assess);
  const data = a.data && typeof a.data === 'object' ? obj(a.data) : a;
  const level = str(data.cefr) || str(data.level);
  if (level) lines.push(`Level: ${oneLine(str(data.cefr) ? `${str(data.cefr)} – ${str(data.level)}` : level, 240)}`);
  const focus = str(obj(data.focus).title);
  if (focus) lines.push(`Current focus: ${oneLine(focus, 120)}`);
  const blockers = (Array.isArray(data.blockers) ? (data.blockers as unknown[]) : [])
    .map((b) => str(obj(b).title))
    .filter(Boolean)
    .slice(0, 3);
  if (blockers.length) lines.push(`Main blockers: ${blockers.map((b) => oneLine(b, 80)).join('; ')}`);
  const weak = weakestTopics(i.grammar, i.uiLang, 3);
  if (weak.length) lines.push(`Weakest grammar topics: ${weak.map((w) => `${w.name} (${Math.round(w.p * 100)}%)`).join('; ')}`);
  const errs = openGrammarErrors(i.grammar, 5);
  if (errs.length) lines.push(`Open grammar mistakes (learner → correct):\n${errs.map((e) => `- ${e.wrong} → ${e.right}`).join('\n')}`);
  const words = stubbornWords(i.vocab, 5);
  if (words.length) lines.push(`Stubborn words: ${words.join(', ')}`);
  if (i.pflichtDone !== null) lines.push(`Daily review done today: ${i.pflichtDone ? 'yes' : 'no'}`);
  const text = lines.join('\n') || '(no data yet)';
  return Array.from(text).length <= BRIEF_MAX ? text : Array.from(text).slice(0, BRIEF_MAX - 1).join('') + '…';
}
