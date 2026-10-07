// Plattform-Wächter (Lernplattform 3.0 P9): Budget 6/9 MiB, WebAssembly, Base64-Ausblendung, ESLint-Sperren.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import { checkHtml, FAIL_BYTES, WARN_BYTES } from '../../scripts/check-platform.mjs';

const MIB = 1024 * 1024;
const GOOD_HEAD = '<html lang="en"><head><meta name="viewport" content="width=device-width, viewport-fit=cover"><title>T</title></head><body>';
const FONT = 'data:font/woff2;base64,AAAA';
const page = (script: string) => `${GOOD_HEAD}<script>${script}</script>${FONT}</body></html>`;

describe('checkHtml', () => {
  it('lässt eine saubere Seite unter dem Budget durch', () => {
    const r = checkHtml(page('var a=1;'), 4.59 * MIB);
    expect(r.problems).toEqual([]);
    expect(r.notes).toEqual([]);
  });

  it('warnt ab 6 MiB und blockiert ab 9 MiB', () => {
    expect(checkHtml(page('1'), WARN_BYTES).notes.join()).toContain('6 MiB');
    expect(checkHtml(page('1'), WARN_BYTES).problems).toEqual([]);
    expect(checkHtml(page('1'), FAIL_BYTES - 1).problems).toEqual([]);
    expect(checkHtml(page('1'), FAIL_BYTES).problems.join()).toContain('9 MiB');
    expect(checkHtml(page('1'), 16 * MIB).problems.join()).toContain('16 MB');
  });

  it('findet WebAssembly in jeder Schreibweise', () => {
    for (const code of ['WebAssembly.instantiate(b)', 'WebAssembly.compile(b)', 'new WebAssembly.Module(b)']) {
      expect(checkHtml(page(code), MIB).problems.join(), code).toContain('WebAssembly');
    }
  });

  it('findet fetch( und Entwicklungsmarker', () => {
    expect(checkHtml(page('fetch("/a")'), MIB).problems.join()).toContain('fetch()');
    expect(checkHtml(page('var m="installFakeRuntime"'), MIB).problems.join()).toContain('installFakeRuntime');
    expect(checkHtml(page('var m="listening-text@1"'), MIB).problems.join()).toContain('listening-text@');
  });

  it('blendet Base64-Blöcke vor den Marker-Prüfungen aus', () => {
    // Ein kurzer Marker, der zufällig in einem langen Base64-Block steht, ist kein Fund.
    const block = 'A'.repeat(300) + 'zzde' + 'B'.repeat(300);
    expect(checkHtml(page(`var p="${block}"`), MIB).problems).toEqual([]);
    // Außerhalb eines Blocks bleibt der Marker ein Fund.
    expect(checkHtml(page('var p="zzde"'), MIB).problems.join()).toContain('zzde');
  });
});

describe('ESLint-Sperren', () => {
  const dir = join(process.cwd(), 'src', '__lintprobe__');
  async function lint(code: string, name: string) {
    mkdirSync(dir, { recursive: true });
    const file = join(dir, name);
    writeFileSync(file, code);
    try {
      const eslint = new ESLint({ cwd: process.cwd() });
      const [res] = await eslint.lintFiles([file]);
      return (res?.messages ?? []).filter((m) => m.ruleId?.startsWith('no-restricted')).map((m) => m.ruleId);
    } finally {
      rmSync(file, { force: true });
    }
  }

  it('verbietet Importe aus Seed und Entwicklungs-Adapter, dynamisches import() und fetch', async () => {
    expect(await lint("import { installFakeRuntime } from '../platform/dev/install';\nexport const a = installFakeRuntime;\n", 'a.ts')).toContain('no-restricted-imports');
    expect(await lint("export const a = import('../platform/dev/install');\n", 'b.ts')).toContain('no-restricted-syntax');
    expect(await lint("export const a = fetch('/x');\n", 'c.ts')).toContain('no-restricted-globals');
    expect(await lint("export const a = globalThis.fetch;\n", 'd.ts')).toContain('no-restricted-properties');
  }, 60_000);
});
