// E2E-Helfer des Bereichs „Sprechen & Schreiben“ – Besitz: Paket P5 (docs/neubau/architektur.md §5.3).
// Gemeinsame Navigation (openTab, openEntry, openProfile, bootAt …) steht in `fixtures.ts` (WP0).

import type { Page } from '@playwright/test';

/**
 * Feste Antwort für `goal-check@1` (N72) in der Test-Laufzeit. Der Entwicklungs-Adapter
 * (`src/platform/dev`, eingefroren) kennt die neue Vorlage noch nicht (Wunsch an den Integrator);
 * bis dahin hüllt dieses Init-Skript `window.claude.use('sample')` ein – nur im Test, nie im Build.
 * Regel: Ziel 0 gilt als erreicht, sobald der Lerner etwas gesagt hat (Zitat: seine letzten Wörter);
 * mit Kriterien („Criteria:“) sind alle „teilweise“ mit einer Begründung in der Erklärungssprache.
 * Vor `boot()` aufrufen.
 */
export async function installGoalCheckReply(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const reply = (prompt: string): string => {
      const lines = prompt.split('\n');
      const goals = lines.slice(lines.indexOf('Goals:') + 1).filter((l) => /^\d+\. /.test(l));
      const critAt = lines.indexOf('Criteria:');
      const nGoals = critAt > 0 ? goals.filter((l) => lines.indexOf(l) < critAt).length : Math.min(3, goals.length);
      const crit = critAt > 0 ? lines.slice(critAt + 1).filter((l) => /^\d+\. /.test(l)) : [];
      const learner = lines.filter((l) => l.startsWith('Learner: '));
      const last = (learner[learner.length - 1] ?? '').replace('Learner: ', '').split(' ').slice(0, 6).join(' ');
      const de = prompt.includes('Explanation language: German');
      return JSON.stringify({
        goals: Array.from({ length: nGoals }, (_, i) => ({ i, state: i === 0 && last ? 'met' : 'open', quote: i === 0 ? last : '' })),
        criteria: crit.map((_, i) => ({ i, state: 'partly', quote: last, note: de ? 'Das kam im Gespräch nur teilweise vor.' : 'This only partly came up in the conversation.' })),
      });
    };
    type Sample = ((input: unknown, opts?: { onText?: (e: { text: string; delta: string }) => void; modelTier?: string }) => Promise<unknown>) & { json: (i: unknown, o?: unknown) => Promise<unknown>; limits: () => Promise<unknown> };
    const wrap = (inner: Sample): Sample => {
      const isGoal = (input: unknown) => typeof input === 'string' && input.startsWith('[goal-check@1]');
      const fn = ((input: unknown, opts?: Parameters<Sample>[1]) => {
        if (!isGoal(input)) return inner(input, opts);
        const text = reply(input as string);
        return new Promise((resolve) =>
          setTimeout(() => {
            opts?.onText?.({ text, delta: text });
            resolve({ text, truncated: false, modelTierApplied: opts?.modelTier ?? 'quick' });
          }, 30),
        );
      }) as Sample;
      fn.json = (input: unknown, opts?: unknown) => (isGoal(input) ? Promise.resolve(JSON.parse(reply(input as string)) as unknown) : inner.json(input, opts));
      fn.limits = () => inner.limits();
      return fn;
    };
    const orig = Object.defineProperty;
    Object.defineProperty = function (o: object, p: PropertyKey, d: PropertyDescriptor & ThisType<unknown>) {
      if (o === window && p === 'claude' && d && d.value) {
        const host = d.value as { use: (n: string) => Promise<unknown> };
        const use = (n: string) => host.use(n).then((cap) => (n === 'sample' && cap ? wrap(cap as Sample) : cap));
        d = { ...d, value: { ...host, use } };
        Object.defineProperty = orig;
      }
      return orig.call(Object, o, p, d);
    } as typeof Object.defineProperty;
  });
}
