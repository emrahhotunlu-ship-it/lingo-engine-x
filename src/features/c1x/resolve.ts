import { kindEnabled } from '../../app/flags';
import { c1ItemById, preloadC1x } from '../../domain/c1x/preload';
import { repeatPick } from '../../domain/c1x/repeat';
import { toTask } from '../../domain/c1x/runtime';
import { C1_KINDS } from '../../domain/c1x/types';
import { topicP } from '../../domain/grammar/bkt';
import type { ErrorEntry } from '../../domain/grammar/errors';
import type { InputProfile } from '../../domain/grammar/tasks';
import type { GrammarTask } from '../../domain/learn/types';
import { logWarn } from '../../platform/diagnostics';

// Verbindung zwischen dem Rundenbau und den c1x-Aufgaben (Lernplattform 3.0 P14/P15): ein Fehlersatz mit `cid` kommt im selben Baustein zurück
// (`domain/c1x/repeat.ts`); ist die Aufgabe nicht aufzulösen oder die Art aus, gilt der Fehlersatz-Text wie bisher.

/** Sicherheitsnetz beim Rundenbau: lädt, was noch fehlt (der Start wartet normalerweise schon darauf, `ready.ts`). */
export function ensureC1xLoaded(): void {
  const kinds = C1_KINDS.filter((k) => kindEnabled(k));
  if (kinds.length) void preloadC1x(kinds).catch((err: unknown) => logWarn('c1x:preload', err));
}

export type ResolveInput = {
  grammarDocs: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
  nowMs: number;
  seed: string;
  profile: InputProfile;
};

/** Der Auflöser für `RoundInput.c1`; `undefined`, wenn keine Art eingeschaltet ist. */
export function c1ErrorResolver(i: ResolveInput): ((topic: string, e: ErrorEntry) => GrammarTask | null) | undefined {
  if (!C1_KINDS.some((k) => kindEnabled(k))) return undefined;
  return (topic, e) => {
    const own = typeof e.cid === 'string' ? c1ItemById(e.cid) : null;
    if (!own || !kindEnabled(own.kind)) return null;
    const doc = i.grammarDocs.get(topic);
    const seen = new Set(Array.isArray(doc?.seen) ? (doc.seen as unknown[]).filter((x): x is string => typeof x === 'string') : []);
    const pick = repeatPick(e, { seen, seed: i.seed, nowMs: i.nowMs, inp: i.profile === 'touch' ? 'touch' : 'desk', p: topicP(topic, doc, i.nowMs) });
    if (!pick || !kindEnabled(pick.item.kind)) return null;
    return toTask(pick.item, { errorT: typeof e.t === 'number' ? e.t : null, ref: `grammar/${topic}` });
  };
}
