import type { Check } from '../schemas';

// Verständnis-Check (docs/umbau/lesen-plan.md §2.2): ohne Wertung und Punkte, nur Rückmeldung mit Begründung. Rein.

export type CheckOutcome = { right: boolean; picked: number; correct: number };

/** Urteil zu einer gewählten Antwort. Eine ungültige Wahl zählt als falsch. */
export function judgeCheck(q: Pick<Check, 'a'>, picked: number): CheckOutcome {
  return { right: picked === q.a, picked, correct: q.a };
}

/** Zusammenfassung aller Antworten (Index der Frage → gewählte Antwort) als `{n, ok}` für den Lesezustand; `null` ohne Antwort. */
export function summarizeChecks(list: readonly Pick<Check, 'a'>[], answers: Readonly<Record<number, number>>): { n: number; ok: number } | null {
  let n = 0;
  let ok = 0;
  list.forEach((q, i) => {
    const a = answers[i];
    if (a === undefined) return;
    n++;
    if (a === q.a) ok++;
  });
  return n ? { n, ok } : null;
}
