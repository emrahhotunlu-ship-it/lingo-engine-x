// Testantworten F3 Anwenden (apply-reply@3, apply-summary@3, apply-keypoints@1; W5: `style` und `greet`; P4: Wort-Kennungen und `why` in `used`). Besitzer: nur dieses Paket.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../fakeSample';
import { mailTextOf, targetWords } from './lp3/p47';
import { CLINIC_RULES } from './lp3/p46';
import { applyBridgeReply } from './applyBridge';

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

/** W5 K1: Stil-Verbesserungen aus einer festen Tabelle (nur Stellen, die wörtlich im Text stehen; `zzfakestyle` → dazu eine erfundene Stelle, fällt weg). */
const STYLE_RULES: ReadonlyArray<{ from: string; to: string; de: string; en: string }> = [
  { from: 'very busy', to: 'stretched thin', de: 'Klingt natürlicher und zeigt mehr Verständnis.', en: 'This sounds more natural and shows more empathy.' },
  { from: 'really needs', to: 'requires', de: 'Ein Wort statt zwei – knapper und sachlicher.', en: 'One precise word instead of two sounds more professional.' },
  { from: 'hard to stop', to: 'difficult to contain', de: 'Das passt besser zu einem sachlichen Bericht.', en: 'This fits a factual report better.' },
  { from: 'we still need', to: 'we are still waiting for', de: 'Klingt in einer Mail an Kunden höflicher.', en: 'This sounds more polite in a client email.' },
];

function styleOf(clean: string, de: boolean, fake: boolean): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = STYLE_RULES.filter((r) => clean.toLowerCase().includes(r.from)).map((r) => {
    const at = clean.toLowerCase().indexOf(r.from);
    return { from: clean.slice(at, at + r.from.length), to: r.to, why: de ? r.de : r.en };
  });
  if (fake) out.unshift({ from: 'a phrase that is not in the text', to: 'something better', why: de ? 'Erfunden.' : 'Invented.' });
  return out.slice(0, 3);
}

/** W5 K7: Anrede und Gruß – fehlt eine Anrede-Zeile am Anfang, `missing`; `zzgreet` → `off`. */
function greetOf(text: string, de: boolean): Record<string, unknown> {
  const first = text.trim().split('\n')[0] ?? '';
  if (/zzgreet/i.test(text)) return { fit: 'off', why: de ? 'Für diese Leserin ist die Anrede zu locker.' : 'The greeting is too casual for this reader.' };
  if (!/^(dear|hi|hello|hey)\b/i.test(first)) return { fit: 'missing', why: de ? 'Am Anfang fehlt die Anrede.' : 'The greeting at the start is missing.' };
  return { fit: 'fits', why: de ? 'Anrede und Gruß passen zum Empfänger.' : 'The greeting and closing suit the reader.' };
}

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
    if (!s) return { i: k + 1, covered: 'no', quote: '', why: de ? 'Dazu steht noch nichts in deinem Text.' : 'Your text does not say anything about this yet.' };
    const partly = k === 1 && /zzpartly/i.test(text);
    return { i: k + 1, covered: partly ? 'partly' : 'yes', quote: s, why: partly ? (de ? 'Das klingt noch zu allgemein; nenne es konkret.' : 'This is still too general; say it more concretely.') : '' };
  });
  const used: Array<Record<string, unknown>> = [];
  for (const w of targetWords(input)) {
    const at = clean.toLowerCase().indexOf(w.word.toLowerCase());
    if (at >= 0) used.push({ pat: w.id, ok: true, quote: clean.slice(at, at + w.word.length), why: de ? 'Das Wort passt hier in der gelernten Bedeutung.' : 'The word fits here in the meaning you learned.' });
  }
  if (/^Target rule/m.test(input) && sents[0]) {
    const bad = /zzrule/i.test(text);
    used.push({ pat: 'rule', ok: !bad, quote: sents[0], why: bad ? (de ? 'Hier fehlt die Form der Regel.' : 'The form of the rule is missing here.') : de ? 'Die Form der Regel ist richtig gebildet.' : 'The form of the rule is built correctly.' });
  }
  const good = sents[0] ? { quote: sents[0], why: de ? 'Der Einstieg ist klar und freundlich.' : 'The opening is clear and friendly.' } : null;
  const style = styleOf(clean, de, /zzfakestyle/i.test(text));
  return { text, de, clean, fixed, edits, points, used, good, style, errors: hits.length };
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
    ...(/^Reader: /m.test(input) ? { greet: greetOf(c.clean, c.de) } : {}),
    good: c.good,
    style: c.style,
    // Gruß nur anhängen, wenn der Text noch keinen hat (sonst stünde „Best regards“ doppelt da).
    upgraded: /\b(best|kind) regards\b/i.test(c.fixed) ? c.fixed : `${c.fixed}\n\nBest regards`,
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
    style: c.style,
    upgraded: `${c.fixed} In short, the article explains what changes next.`,
    summary: c.de ? 'Die Hauptsache ist getroffen; achte als Nächstes auf feste Verbindungen.' : 'You caught the main point; next, watch fixed word combinations.',
    errorCount: c.errors,
  });
}

export function applyKeypointsReply(input: string): string {
  const title = (/^Article: (.*)$/m.exec(input)?.[1] ?? 'the topic').trim();
  return JSON.stringify({
    points: [`It presents the main news: ${title.replace(/[.!?]+$/, '')}.`, 'It explains the main reason for the change.', 'It describes what is expected to happen next.'],
  });
}

/** Meldet die Testantworten von F3 an. */
export function registerApplyReplies(): void {
  registerCannedReply('apply-reply', applyReplyReply);
  registerCannedReply('apply-summary', applySummaryReply);
  registerCannedReply('apply-keypoints', applyKeypointsReply);
  // P4 „Anwenden als Brücke“ (13.11.2026): Brücken-Sätze (apply-bridge@1)
  registerCannedReply('apply-bridge', applyBridgeReply);
}
