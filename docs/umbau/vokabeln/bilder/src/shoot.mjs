// Bildschirmfotos der Bild-Entwürfe. Aufruf: node shoot.mjs <vb.html> <zielordner> [filter]
// Liste der Bilder: shots.json (Name, Bildschirm#Variante, Breite, Modus, Ergebnis-Zustand).
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const [file, outDir, filter] = process.argv.slice(2);
const shots = JSON.parse(readFileSync(process.env.SHOTS || join(here, 'shots.json'), 'utf8')).filter(s => !filter || s.name.includes(filter));
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
for (const s of shots) {
  const w = s.w || 390, h = s.h || (w < 600 ? 844 : 900);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 600 ? 2 : 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.addInitScript(p => { localStorage.setItem('lx-vorschau-1', JSON.stringify(p)); }, { demo: s.demo || 'ok', mode: s.mode || 'dark', motion: 'off', accent: 'iris', tab4: 'praxis', lang: s.lang || 'de' });
  await page.goto('file://' + resolve(file) + '#' + s.screen);
  await page.addStyleTag({ content: '.toolhandle,.tool{display:none!important} #lx{padding-left:0!important}' });
  await page.waitForTimeout(250);
  for (const a of s.acts || []) { await page.evaluate(n => act(n), a); await page.waitForTimeout(150); }
  await page.screenshot({ path: join(outDir, s.name + '.jpg'), type: 'jpeg', quality: 80, fullPage: !!s.full });
  await ctx.close();
  console.log('ok', s.name);
}
await browser.close();
