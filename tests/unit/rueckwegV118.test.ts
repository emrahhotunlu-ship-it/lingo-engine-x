import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { checkoutV118, V118_DIR } from '../../scripts/v86-checkout.mjs';
import { createMemoryDb } from '../../src/platform/dev/memoryDb';
import { bridgeStatPatch } from '../../src/domain/apply/bridgeTime';
import { focusDoc, focusStep, readFocus } from '../../src/domain/grammar/focus';
import { freeUsePatch, readFreeUse } from '../../src/domain/grammar/freeUse';
import { outId } from '../../src/domain/nbdrill/outDoc';
import { readPlan } from '../../src/domain/plan/buildPlan';
import { loadSeed, type Doc } from './helpers';

// Rückweg-Test v118 (data-guard 13.11.2026, Großpaket P „Politur“): Die neuen, rein ergänzenden Felder der Politur – `grammar/<thema>.fo`
// (Fokus-Lauf) und `.fu` (frei verwendet), `app/profile.abm` (Zeit je Brücken-Satz, mit Rundenmarke `r`), `out/<Monat>` mit `k: 'bridge'`,
// `vmod/tempo` und Plan `u.gt.fo` – werden mit dem Code der Live-Version v118 (Commit 255c555f, per scripts/v86-checkout.mjs nach
// .cache/v118/) gelesen. Danach schreibt v118 mit eigenem Writer und eigener Logik (Grammatik-Antwort, Thema, Ergebnis einer anderen Übung,
// kurzer Tag), und die neuen Felder stehen noch da. Erfundene Daten (Seed + Politur-Felder).

checkoutV118();
const v118Validate = await import('../../.cache/v118/src/data/validate');
const v118Writer = await import('../../.cache/v118/src/data/writer');
const v118Grammar = await import('../../.cache/v118/src/domain/grammar/write');
const v118Out = await import('../../.cache/v118/src/domain/nbdrill/outDoc');
const v118Plan = await import('../../.cache/v118/src/domain/plan/buildPlan');
const v118Short = await import('../../.cache/v118/src/domain/plan/shortDay');

const TODAY = '2026-11-13';
const NOW = Date.parse(`${TODAY}T10:00:00+01:00`);
const TOPIC = 'conditionals';

const plan = (): Doc => ({
  d: TODAY,
  v: 1,
  ids: [],
  why: [],
  duty: [],
  goal: { review: 0 },
  lesson: null,
  at: NOW - 3_600_000,
  u: {
    v: 1,
    shape: 'std',
    goalMin: 25,
    theme: '',
    min: 25,
    b: [
      [1, 'words', 18],
      [2, 'grammar', 5],
      [3, 'apply', 3],
    ],
    gt: { intro: null, pats: ['cn.third'], topics: [TOPIC], fo: 1 },
  },
});

/** Seed + alle Politur-Felder, so wie die neue Fassung sie schreibt. */
function stateWithPolitur(): Record<string, Doc> {
  const docs = loadSeed();
  const g = docs[`grammar/${TOPIC}`]!;
  const fo = focusDoc(focusStep(null, { day: TODAY, clean: true, wrong: false, pat: 'cn.third', p: 0.6, stage: 1 }).next);
  const fu = freeUsePatch(g, 'cn.third', TODAY)!.fu;
  docs[`grammar/${TOPIC}`] = { ...g, fo, fu };
  docs['app/profile'] = { ...docs['app/profile'], ...bridgeStatPatch({}, [80_000, 100_000], 'bridge:2026-11-13:3:2:abc')!, plan: plan() };
  // Ergebnis eines Brücken-Satzes in der Form von `bridgeOutItem` (modules/apply/domain/bridgeResult.ts; dort mit Tests, hier ohne Modul-Tür).
  const item = { id: outId('bridge', NOW), k: 'bridge', d: TODAY, t: NOW, theme: 'vocab/client', ok: true, text: 'If we had called them earlier, we would have kept the client.', fb: { w: 'ok', p: 'ok', pat: 'cn.third', wd: 'client', lv: 4, s: 1 }, ms: 42_000 };
  docs['out/2026-11'] = { v: 1, items: [item] };
  // `vmod/tempo` in der Form, die die neue Fassung schreibt (`vmodTempoWriteSchema`, geprüft in tests/unit/vocab/tempo.test.ts).
  docs['vmod/tempo'] = { v: 1, d: TODAY, n: 6, base: 10, why: 'up', ok: 18, all: 20, t: NOW };
  return docs;
}

afterAll(() => {
  vi.restoreAllMocks();
});

describe('Rückweg v118: Lesen', () => {
  it('alle Dokumente mit Politur-Feldern sind unter den v118-Schemas gültig', () => {
    const docs = stateWithPolitur();
    const bad = Object.entries(docs)
      .map(([p, d]) => v118Validate.validateDoc(p, d))
      .filter((r) => !r.ok);
    expect(bad).toEqual([]);
    // Die geprüften Werte behalten die neuen Felder (v118 liest tolerant, nichts wird beim Lesen gestrippt).
    const g = v118Validate.validateDoc(`grammar/${TOPIC}`, docs[`grammar/${TOPIC}`]);
    expect(g.ok && g.value.fo).toEqual(docs[`grammar/${TOPIC}`]!.fo);
    expect(g.ok && g.value.fu).toEqual(docs[`grammar/${TOPIC}`]!.fu);
    const p = v118Validate.validateDoc('app/profile', docs['app/profile']);
    expect(p.ok && p.value.abm).toEqual({ n: 2, ms: 90_000, r: 'bridge:2026-11-13:3:2:abc' });
    const o = v118Validate.validateDoc('out/2026-11', docs['out/2026-11']);
    expect(o.ok && (o.value.items as Doc[])[0]!.k).toBe('bridge');
  });

  it('v118 liest den Plan mit Fokus-Thema (`u.gt.fo`) als gültigen Plan von heute; Thema und Muster wie gespeichert', () => {
    const r = v118Plan.readPlan(plan(), TODAY);
    expect(r).not.toBeNull();
    expect(r?.u?.gt).toMatchObject({ intro: null, pats: ['cn.third'], topics: [TOPIC] });
    // Die neue Fassung liest `fo` aus demselben Plan.
    expect(readPlan(plan(), TODAY)?.u?.gt?.fo).toBe(1);
  });

  it('v118 kennt `vmod/tempo` nicht (kein eigener Leser, nie geschrieben): das Dokument bleibt unberührt', () => {
    const hits: string[] = [];
    const walk = (dir: string): void => {
      for (const n of readdirSync(dir)) {
        const f = join(dir, n);
        if (statSync(f).isDirectory()) walk(f);
        else if (/\.(ts|tsx)$/.test(n) && readFileSync(f, 'utf8').includes('vmod/tempo')) hits.push(f);
      }
    };
    walk(join(V118_DIR, 'src'));
    expect(hits).toEqual([]);
  });
});

describe('Rückweg v118: Zurückschreiben', () => {
  it('v118 bucht eine Grammatik-Antwort im Thema: `fo` und `fu` bleiben', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const docs = stateWithPolitur();
    const h = createMemoryDb({ seed: docs });
    const writer = v118Writer.createWriter(h.db);
    const path = `grammar/${TOPIC}`;
    const cur = h.dump()[path] as Doc;
    const task = { key: 'k-v118', topic: TOPIC, type: 'gap', prompt: 'If we ___ (know), we would have acted.', answer: 'had known', accepted: [], options: null, hint: null, expl: { de: null, en: null }, src: 'seed', ref: null, errorT: null, pat: 'cn.third' };
    const answer = { kind: 'g', t: NOW + 60_000, day: TODAY, lang: 'de', ctx: 'duty', task, given: 'had known', dontKnow: false, verdict: 'correct', grade: 3, ms: 9000, help: { level: 0 }, judged: 'local' } as unknown as Parameters<typeof v118Grammar.grammarWrite>[1];
    const w = v118Grammar.grammarWrite(cur, answer);
    expect(w.kind).toBe('update');
    if (w.kind !== 'update') return;
    expect(Object.keys(w.patch)).not.toContain('fo');
    expect(Object.keys(w.patch)).not.toContain('fu');
    await writer.update(path, w.patch);
    const after = h.dump()[path] as Doc;
    expect(after.n).toBe((cur.n as number) + 1);
    expect(after.fo).toEqual(cur.fo);
    expect(after.fu).toEqual(cur.fu);
    // Die neue Fassung liest beides danach wie vorher.
    expect(readFocus(after)).toEqual(readFocus(cur));
    expect(readFreeUse((after.fu as Doc)['cn.third'])).toEqual({ n: 1, d: TODAY });
    expect(v118Validate.validateDoc(path, after).ok).toBe(true);
  });

  it('v118 ändert das Thema und verkürzt den Tag: `abm` (mit Rundenmarke) und `u.gt.fo` bleiben', async () => {
    const docs = stateWithPolitur();
    const h = createMemoryDb({ seed: docs });
    const writer = v118Writer.createWriter(h.db);
    // Thema ändern wie v118 (`writer.patch` mit `{ theme: { m } }`, verschmolzen).
    await writer.patch('app/profile', { theme: { m: 'light' } }, h.dump()['app/profile']);
    // Kurzer Tag wie v118 (`shortDayPlan` auf dem rohen Plan, `update` mit dem ganzen Plan).
    const raw = (h.dump()['app/profile'] as Doc).plan as Doc;
    const upd = v118Short.shortDayPlan(raw);
    expect(upd).not.toBeNull();
    await writer.update('app/profile', { plan: upd, kt: { [TODAY]: 1 } });
    const after = h.dump()['app/profile'] as Doc;
    expect((after.theme as Doc).m).toBe('light');
    expect(after.abm).toEqual({ n: 2, ms: 90_000, r: 'bridge:2026-11-13:3:2:abc' });
    expect(((after.plan as Doc).u as Doc).gt).toEqual({ intro: null, pats: ['cn.third'], topics: [TOPIC], fo: 1 });
    expect(readPlan(after.plan, TODAY)?.u?.gt?.fo).toBe(1);
    // Die Rundenmarke wirkt danach weiter: dieselbe Runde zählt nicht noch einmal.
    expect(bridgeStatPatch(after, [90_000], 'bridge:2026-11-13:3:2:abc')).toBeNull();
    expect(v118Validate.validateDoc('app/profile', after).ok).toBe(true);
  });

  it('v118 speichert das Ergebnis einer anderen Übung im selben Monat: der Brücken-Eintrag (`k: bridge`) bleibt', async () => {
    const docs = stateWithPolitur();
    const h = createMemoryDb({ seed: docs });
    const writer = v118Writer.createWriter(h.db);
    const bridge = ((h.dump()['out/2026-11'] as Doc).items as Doc[])[0]!;
    const other = { id: `clinic-${NOW + 5000}`, k: 'clinic', d: TODAY, t: NOW + 5000, theme: 'x', ok: true, text: 'We have been working on it since March.', fb: {}, ms: 30_000 };
    await writer.transform('out/2026-11', (cur: Doc | undefined) => v118Out.upsertOut(cur, other as Parameters<typeof v118Out.upsertOut>[1]));
    const items = (h.dump()['out/2026-11'] as Doc).items as Doc[];
    expect(items).toHaveLength(2);
    expect(items).toContainEqual(bridge);
    expect(v118Validate.validateDoc('out/2026-11', h.dump()['out/2026-11']).ok).toBe(true);
  });
});
