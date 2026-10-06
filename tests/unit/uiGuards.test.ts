import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Wächter der Lernplattform 2.0 (docs/umbau/lernplattform-2.md §10.4 P1, Schritt 7): neue Fundstellen sind verboten,
// die heutigen stehen je Besitzer in `tests/unit/uiGuards/allow-P*.json`. Jeder Besitzer leert seine Liste, sobald er
// seine Bildschirme umgebaut hat (Abschluss Welle 2: alle Listen leer). P1 hat seine schon geleert.
//
// 1. `matchMedia('(pointer…')` nur in `src/platform` (das Eingabeprofil `platform/input.ts` ist die eine Stelle).
// 2. kein `text-[…]` in `src/features`, `src/ui`, `src/app`, `src/engine` (Typografie-Rollen und die Skala aus index.css).
// 3. keine kopierte Übungskarten-Klasse (`lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7`)
//    außerhalb `src/ui/exercise` (dort baut `ExerciseShell` die eine Karte).

const ROOT = join(__dirname, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

type RuleKey = 'matchMedia' | 'textPx' | 'card';
const OWNERS = ['P1', 'P5', 'P6', 'P7', 'P8'] as const;

const RULES: Record<RuleKey, { rx: RegExp; applies: (rel: string) => boolean }> = {
  matchMedia: { rx: /matchMedia\??\.?\(\s*['"`]\(pointer/, applies: (r) => !r.startsWith('src/platform/') },
  textPx: { rx: /text-\[/, applies: (r) => /^src\/(features|ui|app|engine)\//.test(r) },
  card: { rx: /lx-glass flex flex-col gap-[45] rounded-\[var\(--radius-card\)\] p-5 sm:p-7/, applies: (r) => !r.startsWith('src/ui/exercise/') },
};

type Allow = { owner: string } & Record<RuleKey, string[]>;
const allow: Record<string, Allow> = Object.fromEntries(
  OWNERS.map((o) => [o, JSON.parse(readFileSync(join(__dirname, 'uiGuards', `allow-${o}.json`), 'utf-8')) as Allow]),
);

const FILES = walk(join(ROOT, 'src')).map((f) => ({ rel: relative(ROOT, f), text: readFileSync(f, 'utf-8') }));
const hits = (k: RuleKey): string[] => FILES.filter((f) => RULES[k].applies(f.rel) && RULES[k].rx.test(f.text)).map((f) => f.rel).sort();

describe.each(['matchMedia', 'textPx', 'card'] as const)('UI-Wächter %s', (k) => {
  it('keine neue Fundstelle außerhalb der Listen', () => {
    const listed = new Set(OWNERS.flatMap((o) => allow[o]?.[k] ?? []));
    expect(hits(k).filter((f) => !listed.has(f))).toEqual([]);
  });

  it('keine veraltete Eintragung (die Datei ist sauber, der Eintrag muss weg)', () => {
    const now = new Set(hits(k));
    const stale = OWNERS.flatMap((o) => (allow[o]?.[k] ?? []).filter((f) => !now.has(f)).map((f) => `${o}: ${f}`));
    expect(stale).toEqual([]);
  });

  it('jede Datei steht höchstens auf einer Liste', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const o of OWNERS) for (const f of allow[o]?.[k] ?? []) (seen.has(f) ? dupes.push(`${f}: ${seen.get(f)} und ${o}`) : seen.set(f, o));
    expect(dupes).toEqual([]);
  });
});

describe('Liste von P1', () => {
  it('allow-P1.json ist leer (P1 hat seine Fundstellen selbst behoben)', () => {
    const a = allow['P1'];
    expect({ matchMedia: a?.matchMedia, textPx: a?.textPx, card: a?.card }).toEqual({ matchMedia: [], textPx: [], card: [] });
  });
});
