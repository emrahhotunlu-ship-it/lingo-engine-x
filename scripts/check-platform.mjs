// Plattform-Prüfung des Produktions-Builds (Kap. 3.1, Kap. 12). Alle Grenzen stammen aus scripts/limits.mjs (einzige Quelle).
// Mehr-Datei (STANDARD, `npm run build`, docs/umbau/mehr-datei.md): dist/ = index.html + flache Zusatzdateien. Dann gilt:
// - keine Unterordner, nur erlaubte Dateitypen, jede Datei unter MAX_FILE_BYTES, Summe höchstens MAX_PUBLISH_BYTES
//   (Hinweis ab WARN_TOTAL_BYTES), höchstens MAX_FILES_PER_PUBLISH Dateien (Hinweis ab TARGET_MAX_FILES)
// - index.html verweist nur flach-relativ auf vorhandene Dateien
// - alle Skripte/Stylesheets/JSON werden wie die HTML-Datei auf Ladeziele und Entwicklungs-Spuren geprüft;
//   `fetch(` ist nur in der Datei erlaubt, die den Marker `lx:content-fetch` trägt (Inhalts-Bündel)
// - dist/.vite/ (Vite-Manifest, nur Bau-Metadaten für scripts/check-budget.mjs) wird übergangen; es wird nie veröffentlicht.
// Einzeldatei (Rückfall, `npm run build:single`): genau dist/index.html, unter MAX_FILE_BYTES,
// Budget (Lernplattform 3.0 §9) Hinweis ab SINGLE_WARN_BYTES, blockiert ab SINGLE_FAIL_BYTES.
// Beide: keine Ladeziele außerhalb (Skripte, Stylesheets, Schriften, Bilder, Netz-APIs, WebAssembly), kein Entwicklungs-Adapter,
// keine Testdaten, Viewport mit viewport-fit=cover, lang-Attribut, Titel.
// Aufruf nach `npm run build` bzw. `npm run build:single`: npm run check:platform (erkennt den Modus am Inhalt von dist/)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import { gunzipSync, inflateRawSync, inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { MAX_FILE_BYTES, MAX_FILES_PER_PUBLISH, MAX_PUBLISH_BYTES, SINGLE_FAIL_BYTES, SINGLE_WARN_BYTES, TARGET_MAX_FILES, WARN_TOTAL_BYTES, mb } from './limits.mjs';

// Alte Namen bleiben als Verweise auf scripts/limits.mjs (Tests und Aufrufer lesen sie weiter von hier).
export const MAX_BYTES = MAX_FILE_BYTES;
export const WARN_BYTES = SINGLE_WARN_BYTES;
export const FAIL_BYTES = SINGLE_FAIL_BYTES;
/** Bau-Metadaten in dist/ (Vite-Manifest), werden weder geprüft noch veröffentlicht. */
export const BUILD_META_DIR = '.vite';

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

/** Entpackt Daten (raw deflate, zlib, gzip); `undefined`, wenn es keine gepackten Daten sind. */
export function unpack(buf) {
  for (const fn of [inflateRawSync, inflateSync, gunzipSync]) {
    try {
      return fn(buf).toString('utf8');
    } catch {
      // kein Treffer mit diesem Verfahren: nächstes versuchen
    }
  }
  return undefined;
}

/**
 * Entwicklungs-Spuren in gepackten Inhalten (Base64-Blöcke im Bündel, Bündeldateien `.txt`): sie werden vor den Marker-Prüfungen
 * entpackt statt nur ausgeblendet (platform-guard S2/S3, 28.10.2026). Rein: `texts` = entpackte Texte.
 * @returns {string[]} gefundene Marker
 */
export function markersInPacked(texts) {
  const found = [];
  for (const t of texts) for (const m of [...devMarkers, ...removedTemplates]) if (t.includes(m) && !found.includes(m)) found.push(m);
  return found;
}

/** Entpackte Texte aller Base64-Blöcke eines Textes (Schriften und Bilder entpacken sich nicht und fallen weg). */
export function packedBlocks(text) {
  const out = [];
  for (const m of text.matchAll(BASE64_BLOCK)) {
    const t = unpack(Buffer.from(m[0], 'base64'));
    if (t !== undefined) out.push(t);
  }
  return out;
}

/**
 * Prüft den Text einer dist/index.html. Rein: `size` ist die Dateigröße in Byte.
 * @returns {{ problems: string[], notes: string[] }}
 */
export function checkHtml(html, size) {
  const problems = [];
  const notes = [];
  if (size >= MAX_BYTES) problems.push(`dist/index.html ist ${size} Bytes groß (Grenze ${mb(MAX_BYTES)} je Datei)`);
  else if (size >= FAIL_BYTES) problems.push(`Budget überschritten: ${(size / 1048576).toFixed(2)} MiB (Grenze ${(FAIL_BYTES / 1048576).toFixed(0)} MiB, Lernplattform 3.0 §9)`);
  else if (size >= WARN_BYTES) notes.push(`Achtung: ${(size / 1048576).toFixed(2)} MiB – über der Warnschwelle von ${(WARN_BYTES / 1048576).toFixed(0)} MiB (Lernplattform 3.0 §9): das nächste Paket packt bestehende Inhalte`);

  const text = html.replace(BASE64_BLOCK, '');
  for (const [re, label] of loaders) if (re.test(text)) problems.push(`Ladeziel gefunden: ${label}`);
  for (const m of removedTemplates) if (text.includes(m)) problems.push(`Kennung einer entfernten Vorlage im Build: "${m}"`);
  for (const m of devMarkers) if (text.includes(m)) problems.push(`Entwicklungs-Adapter oder Testdaten im Build: "${m}"`);
  for (const m of markersInPacked(packedBlocks(html))) problems.push(`Entwicklungs-Spur in gepackten Inhalten: "${m}"`);

  // Kopf
  if (!/<meta[^>]+name="viewport"[^>]+viewport-fit=cover/i.test(html)) problems.push('Viewport ohne viewport-fit=cover');
  if (!/<html[^>]+lang="/i.test(html)) problems.push('<html> ohne lang-Attribut');
  if (!/<title>[^<]+<\/title>/i.test(html)) problems.push('<title> fehlt');
  if (!html.includes('data:font/woff2')) problems.push('Schrift nicht eingebettet (data:font/woff2 fehlt)');
  return { problems, notes };
}

// ---- Mehr-Datei-Modus ----
export const MULTI_MAX_FILE = MAX_FILE_BYTES;
export const MULTI_MAX_TOTAL = MAX_PUBLISH_BYTES;
export const MULTI_WARN_TOTAL = WARN_TOTAL_BYTES;
export const MULTI_EXT = new Set(['.html', '.js', '.css', '.json', '.woff2', '.png', '.jpg', '.webp', '.svg', '.mp4', '.webm', '.txt']);
const TEXT_EXT = new Set(['.js', '.css', '.json', '.svg']);
const FETCH_MARKER = 'lx:content-fetch';
// Verweise, die in der HTML separat geprüft werden (flach-relativ + vorhanden) und deshalb nicht als Ladeziel zählen.
const HTML_REF_LABELS = new Set(['externes <script src>', '<link href> (Stylesheet/Preload)']);
/** Lokaler, flacher, relativer Verweis (kein Host, kein `/`-Anfang, kein Unterordner, kein data:). */
const flatRel = (u) => /^[A-Za-z0-9._-]+(\?[^#]*)?(#.*)?$/.test(u.replace(/^\.\//, ''));

/**
 * Prüft einen Mehr-Datei-Build. Rein: `files` = Liste `{ name, size, text?, packed? }` (text nur für Textdateien,
 * packed = entpackter Inhalt einer Bündeldatei `.txt` (Base64 des rohen deflate), `null` = nicht entpackbar), `name` relativ zu dist/.
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
    if (f.size >= MULTI_MAX_FILE) problems.push(`${f.name} ist ${f.size} Bytes groß (Grenze ${mb(MULTI_MAX_FILE)} je Datei)`);
  }
  if (files.length > MAX_FILES_PER_PUBLISH) problems.push(`${files.length} Dateien: mehr als ${MAX_FILES_PER_PUBLISH} je Veröffentlichung`);
  else if (files.length >= TARGET_MAX_FILES) notes.push(`Achtung: ${files.length} Dateien – Ziel sind weniger als ${TARGET_MAX_FILES}`);
  if (total > MULTI_MAX_TOTAL) problems.push(`Gesamtgröße ${mb(total)} über ${mb(MULTI_MAX_TOTAL)} je Veröffentlichung`);
  else if (total > MULTI_WARN_TOTAL) notes.push(`Achtung: Gesamtgröße ${mb(total)} – über der Warnschwelle von ${mb(MULTI_WARN_TOTAL)}`);

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
    if (f.name.endsWith('.txt')) {
      if (f.packed === null) problems.push(`${f.name}: Inhalts-Bündel lässt sich nicht entpacken`);
      else if (f.packed !== undefined) for (const m of markersInPacked([f.packed])) problems.push(`${f.name}: Entwicklungs-Spur in gepackten Inhalten: "${m}"`);
    }
    if (!f.text) continue;
    for (const m of markersInPacked(packedBlocks(f.text))) problems.push(`${f.name}: Entwicklungs-Spur in gepackten Inhalten: "${m}"`);
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

/** Einträge von dist/ ohne die Bau-Metadaten (dist/.vite/). */
export function distEntries(dir) {
  return readdirSync(dir, { withFileTypes: true }).filter((e) => !(e.isDirectory() && e.name === BUILD_META_DIR));
}

/**
 * Relaunch P1 S1-TOK: Umfang der Brücke alte Namen → neue Tokens (src/styles/bridge.css). Nur ein Hinweis, kein Tor:
 * die Pakete der Stufe 1 bauen die Bausteine um und streichen Verweise, die Zahl soll sinken.
 * @param {string} css Inhalt von bridge.css
 * @returns {string} Hinweiszeile
 */
export function bridgeNote(css) {
  const lx = (css.match(/^\s*--lx-[\w-]+\s*:/gm) ?? []).length;
  const tw = (css.match(/^\s*--color-[\w-]+\s*:/gm) ?? []).length;
  return `Hinweis: Brücke src/styles/bridge.css hält ${lx + tw} alte Namen (${lx} --lx-*, ${tw} --color-*) – Ziel ist 0`;
}

function main() {
  try {
    console.log(bridgeNote(readFileSync(new URL('../src/styles/bridge.css', import.meta.url), 'utf8')));
  } catch (err) {
    console.log(`Hinweis: Brücke src/styles/bridge.css nicht lesbar (${err instanceof Error ? err.message : String(err)})`);
  }
  const dir = new URL('../dist/', import.meta.url);
  const entries = distEntries(dir);
  if (entries.length > 1 || process.env.LX_BUILD === 'multi') {
    const files = entries.map((e) => {
      if (e.isDirectory()) return { name: `${e.name}/`, size: 0 };
      const size = statSync(new URL(e.name, dir)).size;
      const text = TEXT_EXT.has(extname(e.name).toLowerCase()) || e.name === 'index.html' ? readFileSync(new URL(e.name, dir), 'utf8') : undefined;
      const packed = extname(e.name).toLowerCase() === '.txt' ? (unpack(Buffer.from(readFileSync(new URL(e.name, dir), 'utf8').trim(), 'base64')) ?? null) : undefined;
      return { name: e.name, size, text, packed };
    });
    const res = checkMulti(files);
    const total = files.reduce((a, f) => a + f.size, 0);
    console.log(`Mehr-Datei-Build: ${files.length} Dateien, ${mb(total)} gesamt, index.html ${files.find((f) => f.name === 'index.html')?.size ?? 0} Bytes`);
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
  console.log(`Budget: ${(size / 1048576).toFixed(2)} von ${(WARN_BYTES / 1048576).toFixed(0)} MiB`);
  res.notes.forEach((n) => console.log(n));
  if (problems.length) {
    console.error(`PLATTFORM-PRÜFUNG: BLOCKIERT (${problems.length})`);
    problems.forEach((p) => console.error(`  - ${p}`));
    process.exit(1);
  }
  console.log('PLATTFORM-PRÜFUNG: FREIGABE');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
