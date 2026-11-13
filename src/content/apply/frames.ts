import { z } from 'zod';
import framesRaw from './frames.json?raw';
import { logError } from '../../platform/diagnostics';

// Rahmen für „Eigener Satz“ (Anwenden): je Grammatikthema 2–3 Situationen aus dem Vertriebsalltag mit einem Satzanfang, der den Zusammenhang erzwingt,
// den die Regel braucht (Emrahs Live-Rückmeldung 05.11.2026: „Schreibe einen Satz mit ‚to lack‘ – Regel: Past Perfect“ ohne Bezugspunkt war unlösbar).
// Als Text eingebettet und erst beim ersten Gebrauch geparst; ungültige Einträge fallen weg und landen in der Diagnose.
// P4 (13.11.2026, Brücken-Sätze): die Situationen stammen aus Emrahs Berufswelt (Business Development bei einem DMS/ECM-Hersteller mit neuem Cloud-Produkt
// für den Mittelstand, dazu etwa ein Drittel Alltag und Nachrichten); der Satzanfang gibt den Zusammenhang, enthält die Zielform aber nicht. `pats` nennt die Muster,
// zu denen ein Satzanfang passt (ein Thema hat mehrere Muster, „If you sign by Friday, we will …“ passt nur zum First Conditional). `more` hält
// zusätzliche Rahmen für einzelne Muster; `comboFrames()` (Rahmen je Thema) liest sie nicht.

const FrameSchema = z.object({
  de: z.string().trim().min(10).max(200),
  en: z.string().trim().min(10).max(200),
  starter: z.string().trim().min(3).max(80),
  pats: z.array(z.string().trim().min(3).max(40)).max(6).optional(),
});
export type ComboFrame = z.infer<typeof FrameSchema>;
export type ComboFrames = Readonly<Record<string, readonly ComboFrame[]>>;

let cache: { topics: ComboFrames; byPat: ReadonlyMap<string, readonly ComboFrame[]> } | null = null;

function read(): NonNullable<typeof cache> {
  if (cache) return cache;
  const topics: Record<string, ComboFrame[]> = {};
  const byPat = new Map<string, ComboFrame[]>();
  const take = (group: unknown, intoTopics: boolean): void => {
    const g = group && typeof group === 'object' && !Array.isArray(group) ? (group as Record<string, unknown>) : {};
    for (const [id, list] of Object.entries(g)) {
      (Array.isArray(list) ? list : []).forEach((item, i) => {
        const r = FrameSchema.safeParse(item);
        if (!r.success) {
          logError('content:apply:frames', r.error, `${id} ${i} ungültig`);
          return;
        }
        if (intoTopics) (topics[id] ??= []).push(r.data);
        for (const p of r.data.pats ?? []) {
          const have = byPat.get(p) ?? [];
          if (!byPat.has(p)) byPat.set(p, have);
          have.push(r.data);
        }
      });
    }
  };
  try {
    const raw = JSON.parse(framesRaw) as { frames?: unknown; more?: unknown };
    take(raw.frames, true);
    take(raw.more, false);
  } catch (err) {
    logError('content:apply:frames', err, 'frames.json');
  }
  cache = { topics, byPat };
  return cache;
}

/** Rahmen je Themen-ID (leer, wenn die Datei unlesbar ist). */
export function comboFrames(): ComboFrames {
  return read().topics;
}

/** P4: Rahmen je Muster-Kennung (Satzanfang passt zu genau diesem Muster); leer ohne passenden Rahmen. */
export function bridgeFrames(): ReadonlyMap<string, readonly ComboFrame[]> {
  return read().byPat;
}
