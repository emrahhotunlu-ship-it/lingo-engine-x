import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { legacyV2Items } from '../../src/domain/c1x/legacyV2';
import type { C1Item } from '../../src/domain/c1x/types';
import { v2Tasks } from '../../src/domain/grammar/patterns';
import { countKinds, learnerSheet, playC1, playSeed, playV2, type Finding, type PlayOpts } from '../../src/domain/grammar/taskPlayer';
import { seedTasks } from '../../src/domain/grammar/tasks';

// Aufgaben-Spieler (Paket Q0, docs/umbau/auftraege/q0.md): jede Aufgabe aller Arten mit Musterlösung, jeder Alternative und typischen
// Fehlern durch die echte Prüf- und Anzeige-Logik. Rot = kein Test-Link.
//  · Befunde a, c, d (Anzeige widerspricht der Eingabe, Abkürzung ohne Hinweis, widersprüchliche Wortzahlen) müssen 0 sein.
//  · Inhaltsbefunde a2, b, e dürfen nur noch abnehmen: jeder steht in `tests/unit/taskPlayer.open.json` (Liste offener Aufgaben,
//    wird bei jeder Inhaltscharge kleiner). Ein neuer Befund ist rot.
// Bericht: `PLAYER_REPORT=<datei> npx vitest run tests/unit/taskPlayer.test.ts` schreibt alle Befunde (vorher/nachher) als JSON.

const C1X = 'src/content/c1x/src';
function c1xSeed(): C1Item[] {
  const out: C1Item[] = [];
  for (const dir of ['kwt', 'err', 'ocl', 'wf', 'pilot']) {
    const d = join(C1X, dir);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter((x) => x.endsWith('.json')).sort()) {
      const doc = JSON.parse(readFileSync(join(d, f), 'utf8')) as { items?: C1Item[] };
      for (const it of doc.items ?? []) if (['kwt', 'err', 'ocl', 'wf'].includes(it.kind)) out.push(it);
    }
  }
  return out;
}

function playAll(opts: PlayOpts): { findings: Finding[]; total: Record<string, number> } {
  const findings: Finding[] = [];
  const v2 = v2Tasks();
  for (const t of v2) findings.push(...playV2(t, opts));
  const adapter = legacyV2Items();
  for (const it of adapter) findings.push(...playC1(it, opts));
  const seed = c1xSeed();
  for (const it of seed) findings.push(...playC1(it, opts));
  const seeds = seedTasks().filter((t) => t.accepted.length > 0);
  for (const t of seeds) findings.push(...playSeed(t, `${t.topic}|${t.key}`, opts));
  const total = {
    v2: v2.length,
    v2_kwt: v2.filter((t) => t.type === 'kwt').length,
    v2_find: v2.filter((t) => t.type === 'find').length,
    v2_meaning: v2.filter((t) => t.type === 'meaning').length,
    c1x_adapter: adapter.length,
    c1x_seed: seed.length,
    seed_with_accepted: seeds.length,
  };
  return { findings, total };
}

// Vom english-teacher geprüfte Ausnahmen „Abschreiben“ (`copyOk` in scripts/grammar/q0-open.json), auch als c1x-Adapter-Aufgabe `kwt-v2-<n>`.
const Q0_OPEN = JSON.parse(readFileSync('scripts/grammar/q0-open.json', 'utf8')) as { copyOk?: string[] };
const copyOk = new Set<string>(Q0_OPEN.copyOk ?? []);
v2Tasks().forEach((t, i) => {
  if (copyOk.has(t.id)) copyOk.add(`kwt-v2-${i + 1}`);
});
const keyOf = (f: Finding): string => `${f.path}|${f.id}|${f.kind}|${f.input ?? f.note}`;
const OPEN_FILE = 'tests/unit/taskPlayer.open.json';
const open: Set<string> = new Set(existsSync(OPEN_FILE) ? (JSON.parse(readFileSync(OPEN_FILE, 'utf8')) as string[]) : []);

describe('Aufgaben-Spieler (Q0)', () => {
  const de = playAll({ lang: 'de' });
  const en = playAll({ lang: 'en' });
  const after = [...de.findings, ...en.findings.filter((f) => f.kind === 'a' || f.kind === 'a2')].filter((f) => !(f.kind === 'b' && copyOk.has(f.id)));

  if (process.env.PLAYER_REPORT) {
    const before = [...playAll({ lang: 'de', before: true }).findings, ...playAll({ lang: 'en', before: true }).findings.filter((f) => f.kind === 'a' || f.kind === 'a2')];
    const uniq = (fs: Finding[]) => [...new Map(fs.map((f) => [keyOf(f), f])).values()];
    writeFileSync(process.env.PLAYER_REPORT, JSON.stringify({ total: de.total, before: countKinds(uniq(before)), after: countKinds(uniq(after)), findings: uniq(after), beforeFindings: uniq(before) }, null, 1));
  }

  // Lernenden-Ansicht für die Gegenlesung: PLAYER_SHOW=<id,id,…> PLAYER_SHOW_OUT=<datei> (DE und EN).
  if (process.env.PLAYER_SHOW && process.env.PLAYER_SHOW_OUT) {
    const ids = new Set(process.env.PLAYER_SHOW.split(','));
    const v2 = v2Tasks().filter((t) => ids.has(t.id));
    const c1 = c1xSeed().filter((t) => ids.has(t.id));
    const seed = seedTasks().filter((t) => ids.has(`${t.topic}|${t.key}`));
    const lines: string[] = [];
    for (const lang of ['de', 'en'] as const) {
      lines.push(`===== ${lang.toUpperCase()} =====`);
      for (const t of v2) lines.push(`## ${t.id}`, ...learnerSheet({ v2: t }, lang));
      for (const t of c1) lines.push(`## ${t.id}`, ...learnerSheet({ c1: t }, lang));
      for (const t of seed) lines.push(`## ${t.topic}|${t.key}`, ...learnerSheet({ seed: t }, lang));
    }
    writeFileSync(process.env.PLAYER_SHOW_OUT, lines.join('\n') + '\n');
  }

  it('spielt alle Aufgaben', () => {
    expect(de.total.v2).toBeGreaterThan(1000);
    expect(de.total.c1x_seed).toBeGreaterThan(100);
  });

  it('keine Anzeige, die der Eingabe widerspricht (a), keine Abkürzung ohne Hinweis (c), keine widersprüchliche Wortzahl (d)', () => {
    const hard = after.filter((f) => f.kind === 'a' || f.kind === 'c' || f.kind === 'd');
    expect(hard.map((f) => `${keyOf(f)} · ${f.note}`)).toEqual([]);
  });

  it('Inhaltsbefunde (a2, b, e) nur aus der Liste offener Aufgaben', () => {
    const fresh = after.filter((f) => (f.kind === 'a2' || f.kind === 'b' || f.kind === 'e') && !open.has(keyOf(f)));
    expect(fresh.map((f) => `${keyOf(f)} · ${f.note}`)).toEqual([]);
  });

  it('pc-rc-k1 und art-snd-k2 sind ohne Befund', () => {
    expect(after.filter((f) => (f.id === 'pc-rc-k1' || f.id === 'art-snd-k2') && f.kind !== 'f')).toEqual([]);
  });
});
