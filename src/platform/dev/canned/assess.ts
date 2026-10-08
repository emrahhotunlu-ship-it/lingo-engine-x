import { assessExample } from '../../../prompts/assess';
import { assess4Example } from '../../../prompts/assess4';

// Feste Antwort für assess@3 (Phase 6, Plan §13; seit dem Fokus-Umbau nur Grammatik und Wortschatz): liest Sprache, Beleg-Kennungen und erlaubte
// Aktionen aus dem Prompt und baut eine gültige Einschätzung. `setAssessBad(true)`: die erste
// Antwort verletzt das Schema (unbekannte Stufe), der eine Neuversuch ist gültig (A6.3).
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

let bad = false;
export function setAssessBad(on: boolean): void {
  bad = on;
}

export function assessReply(input: string): string {
  const lang = /in English\.$/m.test(/^- Write level.*$/m.exec(input)?.[0] ?? '') ? 'en' : 'de';
  const ids = [...input.matchAll(/^\[([a-z]+:[^\]]*)\] /gm)].map((m) => m[1] ?? '').filter(Boolean);
  const allowed = (/^Allowed actions: (.*)$/m.exec(input)?.[1] ?? '').split(', ').filter(Boolean);
  const retry = input.includes('did not match the required format');
  const out = assessExample({ lang, ids, allowed });
  // Belege passend verteilen: Grammatik-Blocker mit g:-Kennungen, Stärken mit v:/p:.
  const gIds = ids.filter((i) => i.startsWith('g:'));
  const wIds = ids.filter((i) => i.startsWith('v:') || i.startsWith('p:'));
  if (gIds.length) out.blockers.forEach((b, k) => (b.ev = [gIds[k % gIds.length] ?? gIds[0] ?? ids[0] ?? 'p:14d']));
  if (wIds.length) out.strengths.forEach((s, k) => (s.ev = [wIds[k % wIds.length] ?? ids[0] ?? 'p:14d']));
  const focusTopic = allowed.find((a) => a === 'grammar:mixed-cond') ?? allowed.find((a) => a.startsWith('grammar:'));
  if (focusTopic) {
    out.focus.action = focusTopic;
    const b0 = out.blockers[0];
    if (b0) b0.action = focusTopic;
  }
  // assess@4 (P45): dazu das Urteil „Weg zu C1“ aus den C1-Belegzeilen und der Liste der offenen Kriterien.
  if (input.startsWith('[assess@4]')) {
    const c1Ids = [...input.matchAll(/^\[(c1:k[1-7]|chk:[^\]]+|gate:\d+|place)\] /gm)].map((m) => m[1] ?? '').filter(Boolean);
    const openRaw = /^- status: .*Open criteria now: ([^.]*)\.$/m.exec(input)?.[1] ?? 'none';
    const open = openRaw === 'none' ? [] : openRaw.split(', ').filter(Boolean);
    const c1 = assess4Example({ lang, ids, allowed, c1: { evidence: '', ids: c1Ids, open } }).c1;
    if (c1) c1.ev = [c1Ids.find((i) => open.some((o) => i === `c1:${o}`)) ?? c1Ids[0] ?? 'c1:k1'];
    const v4 = { ...out, c1 };
    if (bad && !retry) return JSON.stringify({ ...v4, cefr: 'Z9' });
    return JSON.stringify(v4);
  }
  if (bad && !retry) return JSON.stringify({ ...out, cefr: 'Z9' });
  return JSON.stringify(out);
}
