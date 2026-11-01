// Baut die Bild-Entwürfe VB als eine selbstständige Datei aus der Vorschau-Quelle (nur gelesen) + vb.css + vb-screens.js.
// Aufruf: node docs/umbau/vokabeln/bilder/src/build.mjs <ausgabe.html>   (Ausgabe gehört ins Scratchpad, nicht ins Repo)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..', '..');
const vs = p => readFileSync(join(root, 'docs/relaunch/vorschau/src', p), 'utf8');
const own = p => readFileSync(join(here, p), 'utf8');
const out = process.argv[2];
if (!out) throw new Error('Ausgabepfad fehlt');

const font = readFileSync(join(root, 'node_modules/@fontsource-variable/inter/files/inter-latin-standard-normal.woff2'));
let css = vs('style.css').replace('__INTER_WOFF2_BASE64__', font.toString('base64'));
css += '\n' + ['style-woerter.css', 'style-mehr.css', 'style-soll.css'].map(vs).join('\n') + '\n' + own('vb.css');
const parts = ['app.js', 'screens.js', 'screens-woerter.js', 'screens-mehr.js', 'screens-soll.js', 'desk.js', 'desk-woerter.js', 'desk-mehr.js'].map(vs);
const js = [...parts, own('vb-screens.js'), 'boot();'].join('\n');
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lingo Wörter – Bild-Entwürfe VB</title>\n<style>\n' + css + '\n</style></head><body>\n<div id="lx"></div>\n<script>\n"use strict";\n' + js + '\n</script></body></html>\n';
if (/https?:\/\//.test(html.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, ''))) throw new Error('Externe Adresse gefunden');
writeFileSync(out, html);
console.log(out, Buffer.byteLength(html), 'Bytes');
