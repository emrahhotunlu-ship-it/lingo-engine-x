import type { Coverage, FollowupCheckOut } from '../../prompts/nb/p4/followupCheck';
import type { Feedback, Fix } from '../../ui/feedback/types';

// Rückmeldung zur Follow-up-Mail (Backlog B6, Lehrer H4) im gemeinsamen Format: fehlende oder nur
// teilweise genannte Vereinbarungen zuerst (als Ziel-Korrektur), dann Sprache, dazu die bessere
// Fassung als Aufwertung. Rein und getestet.

/** Abdeckung je Vereinbarung in Reihenfolge; was Claude nicht nennt, gilt als „fehlt“. */
export function coverageList(points: readonly string[], out: Pick<FollowupCheckOut, 'points'>): Coverage[] {
  return points.map((_, i) => out.points.find((p) => p.i === i)?.covered ?? 'no');
}

export function dialogFeedback(points: readonly string[], out: FollowupCheckOut, labels: { missing: string; why: string }): Feedback {
  const cov = coverageList(points, out);
  const all = cov.every((c) => c === 'yes');
  const none = cov.every((c) => c === 'no');
  const goals: Fix[] = points.flatMap((p, i): Fix[] => {
    if (cov[i] === 'yes') return [];
    const note = out.points.find((x) => x.i === i)?.note ?? '';
    return [{ kind: 'goal', mine: labels.missing, right: p, why: note }];
  });
  const forms: Fix[] = out.fixes.map((f) => ({ kind: 'form', mine: f.mine, right: f.right, why: f.why }));
  return {
    verdict: all && forms.length === 0 ? 'ok' : none ? 'wrong' : 'close',
    effect: out.effect,
    fixes: [...goals, ...forms],
    upgrades: out.better ? [{ to: out.better }] : [],
    ...(all ? {} : { why: { question: labels.why } }),
  };
}
