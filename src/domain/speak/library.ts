import type { Lang, Persona, SceneView } from './types';

// Szenen-Bibliothek (Plan §3.8): Inhalt der alten App (`scenes.json`) überlagert von `scene/*`
// (Datenbank gewinnt je `id`). Ungültige Dokumente erscheinen nicht. Eine Szene ohne `opening`
// oder `persona` ist nicht startbar. Sortierung: nie gespielt zuerst, dann am längsten nicht.

type Doc = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function persona(v: unknown): Persona | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const p = v as Doc;
  const name = str(p.name);
  if (!name) return null;
  return { name, role: str(p.role), org: str(p.org), traits: str(p.traits) };
}

function useful(v: unknown): Array<{ en: string; de: string }> {
  if (!Array.isArray(v)) return [];
  const out: Array<{ en: string; de: string }> = [];
  for (const u of v) {
    if (!u || typeof u !== 'object') continue;
    const en = str((u as Doc).en);
    if (en) out.push({ en, de: str((u as Doc).de) });
  }
  return out.slice(0, 8);
}

/** Wurde die Szene schon gespielt? `done` der alten App ist ein Wahrheitswert. */
const playedOf = (d: Doc): boolean => d.done === true || num(d.runs) > 0;

export function sceneView(id: string, d: Doc, src: SceneView['src'], lang: Lang): SceneView {
  const pick = (en: unknown, de: unknown) => (lang === 'de' ? str(de) || str(en) : str(en) || str(de));
  const p = persona(d.persona);
  const opening = str(d.opening);
  const runs = Math.max(num(d.runs), playedOf(d) ? 1 : 0);
  const lastRun = num(d.lastRun) || (playedOf(d) && num(d.ts) ? num(d.ts) : 0);
  return {
    id,
    src,
    title: pick(d.title, d.title_de) || id,
    titleEn: str(d.title) || str(d.title_de) || id,
    situation: pick(d.situation, d.situation_de),
    situationEn: str(d.situation) || str(d.situation_de),
    goal: pick(d.goal, d.goal_de),
    goalEn: str(d.goal) || str(d.goal_de),
    persona: p,
    stake: str(d.stake),
    objection: str(d.objection),
    opening,
    useful: useful(d.useful),
    level: str(d.level) || 'C1',
    runs,
    lastRun: lastRun || null,
    gram: str(d.gram) || null,
    words: Array.isArray(d.words) ? d.words.filter((w): w is string => typeof w === 'string' && !!w.trim()).slice(0, 8) : [],
    valid: !!p && !!opening,
    raw: d,
  };
}

export function mergeScenes(legacy: readonly Doc[], db: ReadonlyMap<string, Doc>, invalid: ReadonlySet<string>, lang: Lang): SceneView[] {
  const out = new Map<string, SceneView>();
  for (const d of legacy) {
    const id = str(d.id);
    if (!id || invalid.has(id)) continue;
    out.set(id, sceneView(id, d, 'legacy', lang));
  }
  for (const [id, d] of db) {
    if (invalid.has(id)) continue;
    const base = out.get(id);
    // Die Datenbank gewinnt; fehlende Felder eines Lauf-Vermerks kommen aus dem Inhalt.
    const merged = base ? { ...base.raw, ...d } : d;
    const src: SceneView['src'] = base ? 'legacy' : str(d.src) === 'ai' || id.startsWith('sc-ai') ? 'ai' : 'db';
    out.set(id, sceneView(id, merged, src, lang));
  }
  return [...out.values()].sort((a, b) => {
    const pa = a.runs > 0 ? 1 : 0;
    const pb = b.runs > 0 ? 1 : 0;
    if (pa !== pb) return pa - pb;
    return (a.lastRun ?? 0) - (b.lastRun ?? 0) || a.id.localeCompare(b.id);
  });
}
