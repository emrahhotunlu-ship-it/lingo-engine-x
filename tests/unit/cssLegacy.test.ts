import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { check, classesOf, literalWords } from '../../scripts/check-css-legacy.mjs';

// D1 V-BAU (stufe1c-plan.md §6): Alte part-CSS umgebauter Bildschirme wird entfernt, nicht überstimmt. Dieser Test hält
// scripts/check-css-legacy.mjs in jedem Lauf scharf und prüft das Skript selbst an einem kleinen Beispiel.

describe('check-css-legacy', () => {
  it('Repository: keine alte Klasse in umgebauten Dateien', () => {
    const r = check();
    expect(r.fehlend).toEqual([]);
    expect(r.befunde).toEqual([]);
    expect(r.files).toBeGreaterThan(0);
    expect(r.legacy).toBeGreaterThan(0);
  });

  it('findet eine alte Klasse, übersieht Kommentare und neue Schichten', () => {
    const root = mkdtempSync(join(tmpdir(), 'css-legacy-'));
    mkdirSync(join(root, 'src/styles/parts'), { recursive: true });
    mkdirSync(join(root, 'src/neu'), { recursive: true });
    writeFileSync(join(root, 'src/styles/parts/alt.css'), "@import './alt2.css';\n.alt-a { color: var(--fg); }\n@media (min-width: 600px) { .alt-b:hover { padding: 0.5em; } }\n");
    writeFileSync(join(root, 'src/styles/parts/alt2.css'), '.alt-c {}\n.geteilt {}\n');
    writeFileSync(join(root, 'src/styles/parts/v.css'), '.lx-v-x {}\n.geteilt {}\n');
    writeFileSync(
      join(root, 'src/neu/A.tsx'),
      "// className=\"alt-c\" im Kommentar zählt nicht\nexport const A = () => <div className=\"lx-v-x alt-a\"><b className={`geteilt ${'alt-b'}`} /></div>;\n",
    );
    const r = check({ root, umgebaut: ['src/neu/', 'src/fehlt/'] });
    expect(r.befunde.map((b) => b.klasse).sort()).toEqual(['alt-a', 'alt-b']);
    expect(r.befunde[0]?.aus).toBe('src/styles/parts/alt.css');
    expect(r.fehlend).toEqual(['src/fehlt/']);
    expect(r.ok).toBe(false);
    expect([...classesOf(join(root, 'src/styles/parts/alt.css'))].sort()).toEqual(['alt-a', 'alt-b', 'alt-c', 'geteilt']);
    expect(literalWords('const x = "a b"; // "c"')).toEqual(['a', 'b']);
  });
});
