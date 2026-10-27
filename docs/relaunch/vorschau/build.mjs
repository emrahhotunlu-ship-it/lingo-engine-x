// Baut die klickbare Design-Vorschau als eine selbstständige Datei (Artefakt-Vertrag: kein doctype/html/head/body).
// Aufruf: node docs/relaunch/vorschau/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const src = p => readFileSync(join(here, 'src', p), 'utf8');

const font = readFileSync(join(root, 'node_modules/@fontsource-variable/inter/files/inter-latin-standard-normal.woff2'));
let css = src('style.css');
if (!css.includes('__INTER_WOFF2_BASE64__')) throw new Error('Platzhalter für die Schrift fehlt in style.css');
css = css.replace('__INTER_WOFF2_BASE64__', font.toString('base64'));

const js = [src('app.js'), src('screens.js'), src('desk.js'), 'boot();'].join('\n');
if (/<\/script/i.test(js)) throw new Error('Skript enthält </script');

const out = '<title>Lingo Vorschau</title>\n' +
  '<meta name="claude:viewport-fit-sides" content="cover">\n' +
  '<style>\n' + css + '\n</style>\n' +
  '<div id="lx"></div>\n' +
  '<script>\n"use strict";\n' + js + '\n</script>\n';

if (/https?:\/\//.test(out.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, ''))) throw new Error('Externe Adresse in der Ausgabe gefunden');
const bytes = Buffer.byteLength(out);
if (bytes >= 2 * 1024 * 1024) throw new Error('Datei zu groß: ' + bytes);
writeFileSync(join(here, 'vorschau.html'), out);
console.log('vorschau.html', bytes, 'Bytes');
