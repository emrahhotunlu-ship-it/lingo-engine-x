import { describe, expect, it } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { checkHtml, checkMulti, MULTI_MAX_FILE, MULTI_WARN_TOTAL, packedBlocks, unpack } from '../../scripts/check-platform.mjs';
import { MAX_FILE_BYTES, MAX_FILES_PER_PUBLISH, MAX_PUBLISH_BYTES, TARGET_MAX_FILES, WARN_TOTAL_BYTES, mb } from '../../scripts/limits.mjs';
import { buildManifest } from '../../scripts/publish-manifest.mjs';

// Mehr-Datei-Modus (docs/umbau/mehr-datei.md): Plattform-Prüfung und Veröffentlichungs-Manifest.
const HTML = '<!doctype html><html lang="de"><head><meta name="viewport" content="width=device-width, viewport-fit=cover"><title>X</title><script type="module" crossorigin src="./index-a1.js"></script><link rel="stylesheet" href="./style-b2.css"></head><body></body></html>';
const base = () => [
  { name: 'index.html', size: HTML.length, text: HTML },
  { name: 'index-a1.js', size: 1000, text: 'var a=1;' },
  { name: 'style-b2.css', size: 100, text: 'a{}' },
  { name: 'f.woff2', size: 100 },
];

describe('checkMulti', () => {
  it('gibt einen sauberen Build frei', () => {
    expect(checkMulti(base()).problems).toEqual([]);
  });
  it('lehnt Unterordner, fremde Dateitypen und zu große Dateien ab', () => {
    const p = checkMulti([...base(), { name: 'assets/x.js', size: 1, text: '' }, { name: 'x.exe', size: 1 }, { name: 'big.txt', size: MULTI_MAX_FILE }, { name: 'alt.bin', size: 1 }]).problems.join('|');
    expect(p).toContain('Unterordner');
    expect(p).toContain('Nicht erlaubter Dateityp');
    // `.bin` liefert das Artefakt nicht aus (application/octet-stream abgelehnt, Test-Link 1a 28.10.2026): Bündel sind `.txt`.
    expect(p).toContain('Nicht erlaubter Dateityp: alt.bin');
    expect(p).toContain(mb(MAX_FILE_BYTES));
  });
  it('Grenzen kommen nur aus scripts/limits.mjs (255 Dateien, 15 MB je Datei, 64 MB je Veröffentlichung)', () => {
    expect([MAX_FILES_PER_PUBLISH, MAX_FILE_BYTES, MAX_PUBLISH_BYTES]).toEqual([255, 15e6, 64e6]);
    expect([MULTI_MAX_FILE, MULTI_WARN_TOTAL]).toEqual([MAX_FILE_BYTES, WARN_TOTAL_BYTES]);
  });
  it('Dateizahl: Hinweis ab 100, Fehler über 255', () => {
    const many = (n: number) => [...base(), ...Array.from({ length: n - base().length }, (_, i) => ({ name: `c${i}.txt`, size: 1 }))];
    expect(checkMulti(many(TARGET_MAX_FILES - 1)).notes).toEqual([]);
    expect(checkMulti(many(TARGET_MAX_FILES)).notes.join()).toContain(String(TARGET_MAX_FILES));
    expect(checkMulti(many(MAX_FILES_PER_PUBLISH)).problems).toEqual([]);
    expect(checkMulti(many(MAX_FILES_PER_PUBLISH + 1)).problems.join()).toContain(String(MAX_FILES_PER_PUBLISH));
  });
  it('Gesamtgröße: Warnung ab 9 MB, Fehler über 64 MB', () => {
    expect(checkMulti([...base(), { name: 'a.txt', size: MULTI_WARN_TOTAL + 1 }]).notes.join()).toContain(mb(WARN_TOTAL_BYTES));
    const big = ['a', 'b', 'c', 'd', 'e'].map((n) => ({ name: `${n}.txt`, size: MAX_FILE_BYTES - 1 }));
    const p = checkMulti([...base(), ...big]).problems;
    expect(p).toHaveLength(1);
    expect(p.join()).toContain(mb(MAX_PUBLISH_BYTES));
  });
  it('index.html: nur flach-relative, vorhandene Verweise', () => {
    const bad = (h: string) => checkMulti([{ name: 'index.html', size: 1, text: h }, ...base().slice(1)]).problems.join('|');
    expect(bad(HTML.replace('./index-a1.js', 'https://cdn.example.com/a.js'))).toContain('nicht flach-relativ');
    expect(bad(HTML.replace('./index-a1.js', '/index-a1.js'))).toContain('nicht flach-relativ');
    expect(bad(HTML.replace('./index-a1.js', './sub/a.js'))).toContain('nicht flach-relativ');
    expect(bad(HTML.replace('./index-a1.js', './fehlt.js'))).toContain('fehlende Datei');
  });
  it('Ladeziele in Skripten: fetch nur mit Marker, sonst XMLHttpRequest, WebSocket, Entwicklungs-Spuren', () => {
    const withJs = (text: string) => checkMulti(base().map((f) => (f.name === 'index-a1.js' ? { ...f, text } : f))).problems.join('|');
    expect(withJs('fetch("/x")')).toContain('fetch()');
    expect(withJs('var m="lx:content-fetch";fetch(u)')).toBe('');
    expect(withJs('new XMLHttpRequest()')).toContain('XMLHttpRequest');
    expect(withJs('new WebSocket("wss://x")')).toContain('WebSocket');
    expect(withJs('window.__LINGO_FAKE__=1')).toContain('Entwicklungs-Adapter');
  });
});

describe('gepackte Inhalte (platform-guard S2/S3)', () => {
  // Füllung mit wenig Wiederholung, damit der Base64-Block die Mindestlänge von 512 Zeichen erreicht.
  const fill = Array.from({ length: 400 }, (_, i) => ((i * 7919) % 10007).toString(36)).join(',');
  const pack = (t: string) => deflateRawSync(Buffer.from(`${t}${fill}`));
  it('findet Entwicklungs-Spuren in Bündeldateien (.txt) und meldet nicht entpackbare', () => {
    const bin = (packed: string | null) => checkMulti([...base(), { name: 'content-x.txt', size: 10, packed }]).problems.join('|');
    expect(bin(unpack(pack('{"a":"ok"}')) ?? null)).toBe('');
    expect(bin(unpack(pack('{"a":"__LINGO_FAKE__"}')) ?? null)).toContain('__LINGO_FAKE__');
    expect(bin(null)).toContain('nicht entpacken');
  });
  it('entpackt Base64-Blöcke im Bündel statt sie nur auszublenden', () => {
    const block = pack('{"t":"Feste Beispielantwort"}').toString('base64');
    expect(packedBlocks(`x="${block}"`).join()).toContain('Feste Beispielantwort');
    const withJs = (text: string) => checkMulti(base().map((f) => (f.name === 'index-a1.js' ? { ...f, text } : f))).problems.join('|');
    expect(withJs(`const c="${block}";`)).toContain('Feste Beispielantwort');
    expect(withJs(`const c="${pack('{"t":"ok"}').toString('base64')}";`)).toBe('');
    expect(checkHtml(`<html lang="de"><head><meta name="viewport" content="viewport-fit=cover"><title>x</title></head><body>data:font/woff2 "${block}"</body></html>`, 100).problems.join()).toContain('Feste Beispielantwort');
  });
});

describe('buildManifest', () => {
  it('index.html ist die Seite, alle anderen Dateien stehen flach in files', () => {
    const m = buildManifest([{ name: 'index.html', size: 5 }, { name: 'a.js', size: 7 }], '/d');
    expect(m.page).toBe('/d/index.html');
    expect(m.files).toEqual({ 'a.js': '/d/a.js' });
    expect(m.totalBytes).toBe(12);
  });
  it('meldet alte Dateien der Vorversion zum Entfernen (null)', () => {
    const m = buildManifest([{ name: 'index.html', size: 1 }, { name: 'b.js', size: 1 }], '/d', { files: { 'a.js': 'x', 'b.js': 'y' } });
    expect(m.stale).toEqual(['a.js']);
    expect(m.removeMap).toEqual({ 'a.js': null });
  });
});
