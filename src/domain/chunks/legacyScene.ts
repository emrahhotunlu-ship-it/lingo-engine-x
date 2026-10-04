import legacyScenes from '../../content/legacy/scenes.json';
import fixedScenes from '../../content/speak/scenes.json';
import { bizScenes } from '../../content/nb/load';
import { bizSceneDoc } from '../speak/bizScenes';

// Feste Szenen als Inhalt (ohne Oberfläche und Datenbank): von der Wendungs-Wiederholung (Situation)
// und vom Rollenspiel gelesen.

type Doc = Record<string, unknown>;

// Feste Szenen = die vier der alten App plus „Preisverhandlung“ und „Partner-Pitch“ (Kap. 6.5,
// `content/speak/scenes.json`). Beide sind Inhalt (Quelle `legacy`) und werden von `scene/<id>`
// überlagert; ein Lauf legt `scene/<id>` wie bei den alten Szenen erst beim Speichern an.
export const LEGACY_SCENES = [...(legacyScenes as unknown as Doc[]), ...(fixedScenes as unknown as Doc[])];

// Neubau (N70): die 16 Business-Szenen aus P7a kommen dazu – erst beim ersten Gebrauch geparst
// (`content/nb/load.ts`, Anhang A 5c), danach im Speicher.
let contentCache: Doc[] | null = null;
export function contentScenes(): Doc[] {
  return (contentCache ??= [...LEGACY_SCENES, ...bizScenes().map(bizSceneDoc)]);
}

export function legacySceneDoc(id: string): Doc | null {
  return contentScenes().find((s) => s.id === id) ?? null;
}
