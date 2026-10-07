// Plattform-Prüfung des Produktions-Builds (Kap. 3.1, Kap. 12):
// - genau eine Datei dist/index.html, kleiner als 16 MB
// - Budget (Lernplattform 3.0 §9): Warnung ab 6 MiB, blockiert ab 9 MiB
// - keine Ladeziele außerhalb der Datei (Skripte, Stylesheets, Schriften, Bilder, Netz-APIs, WebAssembly)
// - kein Entwicklungs-Adapter und keine Testdaten im Build
// - Viewport mit viewport-fit=cover, lang-Attribut, Titel
// Mehr-Datei-Modus (LX_BUILD=multi, docs/umbau/mehr-datei.md): dist/ = index.html + flache Zusatzdateien. Dann gilt:
// - keine Unterordner, nur erlaubte Dateitypen, jede Datei < 16 MB, Gesamtgröße ≤ 64 MB (Warnung ab 12 MB)
// - index.html verweist nur flach-relativ auf vorhandene Dateien
// - alle Skripte/Stylesheets/JSON werden wie die HTML-Datei auf Ladeziele und Entwicklungs-Spuren geprüft;
//   `fetch(` ist nur in der Datei erlaubt, die den Marker `lx:content-fetch` trägt (Inhalts-Bündel)
// Aufruf nach `npm run build` bzw. `npm run build:multi`: npm run check:platform (erkennt den Modus am Inhalt von dist/)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_BYTES = 16 * 1024 * 1024;
export const WARN_BYTES = 6 * 1024 * 1024;
export const FAIL_BYTES = 9 * 1024 * 1024;

// Ladeziele, die eine Anfrage auslösen würden.
const loaders = [
  [/<script\b[^>]*\bsrc\s*=/i, 'externes <script src>'],
  [/<link\b[^>]*\bhref\s*=\s*["']?(?!data:)/i, '<link href> (Stylesheet/Preload)'],
  [/<(img|iframe|video|audio|source|embed|object)\b[^>]*\b(src|data)\s*=\s*["']?https?:/i, 'eingebettetes Medium von außen'],
  [/@import\s/i, 'CSS @import'],
  [/url\(\s*["']?(https?:)?\/\//i, 'CSS url() auf fremden Host'],
  [/\bfetch\s*\(/, 'fetch()'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bnew\s+WebSocket\b/, 'WebSocket'],
  [/\bnew\s+EventSource\b/, 'EventSource'],
  [/\bsendBeacon\b/, 'navigator.sendBeacon'],
  [/\bimportScripts\b/, 'importScripts'],
  [/\bnew\s+(Shared)?Worker\s*\(/, 'Worker'],
  // Lernplattform 3.0 K-21: kein WebAssembly (deckt instantiate, compile, new WebAssembly.Module ab).
  [/\bWebAssembly\b/, 'WebAssembly'],
];

// Spuren des Entwicklungs-Adapters und der Testdaten (Kap. 3.3).
// `export`: der Packer (scripts/content) und der Inhaltstest prüfen die Rohinhalte gegen dieselben Marker.
export const devMarkers = ['__LINGO_FAKE__', '__LINGO_FAKE_OPTIONS__', 'lx:fake-db', 'Feste Beispielantwort', 'installFakeRuntime', 'createMemoryDb', 'Alex Muster', 'zzjson', 'com.apple.voice.compact',
  // Phase 3: nachgebildete Sprech-/Business-Antworten und Spracheingabe
  'zzde', 'I wanted to let you know that', 'InvalidStateError: already started'];
// Phase 5: Testmarker der festen Antworten (Begleiter, Übersetzer, Preply).
devMarkers.push('zzlong', 'zzen', 'zzsame', 'zzempty', '[no-solution]', 'registerCompanionReplies');
// Phase 4: Titel der festen Lese-/Hörtexte des Entwicklungs-Adapters.
devMarkers.push('Heads-Up Before the Client Call', 'Four-Day Week Really Work');
// Phase 6/7: Fehlerpfade und Messhilfen des Adapters.
devMarkers.push('assessBad', 'peakSubscriptions', 'setAssessBad');
// Umbau „Fokus Wörter und Grammatik“: Kennungen entfernter KI-Vorlagen dürfen nicht mehr im Build stehen.
export const removedTemplates = ['listening-text@', 'reading-text@', 'reading-check@', 'writing-prompt@', 'writing-review@', 'apply-check@', 'mail-refine@', 'pitch-script@', 'pitch-feedback@', 'say-check@', 'fluency-check@', 'tone-check@', 'meeting-prep@', 'meeting-debrief@', 'phrase-adapt@', 'scene-gen@', 'compare@'];

/** Base64-Blöcke (gepackte Inhalte, Schriften) werden vor den Marker-Prüfungen ausgeblendet: kurze Marker träfen sonst zufällig. */
const BASE64_BLOCK = /[A-Za-z0-9+/=]{512,}/g;

/**
 * Prüft den Text einer dist/index.html. Rein: `size` ist die Dateigröße in Byte.
 * @returns {{ problems: string[], notes: string[] }}
 */
export function checkHtml(html, size) {
  const problems = [];
  const notes = [];
  if (size >= MAX_BYTES) problems.push(`dist/index.html ist ${size} Bytes groß (Grenze 16 MB)`);
  else if (size >= FAIL_BYTES) problems.push(`Budget überschritten: ${(size / 1048576).toFixed(2)} MiB (Grenze 9 MiB, Lernplattform 3.0 §9)`);
  else if (size >= WARN_BYTES) notes.push(`Achtung: ${(size / 1048576).toFixed(2)} MiB – über der Warnschwelle von 6 MiB (Lernplattform 3.0 §9): das nächste Paket packt bestehende Inhalte`);

  const text = html.replace(BASE64_BLOCK, '');
  for (const [re, label] of loaders) if (re.test(text)) problems.push(`Ladeziel gefunden: ${label}`);
  for (const m of removedTemplates) if (text.includes(m)) problems.push(`Kennung einer entfernten Vorlage im Build: "${m}"`);
  for (const m of devMarkers) if (text.includes(m)) problems.push(`Entwicklungs-Adapter oder Testdaten im Build: "${m}"`);

  // Kopf
  if (!/<meta[^>]+name="viewport"[^>]+viewport-fit=cover/i.test(html)) problems.push('Viewport ohne viewport-fit=cover');
  if (!/<html[^>]+lang="/i.test(html)) problems.push('<html> ohne lang-Attribut');
  if (!/<title>[^<]+<\/title>/i.test(html)) problems.push('<title> fehlt');
  if (!html.includes('data:font/woff2')) problems.push('Schrift nicht eingebettet (data:font/woff2 fehlt)');
  return { problems, notes };
}

// ---- Mehr-Datei-Modus ----
export const MULTI_MAX_FILE = 16 * 1024 * 1024;
export const MULTI_MAX_TOTAL = 64 * 1024 * 1024;
export const MULTI_WARN_TOTAL = 12 * 1024 * 1024;
export const MULTI_EXT = new Set(['.html', '.js', '.css', '.json', '.woff2', '.png', '.jpg', '.webp', '.svg', '.mp4', '.webm', '.bin']);
const TEXT_EXT = new Set(['.js', '.css', '.json', '.svg']);
const FETCH_MARKER = 'lx:content-fetch';
// Verweise, die in der HTML separat geprüft werden (flach-relativ + vorhanden) und deshalb nicht als Ladeziel zählen.
const HTML_REF_LABELS = new Set(['externes <script src>', '<link href> (Stylesheet/Preload)']);
/** Lokaler, flacher, relativer Verweis (kein Host, kein `/`-Anfang, kein Unterordner, kein data:). */
const flatRel = (u) => /^[A-Za-z0-9._-]+(\?[^#]*)?(#.*)?$/.test(u.replace(/^\.\//, ''));

/**
 * Prüft einen Mehr-Datei-Build. Rein: `files` = Liste `{ name, size, text? }` (text nur für Textdateien), `name` relativ zu dist/.
 * @returns {{ problems: string[], notes: string[] }}
 */
export function checkMulti(files) {
  const problems = [];
  const notes = [];
  const names = new Set(files.map((f) => f.name));
  if (!names.has('index.html')) problems.push('dist/index.html fehlt');
  let total = 0;
  for (const f of files) {
    total += f.size;
    if (f.name.includes('/')) problems.push(`Unterordner/nicht flacher Pfad: ${f.name}`);
    if (!MULTI_EXT.has(extname(f.name).toLowerCase())) problems.push(`Nicht erlaubter Dateityp: ${f.name}`);
    if (f.size >= MULTI_MAX_FILE) problems.push(`${f.name} ist ${f.size} Bytes groß (Grenze 16 MB je Datei)`);
  }
  if (total > MULTI_MAX_TOTAL) problems.push(`Gesamtgröße ${(total / 1048576).toFixed(2)} MiB über 64 MB`);
  else if (total > MULTI_WARN_TOTAL) notes.push(`Achtung: Gesamtgröße ${(total / 1048576).toFixed(2)} MiB – über der Warnschwelle von 12 MiB`);

  const html = files.find((f) => f.name === 'index.html')?.text ?? '';
  for (const m of html.matchAll(/<(script|link|img|source)\b[^>]*?\b(src|href)\s*=\s*["']([^"']*)["']/gi)) {
    const url = m[3];
    if (!flatRel(url)) problems.push(`index.html: Verweis nicht flach-relativ: ${url}`);
    else if (!names.has(url.replace(/^\.\//, '').replace(/[?#].*$/, ''))) problems.push(`index.html: Verweis auf fehlende Datei: ${url}`);
  }
  if (/<(iframe|embed|object|video|audio)\b/i.test(html)) problems.push('index.html: eingebettetes Medium/Rahmen');
  if (!/<meta[^>]+name="viewport"[^>]+viewport-fit=cover/i.test(html)) problems.push('Viewport ohne viewport-fit=cover');
  if (!/<html[^>]+lang="/i.test(html)) problems.push('<html> ohne lang-Attribut');
  if (!/<title>[^<]+<\/title>/i.test(html)) problems.push('<title> fehlt');
  if (!files.some((f) => f.name.endsWith('.woff2')) && !files.some((f) => (f.text ?? '').includes('data:font/woff2'))) problems.push('Schrift nicht eingebettet (weder .woff2 noch data:font/woff2)');

  // Ladeziele wie im Einzeldatei-Modus in JEDER Textdatei; `fetch(` nur in der Datei mit dem Marker (Inhalts-Bündel, relativ).
  for (const f of files) {
    if (!f.text) continue;
    const text = f.text.replace(BASE64_BLOCK, '');
    for (const [re, label] of loaders) {
      if (HTML_REF_LABELS.has(label)) continue;
      if (label === 'fetch()' && text.includes(FETCH_MARKER)) continue;
      if (re.test(text)) problems.push(`${f.name}: Ladeziel gefunden: ${label}`);
    }
    for (const m of removedTemplates) if (text.includes(m)) problems.push(`${f.name}: Kennung einer entfernten Vorlage im Build: "${m}"`);
    for (const m of devMarkers) if (text.includes(m)) problems.push(`${f.name}: Entwicklungs-Adapter oder Testdaten im Build: "${m}"`);
  }
  return { problems, notes };
}

function main() {
  const dir = new URL('../dist/', import.meta.url);
  const entries = readdirSync(dir, { withFileTypes: true });
  if (entries.length > 1 || process.env.LX_BUILD === 'multi') {
    const files = entries.map((e) => {
      if (e.isDirectory()) return { name: `${e.name}/`, size: 0 };
      const size = statSync(new URL(e.name, dir)).size;
      const text = TEXT_EXT.has(extname(e.name).toLowerCase()) || e.name === 'index.html' ? readFileSync(new URL(e.name, dir), 'utf8') : undefined;
      return { name: e.name, size, text };
    });
    const res = checkMulti(files);
    const total = files.reduce((a, f) => a + f.size, 0);
    console.log(`Mehr-Datei-Build: ${files.length} Dateien, ${(total / 1048576).toFixed(2)} MiB gesamt, index.html ${files.find((f) => f.name === 'index.html')?.size ?? 0} Bytes`);
    res.notes.forEach((n) => console.log(n));
    if (res.problems.length) {
      console.error(`PLATTFORM-PRÜFUNG (Mehr-Datei): BLOCKIERT (${res.problems.length})`);
      res.problems.forEach((p) => console.error(`  - ${p}`));
      process.exit(1);
    }
    console.log('PLATTFORM-PRÜFUNG (Mehr-Datei): FREIGABE');
    return;
  }
  const problems = [];
  const files = entries.map((e) => e.name);
  if (files.length !== 1 || files[0] !== 'index.html') problems.push(`dist/ muss genau index.html enthalten, gefunden: ${files.join(', ')}`);
  const file = new URL('../dist/index.html', import.meta.url);
  const size = statSync(file).size;
  const html = readFileSync(file, 'utf8');
  const res = checkHtml(html, size);
  problems.push(...res.problems);
  console.log(`dist/index.html: ${size} Bytes (${(size / 1048576).toFixed(2)} MiB)`);
  console.log(`Budget: ${(size / 1048576).toFixed(2)} von 6 MiB`);
  res.notes.forEach((n) => console.log(n));
  if (problems.length) {
    console.error(`PLATTFORM-PRÜFUNG: BLOCKIERT (${problems.length})`);
    problems.forEach((p) => console.error(`  - ${p}`));
    process.exit(1);
  }
  console.log('PLATTFORM-PRÜFUNG: FREIGABE');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
