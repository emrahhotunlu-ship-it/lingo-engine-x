import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createWriter } from '../../../src/data/writer';
import { snapshotFromRecord } from '../../../src/data/snapshot';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { lexOf } from '../../../src/modules/vocab/data/lex';
import { lexWriteSchema, vcfgSchema } from '../../../src/modules/vocab/data/schemas';
import { VOCAB_LOCK_PATH } from '../../../src/modules/vocab/registry';
import { buildInput, catchUpAll, enableModule, fromRead, lockHolder, migrationDone, preview, reenableModule, setModuleSwitch, summaryText } from '../../../src/modules/vocab/ui/switch';

// „Neue Wörter-App einschalten“ (plan.md §9.3/9.4): Eingabe aus vollem Lesen, Wächter, Schalter `vcfg.mod`, Rückweg und Nachholen.
// Nur erfundene Daten (seed/sample-data.json und Testfälle hier).

type Doc = Record<string, unknown>;
const ROOT = join(import.meta.dirname, '../../..');
const NOW = Date.parse('2026-11-02T18:00:00Z');
const DAY = 86_400_000;
const seed = JSON.parse(readFileSync(join(ROOT, 'seed/sample-data.json'), 'utf8')) as Record<string, Doc>;
const EXTRA: Record<string, Doc> = {
  'vocab/deadline': { id: 'deadline', word: 'deadline', de: 'Frist', pos: 'noun', ex: 'The deadline is Friday.', reps: 4, last: NOW - DAY, state: 'review', S: 5, D: 5, due: NOW, stage: 3 },
  'vocab/deadline-2': { id: 'deadline-2', word: 'Deadline', de: 'Frist', pos: 'noun', ex: 'We met the deadline.', reps: 2, last: NOW - 3 * DAY, state: 'review', S: 2, D: 5, due: NOW, stage: 2 },
  'vocab/hidden-one': { id: 'hidden-one', word: 'obsolete', de: 'veraltet', ex: 'This is obsolete.', reps: 2, last: NOW - DAY, state: 'review', S: 2, D: 5, due: NOW, stage: 2, hidden: true },
};
const all = (): Record<string, Doc> => ({ ...seed, ...EXTRA, 'app/schema': { version: 1, cutover: '2026-09-26', migratedAt: 1 } });
const guards = { confirmed: true, backupWritten: true, profileValid: true, possiblyTruncated: false, holder: 'dtest-tab1' };
const without = (d: Doc, key: string): Doc => Object.fromEntries(Object.entries(d).filter(([k]) => k !== key));
const stateOf = (d: Record<string, Doc>, truncated: string[] = []) => fromRead(snapshotFromRecord(d, truncated), NOW);

describe('Einschalten: Eingabe und Probelauf', () => {
  it('Eingabe aus einem vollen Lesen: nur Karten und Tagesprotokolle; vom App-Schema abgelehnte Karten bleiben draußen und stehen im Bericht', () => {
    const d = { ...all(), 'vocab/broken': { id: 'broken', de: 'kaputt', reps: 'x' } } as Record<string, Doc>;
    const snap = snapshotFromRecord(d);
    const st = fromRead(snap, NOW);
    const cards = Object.keys(d).filter((p) => /^(vocab|chunk)\//.test(p));
    const invalid = new Set(snap.invalid.map((x) => x.path));
    expect(st.input.docs.size + st.skipped.length).toBe(cards.length);
    for (const p of st.input.docs.keys()) expect(invalid.has(p), p).toBe(false);
    for (const s of st.skipped) expect(s).toEqual({ path: s.path, why: 'invalid' });
    const logDays = Object.keys(d).filter((p) => p.startsWith('log/') && !invalid.has(p)).map((p) => p.slice(4));
    expect([...st.input.logs.keys()].sort()).toEqual(logDays.sort());
    expect(st.profileValid).toBe(true);
    expect(st.truncated).toBe(false);
    expect(st.schema).toEqual(d['app/schema']);
  });

  it('Wächter: gekappt nur bei vocab/chunk/log; Profil fehlt oder ungültig → profileValid false', () => {
    expect(stateOf(all(), ['vocab']).truncated).toBe(true);
    expect(stateOf(all(), ['log']).truncated).toBe(true);
    expect(stateOf(all(), ['feed']).truncated).toBe(false);
    const noProfile = all();
    delete noProfile['app/profile'];
    expect(stateOf(noProfile).profileValid).toBe(false);
    expect(stateOf({ ...all(), 'app/profile': { days: 'kaputt' } }).profileValid).toBe(false);
  });

  it('Bericht: Gruppen wie die Übersicht, zusammen gleich der Zahl der Wörter; bestätigtes Doppel zählt einmal und bleibt wählbar', () => {
    const st = stateOf(all());
    const { report, summary } = preview(st.input, [], st.skipped);
    expect(summary.fresh + summary.recognize + summary.onway + summary.produce).toBe(summary.words);
    expect(summary.words).toBe(report.lexemes);
    expect(summary.skipped).toContainEqual({ path: 'vocab/hidden-one', why: 'hidden' });
    const pair = summary.dupes.find((p) => [p.lead, p.other].sort().join() === 'vocab/deadline,vocab/deadline-2');
    expect(pair, 'deadline/Deadline als mögliches Doppel').toBeDefined();
    const merged = preview(st.input, [[pair!.lead, pair!.other]], st.skipped).summary;
    expect(merged.words).toBe(summary.words - 1);
    expect(merged.fresh + merged.recognize + merged.onway + merged.produce).toBe(merged.words);
    expect(merged.dupes).toEqual(summary.dupes);
    const text = summaryText(merged, [[pair!.lead, pair!.other]]);
    expect(text).toContain(`Wörter ${merged.words}`);
    expect(text).toContain(`${pair!.lead}|${pair!.other}(${pair!.why},zusammen)`);
    expect(text).toContain('vocab/hidden-one(hidden)');
    expect(text.length).toBeLessThan(6000);
  });

  it('buildInput: Tagesprotokolle ohne Liste oder mit fremden Einträgen werden tolerant gelesen', () => {
    const raw = new Map<string, Doc>([
      ['log/2026-10-01', { entries: [{ t: 1, k: 'v', id: 'a' }, 'kaputt', { k: 'v' }] }],
      ['log/2026-10-02', { foo: 1 }],
      ['vocab/a', { word: 'a' }],
    ]);
    const { input } = buildInput(raw, [], NOW);
    expect(input.logs.get('2026-10-01')).toEqual([{ t: 1, k: 'v', id: 'a' }]);
    expect(input.logs.has('2026-10-02')).toBe(false);
    expect([...input.docs.keys()]).toEqual(['vocab/a']);
  });

  it('Sperren-Kennung: Gerät + Tab', () => {
    expect(lockHolder()).toMatch(/^[a-z0-9]{6,16}-[a-z0-9]+$/);
  });
});

describe('Einschalten: Übernehmen, Schalter und Rückweg', () => {
  it('Schalter: legt vcfg mit Standardwerten an, ändert sonst nichts am Profil; ungültiges vcfg wird nie überschrieben', async () => {
    const h = createMemoryDb({ seed: all() });
    const w = createWriter(h.db);
    const before = h.dump()['app/profile'] as Doc;
    expect(before.vcfg).toBeUndefined();
    expect(await setModuleSwitch(w, 0)).toBe(true);
    expect(h.writes(), 'aus + kein vcfg: nichts zu schreiben').toEqual([]);
    expect(await setModuleSwitch(w, 1)).toBe(true);
    const after = h.dump()['app/profile'] as Doc;
    expect(vcfgSchema.parse(after.vcfg)).toEqual({ min: 15, ret: 0.9, mod: 1 });
    expect(without(after, 'vcfg')).toEqual(before);
    // Eigene Einstellungen bleiben beim Umschalten erhalten.
    await setModuleSwitch(w, 0);
    expect((h.dump()['app/profile'] as Doc).vcfg).toEqual({ min: 15, ret: 0.9, mod: 0 });

    const bad = createMemoryDb({ seed: { ...all(), 'app/profile': { ...before, vcfg: { min: 99, mod: 0 } } } });
    expect(await setModuleSwitch(createWriter(bad.db), 1)).toBe(false);
    expect(bad.writes()).toEqual([]);
    const none = createMemoryDb({ seed: {} });
    expect(await setModuleSwitch(createWriter(none.db), 1)).toBe(false);
    expect(none.dump()['app/profile'], 'fehlendes Profil wird nie angelegt').toBeUndefined();
  });

  it('gesperrt (ohne Sicherung, gekappt, Profil ungültig) → nichts geschrieben, Schalter bleibt aus', async () => {
    for (const g of [{ backupWritten: false }, { possiblyTruncated: true }, { profileValid: false }, { confirmed: false }]) {
      const h = createMemoryDb({ seed: all() });
      const st = stateOf(h.dump());
      const r = await enableModule(createWriter(h.db), st.input, { ...guards, ...g });
      expect(r.state).toBe('blocked');
      expect(h.writes()).toEqual([]);
    }
  });

  it('besetzt (anderer Tab hält die Sperre) → kein Schalter, Grund „busy“', async () => {
    const h = createMemoryDb({ seed: all() });
    const w = createWriter(h.db);
    expect((await w.acquire(VOCAB_LOCK_PATH, { holder: 'dother-tab9', ttlMs: 60_000 })).acquired).toBe(true);
    const r = await enableModule(w, stateOf(h.dump()).input, guards);
    expect(r.state).toBe('busy');
    expect((h.dump()['app/profile'] as Doc).vcfg).toBeUndefined();
  });

  it('Übernehmen → Umrechnung fertig, mod = 1; nochmal (anderer Tab) → already, nichts doppelt', async () => {
    const h = createMemoryDb({ seed: all() });
    const w = createWriter(h.db);
    const r = await enableModule(w, stateOf(h.dump()).input, guards);
    expect(r.state).toBe('done');
    const d = h.dump() as Record<string, Doc>;
    expect(migrationDone(d['app/schema'])).toBe(true);
    expect((d['app/profile']!.vcfg as Doc).mod).toBe(1);
    expect(lexOf(d['vocab/deadline'])).not.toBeNull();
    const once = JSON.stringify(h.dump());
    const again = await enableModule(createWriter(h.db), stateOf(h.dump()).input, { ...guards, holder: 'dtest-tab2' });
    expect(['already', 'busy']).toContain(again.state);
    expect(JSON.stringify(h.dump())).toBe(once);
  });

  it('bestätigtes Doppel wird zusammengelegt (of), unbestätigtes bleibt getrennt', async () => {
    const h = createMemoryDb({ seed: all() });
    const st = stateOf(h.dump());
    const pair = preview(st.input, [], st.skipped).summary.dupes.find((p) => [p.lead, p.other].sort().join() === 'vocab/deadline,vocab/deadline-2')!;
    await enableModule(createWriter(h.db), { ...st.input, confirmedPairs: [[pair.lead, pair.other]] }, guards);
    const d = h.dump() as Record<string, Doc>;
    expect(lexOf(d[pair.other])?.of).toBe(pair.lead);
    const h2 = createMemoryDb({ seed: all() });
    await enableModule(createWriter(h2.db), stateOf(h2.dump()).input, guards);
    expect(lexOf((h2.dump() as Record<string, Doc>)[pair.other])?.of).toBeNull();
  });

  it('Rückweg: mod = 0, Antworten im alten Bereich, wieder an → ohne neue Umrechnung, Antworten nachgeholt, neue Karte umgerechnet', async () => {
    const h = createMemoryDb({ seed: all() });
    const w = createWriter(h.db);
    await enableModule(w, stateOf(h.dump()).input, guards);
    expect(await setModuleSwitch(w, 0)).toBe(true);
    let d = h.dump() as Record<string, Doc>;
    expect((d['app/profile']!.vcfg as Doc).mod).toBe(0);
    const lex0 = lexOf(d['vocab/deadline'])!;
    const schemaBefore = JSON.stringify(d['app/schema']);
    // Alter Bereich: eine Antwort auf „deadline“ (hist + last) und eine neu angelegte Karte ohne `lex`.
    const t = NOW + 2 * DAY;
    const old = d['vocab/deadline']!;
    d['vocab/deadline'] = { ...old, last: t, reps: 5, hist: [...((old.hist as unknown[]) ?? []), { t, g: 3, x: 'type' }] };
    d['vocab/fresh-card'] = { id: 'fresh-card', word: 'leverage', de: 'nutzen', ex: 'We leverage data.', state: 'new' };
    h.load(d);
    const before = h.dump() as Record<string, Doc>;
    const n0 = h.writes().length;

    // Nicht umgestellt → gesperrt.
    expect((await reenableModule(w, stateOf(before).input, { schema: {}, profileValid: true, possiblyTruncated: false })).why).toBe('not_migrated');
    expect((await reenableModule(w, stateOf(before).input, { schema: before['app/schema']!, profileValid: true, possiblyTruncated: true })).why).toBe('possibly_truncated');
    expect(h.writes().length).toBe(n0);

    const st = stateOf(before);
    const r = await reenableModule(w, { ...st.input, nowMs: t + 1000 }, { schema: st.schema, profileValid: st.profileValid, possiblyTruncated: st.truncated });
    expect(r.state).toBe('done');
    expect(r.caught).toMatchObject({ docs: 1, applied: 1, added: 1 });
    d = h.dump();
    expect((d['app/profile']!.vcfg as Doc).mod).toBe(1);
    expect(JSON.stringify(d['app/schema']), 'keine neue Umrechnung').toBe(schemaBefore);
    const lex1 = lexOf(d['vocab/deadline'])!;
    expect(lex1.sync).toBe(t);
    expect(lex1.u.reps).toBe(lex0.u.reps + 1);
    expect(lexWriteSchema.safeParse(lex1).success).toBe(true);
    // Alte Felder unberührt.
    expect(without(d['vocab/deadline']!, 'lex')).toEqual(without(before['vocab/deadline']!, 'lex'));
    expect(lexOf(d['vocab/fresh-card'])).not.toBeNull();
    // Ausgeblendete Karte (bei der Umrechnung übersprungen) wird auch beim Nachholen nicht umgerechnet.
    expect(d['vocab/hidden-one'], 'ausgeblendet bleibt unberührt').toEqual(before['vocab/hidden-one']);
    // Nochmal: nichts mehr nachzuholen.
    const again = await catchUpAll(w, stateOf(h.dump()).input.docs, st.input.logs, t + 2000);
    expect(again).toEqual({ docs: 0, applied: 0, added: 0, incomplete: [] });
  });
});
