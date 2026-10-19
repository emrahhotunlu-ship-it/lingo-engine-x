import { describe, expect, it } from 'vitest';
import { useLive } from '../../src/data/live';
import { validateDoc } from '../../src/data/validate';
import { confusionOf, type ConfusionSources } from '../../src/domain/tutor/confusion';
import { BAD_MAX, claimOp, DIAG_FULL, doneOf, finishOp, readDiag, readOut2, reportOp } from '../../src/domain/tutor/diag';
import { diagnoseVars } from '../../src/features/tutor/diagnoseStore';
import { diagnoseReplyS4 } from '../../src/platform/dev/canned/s4';
import type { DiagnoseOut } from '../../src/prompts/diagnose';
import { diagnoseV2, type DiagnoseV2Out } from '../../src/prompts/diagnoseV2';

// Engine-Verdrahtung 19.10.2026: Die Wochen-Diagnose läuft als `diagnose@2` (Annahmen, complex, Hintergrund höchstens 1 je Tag) im selben Speicher
// `app/patterns.diag[]`. Ergebnisse von `diagnose@1` bleiben lesbar (`out`), neue stehen als `out2` bereit; Melden, Kürzen und Sperre gelten für beide.

const W = '2026-W43';
const NOW = Date.parse('2026-10-19T10:00:00+02:00');
const v1: DiagnoseOut = { headline: 'Du verwechselst a und the.', findings: [{ title: 'a oder the', why: 'Erstmals genannt? Dann a.', rule: 'Neu genannt: a.', ev: ['p:x'], action: 'contrast:a|b' }], better: null, next: 'Kontrast-Runde.' };
const v2: DiagnoseV2Out = {
  hyps: [
    { id: 'h:art.indefinite>art.definite', verdict: 'likely', ev: ['cf:art.indefinite>art.definite'], why: { de: 'An drei Tagen stand „the“, wo „a“ nötig war.', en: 'On three days you used “the” where “a” was needed.' } },
    { id: 'h:psp.finished-time>psp.result-now', verdict: 'unclear', ev: [], why: { de: 'Dafür reichen die Belege noch nicht.', en: 'The evidence is not enough for this yet.' } },
  ],
  focus: ['art.indefinite'],
  summary: { de: 'Diese Woche lohnt sich vor allem „a“ gegen „the“.', en: 'This week “a” versus “the” is the most worthwhile.' },
};

const done = (w: string, t: number, pv: string, out: unknown): Record<string, unknown> => ({ w, t, st: 'done', dev: 'dev-a', pv, lang: 'de', rep: 14, out });

describe('app/patterns.diag liest @1 und @2', () => {
  it('@1 bleibt als out lesbar, @2 kommt als out2; die Form entscheidet, nicht nur pv', () => {
    const doc = { diag: [done('2026-W42', NOW - 7 * 86_400_000, 'diagnose@1', v1), done(W, NOW, 'diagnose@2', v2)] };
    expect(validateDoc('app/patterns', doc).ok).toBe(true);
    const [old, cur] = readDiag(doc);
    expect(old?.out?.headline).toBe(v1.headline);
    expect(old?.out2).toBeNull();
    expect(cur?.out).toBeNull();
    expect(cur?.out2).toEqual(v2);
    expect(doneOf(readDiag(doc), W)?.pv).toBe('diagnose@2');
  });

  it('readOut2 liest tolerant: unbekannte Urteile werden „unclear“, Annahmen ohne Begründung fallen weg, ohne summary keine @2-Form', () => {
    const r = readOut2({ ...v2, hyps: [{ ...v2.hyps[0], verdict: 'maybe' }, { id: 'h:x>y', verdict: 'likely' }], extra: 1 });
    expect(r?.hyps).toHaveLength(1);
    expect(r?.hyps[0]?.verdict).toBe('unclear');
    expect(readOut2({ hyps: [] })).toBeNull();
    expect(readOut2(v1)).toBeNull();
  });

  it('finishOp schreibt @2 auf den eigenen pending-Eintrag; ein zweites Ergebnis derselben Woche wird nicht eingetragen', () => {
    const claimed = claimOp(undefined, { w: W, dev: 'dev-a', now: NOW, lang: 'de' }).op as { set: { diag: unknown[] } };
    const op = finishOp({ diag: claimed.set.diag }, { dev: 'dev-a', t: NOW, w: W, now: NOW + 5000, out: v2, pv: 'diagnose@2', lang: 'de', rep: 14 });
    const doc = { diag: (op as { update: { diag: unknown[] } }).update.diag };
    expect(doc.diag).toHaveLength(1);
    expect(doc.diag[0]).toMatchObject({ w: W, st: 'done', pv: 'diagnose@2', out: v2 });
    expect(new TextEncoder().encode(JSON.stringify(doc.diag[0])).length).toBeLessThan(4096);
    expect(finishOp(doc, { dev: 'dev-b', t: NOW, w: W, now: NOW + 9000, out: v2, pv: 'diagnose@2', lang: 'de', rep: 14 })).toBeNull();
  });

  it('nur die jüngsten 12 Ergebnisse behalten ihr out, gleich welcher Form; die Einträge bleiben', () => {
    const weeks = Array.from({ length: DIAG_FULL + 2 }, (_, k) => done(`2026-W${String(20 + k).padStart(2, '0')}`, NOW - (DIAG_FULL + 2 - k) * 7 * 86_400_000, k % 2 ? 'diagnose@2' : 'diagnose@1', k % 2 ? v2 : v1));
    const claimed = claimOp({ diag: weeks }, { w: W, dev: 'dev-a', now: NOW, lang: 'de' }).op as { update: { diag: unknown[] } };
    const op = finishOp({ diag: claimed.update.diag }, { dev: 'dev-a', t: NOW, w: W, now: NOW + 1, out: v2, pv: 'diagnose@2', lang: 'de', rep: 14 });
    const list = (op as { update: { diag: Array<Record<string, unknown>> } }).update.diag;
    expect(list).toHaveLength(DIAG_FULL + 3);
    expect(list.filter((e) => 'out' in e)).toHaveLength(DIAG_FULL);
  });

  it('Melden markiert Annahmen einer @2-Woche (bis zu 5), löscht nichts', () => {
    const many: DiagnoseV2Out = { ...v2, hyps: Array.from({ length: 5 }, (_, k) => ({ ...v2.hyps[0]!, id: `h:a${k}.x>b.y` })) };
    let doc: Record<string, unknown> = { diag: [done(W, NOW, 'diagnose@2', many)] };
    for (let i = 0; i < 5; i++) doc = { diag: (reportOp(doc, { w: W, index: i }) as { update: { diag: unknown[] } }).update.diag };
    const e = readDiag(doc)[0];
    expect(e?.bad).toEqual([0, 1, 2, 3, 4]);
    expect(BAD_MAX).toBe(5);
    expect(e?.out2?.hyps).toHaveLength(5);
  });
});

describe('Eingabe für diagnose@2', () => {
  const T = (day: string, k: number): number => Date.parse(`${day}T11:00:00+02:00`) + k * 60_000;
  const wrong = (pat: string, day: string, k: number): Record<string, unknown> => ({ t: T(day, k), ok: false, k: 'g', topic: 'articles', type: 'gap', q: `Satz ${k} ___ .`, given: 'x', ans: 'y', pat });
  const sources: ConfusionSources = {
    grammar: new Map([['articles', { id: 'articles', p: 0.5, n: 5, errors: [0, 1, 2].map((k) => ({ q: `We need ___ approval ${k}.`, given: 'the', ans: 'an', t: T(`2026-10-1${4 + k}`, 0), pat: 'art.indefinite', cf: 'art.definite', box: 1 })) }]]),
    logs: new Map([['2026-10-18', { date: '2026-10-18', entries: Array.from({ length: 12 }, (_, k) => wrong('art.definite', '2026-10-18', k)) }]]),
    repair: null,
  };

  it('Annahmen aus dem Lernermodell, Musterstatistik, Belegzeilen und Musterliste; Vorlage complex, Hintergrund 1 je Tag', () => {
    useLive.setState({ day: null, docs: {}, collections: { vocab: new Map() } });
    const today = '2026-10-19';
    const conf = confusionOf(sources, today);
    const vars = diagnoseVars(sources, conf, { lang: 'de', today, now: NOW });
    expect(vars.hyps.map((h) => h.id)).toContain('h:art.indefinite>art.definite');
    expect(vars.hyps[0]).toMatchObject({ state: 'open', n: 3, days: 3 });
    expect(vars.stats).toBe(conf.pats);
    expect(vars.ids).toEqual(conf.ids);
    expect(vars.patList).toContain('art.indefinite');
    expect(diagnoseV2.tier).toBe('complex');
    expect(diagnoseV2.budget).toEqual({ bgPerDay: 1 });
    // Die Testantwort zitiert nur Eingegebenes und besteht die Prüfung der Vorlage.
    const out = diagnoseV2.schema(vars).parse(JSON.parse(diagnoseReplyS4(diagnoseV2.build(vars))));
    expect(out.hyps[0]?.id).toBe('h:art.indefinite>art.definite');
    expect(out.focus.every((f) => vars.patList.includes(f))).toBe(true);
  });
});
