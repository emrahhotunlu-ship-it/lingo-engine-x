import type { UsHint } from './types';

// Beide Formen von `writing/*` für den Verlauf (Plan §3.7, altapp §5):
// - `writing/w<ms>` (Schreibaufgabe): res.errors [{orig, fix, cat, sev, why}]
// - `writing/lesson-<lid>-<ms>` (Lektion, Phase 2): res.errors [{wrong, right, why, cat, sev}]
// Gelesen wird tolerant; fehlende Felder bleiben leer. Nichts wird zurückgeschrieben.

type Doc = Readonly<Record<string, unknown>>;
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

export type WritingErrorView = { orig: string; fix: string; cat: string; sev: 'minor' | 'major'; why: string; topic: string | null };

export type WritingResView = {
  cefr: string | null;
  scores: Partial<Record<'task' | 'grammar' | 'vocabulary' | 'coherence' | 'register', number>>;
  summary: string;
  strengths: string[];
  errors: WritingErrorView[];
  usHints: UsHint[];
  improved: string;
  upgrades: string[];
  phrases: string[];
  next: string;
  /** Sprache der Rückmeldung (`res.lang`), bei Altdaten `null`. */
  lang: 'de' | 'en' | null;
};

export type WritingView = {
  id: string;
  kind: 'task' | 'lesson';
  date: string;
  t: number;
  title: string;
  task: string;
  genre: string;
  promptId: string;
  lesson: string;
  text: string;
  words: number;
  rev: number;
  res: WritingResView | null;
};

const SCORE_KEYS = ['task', 'grammar', 'vocabulary', 'coherence', 'register'] as const;

function errorOf(raw: unknown): WritingErrorView | null {
  const e = obj(raw);
  const orig = str(e.orig) || str(e.wrong);
  const fix = str(e.fix) || str(e.right);
  if (!orig && !fix) return null;
  return { orig, fix, cat: str(e.cat) || 'other', sev: e.sev === 'major' ? 'major' : 'minor', why: str(e.why), topic: str(e.topic) || null };
}

export function normalizeRes(raw: unknown): WritingResView | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = obj(raw);
  const scoresRaw = obj(r.scores);
  const scores: WritingResView['scores'] = {};
  for (const k of SCORE_KEYS) {
    const v = num(scoresRaw[k]);
    if (v !== null) scores[k] = Math.max(1, Math.min(5, Math.round(v)));
  }
  const usHints: UsHint[] = Array.isArray(r.usHints)
    ? r.usHints.map((h) => ({ orig: str(obj(h).orig), us: str(obj(h).us) })).filter((h) => h.orig && h.us)
    : [];
  return {
    cefr: str(r.cefr) || null,
    scores,
    summary: str(r.summary),
    strengths: strList(r.strengths),
    errors: Array.isArray(r.errors) ? r.errors.map(errorOf).filter((e): e is WritingErrorView => e !== null) : [],
    usHints,
    improved: str(r.improved),
    upgrades: strList(r.upgrades),
    phrases: strList(r.phrases),
    next: str(r.next),
    lang: r.lang === 'de' || r.lang === 'en' ? r.lang : null,
  };
}

/** Zeitpunkt aus `t` oder aus der Kennung (`w<ms>`, `lesson-<lid>-<ms>`). */
function timeOf(id: string, doc: Doc): number {
  const t = num(doc.t);
  if (t !== null) return t;
  const m = /(\d{12,14})$/.exec(id);
  return m ? Number(m[1]) : 0;
}

export function normalizeWriting(id: string, doc: Doc): WritingView {
  const lesson = str(doc.lesson);
  const kind: WritingView['kind'] = lesson || id.startsWith('lesson-') ? 'lesson' : 'task';
  const text = str(doc.text);
  const words = num(doc.words) ?? (text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
  return {
    id,
    kind,
    date: str(doc.date),
    t: timeOf(id, doc),
    title: str(doc.title),
    task: str(doc.task),
    genre: str(doc.genre),
    promptId: str(doc.promptId),
    lesson,
    text,
    words,
    rev: num(doc.rev) ?? 0,
    res: normalizeRes(doc.res),
  };
}
