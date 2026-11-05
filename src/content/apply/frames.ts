import { z } from 'zod';
import framesRaw from './frames.json?raw';
import { logError } from '../../platform/diagnostics';

// Rahmen für „Eigener Satz“ (Anwenden): je Grammatikthema 2–3 Situationen aus dem Vertriebsalltag mit einem Satzanfang, der den Zusammenhang erzwingt,
// den die Regel braucht (Emrahs Live-Rückmeldung 05.11.2026: „Schreibe einen Satz mit ‚to lack‘ – Regel: Past Perfect“ ohne Bezugspunkt war unlösbar).
// Als Text eingebettet und erst beim ersten Gebrauch geparst; ungültige Einträge fallen weg und landen in der Diagnose.

const FrameSchema = z.object({
  de: z.string().trim().min(10).max(200),
  en: z.string().trim().min(10).max(200),
  starter: z.string().trim().min(3).max(80),
});
export type ComboFrame = z.infer<typeof FrameSchema>;
export type ComboFrames = Readonly<Record<string, readonly ComboFrame[]>>;

let cache: ComboFrames | null = null;

/** Rahmen je Themen-ID (leer, wenn die Datei unlesbar ist). */
export function comboFrames(): ComboFrames {
  if (cache) return cache;
  const out: Record<string, ComboFrame[]> = {};
  try {
    const raw = JSON.parse(framesRaw) as { frames?: unknown };
    const frames = raw.frames && typeof raw.frames === 'object' && !Array.isArray(raw.frames) ? (raw.frames as Record<string, unknown>) : {};
    for (const [id, list] of Object.entries(frames)) {
      (Array.isArray(list) ? list : []).forEach((item, i) => {
        const r = FrameSchema.safeParse(item);
        if (r.success) (out[id] ??= []).push(r.data);
        else logError('content:apply:frames', r.error, `${id} ${i} ungültig`);
      });
    }
  } catch (err) {
    logError('content:apply:frames', err, 'frames.json');
  }
  cache = out;
  return out;
}
