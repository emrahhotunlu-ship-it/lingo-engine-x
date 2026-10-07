import { describe, expect, it } from 'vitest';
import { checkMulti, MULTI_MAX_FILE, MULTI_WARN_TOTAL } from '../../scripts/check-platform.mjs';
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
    const p = checkMulti([...base(), { name: 'assets/x.js', size: 1, text: '' }, { name: 'x.exe', size: 1 }, { name: 'big.bin', size: MULTI_MAX_FILE }]).problems.join('|');
    expect(p).toContain('Unterordner');
    expect(p).toContain('Nicht erlaubter Dateityp');
    expect(p).toContain('16 MB');
  });
  it('Gesamtgröße: Warnung ab 12 MiB, Fehler über 64 MB', () => {
    expect(checkMulti([...base(), { name: 'a.bin', size: MULTI_WARN_TOTAL + 1 }]).notes.join()).toContain('12 MiB');
    expect(checkMulti([...base(), { name: 'a.bin', size: 15e6 }, { name: 'b.bin', size: 15e6 }, { name: 'c.bin', size: 15e6 }, { name: 'd.bin', size: 15e6 }, { name: 'e.bin', size: 15e6 }]).problems.join()).toContain('64 MB');
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
