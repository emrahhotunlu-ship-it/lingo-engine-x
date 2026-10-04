// Plattform-Prüfung des Produktions-Builds (Kap. 3.1, Kap. 12):
// - genau eine Datei dist/index.html, kleiner als 16 MB
// - keine Ladeziele außerhalb der Datei (Skripte, Stylesheets, Schriften, Bilder, Netz-APIs)
// - kein Entwicklungs-Adapter und keine Testdaten im Build
// - Viewport mit viewport-fit=cover, lang-Attribut, Titel
// - Testwerkzeuge (nur im Test-Build für den Test-Link):
//     --prod  Fassung für die Produktivadresse (`npm run build`): die Kennzeichnung `lx-test-tools` und die
//             Texte der Testwerkzeuge dürfen NICHT in dist/index.html stehen
//     --test  Test-Build (`npm run build:test`): die Kennzeichnung MUSS drinstehen
//     ohne Schalter: nur die gemeinsamen Prüfungen
// Aufruf nach dem Bauen: npm run check:platform -- --prod   (oder --test)

import { readdirSync, readFileSync, statSync } from 'node:fs';

const MAX_BYTES = 16 * 1024 * 1024;
const WARN_BYTES = 8 * 1024 * 1024;
const problems = [];
const notes = [];
const mode = process.argv.includes('--prod') ? 'prod' : process.argv.includes('--test') ? 'test' : 'base';
// Kennzeichnung des Test-Panels (data-testid) und wörtliche Texte der Testwerkzeuge.
const TEST_TOOLS_MARKER = 'lx-test-tools';
const TEST_TOOLS_TEXTS = ['Test-Profil setzen', 'Einstufung überspringen', 'Beispiel-Fortschritt'];

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
// Phase 5: Testmarker der festen Antworten (Begleiter, Übersetzer, Preply).
devMarkers.push('zzlong', 'zzen', 'zzsame', 'zzempty', '[no-solution]', 'registerCompanionReplies');
// Phase 4: Titel der festen Lese-/Hörtexte des Entwicklungs-Adapters.
devMarkers.push('Heads-Up Before the Client Call', 'Four-Day Week Really Work');
// Phase 6/7: Fehlerpfade und Messhilfen des Adapters.
devMarkers.push('assessBad', 'peakSubscriptions', 'setAssessBad');
for (const m of devMarkers) if (html.includes(m)) problems.push(`Entwicklungs-Adapter oder Testdaten im Build: "${m}"`);

// Testwerkzeuge: nur im Test-Build, nie in der Fassung für die Produktivadresse.
if (mode === 'prod') {
  if (html.includes(TEST_TOOLS_MARKER)) problems.push(`Testwerkzeuge im normalen Build: "${TEST_TOOLS_MARKER}" steht in dist/index.html`);
  for (const t of TEST_TOOLS_TEXTS) if (html.includes(t)) problems.push(`Text der Testwerkzeuge im normalen Build: "${t}"`);
}
if (mode === 'test' && !html.includes(TEST_TOOLS_MARKER)) problems.push(`Test-Build ohne Testwerkzeuge: "${TEST_TOOLS_MARKER}" fehlt in dist/index.html`);

// Kopf
if (!/<meta[^>]+name="viewport"[^>]+viewport-fit=cover/i.test(html)) problems.push('Viewport ohne viewport-fit=cover');
if (!/<html[^>]+lang="/i.test(html)) problems.push('<html> ohne lang-Attribut');
if (!/<title>[^<]+<\/title>/i.test(html)) problems.push('<title> fehlt');
if (!html.includes('data:font/woff2')) problems.push('Schrift nicht eingebettet (data:font/woff2 fehlt)');

console.log(`dist/index.html: ${size} Bytes (${(size / 1048576).toFixed(2)} MB) · Modus: ${mode === 'prod' ? 'normaler Build' : mode === 'test' ? 'Test-Build' : 'gemeinsame Prüfungen'}`);
notes.forEach((n) => console.log(n));
if (problems.length) {
  console.error(`PLATTFORM-PRÜFUNG: BLOCKIERT (${problems.length})`);
  problems.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}
console.log('PLATTFORM-PRÜFUNG: FREIGABE');
