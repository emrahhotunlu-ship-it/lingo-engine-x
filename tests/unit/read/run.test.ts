import { describe, expect, it } from 'vitest';
import { AiFailure } from '../../../src/ai/types';
import type { AiRequest } from '../../../src/ai/types';
import { createWriter } from '../../../src/data/writer';
import type { Writer } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { readArticleReply } from '../../../src/platform/dev/canned/read';
import { parsePrefs } from '../../../src/modules/read/domain/docs';
import type { Prefs } from '../../../src/modules/read/domain/docs';
import { readArticle } from '../../../src/modules/read/prompt';
import type { ReadArticleVars } from '../../../src/modules/read/prompt';
import type { AcceptedArticle } from '../../../src/modules/read/domain/accept';
import { runFetch } from '../../../src/modules/read/run';
import type { RunEvent, RunInput } from '../../../src/modules/read/run';
import type { IndexItem } from '../../../src/modules/read/schemas';
import { loadHome } from '../../../src/modules/read/store';

// Das Holen der Artikel (run.ts) mit der festen Dev-Antwort anstelle von `sample`: Teilergebnisse bleiben, Fehler werden nie automatisch
// wiederholt, Stopp per AbortController, kooperative Sperre, Tageslimit.

const DAY = '2026-10-02';

type Step = 'ok' | AiFailure;
type Ask = NonNullable<RunInput['deps']>['ask'];

/** Ersetzt askJson: eine Antwort je Aufruf, gleiche Prüfung (Schema der Vorlage) wie im KI-Tor. */
function stub(steps: Step[] = []) {
  const calls: Array<{ vars: ReadArticleVars; refresh: boolean | undefined }> = [];
  const ask = ((req: AiRequest<ReadArticleVars, AcceptedArticle>) => {
    calls.push({ vars: req.vars, refresh: req.refresh });
    if (req.signal.aborted) return Promise.reject(new AiFailure('cancelled', 'cancelled', null));
    const step = steps.shift() ?? 'ok';
    if (step !== 'ok') return Promise.reject(step);
    const raw = JSON.parse(readArticleReply(readArticle.build(req.vars))) as unknown;
    const data = readArticle.schema(req.vars).parse(raw);
    return Promise.resolve({ data, tierApplied: 'default' as const, retried: false });
  }) as unknown as Ask;
  return { ask, calls };
}

function setup(seed: Record<string, Record<string, unknown>> = {}) {
  const h = createMemoryDb({ seed });
  const writer = createWriter(h.db);
  const events: RunEvent[] = [];
  const base = (over: Partial<RunInput> = {}): RunInput => ({
    writer,
    day: DAY,
    prefs: parsePrefs(undefined),
    items: [],
    count: 3,
    signal: new AbortController().signal,
    holder: 'test',
    rand: () => 0.5,
    now: 1_790_000_000_000,
    onEvent: (e) => events.push(e),
    ...over,
  });
  return { h, writer, events, base };
}

const home = (h: ReturnType<typeof createMemoryDb>) =>
  loadHome(async (p) => {
    const s = await h.db.doc(p).get();
    return s.exists ? s.data() : undefined;
  }, DAY);

describe('runFetch', () => {
  it('holt drei Artikel nacheinander, speichert jeden sofort und führt Index, Lerntage und Themenverlauf nach', async () => {
    const { h, base, events } = setup();
    const { ask, calls } = stub();
    const res = await runFetch(base({ deps: { ask } }));
    expect(res).toEqual({ saved: 3, total: 3, stopped: false, failure: null });
    expect(calls).toHaveLength(3);
    const day = h.dump()[`read/d-${DAY}`] as { items: Array<{ id: string; title: string }> };
    expect(day.items.map((i) => i.id.split('-').slice(0, 5).join('-'))).toEqual([`a-${DAY}-1`, `a-${DAY}-2`, `a-${DAY}-3`]);
    const hm = await home(h);
    expect(hm.items).toHaveLength(3);
    expect(hm.days).toEqual([DAY]);
    expect(hm.prefs.lastTopics).toHaveLength(3);
    expect(hm.prefs.gen).toEqual({ d: DAY, n: 3 });
    expect(events.filter((e) => e.kind === 'start').map((e) => (e as { n: number }).n)).toEqual([1, 2, 3]);
    expect(events.filter((e) => e.kind === 'saved')).toHaveLength(3);
    // jeder Artikel ein eigener Titel (Neuheits-Bias und Dublettentor: die späteren Aufrufe kennen die früheren Titel)
    expect(new Set(day.items.map((i) => i.title)).size).toBe(3);
    expect(calls[2]?.vars.recent.length).toBe(2);
  });

  it('zählt weiter, wenn schon Artikel da sind (Nummer und Titelverlauf aus dem Index)', async () => {
    const { h, base } = setup();
    const { ask } = stub();
    await runFetch(base({ count: 2, deps: { ask } }));
    const first = await home(h);
    const { ask: ask2, calls } = stub();
    const res = await runFetch(base({ count: 1, items: first.items, prefs: first.prefs, deps: { ask: ask2 } }));
    expect(res.saved).toBe(1);
    expect(calls[0]?.vars.recent).toHaveLength(2);
    const day = h.dump()[`read/d-${DAY}`] as { items: Array<{ id: string }> };
    expect(day.items[2]?.id).toMatch(new RegExp(`^a-${DAY}-3-`));
  });

  it('Themenwahl folgt den Chips: nur ein aktives Thema → nur dieses Thema', async () => {
    const { base } = setup();
    const { ask, calls } = stub();
    const prefs: Prefs = { ...parsePrefs(undefined), topics: { ai: 1 } };
    await runFetch(base({ prefs, deps: { ask } }));
    expect(calls.map((c) => c.vars.topic)).toEqual(['ai', 'ai', 'ai']);
  });

  it('eigenes Thema geht als `custom` in den Prompt', async () => {
    const { base } = setup();
    const { ask, calls } = stub();
    const prefs: Prefs = { ...parsePrefs(undefined), custom: ['Pricing for dev tools'] };
    await runFetch(base({ count: 1, prefs, deps: { ask } }));
    expect(calls[0]?.vars).toMatchObject({ topic: 'custom', custom: 'Pricing for dev tools' });
  });

  it('rate_limited mitten im Lauf: bisherige Artikel bleiben, ruhiger Fehler, kein dritter Versuch', async () => {
    const { h, base } = setup();
    const { ask, calls } = stub(['ok', new AiFailure('busy', 'rate_limited', 'aiBusy')]);
    const res = await runFetch(base({ deps: { ask } }));
    expect(res).toMatchObject({ saved: 1, total: 3, stopped: false, failure: { type: 'rate' } });
    expect(calls).toHaveLength(2); // nie in einer Schleife wiederholt
    expect((h.dump()[`read/d-${DAY}`] as { items: unknown[] }).items).toHaveLength(1);
    expect((await home(h)).items).toHaveLength(1);
  });

  it('ungültige Antwort: Fehler „invalid“ (Knopf „Erneut versuchen“), nichts gespeichert; der Neustart übergeht den Zwischenspeicher', async () => {
    const { h, base } = setup();
    const { ask, calls } = stub([new AiFailure('invalid', 'invalid_json', 'aiInvalid')]);
    const res = await runFetch(base({ deps: { ask } }));
    expect(res).toMatchObject({ saved: 0, failure: { type: 'invalid', key: 'aiInvalid' } });
    expect(h.dump()[`read/d-${DAY}`]).toBeUndefined();
    expect(calls[0]?.refresh).toBeUndefined();
    const retry = stub();
    const res2 = await runFetch(base({ count: 1, refresh: true, deps: { ask: retry.ask } }));
    expect(res2.saved).toBe(1);
    expect(retry.calls[0]?.refresh).toBe(true);
  });

  it('nicht erlaubt/andere Fehler: Meldung des KI-Tors, kein Speichern', async () => {
    const { base } = setup();
    const { ask } = stub([new AiFailure('unavailable', 'not_granted', 'aiUnavailable')]);
    expect(await runFetch(base({ deps: { ask } }))).toMatchObject({ saved: 0, failure: { type: 'ai', key: 'aiUnavailable' } });
  });

  it('Stopp: AbortController → angehalten, kein Fehler, schon fertige Artikel bleiben', async () => {
    const { h, base } = setup();
    const ctl = new AbortController();
    const { ask } = stub();
    const res = await runFetch(
      base({
        signal: ctl.signal,
        deps: { ask },
        onEvent: (e) => {
          if (e.kind === 'saved' && e.n === 1) ctl.abort();
        },
      }),
    );
    expect(res).toMatchObject({ saved: 1, stopped: true, failure: null });
    expect((h.dump()[`read/d-${DAY}`] as { items: unknown[] }).items).toHaveLength(1);
  });

  it('Stopp mitten im Aufruf (cancelled aus dem Tor) zählt als angehalten, nicht als Fehler', async () => {
    const { base } = setup();
    const { ask } = stub([new AiFailure('cancelled', 'cancelled', null)]);
    expect(await runFetch(base({ deps: { ask } }))).toMatchObject({ saved: 0, stopped: true, failure: null });
  });

  it('Sperre belegt (anderes Gerät): kein Aufruf an Claude, Hinweis „läuft auf einem anderen Gerät“', async () => {
    const { writer, base } = setup();
    const busy: Writer = { ...writer, acquire: () => Promise.resolve({ acquired: false }) };
    const { ask, calls } = stub();
    const res = await runFetch(base({ writer: busy, deps: { ask } }));
    expect(res).toMatchObject({ saved: 0, failure: { type: 'device_busy' } });
    expect(calls).toHaveLength(0);
  });

  it('Tag voll: Anzahl 0 oder acht Artikel vorhanden → „full“, kein Aufruf', async () => {
    const { base } = setup();
    const { ask, calls } = stub();
    expect(await runFetch(base({ count: 0, deps: { ask } }))).toMatchObject({ saved: 0, failure: { type: 'full' } });
    const items: IndexItem[] = [];
    const res = await runFetch(base({ items, count: 9, deps: { ask } }));
    expect(res.total).toBe(8); // höchstens acht je Tag
    expect(res.saved).toBe(8);
    expect(calls).toHaveLength(8);
  });

  it('Sperre wird vor jedem weiteren Artikel erneuert; läuft sie weg, hört das Holen mit „anderes Gerät“ auf', async () => {
    const { writer, base } = setup();
    let acquires = 0;
    const flaky: Writer = {
      ...writer,
      acquire: () => {
        acquires += 1;
        return Promise.resolve({ acquired: acquires < 3 });
      },
    };
    const { ask, calls } = stub();
    const res = await runFetch(base({ writer: flaky, count: 3, deps: { ask } }));
    expect(acquires).toBe(3); // einmal vorab, einmal vor Artikel 2, einmal vor Artikel 3 (verloren)
    expect(res).toMatchObject({ saved: 2, failure: { type: 'device_busy' } });
    expect(calls).toHaveLength(2);
  });

  it('Kapazitätswächter: ein NEUER Tag legt bei 400 Tagesdokumenten oder voller Datenbank nichts an; ein vorhandener Tag schon', async () => {
    const { base } = setup();
    const { ask, calls } = stub();
    expect(await runFetch(base({ dayDocs: 400, deps: { ask } }))).toMatchObject({ saved: 0, failure: { type: 'full' } });
    expect(await runFetch(base({ docTotal: 4_300, deps: { ask } }))).toMatchObject({ saved: 0, failure: { type: 'full' } });
    expect(calls).toHaveLength(0);
    const today: IndexItem[] = [{ id: 'a-2026-10-02-1-aaaaaa', day: DAY, title: 'Heute schon da', topic: 'ai' }];
    const res = await runFetch(base({ dayDocs: 400, docTotal: 4_300, items: today, count: 1, deps: { ask } }));
    expect(res.saved).toBe(1);
  });
});
