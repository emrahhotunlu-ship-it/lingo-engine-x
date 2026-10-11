import { useClock } from '../../app/clock';
import { getWriter } from '../../data';
import { readTt } from '../../domain/grammar/topicTest';
import { logWarn } from '../../platform/diagnostics';

// Kapitel-Arbeit (K4): eigener kleiner Baustein ohne weitere Abhängigkeiten, damit das Rundenende ihn ohne Import-Schleife nutzen kann.

/**
 * „Nächstes Thema trotzdem beginnen“ nach einem nicht bestandenen Themen-Test: `grammar/<thema>.tt.s` = heute. Der Cursor überspringt das Thema
 * dann; der Test bleibt offen und kommt wieder, sobald die übrigen Themen geschafft sind. Nichts wird gesperrt.
 */
export async function skipTopicTest(topic: string): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  const today = useClock.getState().today;
  try {
    const r = await writer.transform(`grammar/${topic}`, (cur) => {
      const tt = readTt(cur);
      const raw = cur?.tt;
      if (!tt || tt.ok || tt.s === today || !raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
      return { update: { tt: { ...(raw as Record<string, unknown>), s: today } } };
    });
    return r === 'updated';
  } catch (err) {
    logWarn('chapter:skip', err, `grammar/${topic}`);
    return false;
  }
}
