// Testantworten F3 Anwenden (apply-reply@1, apply-summary@1, apply-keypoints@1). Besitzer: nur dieses Paket.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../fakeSample';
import { mailTextOf } from './lp3/p47';
import { CLINIC_RULES } from './lp3/p46';

const NOT_JSON = 'Here is my check, but sadly not in the requested format.';

/** Nummerierte Zeilen („1. …“) direkt unter der Zeile, die mit `label` beginnt. */
function numbered(input: string, label: string): string[] {
  const at = input.indexOf(label);
  if (at < 0) return [];
  const out: string[] = [];
  for (const line of input.slice(at).split('\n').slice(1)) {
    const m = /^(\d+)\. (.*)$/.exec(line);
    if (!m) break;
    out.push(m[2] ?? '');
  }
  return out;
}

/** Zielwörter aus „Target words: a | b“. */
const targetWords = (input: string): string[] =>
  (/^Target words: (.*)$/m.exec(input)?.[1] ?? '')
    .split(' | ')
    .map((w) => w.trim())
    .filter(Boolean);

const sentencesOf = (text: string): string[] => (text.match(/[^.!?\n]+[.!?]?/g) ?? []).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 3);

/**
 * Gemeinsamer Kern: Fehler aus der Tabelle der Satz-Klinik (`CLINIC_RULES`), eine Verbesserung („tell you“ → „let you know“), Punkte der Reihe nach aus den Sätzen
 * (Satz k deckt Punkt k; `zznopoint` → kein Punkt, `zzpartly` → Punkt 2 nur teilweise), Zielwörter als benutzt, sofern sie im Text stehen (`zzrule` → Regel falsch).
 */
function core(input: string, n: number) {
  const text = mailTextOf(input);
  const de = /^Explanation language: German$/m.test(input);
  const clean = text.replace(/\bzz[a-z]+\b/gi, '').replace(/[ \t]+/g, ' ').trim();
  const hits = CLINIC_RULES.filter((r) => clean.toLowerCase().includes(r.from.toLowerCase()));
  const edits: Array<Record<string, unknown>> = hits.map((r) => ({ from: r.from, to: r.to, kind: r.kind, sev: 'error', pat: r.pat, why: de ? r.de : r.en }));
  if (clean.includes('tell you')) edits.push({ from: 'tell you', to: 'let you know', kind: 'word', sev: 'upgrade', pat: null, why: de ? 'So klingt es in einer Mail höflicher.' : 'This sounds more polite in an email.' });
  let fixed = clean;
  for (const r of hits) fixed = fixed.replace(new RegExp(r.from, 'i'), r.to);
  const sents = sentencesOf(clean);
  const none = /zznopoint/i.test(text);
  const points = Array.from({ length: n }, (_, k) => {
    const s = none ? undefined : sents[k];
    if (!s) return { i: k + 1, covered: 'no', quote: '' };
    return { i: k + 1, covered: k === 1 && /zzpartly/i.test(text) ? 'partly' : 'yes', quote: s };
  });
  const used: Array<Record<string, unknown>> = [];
  for (const w of targetWords(input)) {
    const at = clean.toLowerCase().indexOf(w.toLowerCase());
    if (at >= 0) used.push({ pat: w, ok: true, quote: clean.slice(at, at + w.length) });
  }
  if (/^Target rule/m.test(input) && sents[0]) used.push({ pat: 'rule', ok: !/zzrule/i.test(text), quote: sents[0] });
  const good = sents[0] ? { quote: sents[0], why: de ? 'Der Einstieg ist klar und freundlich.' : 'The opening is clear and friendly.' } : null;
  return { text, de, clean, fixed, edits, points, used, good, errors: hits.length };
}

export function applyReplyReply(input: string): string {
  const n = numbered(input, 'Points the reply must cover:').length;
  const c = core(input, n);
  if (/zzjson/i.test(c.text)) return NOT_JSON;
  if (/zzschema/i.test(c.text) && !input.includes('did not match the required format')) return JSON.stringify({ edits: [], summary: 'broken' });
  return JSON.stringify({
    points: c.points,
    edits: c.edits,
    used: c.used,
    tone: { fit: 'fits', why: c.de ? 'Der Ton passt zum Empfänger.' : 'The tone suits the reader.' },
    good: c.good,
    upgraded: `${c.fixed}\n\nBest regards`,
    summary: c.de ? 'Klar gegliedert; achte als Nächstes auf feste Verbindungen.' : 'Clearly structured; next, watch fixed word combinations.',
    errorCount: c.errors,
  });
}

export function applySummaryReply(input: string): string {
  const n = numbered(input, 'Key points of the article').length;
  const c = core(input, n);
  if (/zzjson/i.test(c.text)) return NOT_JSON;
  const opinion = /\bI think\b[^.!?]*/.exec(c.clean)?.[0] ?? '';
  return JSON.stringify({
    points: c.points,
    faithful: opinion
      ? { ok: false, quote: opinion, why: c.de ? 'Das ist deine Meinung, nicht der Inhalt des Artikels.' : 'This is your opinion, not what the article says.' }
      : { ok: true, quote: '', why: c.de ? 'Alles steht so im Artikel.' : 'Everything is stated in the article.' },
    edits: c.edits,
    used: c.used,
    good: c.good,
    upgraded: `${c.fixed} In short, the article explains what changes next.`,
    summary: c.de ? 'Die Hauptsache ist getroffen; achte als Nächstes auf feste Verbindungen.' : 'You caught the main point; next, watch fixed word combinations.',
    errorCount: c.errors,
  });
}

export function applyKeypointsReply(input: string): string {
  const title = (/^Article: (.*)$/m.exec(input)?.[1] ?? 'the topic').trim();
  return JSON.stringify({
    points: [`The article reports on ${title}.`, 'It explains the main reason for the change.', 'It describes what is expected to happen next.'],
  });
}

/** Meldet die Testantworten von F3 an. */
export function registerApplyReplies(): void {
  registerCannedReply('apply-reply', applyReplyReply);
  registerCannedReply('apply-summary', applySummaryReply);
  registerCannedReply('apply-keypoints', applyKeypointsReply);
}
