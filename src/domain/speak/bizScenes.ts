import type { BizScene } from '../../content/nb/schemas';
import type { Lang, SceneView } from './types';

// Business-Szenen aus P7a (`content/nb/scenes.json`, N70) im Format der Szenen-Bibliothek
// (`library.ts`, Felder der alten App). Ziele und Kriterien bleiben zweisprachig erhalten
// (`goals`, `criteria`) – für die Ziel-Checkliste und das Kriterien-Raster (N72). Rein, ohne zod.

type Doc = Record<string, unknown>;
export type Bi = { de: string; en: string };

/** Kennung einer Business-Szene (`b01` … `b16`). */
export const isBizId = (id: string): boolean => /^b\d{2}$/.test(id);

/** Eine Business-Szene als Bibliotheks-Dokument (Inhalt, von `scene/<id>` überlagert). */
export function bizSceneDoc(b: BizScene): Doc {
  return {
    id: b.id,
    src: 'biz',
    theme: b.theme,
    kind: b.kind,
    level: 'C1',
    title: b.title.en,
    title_de: b.title.de,
    situation: b.setting.en,
    situation_de: b.setting.de,
    goal: b.goals.map((g) => g.en).join(' · '),
    goal_de: b.goals.map((g) => g.de).join(' · '),
    goals: b.goals.map((g) => ({ de: g.de, en: g.en })),
    criteria: b.criteria.map((c) => ({ de: c.de, en: c.en })),
    persona: { name: b.partner.name, role: b.partner.role, org: '', traits: b.partner.mood },
    opening: b.opener,
  };
}

/**
 * Lauf-Vermerk einer Business-Szene in `scene/<id>`: nur Kennung und Quelle. Der Rest kommt beim
 * Lesen aus dem Inhalt (Datenbank gewinnt je Feld, `mergeScenes`); spätere Inhaltskorrekturen wirken so.
 */
export const bizRunMarker = (id: string): Doc => ({ id, src: 'biz' });

function biList(v: unknown): Bi[] {
  if (!Array.isArray(v)) return [];
  const out: Bi[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const de = typeof (x as Doc).de === 'string' ? ((x as Doc).de as string).trim() : '';
    const en = typeof (x as Doc).en === 'string' ? ((x as Doc).en as string).trim() : '';
    if (de || en) out.push({ de: de || en, en: en || de });
  }
  return out;
}

/**
 * Ziele einer Szene (höchstens 3): Business-Szenen bringen drei mit; ältere Szenen haben ein
 * einzelnes Ziel (`goal`/`goal_de`), das dann das einzige Ziel ist.
 */
export function sceneGoals(scene: Pick<SceneView, 'raw' | 'goal' | 'goalEn'>): Bi[] {
  const list = biList(scene.raw.goals).slice(0, 3);
  if (list.length) return list;
  const en = scene.goalEn.trim();
  const de = typeof scene.raw.goal_de === 'string' && scene.raw.goal_de.trim() ? scene.raw.goal_de.trim() : en;
  return en ? [{ de, en }] : [];
}

/** Prüfbare Kriterien einer Szene (3–5, nur Business-Szenen; sonst leer). */
export function sceneCriteria(scene: Pick<SceneView, 'raw'>): Bi[] {
  return biList(scene.raw.criteria).slice(0, 5);
}

export const pickLang = (b: Bi, lang: Lang): string => (lang === 'de' ? b.de : b.en);

/** Szene zum Wochenthema: die Szene des Themas, sonst die erste Business-Szene mit diesem Thema. */
export function themeScene<T extends Pick<SceneView, 'id' | 'raw' | 'valid'>>(scenes: readonly T[], sceneId: string | null | undefined, themeId: string | null | undefined): T | null {
  const byId = sceneId ? scenes.find((s) => s.id === sceneId && s.valid) : undefined;
  if (byId) return byId;
  if (!themeId) return null;
  return scenes.find((s) => s.valid && s.raw.theme === themeId) ?? null;
}
