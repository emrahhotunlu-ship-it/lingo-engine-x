import { describe, expect, it } from 'vitest';
import type { UnitCtx } from '../../src/app/unit/types';
import { EMPTY_TARGETS } from '../../src/domain/week/targets';
import { advance, endInbox, inboxResume, setGist, setReply, startInbox, useInbox } from '../../src/features/inbox/session';
import { collocSubmit, drillResume, endDrill, gapSubmit, nextItem, startDrill, useDrill } from '../../src/features/nbdrill/session';
import { P7_UNIT_BLOCKS } from '../../src/features/nbdrill/unitBlocks';
import { beginAnswer, endPressure, pressureResume, setDraft, startPressure, submitAnswer, usePressure } from '../../src/features/pressure/session';
import { endShadow, nextShadowStep, pronResume, startShadow, usePron } from '../../src/features/pron/session';

// G3 (plan.md §4.0): je Resumable Momentaufnahme → Herstellen → gleiche Position (ohne db).

describe('Fortsetzen der neuen Übungen', () => {
  it('Tipp-Drill: gleiche Aufgabe, Zustand der Aufgabe und Ergebnisse', () => {
    expect(startDrill('colloc', { lang: 'de' })).toBe(true);
    collocSubmit('close', 100);
    collocSubmit('strike', 100);
    nextItem();
    collocSubmit('meet', 100);
    const snap = drillResume.snapshot();
    expect(snap).not.toBeNull();
    const json = JSON.parse(JSON.stringify(snap)) as NonNullable<typeof snap>;
    endDrill();
    expect(drillResume.restore(json)).toBe(true);
    const s = useDrill.getState().s;
    expect(s?.pos).toBe(1);
    expect(s?.colloc?.found).toEqual(['meet']);
    expect(s?.results).toHaveLength(1);
    expect(drillResume.route(json)).toEqual({ name: 'nbdrill', set: 'colloc' });
    endDrill();
    expect(drillResume.restore({ ...json, ids: ['c99'] })).toBe(false);
  });

  it('Umformung: zweiter Versuch bleibt nach dem Herstellen offen', () => {
    startDrill('transform', { lang: 'de' });
    gapSubmit('did not get', 100);
    const json = JSON.parse(JSON.stringify(drillResume.snapshot())) as Parameters<typeof drillResume.restore>[0];
    endDrill();
    drillResume.restore(json);
    expect(useDrill.getState().s?.gap?.tries).toBe(1);
    expect(useDrill.getState().s?.gap?.final).toBe(false);
    endDrill();
  });

  it('Einwand-Training: Einwand, Phase und Entwurf', () => {
    startPressure({ lang: 'de' });
    beginAnswer();
    setDraft('I understand');
    const json = JSON.parse(JSON.stringify(pressureResume.snapshot())) as Parameters<typeof pressureResume.restore>[0];
    endPressure();
    expect(pressureResume.restore(json)).toBe(true);
    const s = usePressure.getState().s;
    expect(s?.phase).toBe('answer');
    expect(s?.draft).toBe('I understand');
    submitAnswer();
    expect(usePressure.getState().s?.phase).toBe('review');
    endPressure();
  });

  it('Posteingang: Schritt und Entwürfe', () => {
    startInbox({ lang: 'de' });
    advance();
    setGist('Keine Zeit');
    advance();
    setReply('Hi Laura');
    const json = JSON.parse(JSON.stringify(inboxResume.snapshot())) as Parameters<typeof inboxResume.restore>[0];
    endInbox();
    expect(inboxResume.restore(json)).toBe(true);
    const s = useInbox.getState().s;
    expect(s?.step).toBe('reply');
    expect(s?.gist).toBe('Keine Zeit');
    expect(s?.reply).toBe('Hi Laura');
    endInbox();
  });

  it('Nachsprechen: gleicher Schritt', () => {
    startShadow({ sentences: ['One two three.', 'Four five six.'] });
    nextShadowStep();
    nextShadowStep();
    const json = JSON.parse(JSON.stringify(pronResume.snapshot())) as Parameters<typeof pronResume.restore>[0];
    endShadow();
    expect(pronResume.restore(json)).toBe(true);
    expect(usePron.getState().s?.step).toBe(2);
    expect(usePron.getState().s?.sentences).toEqual(['One two three.', 'Four five six.']);
    endShadow();
  });
});

describe('Block-Anbieter (N106)', () => {
  const ctx = (block: 1 | 2 | 3 | 4 | 5, extra: Partial<UnitCtx> = {}): UnitCtx => ({ day: '2026-09-23', block, theme: null, targets: EMPTY_TARGETS, minutes: 9, ...extra });
  const by = (k: string) => P7_UNIT_BLOCKS.find((b) => b.kind === k);

  it('liefert alle vier Arten und startet synchron mit Route', () => {
    expect(P7_UNIT_BLOCKS.map((b) => b.kind).sort()).toEqual(['focus.colloc', 'pron.shadow', 'task.inbox', 'task.objection']);
    expect(by('pron.shadow')?.feasible({ ai: true, tts: false })).toBe(false);
    expect(by('task.objection')?.feasible({ ai: false, tts: false })).toBe(true);
    expect(by('task.objection')?.start(ctx(3))).toEqual({ name: 'pressure' });
    expect(usePressure.getState().s?.unit?.block).toBe(3);
    expect(usePressure.getState().s?.ids).toHaveLength(5);
    expect(by('task.objection')?.start(ctx(3, { minutes: 5 })) && usePressure.getState().s?.ids).toHaveLength(3);
    expect(by('focus.colloc')?.start(ctx(4))).toEqual({ name: 'nbdrill', set: 'colloc' });
    expect(useDrill.getState().s?.ids).toHaveLength(3);
    expect(by('task.inbox')?.start(ctx(2))).toEqual({ name: 'inbox' });
    expect(useInbox.getState().s?.part).toBe('read');
    expect(by('task.inbox')?.start(ctx(3))).toEqual({ name: 'inbox' });
    expect(useInbox.getState().s?.part).toBe('full');
    expect(by('pron.shadow')?.start(ctx(2, { sentences: ['A b c.'] }))).toEqual({ name: 'pron', kind: 'shadow' });
    expect(usePron.getState().s?.sentences).toEqual(['A b c.']);
    endPressure();
    endDrill();
    endInbox();
    endShadow();
  });
});
