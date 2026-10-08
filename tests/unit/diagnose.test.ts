/* eslint-disable @typescript-eslint/prefer-promise-reject-errors -- contract/sample.d.ts: `sample` lehnt mit schlichten Objekten ab. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { askJson, resetAiGate } from '../../src/ai/gate';
import { resetAiBudget } from '../../src/ai/budget';
import { AiFailure } from '../../src/ai/types';
import { createWriter } from '../../src/data/writer';
import { claimOp, CLAIM_TTL_MS, DIAG_FULL, FUTURE_SLACK_MS, diagState, doneOf, finishOp, readDiag, releaseOp, reportOp, type DiagEntry } from '../../src/domain/tutor/diag';
import { claimWeek, PATTERNS_PATH } from '../../src/features/tutor/diagnoseStore';
import { diagnoseReply } from '../../src/platform/dev/canned/lp3/p49';
import { initCapabilities, markSampleConfirmed, useCapabilities } from '../../src/platform/capabilities';
import { createMemoryDb } from '../../src/platform/dev/memoryDb';
import type { SampleFn } from '../../src/platform/types';
import { PROMPT_MAX_BYTES } from '../../src/prompts/common';
import { actionFits, diagnose, diagnoseSchema, type DiagnoseOut, type DiagnoseVars } from '../../src/prompts/diagnose';
import { TEMPLATES } from '../../src/prompts/registry';

// P49 (Lernplattform 3.0, KI-Tutor T5): Vorlage diagnose@1 (Schema, Prompt, Fehlerweg nach A6.3, Budget) und das Protokoll
// `app/patterns.diag[]` mit der Beanspruchung je ISO-Woche (K-10).

const vars: DiagnoseVars = {
  lang: 'de',
  evidence: '[p:art.definite] the definite article: 6 attempts, 4 wrong\n[cf:art.indefinite>art.definite] the used where a was needed: 3×',
  ids: ['p:art.definite', 'cf:art.indefinite>art.definite'],
  allowed: ['contrast:art.indefinite|art.definite', 'pattern:art.definite'],
  prev: null,
  today: '2026-11-01',
};
const good = {
  headline: 'Du verwechselst vor allem a und the.',
  findings: [{ title: 'a oder the', why: 'Du nimmst the, wo etwas zum ersten Mal genannt wird. Achte auf neue Informationen.', rule: 'Erstmals genannt? Dann a.', ev: ['p:art.definite'], action: 'contrast:art.indefinite|art.definite' }],
  better: null,
  next: 'Mach diese Woche eine Kontrast-Runde.',
};

describe('diagnose@1: Prompt', () => {
  it('Kopfzeile, Belege, erlaubte Aktionen, Stufe complex, kein Zwischenspeicher, Budget 1 am Tag, unter 8 KB', () => {
    const p = diagnose.build(vars);
    expect(p.split('\n')[0]).toBe('[diagnose@1]');
    expect(p).toContain('[p:art.definite]');
    expect(p).toContain('Allowed actions: contrast:art.indefinite|art.definite, pattern:art.definite');
    expect(p).toContain('in German.');
    expect(diagnose.tier).toBe('complex');
    expect(diagnose.cache).toBe(false);
    expect(diagnose.budget).toEqual({ bgPerDay: 1 });
    expect(diagnose.verb).toBe('text-json');
    // Höchstwert: 6 KB Belege (Obergrenze der App) plus Rahmen bleibt unter 8 KB.
    const big = diagnose.build({ ...vars, evidence: `[p:x] ${'a'.repeat(4890)}`, prev: { headline: 'h'.repeat(300), titles: ['t'.repeat(200), 'u', 'v', 'w'] } });
    expect(new TextEncoder().encode(big).length).toBeLessThan(8000);
    expect(new TextEncoder().encode(big).length).toBeLessThan(PROMPT_MAX_BYTES);
  });

  it('ist registriert (einmalig, mit Kopfzeile)', () => {
    expect(TEMPLATES.filter((t) => t.id === 'diagnose')).toHaveLength(1);
  });
});

describe('diagnose@1: Schema', () => {
  const parse = (o: unknown, v: Partial<DiagnoseVars> = {}) => diagnoseSchema({ ...vars, ...v }).safeParse(o);

  it('eine gültige Antwort geht durch', () => {
    const r = parse(good);
    expect(r.success).toBe(true);
    expect(r.data?.findings[0]?.ev).toEqual(['p:art.definite']);
  });

  it('erfundene Beleg-Kennungen fallen weg; bleibt keine, ist die Antwort ungültig (Neuversuch im Tor)', () => {
    const mixed = parse({ ...good, findings: [{ ...good.findings[0], ev: ['p:erfunden', '[p:art.definite]', 'cf:art.indefinite>art.definite'] }] });
    expect(mixed.data?.findings[0]?.ev).toEqual(['p:art.definite', 'cf:art.indefinite>art.definite']);
    expect(parse({ ...good, findings: [{ ...good.findings[0], ev: ['p:erfunden'] }] }).success).toBe(false);
  });

  it('nur erlaubte Aktionen; „contrast: a | b“ wird bereinigt', () => {
    expect(parse({ ...good, findings: [{ ...good.findings[0], action: 'contrast: art.indefinite|art.definite' }] }).success).toBe(true);
    expect(parse({ ...good, findings: [{ ...good.findings[0], action: 'contrast:fake.a|fake.b' }] }).success).toBe(false);
    expect(parse({ ...good, findings: [{ ...good.findings[0], action: 'weg' }] }).success).toBe(false);
  });

  it('höchstens drei Befunde (mehr werden gekappt), mindestens einer; falsche Sprache ist ein Mangel', () => {
    const f = good.findings[0];
    expect(parse({ ...good, findings: [f, f, f, f, f] }).data?.findings).toHaveLength(3);
    // Eine leere Liste ist erlaubt (Evidenz zu dünn), mehr als drei werden gekappt.
    expect(parse({ ...good, findings: [] }).data?.findings).toEqual([]);
    const english = { ...good, headline: 'You mostly confuse the indefinite article with the definite article here.' };
    expect(parse(english).success).toBe(false);
    expect(parse(english, { lang: 'en' }).success).toBe(true);
  });

  it('ein ungültiges „Besser geworden“ fällt weg, statt alles zu verwerfen', () => {
    expect(parse({ ...good, better: { text: 'Besser geworden bei a und the.', ev: ['p:erfunden'] } }).data?.better).toBeNull();
    expect(parse({ ...good, better: { text: 'Besser geworden bei a und the.', ev: ['p:art.definite'] } }).data?.better).toEqual({ text: 'Besser geworden bei a und the.', ev: ['p:art.definite'] });
  });
});

describe('diagnose@1: durch das KI-Tor (A6.3, Budget)', () => {
  class MemStorage {
    private m = new Map<string, string>();
    getItem(k: string): string | null {
      return this.m.get(k) ?? null;
    }
    setItem(k: string, v: string): void {
      this.m.set(k, v);
    }
    removeItem(k: string): void {
      this.m.delete(k);
    }
  }
  const prompts: string[] = [];
  let reply: (input: string) => string = diagnoseReply;
  const sample = Object.assign(
    ((input: string) => {
      prompts.push(input);
      return Promise.resolve({ text: reply(input), truncated: false } as Claude.sample.SampleResult);
    }) as unknown as SampleFn,
    { json: () => Promise.reject({ code: 'invalid_request' }), limits: () => Promise.resolve({ maxPromptBytes: 65536 }) },
  );
  const stub = (): void => {
    vi.stubGlobal('window', { localStorage: new MemStorage(), sessionStorage: new MemStorage(), claude: { use: (n: string) => Promise.resolve(n === 'sample' ? sample : null) }, addEventListener: () => undefined, removeEventListener: () => undefined });
  };
  const run = (priority: 'user' | 'background') => askJson({ template: diagnose, vars, signal: new AbortController().signal, priority });

  beforeAll(async () => {
    stub();
    initCapabilities();
    await vi.waitFor(() => expect(useCapabilities.getState().sample).toBe('ready'));
  });
  beforeEach(() => {
    prompts.length = 0;
    reply = diagnoseReply;
    stub();
    resetAiGate();
    resetAiBudget();
    useCapabilities.setState({ sampleRevoked: false });
    markSampleConfirmed();
    (globalThis as { __LINGO_FAKE__?: { diagnoseMode?: string } }).__LINGO_FAKE__ = {};
  });
  afterEach(() => {
    delete (globalThis as { __LINGO_FAKE__?: unknown }).__LINGO_FAKE__;
  });
  const mode = (m: string): void => void ((globalThis as { __LINGO_FAKE__?: { diagnoseMode?: string } }).__LINGO_FAKE__ = { diagnoseMode: m });

  it('gültige Antwort: genau ein Aufruf', async () => {
    const r = await run('user');
    expect(prompts).toHaveLength(1);
    expect(r.data.findings[0]?.action).toBe('contrast:art.indefinite|art.definite');
  });

  it('Schemaverletzung: genau ein Neuversuch mit angehängtem Mangel, danach gültig', async () => {
    mode('zzschema');
    const r = await run('user');
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('did not match the required format');
    expect(r.data.headline.length).toBeGreaterThan(9);
  });

  it('nur erfundene Kennungen: ein Neuversuch, dann Fehler (nie eine Schleife)', async () => {
    mode('zzonlyinvent');
    await expect(run('user')).rejects.toBeInstanceOf(AiFailure);
    expect(prompts).toHaveLength(2);
  });

  it('eine zusätzliche erfundene Kennung fällt still weg, ohne Neuversuch', async () => {
    mode('zzinvent');
    const r = await run('user');
    expect(prompts).toHaveLength(1);
    expect(r.data.findings[0]?.ev).toEqual(['p:art.definite']);
  });

  it('kein JSON: kein automatischer Neuversuch', async () => {
    mode('zzjson');
    await expect(run('user')).rejects.toBeInstanceOf(AiFailure);
    expect(prompts).toHaveLength(1);
  });

  it('Hintergrund: höchstens ein Aufruf am Tag (Budget), Nutzeraufrufe bleiben frei', async () => {
    await run('background');
    await expect(run('background')).rejects.toMatchObject({ kind: 'busy', code: 'budget' });
    expect(prompts).toHaveLength(1);
    await run('user');
    expect(prompts).toHaveLength(2);
  });
});

describe('app/patterns.diag: Beanspruchung, Ergebnis, Melden', () => {
  const W = '2026-W44';
  const NOW = Date.parse('2026-10-30T10:00:00+01:00');
  const out: DiagnoseOut = { headline: 'Du verwechselst a und the.', findings: [{ title: 'a oder the', why: 'Erstmals genannt? Dann a.', rule: 'Neu genannt: a.', ev: ['p:x'], action: 'contrast:a|b' }], better: null, next: 'Kontrast-Runde.' };

  it('die erste Beanspruchung schreibt einen pending-Eintrag (ohne Dokument per set, mit Dokument per update); die zweite bekommt sie nicht', () => {
    const first = claimOp(undefined, { w: W, dev: 'dev-a', now: NOW, lang: 'de' });
    expect(first.claimed).toBe(true);
    expect(first.op).toEqual({ set: { diag: [{ w: W, t: NOW, st: 'pending', dev: 'dev-a', lang: 'de' }] } });
    const doc = { items: [], diag: (first.op as { set: { diag: unknown[] } }).set.diag };
    const second = claimOp(doc, { w: W, dev: 'dev-b', now: NOW + 1000, lang: 'de' });
    expect(second).toEqual({ op: null, claimed: false });
    // Nach Ablauf (10 Minuten) darf ein anderes Gerät neu beanspruchen; der alte Eintrag wird ersetzt, nicht gehäuft.
    const later = claimOp(doc, { w: W, dev: 'dev-b', now: NOW + CLAIM_TTL_MS + 1, lang: 'de' });
    expect(later.claimed).toBe(true);
    const diag = (later.op as { update: { diag: Array<{ dev: string }> } }).update.diag;
    expect(diag.map((e) => e.dev)).toEqual(['dev-b']);
  });

  it('ein Ergebnis dieser Woche sperrt jede weitere Beanspruchung; die nächste Woche ist frei', () => {
    const claimed = claimOp(undefined, { w: W, dev: 'dev-a', now: NOW, lang: 'de' }).op as { set: { diag: unknown[] } };
    const done = finishOp({ diag: claimed.set.diag }, { dev: 'dev-a', t: NOW, w: W, now: NOW + 5000, out, pv: 'diagnose@1', lang: 'de', rep: 14 });
    const doc = { diag: (done as { update: { diag: unknown[] } }).update.diag };
    expect(doneOf(readDiag(doc), W)?.out?.headline).toBe(out.headline);
    expect(readDiag(doc)).toHaveLength(1);
    expect(claimOp(doc, { w: W, dev: 'dev-b', now: NOW + 10_000, lang: 'de' }).claimed).toBe(false);
    expect(claimOp(doc, { w: '2026-W45', dev: 'dev-b', now: NOW + 7 * 86_400_000, lang: 'de' }).claimed).toBe(true);
    // Ein zweites Ergebnis derselben Woche (anderes Gerät war schneller) wird nicht eingetragen.
    expect(finishOp(doc, { dev: 'dev-b', t: NOW, w: W, now: NOW + 20_000, out, pv: 'diagnose@1', lang: 'de', rep: 14 })).toBeNull();
  });

  it('Freigeben entfernt nur den eigenen pending-Eintrag', () => {
    const doc = { diag: [{ w: W, t: NOW, st: 'pending', dev: 'dev-a' }] };
    expect(releaseOp(doc, { dev: 'dev-b', t: NOW })).toBeNull();
    expect(releaseOp(doc, { dev: 'dev-a', t: NOW + 1 })).toBeNull();
    expect(releaseOp(doc, { dev: 'dev-a', t: NOW })).toEqual({ update: { diag: [] } });
    expect(releaseOp(undefined, { dev: 'dev-a', t: NOW })).toBeNull();
  });

  it('nur die jüngsten 12 Ergebnisse behalten `out`; ältere werden auf die Kurzform gekürzt, nie entfernt', () => {
    const doc = { diag: Array.from({ length: DIAG_FULL + 3 }, (_, k) => ({ w: `2026-W${String(10 + k).padStart(2, '0')}`, t: NOW - (DIAG_FULL + 3 - k) * 7 * 86_400_000, st: 'done', dev: 'x', pv: 'diagnose@1', unbekannt: k, out })) };
    const r = claimOp(doc, { w: W, dev: 'dev-a', now: NOW, lang: 'de' });
    const diag = (r.op as { update: { diag: Array<{ w: string; out?: unknown; unbekannt?: number }> } }).update.diag;
    expect(diag).toHaveLength(DIAG_FULL + 3 + 1);
    expect(diag.slice(0, 3).every((e) => e.out === undefined)).toBe(true);
    expect(diag.slice(3, -1).every((e) => !!e.out)).toBe(true);
    expect(diag.map((e) => e.unbekannt).slice(0, 15)).toEqual(Array.from({ length: 15 }, (_, k) => k));
    expect(diag.at(-1)?.w).toBe(W);
  });

  it('unbekannte Felder und unlesbare Einträge überleben claim, finish, release und report', () => {
    const odd = { x: 1, nested: { a: [1, 2] } };
    const junk = [null, 'text', { w: 'kaputt' }];
    const old = { w: '2026-W30', t: NOW - 30 * 86_400_000, st: 'done', dev: 'z', out, extra: { k: 'v' }, bad: [0], zukunft: true };
    const doc = { items: [], ...odd, diag: [...junk, old] };
    const claim = claimOp(doc, { w: W, dev: 'dev-a', now: NOW, lang: 'de' }).op as { update: { diag: Array<Record<string, unknown>> } };
    expect(claim.update.diag.slice(0, 3)).toEqual(junk);
    expect(claim.update.diag[3]).toEqual(old);
    const doc2 = { ...doc, diag: claim.update.diag };
    const fin = finishOp(doc2, { dev: 'dev-a', t: NOW, w: W, now: NOW + 1000, out, pv: 'diagnose@1', lang: 'de', rep: 14 }) as { update: { diag: Array<Record<string, unknown>> } };
    expect(fin.update.diag.slice(0, 3)).toEqual(junk);
    expect(fin.update.diag[3]).toEqual(old);
    // Das fertige Ergebnis behält Felder, die ein anderer Schreiber am pending-Eintrag ergänzt hat.
    const withExtra = { diag: [{ w: W, t: NOW, st: 'pending', dev: 'dev-a', fremd: 'bleibt' }, ...junk] };
    const done = finishOp(withExtra, { dev: 'dev-a', t: NOW, w: W, now: NOW + 1000, out, pv: 'diagnose@1', lang: 'de', rep: 1 }) as { update: { diag: Array<Record<string, unknown>> } };
    expect(done.update.diag[0]).toMatchObject({ w: W, st: 'done', fremd: 'bleibt' });
    expect(done.update.diag.slice(1)).toEqual(junk);
    const rel = releaseOp(withExtra, { dev: 'dev-a', t: NOW }) as { update: { diag: unknown[] } };
    expect(rel.update.diag).toEqual(junk);
    const rep = reportOp({ diag: [...junk, { ...old, w: W, t: NOW }] }, { w: W, index: 1 }) as { update: { diag: Array<Record<string, unknown>> } };
    expect(rep.update.diag.slice(0, 3)).toEqual(junk);
    expect(rep.update.diag[3]).toMatchObject({ extra: { k: 'v' }, zukunft: true, bad: [0, 1], out });
  });

  it('ein done ohne gültiges out belegt seine Woche trotzdem', () => {
    const doc = { diag: [{ w: W, t: NOW, st: 'done', dev: 'x', out: 'kaputt' }] };
    expect(doneOf(readDiag(doc), W)).not.toBeNull();
    expect(claimOp(doc, { w: W, dev: 'dev-b', now: NOW + 5000, lang: 'de' }).claimed).toBe(false);
    expect(diagState(readDiag(doc), '2026-10-30', NOW, 40).kind).toBe('done');
  });

  it('eine zukunftsdatierte Beanspruchung gilt bis 60 s Vorlauf, danach nicht mehr', () => {
    const e = (t: number) => readDiag({ diag: [{ w: W, t, st: 'pending', dev: 'x' }] });
    expect(diagState(e(NOW + FUTURE_SLACK_MS), '2026-10-30', NOW, 40).kind).toBe('pending');
    expect(diagState(e(NOW + FUTURE_SLACK_MS + 1), '2026-10-30', NOW, 40).kind).toBe('due');
  });

  it('Prompt: Schwelle nur mit falschen Antworten, leere Liste erlaubt, pc-Regel, keine Stufe', () => {
    const p = diagnose.build(vars);
    expect(p).toContain('at least 3 WRONG answers/mistakes');
    expect(p).toContain('"findings": []');
    expect(p).toContain('Never lower the threshold');
    expect(p).toContain('Only [cf:…] lines prove a mix-up.');
    expect(p).toContain('No CEFR level, score or percentage.');
    expect(p).toContain('Evidence format: [p:id]');
    expect(p).toContain('Address the learner directly as "du" in German');
    expect(p).toContain('for [cf:…] the two forms that get mixed up');
    expect(p).toContain('Never make up a learner example');
    expect(p).toContain('an email, a client call');
  });

  it('actionFits vergleicht die Kennung genau, nicht als Teilstring', () => {
    expect(actionFits('contrast:art.definite|art.indefinite', ['p:art.indefinite'])).toBe(true);
    expect(actionFits('contrast:art.definite|art.indefinite', ['cf:art.indefinite>art.definite'])).toBe(true);
    expect(actionFits('contrast:art.definite|art.indefinite', ['pc:art.definite|art.indefinite'])).toBe(true);
    expect(actionFits('pattern:art.zero', ['src:write:art.zero'])).toBe(true);
    expect(actionFits('pattern:art.zero', ['p:art.zero-extra', 'p:art.zer'])).toBe(false);
    expect(actionFits('pattern:art.definite', ['p:art.indefinite'])).toBe(false);
  });

  it('die Aktion muss zur Evidenz passen', () => {
    const f = good.findings[0];
    const ok = diagnoseSchema(vars).safeParse({ ...good, findings: [f] });
    expect(ok.success).toBe(true);
    const bad = diagnoseSchema({ ...vars, ids: ['p:dip.hoping', ...vars.ids] }).safeParse({ ...good, findings: [{ ...f, ev: ['p:dip.hoping'] }] });
    expect(bad.success).toBe(false);
  });

  it('Melden markiert den Befund und löscht nie', () => {
    const doc = { diag: [{ w: W, t: NOW, st: 'done', dev: 'a', out }] };
    const r = reportOp(doc, { w: W, index: 0 }) as { update: { diag: Array<{ bad?: number[]; out?: unknown }> } };
    expect(r.update.diag[0]?.bad).toEqual([0]);
    expect(r.update.diag[0]?.out).toBeTruthy();
    expect(reportOp({ diag: r.update.diag }, { w: W, index: 0 })).toBeNull();
  });

  it('diagState: Ergebnis vor Beanspruchung vor Mindestmenge', () => {
    const entries = (e: Partial<DiagEntry>[]): DiagEntry[] => readDiag({ diag: e });
    const pending = { w: W, t: NOW, st: 'pending', dev: 'a' } as const;
    expect(diagState([], '2026-10-30', NOW, 3)).toEqual({ kind: 'few', have: 3, need: 12 });
    expect(diagState([], '2026-10-30', NOW, 12).kind).toBe('due');
    expect(diagState(entries([pending]), '2026-10-30', NOW + 1000, 40).kind).toBe('pending');
    expect(diagState(entries([pending]), '2026-10-30', NOW + CLAIM_TTL_MS + 1, 40).kind).toBe('due');
    expect(diagState(entries([{ ...pending, st: 'done', out }]), '2026-10-30', NOW, 40).kind).toBe('done');
    // 2026-10-30 ist ein Freitag in KW 44; ein Ergebnis aus KW 43 sperrt nicht.
    expect(diagState(entries([{ ...pending, w: '2026-W43', st: 'done', out }]), '2026-10-30', NOW, 40).kind).toBe('due');
  });
});

describe('Beanspruchung zwischen zwei Geräten (db acquire + transform)', () => {
  it('zwei Geräte gleichzeitig: genau eines beansprucht die Woche', async () => {
    const h = createMemoryDb({ seed: { [PATTERNS_PATH]: { d: '2026-10-30', items: [], history: [] } } });
    const a = createWriter(h.db);
    const b = createWriter(h.db);
    const now = Date.parse('2026-10-30T10:00:00+01:00');
    const [ra, rb] = await Promise.all([claimWeek(a, { w: '2026-W44', dev: 'dev-a', now, lang: 'de' }), claimWeek(b, { w: '2026-W44', dev: 'dev-b', now, lang: 'de' })]);
    expect([ra, rb].filter(Boolean)).toHaveLength(1);
    const doc = (await h.db.doc(PATTERNS_PATH).get()).data() as { diag: Array<{ dev: string; st: string }>; items: unknown[] };
    expect(doc.diag).toHaveLength(1);
    expect(doc.diag[0]?.st).toBe('pending');
    // Die anderen Felder des Dokuments bleiben unberührt.
    expect(doc.items).toEqual([]);
  });

  it('nacheinander: das zweite Gerät sieht die Beanspruchung (auch ohne Sperre) und ruft nicht auf', async () => {
    const h = createMemoryDb();
    const a = createWriter(h.db);
    const b = createWriter(h.db);
    const now = Date.parse('2026-10-30T10:00:00+01:00');
    expect(await claimWeek(a, { w: '2026-W44', dev: 'dev-a', now, lang: 'de' })).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(await claimWeek(b, { w: '2026-W44', dev: 'dev-b', now: now + 50, lang: 'de' })).toBe(false);
  });
});
