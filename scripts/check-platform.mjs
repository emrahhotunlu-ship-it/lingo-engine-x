// Plattform-Prüfung des Produktions-Builds (Kap. 3.1, Kap. 12):
// - genau eine Datei dist/index.html, kleiner als 16 MB
// - keine Ladeziele außerhalb der Datei (Skripte, Stylesheets, Schriften, Bilder, Netz-APIs)
// - kein Entwicklungs-Adapter und keine Testdaten im Build
// - Viewport mit viewport-fit=cover, lang-Attribut, Titel
// Aufruf nach `npm run build`: npm run check:platform

import { readdirSync, readFileSync, statSync } from 'node:fs';

const MAX_BYTES = 16 * 1024 * 1024;
const WARN_BYTES = 8 * 1024 * 1024;
const problems = [];
const notes = [];

const files = readdirSync(new URL('../dist/', import.meta.url));
if (files.length !== 1 || files[0] !== 'index.html') problems.push(`dist/ muss genau index.html enthalten, gefunden: ${files.join(', ')}`);

const file = new URL('../dist/index.html', import.meta.url);
const size = statSync(file).size;
const html = readFileSync(file, 'utf8');
if (size >= MAX_BYTES) problems.push(`dist/index.html ist ${size} Bytes groß (Grenze 16 MB)`);
else if (size >= WARN_BYTES) notes.push(`Achtung: ${(size / 1048576).toFixed(1)} MB – mehr als die Hälfte der Grenze`);

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
];
for (const [re, label] of loaders) if (re.test(html)) problems.push(`Ladeziel gefunden: ${label}`);

// Spuren des Entwicklungs-Adapters und der Testdaten (Kap. 3.3).
const devMarkers = ['__LINGO_FAKE__', '__LINGO_FAKE_OPTIONS__', 'lx:fake-db', 'Feste Beispielantwort', 'installFakeRuntime', 'createMemoryDb', 'Alex Muster', 'zzjson', 'com.apple.voice.compact',
  // Phase 3: nachgebildete Sprech-/Business-Antworten und Spracheingabe
  'zzde', 'I wanted to let you know that', 'InvalidStateError: already started'];
for (const m of devMarkers) if (html.includes(m)) problems.push(`Entwicklungs-Adapter oder Testdaten im Build: "${m}"`);

// Kopf
if (!/<meta[^>]+name="viewport"[^>]+viewport-fit=cover/i.test(html)) problems.push('Viewport ohne viewport-fit=cover');
if (!/<html[^>]+lang="/i.test(html)) problems.push('<html> ohne lang-Attribut');
if (!/<title>[^<]+<\/title>/i.test(html)) problems.push('<title> fehlt');
if (!html.includes('data:font/woff2')) problems.push('Schrift nicht eingebettet (data:font/woff2 fehlt)');

console.log(`dist/index.html: ${size} Bytes (${(size / 1048576).toFixed(2)} MB)`);
notes.forEach((n) => console.log(n));
if (problems.length) {
  console.error(`PLATTFORM-PRÜFUNG: BLOCKIERT (${problems.length})`);
  problems.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}
console.log('PLATTFORM-PRÜFUNG: FREIGABE');
