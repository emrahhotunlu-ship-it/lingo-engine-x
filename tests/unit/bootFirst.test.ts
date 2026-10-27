import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { moveInlineModuleToBody } from '../../scripts/vite-boot-first.mjs';

// U2 Start-Bild: Im Einzeldatei-Build steht das große App-Skript hinter dem Start-Bild (Ende von <body>), damit der Browser das Start-Bild
// zeichnen kann, bevor er 6 MB Skript liest. Das Modul läuft wie bisher erst nach dem Lesen des Dokuments.

describe('moveInlineModuleToBody', () => {
  const html = '<html><head><title>x</title><script type="module" crossorigin>console.log("</div>")</script><style>a{}</style></head><body><div id="root"><div id="lx-boot">B</div></div></body></html>';
  it('schiebt das eingebettete Modul-Skript ans Ende von body', () => {
    const out = moveInlineModuleToBody(html);
    expect(out.indexOf('<script type="module"')).toBeGreaterThan(out.indexOf('id="lx-boot"'));
    expect(out.indexOf('<script type="module"')).toBeLessThan(out.indexOf('</body>'));
    expect(out.slice(0, out.indexOf('</head>'))).not.toContain('<script type="module"');
    expect(out).toContain('<style>a{}</style></head>');
    expect(out.match(/<script type="module"/g)).toHaveLength(1);
  });
  it('lässt Mehr-Datei-HTML (Skript mit src) und HTML ohne Modul unverändert', () => {
    const multi = '<html><head><script type="module" crossorigin src="./index-a.js"></script></head><body></body></html>';
    expect(moveInlineModuleToBody(multi)).toBe(multi);
    const none = '<html><head></head><body></body></html>';
    expect(moveInlineModuleToBody(none)).toBe(none);
  });
  it('index.html enthält das Start-Bild vor dem Skript, mit derselben Kartenhöhe wie die App', () => {
    const src = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(src.indexOf('id="lx-boot"')).toBeLessThan(src.indexOf('<script type="module"'));
    expect(src).toContain('lx-card lx-today-card');
    // Nichts extern laden (Kap. 3.1, A6 Nr. 8).
    expect(src).not.toMatch(/(?:src|href)="https?:/);
  });
});
