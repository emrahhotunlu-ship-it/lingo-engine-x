import type { Lang } from '../srs/types';
import { legacyNorm, legacyTaskKey } from './key';
import { formHint, ruleOf } from './rules';
import { seedTasks } from './tasks';

// „Warum“ zu einem Grammatik-Fehlersatz (Prüfbefund B1): erst die beim Anlegen mitgeschriebene Erklärung (`expl`),
// bei älteren Einträgen die Erklärung der Startaufgabe mit gleichem Schlüssel, dann die Falle im Regelblatt, zuletzt der Kernsatz.
// Rein. Texte immer in der Oberflächensprache (formHint prüft die Sprache und fällt auf den Kernsatz zurück).

type Expl = { de: string | null; en: string | null };

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Erklärung aus dem Eintrag (`{de, en}`), tolerant gelesen. */
export function explOf(v: unknown): Expl | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const e = { de: str(o.de), en: str(o.en) };
  return e.de || e.en ? e : null;
}

let byKey: Map<string, Expl> | null = null;
function seedExpl(key: string): Expl | null {
  if (!byKey) {
    byKey = new Map();
    for (const t of seedTasks()) if (t.expl.de || t.expl.en) byKey.set(t.key, t.expl);
  }
  return byKey.get(key) ?? null;
}

export function whyOfError(topic: string, e: { q?: unknown; expl?: unknown }, lang: Lang): string {
  const q = typeof e.q === 'string' ? e.q : '';
  const own = explOf(e.expl) ?? (q ? seedExpl(legacyTaskKey(q)) : null);
  if (own) {
    const t = formHint({ topic, expl: own }, lang);
    if (t) return t;
  }
  const rule = ruleOf(topic, lang);
  const k = legacyNorm(q);
  const trap = k ? rule?.traps.find((x) => legacyNorm(x.bad) === k) : undefined;
  if (trap?.why) return trap.why;
  return rule?.core ?? '';
}
