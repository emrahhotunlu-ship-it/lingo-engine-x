import { addDays } from '../date';
import type { AssessPlanInput } from '../plan/channels';
import { focusChannels } from './actions';
import { readAssess } from './envelope';
import { levelRank } from './types';

// Einschätzung → Eingabe der Kanalgewichtung (Plan §5.2). Der Fokus gilt `focus.days` Lerntage ab
// dem Tag der Einschätzung (`d + days > heute`). Die Belastbarkeit und die Stufen sind sprachfrei,
// deshalb gelten sie auch bei einer Einschätzung in der anderen Oberflächensprache.

export function assessPlanInput(doc: unknown, today: string): AssessPlanInput | null {
  const a = readAssess(doc);
  if (!a) return null;
  const f = a.data.focus;
  const focusValid = !!f && !!a.d && addDays(a.d, f.days) > today;
  const channels = f ? (f.channels.length ? f.channels : focusChannels(f.action)) : [];
  const dims: AssessPlanInput['dims'] = {};
  for (const d of a.data.dims) dims[d.id] = { rank: levelRank(d.level), confidence: d.level === null ? 'thin' : d.confidence };
  return { focusValid, focusChannels: channels, focusRef: f?.action ?? null, dims };
}
