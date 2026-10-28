import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

// Relaunch P1 S1-TOK (Abnahme): Farbwerte stehen nur in den Token-Blöcken von src/styles/index.css
// (:root mit [data-theme]/[data-accent]). Alles andere zeigt auf Tokens. Kein Weichzeichner (backdrop-filter) mehr.

const ROOT = new URL('../../', import.meta.url).pathname;
const STYLES = join(ROOT, 'src/styles');

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? cssFiles(join(dir, e.name)) : e.name.endsWith('.css') ? [join(dir, e.name)] : []));
}
const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '');

/** Token-Block: Selektor nur aus :root mit [data-theme=…]/[data-accent=…], ohne Verschachtelung. */
const TOKEN_BLOCK = /(^|\n)\s*:root(?:\[data-(?:theme|accent)='[\w-]+'\])*(?:,\s*:root(?:\[data-(?:theme|accent)='[\w-]+'\])*)*\s*\{[^{}]*\}/g;

const NAMED = ['white', 'black', 'red', 'green', 'blue', 'gray', 'grey', 'silver', 'orange', 'yellow', 'purple', 'pink', 'violet', 'cyan', 'magenta', 'gold', 'navy', 'teal', 'lime', 'maroon', 'olive', 'aqua', 'fuchsia', 'indigo', 'brown', 'tan', 'beige', 'ivory', 'coral', 'salmon', 'crimson'];
const LITERALS: Array<[string, RegExp]> = [
  ['Hex', /#[0-9a-fA-F]{3,8}(?![\w-])/],
  ['Farbfunktion', /(?<![\w-])(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\(/i],
  ['Farbname', new RegExp(`(?<![\\w-])(?:${NAMED.join('|')})(?![\\w-])`, 'i')],
];

/** Werte aller Deklarationen (`eigenschaft: wert;`), Selektoren bleiben außen vor (#lx-boot ist kein Farbwert). */
function values(css: string): string[] {
  return [...css.matchAll(/[\w-]+\s*:\s*([^;{}]+)[;}]/g)].map((m) => m[1] ?? '');
}

describe('keine Farbliterale außerhalb der Token-Blöcke', () => {
  const files = cssFiles(STYLES);

  it('findet die Stylesheets (index, bridge, Teile)', () => {
    const names = files.map((f) => relative(STYLES, f));
    expect(names).toContain('index.css');
    expect(names).toContain('bridge.css');
    expect(names).toContain('parts/shell.css');
    expect(names).toContain('parts/band.css');
  });

  it.each(files.map((f) => [relative(STYLES, f), f]))('%s', (_name, file) => {
    let css = stripComments(readFileSync(file, 'utf8'));
    if (file.endsWith('/styles/index.css')) css = css.replace(TOKEN_BLOCK, '\n');
    const hits: string[] = [];
    for (const v of values(css)) for (const [kind, re] of LITERALS) if (re.test(v)) hits.push(`${kind}: ${v.trim().slice(0, 90)}`);
    expect(hits).toEqual([]);
  });

  it('die Token-Blöcke selbst enthalten die Farbwerte (Gegenprobe, dass der Test etwas ausnimmt)', () => {
    const css = stripComments(readFileSync(join(STYLES, 'index.css'), 'utf8'));
    const blocks = css.match(TOKEN_BLOCK) ?? [];
    expect(blocks.length).toBeGreaterThanOrEqual(5);
    expect(blocks.join('\n')).toMatch(/oklch\(/);
  });

  it('bridge.css enthält nur Verweise auf Tokens', () => {
    const css = stripComments(readFileSync(join(STYLES, 'bridge.css'), 'utf8'));
    for (const v of values(css)) expect(v.trim(), v).toMatch(/^(var\(--[\w-]+\)|none)$/);
  });
});

it('kein backdrop-filter in src/styles (Glas entfällt)', () => {
  for (const f of cssFiles(STYLES)) expect(stripComments(readFileSync(f, 'utf8')), relative(STYLES, f)).not.toMatch(/backdrop-filter/);
});

it('jede in CSS benutzte --lx-Variable ohne Ersatzwert ist definiert (CSS oder aus dem Code gesetzt)', () => {
  const all = cssFiles(STYLES).map((f) => stripComments(readFileSync(f, 'utf8'))).join('\n');
  const defined = new Set([...all.matchAll(/(--lx-[\w-]+)\s*:/g)].map((m) => m[1]));
  const code = (dir: string): string =>
    readdirSync(dir, { withFileTypes: true })
      .map((e) => (e.isDirectory() ? code(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? readFileSync(join(dir, e.name), 'utf8') : ''))
      .join('\n');
  const src = code(join(ROOT, 'src'));
  const missing = [...new Set([...all.matchAll(/var\((--lx-[\w-]+)\)/g)].map((m) => m[1] ?? ''))].filter((v) => !defined.has(v) && !src.includes(`'${v}'`) && !src.includes(`"${v}"`));
  expect(missing).toEqual([]);
});

// Schrift: 'opsz' 32 für Überschriften nur, wenn die eingebettete Datei die Achse hat (Plan P1).
it('eingebettete Inter hat die Achse opsz (bis 32) und Überschriften nutzen sie', () => {
  const css = readFileSync(join(STYLES, 'index.css'), 'utf8');
  const src = /src: url\('([^']+\.woff2)'\)/.exec(css)?.[1] ?? '';
  const buf = readFileSync(new URL(src, new URL('../../src/styles/', import.meta.url)));
  expect(buf.toString('latin1', 0, 4)).toBe('wOF2');
  const known = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];
  let p = 48;
  const base128 = (): number => {
    let v = 0;
    for (let i = 0; i < 5; i++) {
      const b = buf[p++] ?? 0;
      v = (v << 7) | (b & 0x7f);
      if (!(b & 0x80)) break;
    }
    return v;
  };
  const tables: Array<{ tag: string; len: number; off: number }> = [];
  for (let i = 0, n = buf.readUInt16BE(12); i < n; i++) {
    const flags = buf[p++] ?? 0;
    let tag = known[flags & 0x3f] ?? '';
    if ((flags & 0x3f) === 63) {
      tag = buf.toString('latin1', p, p + 4);
      p += 4;
    }
    const xf = (flags >> 6) & 3;
    let len = base128();
    if (tag === 'glyf' || tag === 'loca' ? xf === 0 : xf !== 0) len = base128();
    tables.push({ tag, len, off: 0 });
  }
  const data = brotliDecompressSync(buf.subarray(p, p + buf.readUInt32BE(20)));
  let off = 0;
  for (const t of tables) {
    t.off = off;
    off += t.len;
  }
  const fvar = tables.find((t) => t.tag === 'fvar');
  expect(fvar, 'fvar-Tabelle').toBeTruthy();
  const f = data.subarray(fvar!.off);
  const axes: Record<string, number> = {};
  for (let i = 0; i < f.readUInt16BE(8); i++) {
    const a = f.subarray(f.readUInt16BE(4) + i * f.readUInt16BE(10));
    axes[a.toString('latin1', 0, 4)] = a.readInt32BE(12) / 65536;
  }
  expect(axes.opsz).toBeGreaterThanOrEqual(32);
  expect(css).toMatch(/h1,\s*h2,\s*\.lx-t-display,\s*\.lx-t-title\s*\{\s*font-variation-settings: 'opsz' 32;/);
});
