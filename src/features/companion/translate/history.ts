import { KEY_PREFIX, local } from '../../../platform/storage';
import type { Register, TransLang } from '../../../prompts/translate';

// Verlauf des Übersetzers (Phase 5 §5.7): nur Bequemlichkeit, lokal, höchstens 20 Einträge.

export type HistoryEntry = { t: number; text: string; dir: TransLang; reg: Register; main: string };

const KEY = `${KEY_PREFIX}translate-history`;
export const HISTORY_MAX = 20;

const valid = (e: unknown): e is HistoryEntry => {
  if (!e || typeof e !== 'object') return false;
  const o = e as Record<string, unknown>;
  return typeof o.t === 'number' && typeof o.text === 'string' && (o.dir === 'de' || o.dir === 'en') && typeof o.main === 'string' && typeof o.reg === 'string';
};

export function readHistory(): HistoryEntry[] {
  const raw = local.getJson<unknown>(KEY);
  return Array.isArray(raw) ? raw.filter(valid).slice(0, HISTORY_MAX) : [];
}

export function pushHistory(e: HistoryEntry): HistoryEntry[] {
  const list = [e, ...readHistory().filter((x) => !(x.text === e.text && x.dir === e.dir && x.reg === e.reg))].slice(0, HISTORY_MAX);
  local.set(KEY, JSON.stringify(list));
  return list;
}
