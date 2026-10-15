import { z } from 'zod';
import { FALSE_FRIEND_NOTE, falseFriendLines } from '../content/falseFriends';
import { fixedProblem, fixedProblems, usOutput } from '../domain/text/correctness';
import { logWarn } from '../platform/diagnostics';

// Korrigierte Fassungen von Claude (`fixed`, `better`) prüfen (Auswertung 15.10.2026, Punkt 1 und 2).
//  - Prompt-Regeln (`CORRECTION_RULES`): alle Fehler beheben, nur minimal ändern, keinen falschen Freund übernehmen, US-Schreibweise,
//    nur wenn keine ganz richtige Fassung möglich ist, `fixed` leer lassen statt eine falsche Fassung zu liefern.
//  - Nachprüfung (`withFixedGate`): britische Formen werden still nach US gewandelt; besteht `fixed` die lokale Selbstprüfung
//    (`src/domain/text/correctness.ts`) nicht, gilt das als Schemaverletzung (der EINE Neuversuch, A6.3, mit der Fehlerbeschreibung).
//    Besteht auch der Neuversuch nicht (`lenient`), oder bleibt `fixed` leer, wird die Fassung NICHT als richtig gezeigt oder gespeichert:
//    `fixedUnsure: true`, `fixed` leer; die Oberfläche sagt „noch nicht sicher geprüft“.

/** Regeln für jede Vorlage, die eine korrigierte Fassung (`fixed`) liefert: Fortsetzungszeilen unter der Zeile „- fixed: …“ (englisch). */
export function correctionRules(): string[] {
  return [
    '  Fix EVERY error in the learner text (grammar, word choice, agreement, article, preposition, word order, spelling), but change as little as possible and keep his meaning.',
    '  Re-read your fixed text before answering: it must be correct on its own. Check subject-verb agreement ("the list ... is", not "are"), a/an, and the verb form after will/would/have/had/been/having.',
    `  Never keep or introduce a false friend of a German speaker. ${FALSE_FRIEND_NOTE}: ${falseFriendLines().join('; ')}.`,
    '  Always American spelling (jeopardizing, organization, color), also if the learner used British spelling.',
    '  Only if no fully correct version is possible, set fixed to "" and explain the problem in "why" instead of guessing.',
  ];
}

type WithFixed = { fixed: string; better?: string; fixedUnsure?: boolean };

/**
 * Hüllt ein Antwortschema in die Nachprüfung der korrigierten Fassung.
 * `needs` sagt, wann der Fall eine korrigierte Fassung braucht (z. B. Urteil nicht „correct“). `lenient`: bestandene Prüfung ist Pflicht nicht mehr,
 * eine durchgefallene Fassung wird geleert und als „unsicher“ markiert (nur für die Antwort des einen Neuversuchs).
 */
export function withFixedGate<O extends WithFixed>(schema: z.ZodType<O>, opts: { needs: (o: O) => boolean; lenient?: boolean }): z.ZodType<O> {
  // Erst die Schreibweise (vor den Prüfungen des inneren Schemas, die das Zielwort suchen: „jeopardise“ ≠ „jeopardize“).
  const toUS = (v: unknown): unknown => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
    const r = { ...(v as Record<string, unknown>) };
    for (const k of ['fixed', 'better'] as const) if (typeof r[k] === 'string') r[k] = usOutput(r[k]);
    return r;
  };
  return z.preprocess(toUS, schema.transform((o, ctx) => {
    const fixed = usOutput(o.fixed);
    const better = o.better === undefined ? undefined : usOutput(o.better);
    const base: O = { ...o, fixed, ...(better !== undefined ? { better } : {}) };
    // Die C1-Aufwertung (`better`) prüft dieselbe Selbstprüfung: durchgefallen wird sie geleert, ohne Neuversuch (nur `fixed` löst den einen Neuversuch aus).
    if (better?.trim()) {
      const bad = fixedProblems(better)[0];
      if (bad) {
        logWarn('fixedGate:selfcheck', { code: 'better_cleared', message: `better geleert: ${bad.id}: ${bad.hit}` });
        base.better = '';
      }
    }
    if (!opts.needs(base)) return base;
    if (!fixed.trim()) return { ...base, fixed: '', fixedUnsure: true };
    const problem = fixedProblem(fixed);
    if (!problem) return base;
    // Jeder Treffer der Selbstprüfung steht im Diagnose-Protokoll: nach einer Woche sieht man, welche Muster falsch anschlagen.
    const hit = fixedProblems(fixed)[0];
    logWarn('fixedGate:selfcheck', { code: 'fixed_rejected', message: `fixed abgelehnt: ${hit?.id ?? '?'}: ${hit?.hit ?? ''}` });
    if (opts.lenient) return { ...base, fixed: '', fixedUnsure: true };
    ctx.addIssue({ code: 'custom', path: ['fixed'], message: problem });
    return base;
  }));
}
