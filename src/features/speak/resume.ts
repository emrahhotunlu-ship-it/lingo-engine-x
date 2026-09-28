import { readGoalMarks, type GoalMark } from '../../domain/speak/goals';
import type { AnalysisSlot, Turn } from '../../domain/speak/types';
import { KEY_PREFIX, local } from '../../platform/storage';

// Fortsetzen nach einem Neuladen (Plan §5.2): Kopie des laufenden Gesprächs im Browser-Speicher
// (Bequemlichkeit, Kap. 3.1). Nur fertige Analysen, höchstens 40 KB. Jeder Zugriff ist über
// platform/storage abgesichert. Nach dem Speichern des Berichts wird die Kopie gelöscht.

/** `goals`: Ziel-Checkliste (N72), damit die Haken ein Neuladen überstehen. */
export type ResumeCopy = { v: 1; turns: Turn[]; analyses: Record<number, AnalysisSlot>; startedAt: number; day: string; taken: string[]; goals?: GoalMark[] };

export const RESUME_MAX_BYTES = 40_000;
const key = (sceneId: string) => `${KEY_PREFIX}roleplay:${sceneId}`;

const isTurn = (t: unknown): t is Turn =>
  !!t && typeof t === 'object' && ((t as Turn).role === 'me' || (t as Turn).role === 'persona') && typeof (t as Turn).text === 'string' && typeof (t as Turn).t === 'number';

export function readResume(sceneId: string, today: string): ResumeCopy | null {
  const raw = local.getJson<Partial<ResumeCopy>>(key(sceneId));
  if (!raw || raw.v !== 1 || raw.day !== today || !Array.isArray(raw.turns) || typeof raw.startedAt !== 'number') return null;
  const turns = raw.turns.filter(isTurn);
  if (!turns.some((t) => t.role === 'me')) return null;
  const analyses: Record<number, AnalysisSlot> = {};
  for (const [k, a] of Object.entries(raw.analyses ?? {})) {
    if (a && typeof a === 'object' && a.state === 'done' && a.data) analyses[Number(k)] = a;
  }
  return {
    v: 1,
    turns,
    analyses,
    startedAt: raw.startedAt,
    day: raw.day,
    taken: Array.isArray(raw.taken) ? raw.taken.filter((x): x is string => typeof x === 'string') : [],
    goals: readGoalMarks(raw.goals),
  };
}

export function writeResume(sceneId: string, copy: ResumeCopy): void {
  const analyses = Object.fromEntries(Object.entries(copy.analyses).filter(([, a]) => a.state === 'done'));
  let c: ResumeCopy = { ...copy, analyses };
  let json = JSON.stringify(c);
  // Zu groß: zuerst die Analysen der ältesten Züge, dann die ältesten Züge weglassen.
  while (json.length > RESUME_MAX_BYTES && Object.keys(c.analyses).length) {
    const first = Math.min(...Object.keys(c.analyses).map(Number));
    const next = { ...c.analyses };
    delete next[first];
    c = { ...c, analyses: next };
    json = JSON.stringify(c);
  }
  if (json.length > RESUME_MAX_BYTES) return;
  local.set(key(sceneId), json);
}

export function clearResume(sceneId: string): void {
  local.remove(key(sceneId));
}
