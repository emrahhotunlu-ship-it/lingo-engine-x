import bankJson from '../../content/grammar-bank.json';
import extraJson from '../../content/grammar-extra.json';
import { asText } from '../text/str';
import { legacyTaskKey } from './key';
import { asList, asRecord, grammarJson, rulesJson, toolkitJson } from './raw';

// Erklärungen der Startaufgaben nach Aufgabenschlüssel, ohne `tasks.ts` zu importieren (`errors.ts` braucht sie beim Lesen;
// `tasks.ts` importiert `errors.ts`). Dieselben Quellen und dieselbe Feldwahl wie `normalizeTask`/`seedTasks`; ein Unit-Test
// vergleicht beide (`tests/unit/errorsExpl.test.ts`), damit sie nicht auseinanderlaufen.

export type Expl = { de: string | null; en: string | null };
const s = (v: unknown): string | null => {
  const t = asText(v).trim();
  return t ? t : null;
};

let cache: Map<string, Expl> | null = null;

function add(map: Map<string, Expl>, raw: unknown): void {
  const it = asRecord(raw);
  const prompt = asText(it.prompt).trim();
  if (!prompt) return;
  const key = legacyTaskKey(prompt);
  if (map.has(key)) return; // wie `seedTasks`: die erste Quelle gewinnt
  const expl = { de: s(it.explanation_de) ?? s(it.expl), en: s(it.explanation_en) ?? s(it.expl_en) };
  if (expl.de || expl.en) map.set(key, expl);
}

/** Erklärung der Startaufgabe mit diesem Schlüssel (`legacyTaskKey(prompt)`) oder `null`. */
export function seedExplOf(key: string): Expl | null {
  if (!cache) {
    const map = new Map<string, Expl>();
    for (const g of asList(grammarJson().seedGrammar)) add(map, g);
    for (const g of extraJson.tasks as unknown[]) add(map, g);
    for (const g of bankJson.tasks as unknown[]) add(map, g);
    for (const g of asList(toolkitJson().tasks)) add(map, g);
    const rules = { ...asRecord(toolkitJson().rules), ...asRecord(rulesJson().rules) };
    for (const r of Object.values(rules)) {
      for (const trap of asList(asRecord(r).traps)) {
        const t = asRecord(trap);
        const why = Array.isArray(t.why) ? t.why.map(asText) : [];
        add(map, { prompt: t.bad, expl: why[0], expl_en: why[1] });
      }
    }
    cache = map;
  }
  return cache.get(key) ?? null;
}
