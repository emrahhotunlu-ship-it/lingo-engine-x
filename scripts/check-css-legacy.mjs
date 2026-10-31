// Prüfskript „keine alten Stil-Klassen in umgebauten Bildschirmen“ (Relaunch Teil 1c, D1 V-BAU; docs/relaunch/stufe1c-plan.md §6).
//
// Regel: Alte part-CSS umgebauter Bildschirme wird entfernt, nicht überstimmt. Dieses Skript meldet jede Klasse aus einer ALTEN
// part-Datei (src/styles/parts/*.css außer den neuen Schichten shell, band, v), die in einer UMGEBAUTEN Datei noch benutzt wird.
//
// Pflege (je D-/E-Paket beim Zusammenführen, Besitz der Hauptsitzung):
//  - UMGEBAUT: Dateien oder Ordner (Präfix), die nach dem Paket nur noch Bausteine aus src/ui/v und die neuen Schichten benutzen.
//    Jedes Paket trägt hier seine umgebauten Bildschirmdateien ein (Zuordnung in stufe1c-plan.md §3).
//  - NEU: Stil-Dateien der neuen Schichten; sie zählen nicht als „alt“.
//
// Gesucht wird in String- und Vorlagen-Literalen der umgebauten Dateien (className="…", `…`, '…'): jedes Wort, das genau einer
// Klasse aus einer alten Datei entspricht, ist ein Befund. Kommentare werden vorher entfernt.
//
// Aufruf: node scripts/check-css-legacy.mjs [--json]   Exit 0 = sauber, 1 = Befunde.
// Ein Unit-Test (tests/unit/cssLegacy.test.ts) ruft `check()` auf, damit die Regel in jedem Lauf (verify, verify:fast) greift.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PARTS = 'src/styles/parts';

/** Neue Schichten (Relaunch): keine Altlast. */
export const NEU = ['shell.css', 'band.css', 'v.css'];

/** Umgebaute Dateien/Ordner (Präfix relativ zum Repo). Nur anhängen, nie still entfernen. */
export const UMGEBAUT = [
  // D1 V-BAU: die Bausteine selbst.
  'src/ui/v/',
];

const stripCssComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const stripJsComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

/** Klassen einer CSS-Datei (nur aus Selektoren, nicht aus Werten). Folgt @import innerhalb von parts/. */
export function classesOf(file, seen = new Set()) {
  if (seen.has(file) || !existsSync(file)) return new Set();
  seen.add(file);
  const css = stripCssComments(readFileSync(file, 'utf8'));
  const out = new Set();
  for (const m of css.matchAll(/@import\s+['"]\.\/([\w.-]+\.css)['"]/g)) for (const c of classesOf(join(file, '..', m[1]), seen)) out.add(c);
  // Selektoren = Text vor `{`; Deklarationsblöcke ohne Verschachtelung überspringen.
  const rules = css.replace(/@import[^;]*;/g, '');
  for (const sel of rules.split('{').map((p) => p.split('}').pop() ?? '')) {
    if (/^\s*@(?!media|supports|container)/.test(sel)) continue;
    for (const m of sel.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) out.add(m[1]);
  }
  return out;
}

/** Alle alten Klassen mit Herkunftsdatei. */
export function legacyClasses(root = ROOT) {
  const dir = join(root, PARTS);
  const map = new Map();
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.css') && !NEU.includes(n)).sort()) {
    for (const c of classesOf(join(dir, f))) if (!map.has(c)) map.set(c, `${PARTS}/${f}`);
  }
  // Klassen, die auch eine neue Schicht definiert, sind kein Befund (gleiche Klasse, neuer Ort).
  for (const f of NEU) for (const c of classesOf(join(dir, f))) map.delete(c);
  return map;
}

function filesUnder(root, prefix) {
  const abs = join(root, prefix);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(root, join(prefix, e.name)) : /\.(tsx?|jsx?)$/.test(e.name) ? [join(abs, e.name)] : [],
  );
}

/** Wörter aus String- und Vorlagen-Literalen. */
export function literalWords(src, nested = false) {
  const code = nested ? src : stripJsComments(src);
  const words = [];
  for (const m of code.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
    // Ausdrücke in Vorlagen (`${…}`) können selbst Literale enthalten (`${on ? 'alt-x' : ''}`).
    for (const e of m[2].matchAll(/\$\{([^}]*)\}/g)) words.push(...literalWords(e[1], true));
    for (const w of m[2].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) if (w) words.push(w);
  }
  return words;
}

/**
 * @param {{ root?: string, umgebaut?: string[] }} [opts]
 * @returns {{ ok: boolean, files: number, legacy: number, befunde: Array<{ file: string, klasse: string, aus: string }>, fehlend: string[] }}
 */
export function check(opts = {}) {
  const root = opts.root ?? ROOT;
  const umgebaut = opts.umgebaut ?? UMGEBAUT;
  const legacy = legacyClasses(root);
  const befunde = [];
  const fehlend = [];
  let files = 0;
  for (const prefix of umgebaut) {
    const list = filesUnder(root, prefix);
    if (list.length === 0) fehlend.push(prefix);
    for (const file of list) {
      files++;
      const seen = new Set();
      for (const w of literalWords(readFileSync(file, 'utf8'))) {
        if (legacy.has(w) && !seen.has(w)) {
          seen.add(w);
          befunde.push({ file: relative(root, file), klasse: w, aus: legacy.get(w) });
        }
      }
    }
  }
  return { ok: befunde.length === 0 && fehlend.length === 0, files, legacy: legacy.size, befunde, fehlend };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = check();
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(`check-css-legacy: ${r.files} umgebaute Dateien gegen ${r.legacy} alte Klassen geprüft.`);
    for (const p of r.fehlend) console.log(`  ✘ Eintrag in UMGEBAUT ohne Dateien: ${p}`);
    for (const b of r.befunde) console.log(`  ✘ ${b.file}: Klasse „${b.klasse}“ aus ${b.aus}`);
    console.log(r.ok ? '✓ keine alten Klassen in umgebauten Dateien' : `✘ ${r.befunde.length + r.fehlend.length} Befund(e)`);
  }
  process.exit(r.ok ? 0 : 1);
}
