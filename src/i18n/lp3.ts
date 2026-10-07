// Texte der Lernplattform 3.0 (docs/umbau/lernplattform-3.md §10.0 Nr. 6): je Paket eine Datei `parts/lp3/<paket>.{de,en}.ts` mit Schlüsseln
// nur unter dem Präfix des Bereichs (`cx` Aufgaben, `px` Programm, `tt` Tutor, `mo` Motivation, `ee` Effekte). Sie werden per Glob eingesammelt:
// kein Paket ändert `de.ts`/`en.ts`. `tests/unit/i18nParts.test.ts` prüft Präfix-Besitz und doppelte Schlüssel.

export type Lp3Key = `cx${string}` | `px${string}` | `tt${string}` | `mo${string}` | `ee${string}`;
export const LP3_PREFIXES = ['cx', 'px', 'tt', 'mo', 'ee'] as const;

type Mods = Record<string, Record<string, unknown>>;

function merge(mods: Mods): Record<Lp3Key, string> {
  const out: Record<string, string> = {};
  for (const file of Object.keys(mods).sort()) {
    for (const part of Object.values(mods[file] ?? {})) {
      if (!part || typeof part !== 'object') continue;
      for (const [k, v] of Object.entries(part)) if (typeof v === 'string') out[k] = v;
    }
  }
  return out;
}

export const lp3De = merge(import.meta.glob('./parts/lp3/*.de.ts', { eager: true }));
export const lp3En = merge(import.meta.glob('./parts/lp3/*.en.ts', { eager: true }));
