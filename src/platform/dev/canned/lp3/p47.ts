// Testantworten Lernplattform 3.0, Paket P47 (Schreibwerkstatt, c1-mail@1). Besitzer: nur dieses Paket.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../../fakeSample';
import { CLINIC_RULES } from './p46';

const NOT_JSON = 'Hier ist meine Korrektur, aber leider ohne das verlangte Format.';

/** Der Text zwischen den Markern der Vorlage. */
export function mailTextOf(input: string): string {
  return /<<<TEXT\n([\s\S]*?)\nTEXT>>>/.exec(input)?.[1]?.trim() ?? '';
}

/** Zielwörter aus „Target words (id: word = meaning …): w1: a = … | w2: b“ (@3) bzw. „Target words: a | b“ (älter). */
export const targetWords = (input: string): Array<{ id: string; word: string }> =>
  (/^Target words(?: \([^)]*\))?: (.*)$/m.exec(input)?.[1] ?? '')
    .split(' | ')
    .map((w, k) => {
      const m = /^(w\d): (.+?)(?: = .*)?$/.exec(w.trim());
      return m ? { id: m[1] ?? `w${k + 1}`, word: (m[2] ?? '').trim() } : { id: `w${k + 1}`, word: w.trim() };
    })
    .filter((w) => !!w.word);

/** Kennungen der Zielmuster aus dem Prompt (Zeilen „id: Name (Formel)“ unter „Target patterns“). */
function targetIds(input: string): string[] {
  const block = /^Target patterns \(id: name \(form\)\):\n((?:.+\n)+?)(?:Target phrases:|Target words|Explanation language:)/m.exec(input)?.[1] ?? '';
  return block
    .split('\n')
    .map((l) => /^([a-z0-9]+\.[a-z0-9-]+):/.exec(l)?.[1] ?? '')
    .filter(Boolean);
}

/**
 * Feste, realistische Antwort für `c1-mail@1`. Die Fehler kommen aus der Tabelle der Satz-Klinik (`CLINIC_RULES`), jede Fundstelle ist ein Fehler; dazu eine
 * Verbesserung („tell you“ → „let you know“). `errorCount` ist die Zahl der Fehler, `zzcount` macht sie unplausibel hoch. Marker im Text: `zzjson` → kein JSON,
 * `zzschema` → beim ersten Aufruf ungültige Form (der Neuversuch ist gültig), `zzfake` → dazu eine erfundene Stelle (fällt weg), `zzused` → das erste Zielmuster
 * wird als benutzt gemeldet, `zztone` → Ton „zu locker“, `zzstyle` → viele Verbesserungen, aber keine Fehler.
 */
export function c1MailReply(input: string): string {
  const text = mailTextOf(input);
  const de = /^Explanation language: German$/m.test(input);
  const retry = input.includes('did not match the required format');
  if (/zzjson/i.test(text)) return NOT_JSON;
  if (/zzschema/i.test(text) && !retry) return JSON.stringify({ edits: [], summary: 'kaputt' });
  const clean = text.replace(/\bzz[a-z]+\b/gi, '').replace(/[ \t]+/g, ' ').trim();
  const hits = CLINIC_RULES.filter((r) => clean.toLowerCase().includes(r.from.toLowerCase()));
  const edits: Array<Record<string, unknown>> = hits.map((r) => ({ from: r.from, to: r.to, kind: r.kind, sev: 'error', pat: r.pat, why: de ? r.de : r.en }));
  if (clean.includes('tell you')) edits.push({ from: 'tell you', to: 'let you know', kind: 'word', sev: 'upgrade', pat: null, why: de ? 'So klingt es in einer Mail höflicher.' : 'This sounds more polite in an email.' });
  if (/zzstyle/i.test(text) && clean.includes('budget')) edits.push({ from: 'budget', to: 'financial plan', kind: 'word', sev: 'upgrade', pat: null, why: de ? 'Ein präziseres Wort für diesen Zusammenhang.' : 'A more precise word for this context.' });
  if (/zzfake/i.test(text)) edits.push({ from: 'a phrase that is not in the text', to: 'x', kind: 'grammar', sev: 'error', pat: null, why: de ? 'Diese Stelle gibt es nicht.' : 'This span does not exist.' });
  let fixed = clean;
  for (const r of hits) fixed = fixed.replace(new RegExp(r.from, 'i'), r.to);
  const [first] = targetIds(input);
  const quote = clean.split(/\s+/).slice(0, 3).join(' ');
  const errors = hits.length;
  return JSON.stringify({
    edits,
    // c1-mail@3 (P4): die Zielwörter (Kennung `w1` …) werden beurteilt, sobald sie im Text stehen, jeder Eintrag mit Grund.
    used: [
      ...(/zzused/i.test(text) && first ? [{ pat: first, ok: true, quote, why: de ? 'Die Form ist richtig gebildet.' : 'The form is built correctly.' }] : []),
      ...targetWords(input)
        .map((w) => ({ w, at: clean.toLowerCase().indexOf(w.word.toLowerCase()) }))
        .filter((x) => x.at >= 0)
        .map(({ w, at }) => ({ pat: w.id, ok: !/zzwordbad/i.test(text), quote: clean.slice(at, at + w.word.length), why: /zzwordbad/i.test(text) ? (de ? 'Hier passt die gelernte Bedeutung nicht.' : 'The learned meaning does not fit here.') : de ? 'Das Wort passt hier in der gelernten Bedeutung.' : 'The word fits here in the meaning you learned.' })),
    ],
    tone: /zztone/i.test(text)
      ? { fit: 'too-informal', why: de ? 'Für diesen Empfänger klingt der Text zu locker.' : 'For this reader the text sounds too casual.' }
      : { fit: 'fits', why: de ? 'Der Ton passt zum Empfänger.' : 'The tone suits the reader.' },
    upgraded: `${fixed}\n\nBest regards`,
    summary: de ? 'Gut gegliedert; achte als Nächstes auf feste Verbindungen.' : 'Well structured; next, watch fixed word combinations.',
    errorCount: /zzcount/i.test(text) ? errors * 4 + 9 : errors,
  });
}

/** Meldet die Testantworten von P47 an. */
export function registerLp3P47Replies(): void {
  registerCannedReply('c1-mail', c1MailReply);
}
