// Inhaltsspeicher (Lernplattform 3.0 P10): Packen, Laden, Manifest, doppelte id, fehlende Unterstützung.
import { inflateRawSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { packBundle } from '../../scripts/content/pack.mjs';
import { contentStore } from '../../scripts/content/vite-plugin.mjs';
import { contentManifest, inflateBase64, loadPacked, packedSupported, resetPackedCache } from '../../src/content/store';

const files = { 'a.json': { v: 1, items: [{ id: 'x-1', kind: 'kwt', t: 'Ä ß “quote”' }, { id: 'x-2', kind: 'err' }] }, 'b.json': { v: 1, items: [{ id: 'x-3', kind: 'kwt' }] } };
const io = (f: Record<string, unknown>) => ({ files: Object.keys(f), read: (p: string) => JSON.stringify(f[p]) });

afterEach(() => {
  vi.unstubAllGlobals();
  resetPackedCache();
});

describe('packBundle', () => {
  it('ist deterministisch und entpackt byte-genau mit zlib und mit DecompressionStream', async () => {
    const a = packBundle({ dirs: [] }, io(files));
    const b = packBundle({ dirs: [] }, io(files));
    expect(a.b64).toBe(b.b64);
    expect(a.count).toBe(3);
    const viaZlib = inflateRawSync(Buffer.from(a.b64, 'base64')).toString('utf8');
    expect(viaZlib).toBe(a.json);
    expect(await inflateBase64(a.b64)).toBe(viaZlib);
    expect(Buffer.byteLength(viaZlib)).toBe(a.rawBytes);
    expect(Buffer.from(a.b64, 'base64').length).toBe(a.packedBytes);
  });

  it('bricht bei doppelter id ab', () => {
    const bad = { ...files, 'c.json': { v: 1, items: [{ id: 'x-1', kind: 'kwt' }] } };
    expect(() => packBundle({ dirs: [] }, io(bad))).toThrow(/Doppelte id "x-1"/);
  });

  it('filtert nach kind und weist Marker, kaputtes JSON und falsche Form ab', () => {
    expect(packBundle({ dirs: [], kind: 'kwt' }, io(files)).count).toBe(2);
    expect(() => packBundle({ dirs: [] }, { files: ['m.json'], read: () => '{"v":1,"items":[{"id":"q","t":"installFakeRuntime"}]}' })).toThrow(/Marker/);
    expect(() => packBundle({ dirs: [] }, { files: ['m.json'], read: () => '{' })).toThrow(/JSON/);
    expect(() => packBundle({ dirs: [] }, { files: ['m.json'], read: () => '{"items":[]}' })).toThrow(/v": 1/);
  });
});

describe('Vite-Plugin', () => {
  it('liefert Manifest und Module; Größe des Moduls entspricht dem Manifest', () => {
    const plugin = contentStore() as unknown as { load: (id: string) => string | null; buildStart: () => void };
    plugin.buildStart();
    const manifest = JSON.parse(plugin.load('\0virtual:content/manifest')!.replace(/^export default /, '').replace(/;$/, '')) as Record<string, { count: number; rawBytes: number; packedBytes: number }>;
    expect(Object.keys(manifest)).toContain('c1x-kwt');
    for (const [name, info] of Object.entries(manifest)) {
      const mod = plugin.load(`\0virtual:content/${name}`)!;
      const b64 = JSON.parse(mod.replace(/^export default /, '').replace(/;$/, '')) as string;
      expect(Math.ceil(info.packedBytes / 3) * 4, name).toBe(b64.length);
    }
    expect(plugin.load('\0virtual:content/loaders')).toContain('"c1x-kwt": () => import("virtual:content/c1x-kwt")');
    expect(contentManifest['c1x-kwt']).toEqual(manifest['c1x-kwt']);
  });
});

describe('loadPacked', () => {
  it('lädt jedes Bündel, einmal je Name, mit derselben Zahl wie das Manifest', async () => {
    expect(packedSupported()).toBe(true);
    for (const [name, info] of Object.entries(contentManifest)) {
      const doc = await loadPacked<{ id: string }>(name);
      expect(doc?.items.length, name).toBe(info.count);
    }
    expect(loadPacked('c1x-kwt')).toBe(loadPacked('c1x-kwt'));
  });

  it('liefert null und meldet, wenn DecompressionStream fehlt oder das Bündel unbekannt ist', async () => {
    expect(await loadPacked('gibt-es-nicht')).toBeNull();
    resetPackedCache();
    vi.stubGlobal('DecompressionStream', undefined);
    expect(packedSupported()).toBe(false);
    expect(await loadPacked('c1x-kwt')).toBeNull();
  });
});
