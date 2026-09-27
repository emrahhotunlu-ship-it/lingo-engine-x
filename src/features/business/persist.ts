import { getWriter } from '../../data';
import { upsertBizItem } from '../../domain/business/bizDoc';
import type { BizItem } from '../../domain/business/types';
import { radarEvents, type RadarError } from '../../domain/progress/radarPatch';
import { monthOf } from '../../domain/speak/talkDoc';
import type { ActivityLogEntry } from '../../domain/progress/logPatch';
import { logError } from '../../platform/diagnostics';
import { nextT, recordActivity } from '../progress/persist';

// Schreibwege der Business-Suite (Plan §3.2, §3.5): `biz/<Monat>` (idempotent über `id`), Log
// und Profil über den GEMEINSAMEN Puffer (B6), Fehler-Radar mit Quelle `b` (Pitch) ebenfalls.

const M: Record<BizItem['kind'], ActivityLogEntry['m']> = { mail: 'biz-mail', pitch: 'biz-pitch', play: 'biz-play' };

export async function saveBizItem(item: BizItem, opts: { lang: 'de' | 'en'; title: string; n: number; right: number; activeMs: number; errors?: RadarError[] }): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  let ok = true;
  try {
    await writer.transform(`biz/${monthOf(item.day)}`, (cur) => upsertBizItem(cur, item));
  } catch (err) {
    ok = false;
    logError('biz:save', err, item.id);
  }
  const id = item.kind === 'play' ? `pb-${item.playbook}` : item.kind;
  const saved = await recordActivity(
    { t: nextT(), ok: true, lang: opts.lang, type: 'biz', id, m: M[item.kind], q: opts.title, n: opts.n, ms: opts.activeMs, ctx: 'biz' },
    { day: item.day, act: 'biz', partial: false, n: Math.max(1, opts.n), right: opts.right, activeMs: opts.activeMs, countAs: 1 },
    // Fehler-Radar über dieselbe Sammel-Warteschlange (phase2-plan D5).
    radarEvents(opts.errors ?? [], 'b', item.t),
  );
  if (!saved) ok = false;
  return ok;
}
