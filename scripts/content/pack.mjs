// Inhalts-Packer (Lernplattform 3.0 §3.7, P10): liest die Quelldateien eines Bündels, prüft doppelte `id`
// und Entwicklungs-Marker, schreibt deterministisch `{ v: 1, items }`, komprimiert mit deflate-raw und kodiert Base64.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { devMarkers, removedTemplates } from '../check-platform.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;

/** Alle *.json eines Ordners (nicht rekursiv über README u. ä.), nach Pfad sortiert. */
function jsonFiles(dir) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.json')) out.push(p);
    }
  };
  walk(abs);
  return out;
}

/**
 * Packt ein Bündel.
 * @param {{ dirs: string[], kind?: string }} spec
 * @param {{ read?: (path: string) => string, files?: string[] }} [io] nur für Tests
 * @returns {{ json: string, b64: string, count: number, rawBytes: number, packedBytes: number, files: string[] }}
 */
export function packBundle(spec, io = {}) {
  const read = io.read ?? ((p) => readFileSync(p, 'utf8'));
  const files = io.files ?? [...new Set(spec.dirs.flatMap(jsonFiles))].sort();
  const seen = new Map();
  const items = [];
  for (const file of files) {
    const label = relative(ROOT, file) || file;
    const text = read(file);
    for (const m of [...devMarkers, ...removedTemplates]) {
      if (text.includes(m)) throw new Error(`Inhalt ${label}: verbotener Marker "${m}"`);
    }
    let doc;
    try {
      doc = JSON.parse(text);
    } catch (e) {
      throw new Error(`Inhalt ${label}: kein gültiges JSON (${e instanceof Error ? e.message : String(e)})`, { cause: e });
    }
    if (!doc || doc.v !== 1 || !Array.isArray(doc.items)) throw new Error(`Inhalt ${label}: erwartet { "v": 1, "items": [...] }`);
    for (const it of doc.items) {
      if (spec.kind && it?.kind !== spec.kind) continue;
      if (typeof it?.id !== 'string' || !it.id) throw new Error(`Inhalt ${label}: Eintrag ohne id`);
      if (seen.has(it.id)) throw new Error(`Doppelte id "${it.id}" in ${label} und ${seen.get(it.id)}`);
      seen.set(it.id, label);
      items.push(it);
    }
  }
  const json = JSON.stringify({ v: 1, items });
  const rawBytes = Buffer.byteLength(json, 'utf8');
  const packed = deflateRawSync(Buffer.from(json, 'utf8'), { level: 9 });
  return { json, b64: packed.toString('base64'), count: items.length, rawBytes, packedBytes: packed.length, files };
}
