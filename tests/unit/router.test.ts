import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { goBack, navigate } from '../../src/app/nav';
import { installAreas, kindOf, screenOf, type AreaDef } from '../../src/app/registry';
import { parseRoute, routeFromHash, routeToString } from '../../src/app/router/deeplink';
import type { Route } from '../../src/app/router/types';
import { TABS } from '../../src/app/shell/tabs';

// Neubau-Rahmen (docs/neubau/architektur.md §2.3): Reiter-Stapel, Übungsebene, Deep-Links.
// Die Bereiche werden hier mit leeren Komponenten nachgebildet (keine React-Bildschirme im Test).

const Empty = () => null;
const AREAS: AreaDef[] = [
  {
    id: 'test',
    screens: {
      today: { kind: 'tab', component: Empty },
      vocab: { kind: 'tab', component: Empty },
      speak: { kind: 'tab', component: Empty },
      learn: { kind: 'tab', component: Empty },
      apply: { kind: 'tab', component: Empty },
      grammar: { kind: 'page', component: Empty },
      wissen: { kind: 'page', component: Empty },
      overview: { kind: 'tab', component: Empty, params: z.object({ tab: z.enum(['judge', 'errors', 'path', 'history']).optional() }) },
      grammarSession: { kind: 'exercise', component: Empty, params: z.object({ mode: z.enum(['duty', 'xtra', 'errors', 'topic']), topic: z.string().optional() }) },
      trainer: { kind: 'exercise', component: Empty, params: z.object({ round: z.enum(['pflicht', 'extra']) }) },
      roleplay: { kind: 'exercise', component: Empty, params: z.object({ sceneId: z.string(), resume: z.boolean().optional(), n: z.number().optional() }) },
    },
  },
];

type Core = Parameters<typeof navigate>[0];
const start = (): Core => ({ tab: 'today', stacks: Object.fromEntries(TABS.map((t) => [t.id, [t.root]])) as unknown as Core['stacks'], overlay: null });
const top = (c: Core): Route => c.overlay?.route ?? (c.stacks[c.tab].at(-1) as Route);

beforeAll(() => installAreas(AREAS));

describe('Register', () => {
  it('fünf Reiter mit Wurzeln (Fokus Vokabeln und Grammatik, 04.10.2026; „Anwenden“ per „Go Anwenden“; zuletzt „Fortschritt“ = Dein Stand); `learn` bleibt die Test-ID von „Grammatik“', () => {
    expect(TABS.map((t) => t.id)).toEqual(['today', 'vocab', 'learn', 'apply', 'progress']);
    expect(TABS.find((t) => t.id === 'progress')?.root.name).toBe('overview');
  });

  it('kennt Ebenen und wirft bei doppelten Bildschirmen', () => {
    expect(kindOf('today')).toBe('tab');
    expect(kindOf('grammarSession')).toBe('exercise');
    expect(kindOf('unbekannt')).toBe('page');
    expect(() => installAreas([...AREAS, { id: 'zwei', screens: { today: { kind: 'tab', component: Empty } } }])).toThrow(/doppelt/);
    installAreas(AREAS);
  });

  it('jede Reiter-Wurzel ist ein Reiter-Bildschirm', () => {
    for (const t of TABS) expect(kindOf(t.root.name), t.id).toBe('tab');
  });

  it('„Dein Stand“ (overview) wechselt zum Reiter Fortschritt, statt als Seite auf den aktiven Reiter zu kommen', () => {
    const c = navigate(start(), { name: 'overview', tab: 'history' });
    expect(c.tab).toBe('progress');
    expect(c.stacks.progress).toEqual([{ name: 'overview', tab: 'history' }]);
    expect(c.stacks.today.map((r) => r.name)).toEqual(['today']);
  });
});

describe('Router: Reiter-Stapel und Übungsebene', () => {
  it('Seite legt sich auf den aktiven Reiter, back() führt zur Herkunft', () => {
    let c = navigate(start(), { name: 'grammar' });
    c = navigate(c, { name: 'wissen' });
    expect(c.stacks.today.map((r) => r.name)).toEqual(['today', 'grammar', 'wissen']);
    c = goBack(c);
    expect(top(c).name).toBe('grammar');
    c = goBack(goBack(c));
    expect(top(c).name).toBe('today');
  });

  it('Ziel gleich dem Eintrag darunter wirkt wie back()', () => {
    let c = navigate(navigate(start(), { name: 'grammar' }), { name: 'wissen' });
    c = navigate(c, { name: 'grammar' });
    expect(c.stacks.today.map((r) => r.name)).toEqual(['today', 'grammar']);
  });

  it('Übung öffnet über der Herkunft; Übung → Übung ersetzt; back() schließt zur Herkunft', () => {
    let c = navigate(navigate(start(), { name: 'wissen' }), { name: 'grammarSession', mode: 'duty' });
    expect(c.overlay).toEqual({ route: { name: 'grammarSession', mode: 'duty' }, origin: 'today' });
    c = navigate(c, { name: 'trainer', round: 'pflicht' });
    expect(c.overlay?.route).toEqual({ name: 'trainer', round: 'pflicht' });
    c = goBack(c);
    expect(c.overlay).toBeNull();
    expect(top(c).name).toBe('wissen');
  });

  it('Seite aus einer Übung schließt die Übung; ist sie die Herkunft, entsteht kein Doppel', () => {
    let c = navigate(navigate(start(), { name: 'wissen' }), { name: 'grammarSession', mode: 'duty' });
    c = navigate(c, { name: 'wissen' });
    expect(c.overlay).toBeNull();
    expect(c.stacks.today.map((r) => r.name)).toEqual(['today', 'wissen']);
  });

  it('Reiter-Wurzel wechselt den Reiter, setzt Wurzelparameter und schließt die Übung', () => {
    let c = navigate(start(), { name: 'trainer', round: 'extra' });
    c = navigate(c, { name: 'overview', tab: 'errors' });
    expect(c.tab).toBe('progress');
    expect(c.overlay).toBeNull();
    expect(top(c)).toEqual({ name: 'overview', tab: 'errors' });
  });

  it('Sprechen ist seit 04.10.2026 eine Seite: kein Reiterwechsel, Seite auf dem aktuellen Stapel', () => {
    const c = navigate(start(), { name: 'speak' });
    expect(c.tab).toBe('today');
    expect(top(c)).toEqual({ name: 'speak' });
  });

  it('andere Reiter behalten ihren Stapel; auf der Wurzel tut back() nichts', () => {
    let c = navigate(start(), { name: 'grammar' });
    c = navigate(c, { name: 'vocab' });
    expect(c.stacks.today.map((r) => r.name)).toEqual(['today', 'grammar']);
    expect(goBack(c)).toBe(c);
  });
});

describe('Deep-Links', () => {
  const lookup = (name: string) => screenOf(name as Route['name']);

  it('Route ↔ Text, geprüft mit dem Schema', () => {
    const r: Route = { name: 'roleplay', sceneId: 'sc-vida', resume: true, n: 2 };
    const s = routeToString(r);
    expect(s).toBe('roleplay?sceneId=sc-vida&resume=true&n=2');
    expect(parseRoute(s, lookup)).toEqual(r);
    expect(routeToString({ name: 'today' })).toBe('today');
    expect(parseRoute('trainer?round=extra', lookup)).toEqual({ name: 'trainer', round: 'extra' });
    expect(parseRoute('grammarSession?mode=topic&topic=passive', lookup)).toEqual({ name: 'grammarSession', mode: 'topic', topic: 'passive' });
  });

  it('unbekannte Bildschirme und ungültige Werte ergeben null', () => {
    expect(parseRoute('nirgends', lookup)).toBeNull();
    expect(parseRoute('trainer?round=bald', lookup)).toBeNull();
    expect(parseRoute('trainer', lookup)).toBeNull();
    expect(parseRoute('today?x=1', lookup)).toBeNull();
    expect(parseRoute('<script>', lookup)).toBeNull();
  });

  it('#go= aus dem Adress-Anker', () => {
    expect(routeFromHash(`#go=${encodeURIComponent('overview?tab=history')}`, lookup)).toEqual({ name: 'overview', tab: 'history' });
    expect(routeFromHash('#go=trainer?round=extra', lookup)).toEqual({ name: 'trainer', round: 'extra' });
    expect(routeFromHash('#main', lookup)).toBeNull();
  });
});
