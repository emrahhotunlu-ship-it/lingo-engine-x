// Testantworten Tutor-Engine v3, Scheibe S4 (diagnose@2, solve-check@1, word-bank@1). Besitzer: nur diese Scheibe.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../fakeSample';
import { diagnoseReply } from './lp3/p49';

const fakeMode = (): string => (globalThis as { __LINGO_FAKE__?: { diagnoseMode?: string } }).__LINGO_FAKE__?.diagnoseMode ?? '';

/** Abschnitt zwischen zwei Überschriften-Zeilen der Vorlage. */
function section(input: string, start: string, end: string): string[] {
  const a = input.indexOf(`\n${start}\n`);
  if (a < 0) return [];
  const rest = input.slice(a + start.length + 2);
  const b = rest.indexOf(`\n${end}`);
  return (b < 0 ? rest : rest.slice(0, b)).split('\n').filter((l) => l && l !== '(none)');
}

/**
 * Feste Antwort für `diagnose@2` (erkannt an der Kopfzeile; alles andere geht an die Antwort von @1). Liest Annahmen, Belege und Musterliste aus dem
 * Prompt und zitiert nur sie. `diagnoseMode` wie bei @1: `zzjson` → kein JSON, `zzschema` → erster Aufruf ohne `summary` (der Neuversuch ist gültig),
 * `zzinvent` → zusätzlich eine erfundene Annahme und ein erfundener Beleg (fallen weg), `zzempty` → keine Annahme bestätigt (Belege dünn).
 */
export function diagnoseReplyS4(input: string): string {
  if (!input.startsWith('[diagnose@2]')) return diagnoseReply(input);
  const mode = fakeMode();
  if (/zzjson/i.test(mode)) return 'Hier ist meine Einschätzung, aber leider ohne das verlangte Format.';
  if (/zzschema/i.test(mode) && !input.includes('did not match the required format')) return JSON.stringify({ hyps: [], focus: [] });
  if (/zzempty/i.test(mode))
    return JSON.stringify({ hyps: [], focus: [], summary: { de: 'Diese Woche gibt es noch zu wenig Belege für eine Annahme.', en: 'This week there is still too little evidence for a hypothesis.' } });
  const hyps = section(input, 'Hypotheses of the app:', 'German transfer notes:').map((l) => {
    const [id = '', used = ''] = l.split(' | ');
    const m = /^used (\S+) where (\S+) was right$/.exec(used);
    return { id, to: m?.[1] ?? '', from: m?.[2] ?? '' };
  });
  const ev = [...input.matchAll(/^\[([a-z0-9:.|>-]+)\] /gm)].map((m) => m[1] ?? '');
  const pats = new Set(section(input, 'Pattern list (topic: ids):', 'Length limits:').flatMap((l) => (l.split(': ')[1] ?? '').split(', ').map((s) => s.trim())));
  const invent = /zzinvent/i.test(mode);
  const out = hyps.slice(0, 3).map((h, k) => ({
    id: h.id,
    verdict: k === 0 ? 'likely' : 'unclear',
    ev: [...ev.filter((e) => (h.from && e.includes(h.from)) || (h.to && e.includes(h.to))).slice(0, 2), ...(invent ? ['p:invented.one'] : [])],
    why: {
      de: k === 0 ? 'Mehrere Belege an verschiedenen Tagen zeigen dieselbe Verwechslung.' : 'Die Belege reichen noch nicht für ein sicheres Urteil.',
      en: k === 0 ? 'Several pieces of evidence on different days show the same mix-up.' : 'The evidence is not enough yet for a firm judgment.',
    },
  }));
  if (invent) out.push({ id: 'h:invented>one', verdict: 'likely', ev: [], why: { de: 'Erfundene Annahme, sie fällt weg.', en: 'An invented hypothesis that is dropped.' } });
  const focus = [...new Set(hyps.map((h) => h.from).filter((p) => pats.has(p)))].slice(0, 2);
  return JSON.stringify({
    hyps: out,
    focus,
    summary: hyps.length
      ? { de: 'Diese Woche lohnt sich vor allem die erste Verwechslung.', en: 'This week the first mix-up is the most worthwhile one.' }
      : { de: 'Diese Woche gibt es noch zu wenig Belege für eine Annahme.', en: 'This week there is still too little evidence for a hypothesis.' },
  });
}

/**
 * Feste Antwort für `solve-check@1`: löst die Aufgaben der Test-Antwort von `grammar-items` (Bericht-Sätze) wie ein zweiter Löser. Unbekannte
 * Aufgaben gelten als nicht lösbar (`ambiguous`), ebenso Sätze mit dem Marker `zzambig`.
 */
export function solveCheckReply(input: string): string {
  const results = [...input.matchAll(/^#(\d+) \| type=(\w+) \| (.*)$/gm)].map((m) => {
    const i = Number(m[1]);
    const type = m[2] ?? '';
    const rest = m[3] ?? '';
    const sentence = /sentence=([^|]+)/.exec(rest)?.[1]?.trim() ?? '';
    const target = /target=([^|]+)/.exec(rest)?.[1]?.trim() ?? '';
    let answers: string[] = [];
    if (/zzambig/i.test(rest)) answers = [];
    else if (type === 'mc' && /every Monday/.test(sentence)) answers = ['is checked'];
    else if (type === 'gap' && /\(send\)/.test(sentence)) answers = ['was sent'];
    else if (type === 'transform' && /every week/.test(target)) answers = ['is updated'];
    else if (type === 'correct' && / was send /.test(sentence)) answers = [sentence.replace(' was send ', ' was sent ')];
    const ok = answers.length > 0;
    return {
      i,
      answers,
      ambiguous: !ok,
      why: ok
        ? { de: 'Der Satzgegenstand handelt nicht selbst: Passiv.', en: 'The subject does not act itself: passive.' }
        : { de: 'Aus dem Satz allein ist die Lösung nicht eindeutig.', en: 'The sentence alone does not give one clear answer.' },
    };
  });
  return JSON.stringify({ results });
}

/**
 * Feste Antwort für `word-bank@1`: je Karte vier Sätze (2 Beruf, 1 Alltag, 1 Frage), das Wort genau einmal, US-Schreibweise.
 * Marker im Wort: `zzuk` → der erste Satz ist britisch geschrieben (fällt bei der Prüfung weg).
 */
export function wordBankReply(input: string): string {
  const items = [...input.matchAll(/^- id=([^|]+?) \| (?:word|phrase)=([^|]+?) \|.*$/gm)].map((m) => {
    const id = (m[1] ?? '').trim();
    const w = (m[2] ?? '').trim().replace(/^to\s+/i, '');
    const uk = /zzuk/i.test(w);
    return {
      id,
      sents: [
        {
          en: uk ? `In the client call, Maria used ${w} to describe our new colour scheme.` : `In the client call, Maria used ${w} to describe our new project plan.`,
          de: 'Im Kundentermin hat Maria das Wort benutzt, um unseren neuen Projektplan zu beschreiben.',
          sit: 'client call',
          k: 'work',
        },
        { en: `Our team lead wrote ${w} in the summary email after the budget review.`, de: 'Unsere Teamleiterin schrieb das Wort nach der Budgetprüfung in die Zusammenfassung.', sit: 'budget email', k: 'work' },
        { en: `At dinner last night, my sister said ${w} while telling us about her trip.`, de: 'Beim Abendessen gestern sagte meine Schwester das Wort, als sie von ihrer Reise erzählte.', sit: 'family dinner', k: 'life' },
        { en: `Did the new intern really use ${w} in front of the whole sales team?`, de: 'Hat der neue Praktikant das Wort wirklich vor dem ganzen Vertriebsteam benutzt?', sit: 'office chat', k: 'form' },
      ],
    };
  });
  return JSON.stringify({ items });
}

/** Meldet die Testantworten von S4 an (nach P49: `diagnose` erkennt die Version an der Kopfzeile). */
export function registerS4Replies(): void {
  registerCannedReply('diagnose', diagnoseReplyS4);
  registerCannedReply('solve-check', solveCheckReply);
  registerCannedReply('word-bank', wordBankReply);
}
