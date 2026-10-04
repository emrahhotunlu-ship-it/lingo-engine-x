import { clip } from '../../prompts/common';
import cefr from '../../content/legacy/cefr.json';
import { TOPICS } from '../content';
import { daysBetween } from '../date';
import { readChecks } from '../check/record';
import {
  canDoSelf,
  grammarSources,
  lastVtest,
  logSources,
  num,
  obj,
  profileWindow,
  radarSources,
  vocabSource,
} from './sources';
import type { AssessRead, EvidenceCounts, EvidenceKey, EvidenceLine, EvidencePack, EvidenceSection } from './types';

// Belegpaket der Einschätzung (Plan §4.2): nummerierte Zeilen `[id] …` je Quelle, mit festen
// Deckeln je Abschnitt und einem Byte-Budget von 46.000 B. Gekürzt wird nach Priorität
// (Radar, Tagesprotokolle, Grammatik). Die Kennungen sind die einzigen, die die KI in `ev` nennen darf.

type Doc = Readonly<Record<string, unknown>>;

export const EVIDENCE_BUDGET = 46_000;
const encoder = new TextEncoder();
const bytes = (s: string): number => encoder.encode(s).length;

export const CEFR_IDS: ReadonlySet<string> = new Set((cefr.items as Array<{ id: string }>).map((i) => i.id));

export type EvidenceInput = {
  nowMs: number;
  today: string;
  profile: Doc;
  grammar: ReadonlyMap<string, Doc>;
  radar: Doc | null;
  vocab: ReadonlyMap<string, Doc>;
  logs: ReadonlyMap<string, Doc>;
  prev: AssessRead | null;
};

const pct = (ok: number, n: number): string => (n > 0 ? `${Math.round((ok / n) * 100)}%` : '–');
const r2 = (x: number): number => Math.round(x * 100) / 100;

/** Deckel je Abschnitt in Bytes (Plan §4.2). */
const CAPS: Record<EvidenceKey, number> = { p: 1500, g: 16 * 700, r: 8000, v: 3000, l: 3000, cd: 500, a: 500 };
/** Reihenfolge, in der bei zu großem Paket gekürzt wird. */
const CUT_ORDER: readonly EvidenceKey[] = ['r', 'l', 'g'];

function capped(key: EvidenceKey, title: string, lines: EvidenceLine[]): EvidenceSection {
  const out: EvidenceLine[] = [];
  let used = 0;
  for (const l of lines) {
    const b = bytes(`[${l.id}] ${l.text}\n`);
    if (used + b > CAPS[key]) break;
    out.push(l);
    used += b;
  }
  return { key, title, lines: out };
}

export function sectionBytes(sections: readonly EvidenceSection[]): number {
  let n = 0;
  for (const s of sections) {
    n += bytes(`${s.title}\n`);
    for (const l of s.lines) n += bytes(`[${l.id}] ${l.text}\n`);
  }
  return n;
}

/** Kürzt nach Priorität, bis das Paket ins Budget passt (Zeilen am Ende eines Abschnitts zuerst). */
export function fitBudget(sections: EvidenceSection[], budget = EVIDENCE_BUDGET): EvidenceSection[] {
  const out = sections.map((s) => ({ ...s, lines: [...s.lines] }));
  let size = sectionBytes(out);
  for (const key of CUT_ORDER) {
    const s = out.find((x) => x.key === key);
    while (s && s.lines.length && size > budget) {
      const l = s.lines.pop();
      if (l) size -= bytes(`[${l.id}] ${l.text}\n`);
    }
    if (size <= budget) break;
  }
  return out.filter((s) => s.lines.length > 0);
}

export function buildEvidence(i: EvidenceInput): EvidencePack {
  const sections: EvidenceSection[] = [];

  // p: Aktivität der letzten 14 Tage
  const w14 = profileWindow(i.profile, i.today, 14);
  const ema = obj(i.profile.ema);
  const n = obj(i.profile.n);
  const emaTxt = Object.entries(ema)
    .filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => `${k}=${r2(num(v))}`)
    .join(' ');
  const nTxt = Object.entries(n)
    .filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => `${k}=${num(v)}`)
    .join(' ');
  const actTxt = Object.entries(w14.acts)
    .map(([k, v]) => `${k}×${v}`)
    .join(' ');
  sections.push(
    capped('p', 'Activity (last 14 days)', [
      { id: 'p:14d', text: `active days ${w14.days}/14, answers ${w14.answers}, minutes ${w14.minutes}${actTxt ? `, channels ${actTxt}` : ''}` },
      ...(emaTxt ? [{ id: 'p:ema', text: `recent accuracy (EMA) ${emaTxt}${nTxt ? `; answers per channel ${nTxt}` : ''}` }] : []),
    ]),
  );

  // g: Grammatikthemen
  const gs = grammarSources(i.grammar)
    .filter((g) => g.n > 0 || g.errors.length)
    .sort((a, b) => b.errors.length - a.errors.length || a.p - b.p);
  const nameOf = (id: string) => TOPICS.find((t) => t.id === id)?.name_en ?? id;
  sections.push(
    capped(
      'g',
      'Grammar topics (mastery p, answers n, last results 1/0, open error sentences)',
      gs.slice(0, 16).map((g) => ({
        id: `g:${g.topic}`,
        text: clip(
          `${nameOf(g.topic)}: p=${r2(g.p)} n=${g.n} recent=${g.recent.join('') || '–'}${g.errors.map((e) => `; wrote "${e.given}" in "${e.q}" (right: "${e.ans}")`).join('')}`,
          600,
        ),
      })),
    ),
  );

  // r: Fehler-Radar (neueste 80)
  const radar = radarSources(i.radar);
  sections.push(
    capped(
      'r',
      'Mistake radar (category, source g=grammar w=writing r=reading v=vocab s=sprint drill k=role-play b=business)',
      radar.map((e, k) => ({ id: `r:${k}`, text: clip(`${e.c}/${e.s}: "${e.g}" → "${e.a}"${e.q ? ` in "${e.q}"` : ''}`, 220) })),
    ),
  );

  // v: Wortschatz
  const vs = vocabSource(i.vocab, i.nowMs);
  const vt = lastVtest(i.profile);
  const vLines: EvidenceLine[] = [
    { id: 'v:cards', text: `cards ${vs.total}, by stage 0–5 ${vs.byStage.join('/')}, mean recall ${vs.meanR === null ? '–' : r2(vs.meanR)}, reviews in 30 days ${vs.reviews30}` },
  ];
  if (typeof ema.colloc === 'number') vLines.push({ id: 'v:colloc', text: `collocation accuracy ${r2(num(ema.colloc))} over ${num(n.colloc)} answers` });
  if (vs.leeches.length) vLines.push({ id: 'v:leech', text: clip(`often forgotten: ${vs.leeches.join(', ')}`, 500) });
  if (vt) vLines.push({ id: 'v:test', text: `vocabulary test ${vt.d}: passive about ${vt.passive}, active about ${vt.active}` });
  // Wochen-Check (M10): gemischte Aufgaben ohne Tipps – die letzten drei als Beleg.
  const checks = readChecks(i.profile).slice(-3);
  if (checks.length)
    vLines.push({
      id: 'v:check',
      text: clip(`weekly checks without hints (newest last): ${checks.map((c) => `${c.d || '?'} ${c.ok}/${c.n} (words ${c.vocab.ok}/${c.vocab.n}, collocations ${c.colloc.ok}/${c.colloc.n}, grammar ${c.gram.ok}/${c.gram.n})`).join('; ')}`, 400),
    });
  sections.push(capped('v', 'Vocabulary', vLines));

  // l: Tagesprotokolle
  const logs = logSources(i.logs);
  const forgot = new Map<string, number>();
  for (const d of logs) for (const id of d.forgot) forgot.set(id, (forgot.get(id) ?? 0) + 1);
  const lLines: EvidenceLine[] = logs.map((d) => ({
    id: `l:${d.day}`,
    text: Object.entries(d.byKind)
      .map(([k, b]) => `${k} ${pct(b.ok, b.n)} of ${b.n}`)
      .join(', '),
  }));
  const oft = [...forgot.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]);
  if (oft.length) lLines.unshift({ id: 'l:forgot', text: clip(`cards missed on several days: ${oft.map(([id]) => (typeof i.vocab.get(id)?.word === 'string' ? String(i.vocab.get(id)?.word) : id)).join(', ')}`, 400) });
  sections.push(capped('l', 'Daily logs (accuracy per exercise type)', lLines));

  // cd: selbst markierte Can-Do-Punkte
  const cds = canDoSelf(i.profile, CEFR_IDS);
  const items = cefr.items as Array<{ id: string; en: string; level: string }>;
  sections.push(capped('cd', 'Can-do statements the learner marked as mastered', cds.map((id) => ({ id: `cd:${id}`, text: clip(`${items.find((x) => x.id === id)?.level ?? ''} ${items.find((x) => x.id === id)?.en ?? id}`, 160) }))));

  // a: vorige Einschätzung
  if (i.prev) {
    const dims = i.prev.data.dims.map((d) => `${d.id}=${d.level ?? 'thin'}`).join(' ');
    sections.push(capped('a', 'Previous assessment', [{ id: 'a:prev', text: `${i.prev.d ?? '?'}: overall ${i.prev.data.cefr ?? '–'}; ${dims}` }]));
  }

  const fitted = fitBudget(sections);
  const ids = fitted.flatMap((s) => s.lines.map((l) => l.id));

  const counts: EvidenceCounts = {
    answers14: w14.answers,
    grammarN: gs.reduce((a, g) => a + g.n, 0),
    grammarTopics: gs.filter((g) => g.n > 0).length,
    vocabReviews30: vs.reviews30,
    vtestDays: vt?.d ? daysBetween(vt.d, i.today) : null,
    vtestD: vt?.d ?? null,
  };
  return { sections: fitted, ids, counts };
}

/** Das Paket als Prompt-Text: je Abschnitt eine Überschrift und nummerierte Zeilen. */
export function evidenceText(pack: EvidencePack): string {
  return pack.sections.map((s) => [`## ${s.title}`, ...s.lines.map((l) => `[${l.id}] ${l.text}`)].join('\n')).join('\n');
}
