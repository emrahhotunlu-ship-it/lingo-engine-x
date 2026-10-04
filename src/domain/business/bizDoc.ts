import { compactList, monthOf, upsertById } from '../monthDoc';
import type { BizItem } from './types';

// Business-Einheiten als Monatsdokument `biz/<JJJJ-MM>` (Plan §3.5). Idempotent über `id`.
// Verdichtung wie bei `talk`: bis ≤ 200 KiB zuerst die Texte (`orig`/`final`/`attempt`) der
// ältesten Einträge leeren; die Kennzahlen bleiben.

type Doc = Record<string, unknown>;

export const BIZ_DOC_MAX_BYTES = 200 * 1024;
export const MAIL_TEXT_MAX = 3000;
export const PITCH_TEXT_MAX = 2000;

const STEPS: ReadonlyArray<(i: Doc) => Doc | null> = [
  (i) => {
    const has = ['orig', 'final', 'attempt'].some((k) => typeof i[k] === 'string' && i[k].length > 0);
    return has ? { ...i, ...(typeof i.orig === 'string' ? { orig: '' } : {}), ...(typeof i.final === 'string' ? { final: '' } : {}), ...(typeof i.attempt === 'string' ? { attempt: '' } : {}) } : null;
  },
  (i) => (Array.isArray(i.points) && i.points.length ? { ...i, points: [] } : null),
];

export function compactBiz(items: readonly unknown[], month = '0000-00'): unknown[] {
  return compactList(items, STEPS, BIZ_DOC_MAX_BYTES, (list) => ({ v: 1, month, items: list }));
}

export function upsertBizItem(cur: Doc | undefined, item: BizItem): { set: Doc } | { update: Doc } | null {
  const month = monthOf(item.day);
  if (!cur) return { set: { v: 1, month, items: compactBiz([item], month) } };
  if (cur.items != null && !Array.isArray(cur.items)) return null;
  const list = Array.isArray(cur.items) ? cur.items : [];
  return { update: { items: compactBiz(upsertById(list, item), month) } };
}

/** Kennung einer Business-Einheit: Art + Zeit (Basis 36). */
export const bizId = (kind: BizItem['kind'], t: number): string => `${kind}-${Math.max(0, Math.floor(t)).toString(36)}`;
