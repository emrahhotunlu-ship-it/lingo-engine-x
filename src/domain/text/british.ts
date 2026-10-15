import { usSpelling } from './lemma';

// Britische Schreibweise erkennen und nach US wandeln (Auswertung 15.10.2026: KI-Korrekturen gaben „jeopardising“ aus).
// Gemeinsam für das Lesen-Modul (Tor 8, über `modules/read/shared.ts`) und die KI-Korrekturen (`prompts/fixedGate.ts`).
// In Emrahs EINGABEN sind britische Formen richtig (CLAUDE.md A7); hier geht es nur um Text, den die App selbst ausgibt.

// US-Schreibweise (Tor 8): britische Formen im erzeugten Text. In Emrahs EINGABEN sind britische Formen richtig (CLAUDE.md A7), im erzeugten Text gilt US.
const BRITISH = new RegExp(
  [
    '\\b(?:colour|favour|honour|behaviour|labour|neighbour|humour|rumour|harbour|flavour|savour|vapour|endeavour|armour|odour)\\w*',
    '\\b(?:centre|metre|litre|theatre|fibre|calibre)s?\\b',
    '\\b(?:defence|offence|licence|pretence)s?\\b',
    '\\w+isation(?:s)?\\b',
    '\\b(?:organis|realis|recognis|optimis|prioritis|minimis|maximis|summaris|utilis|customis|standardis|specialis|categoris|capitalis|authoris|finalis|digitis|monetis|harmonis|centralis|localis|globalis|generalis|synchronis|visualis|personalis|apologis|criticis|itemis|emphasis|memoris|normalis|stabilis|mobilis|modernis|penalis|revolutionis|rationalis|socialis|commercialis|industrialis|incentivis|operationalis|virtualis|containeris|materialis|neutralis|familiaris)(?:e|ed|es|ing|er|ers)\\b',
    '\\banalys(?:e|ed|ing)\\b',
    '\\b(?:jeopardis|hospitalis|sympathis|empathis|characteris|subsidis|legalis|formalis|fertilis|mechanis|publicis|computeris|scrutinis|sanitis|catalys|paralys|dialys)(?:e|ed|ing)\\b',
    '\\b(?:programme|catalogue|cheque|tyre|kerb|aluminium|artefact|sceptic|cosy|mould|plough|draught|pyjamas|aeroplane|grey|maths|whilst|amongst|learnt|spelt|dreamt|judgement|acknowledgement|ageing|storey|fortnight|jewellery)s?\\b',
    '\\b(?:fulfil|enrol|instalment|skilful|wilful|fulfilment|enrolment)s?\\b',
    '\\b(?:travell|modell|labell|signall|channell|levell|fuell|tunnell|marvell)(?:ed|ing|er|ers|ous)\\b',
  ].join('|'),
  'i',
);

/** Britische Schreibweise gefunden? Liefert die Fundstelle. */
export function britishSpelling(text: string): string | null {
  return BRITISH.exec(text)?.[0] ?? null;
}

/** US-Form eines einzelnen Worts mit Groß-/Kleinschreibung des Originals (Satzanfang, ALLES GROSS). */
function usWordCase(word: string): string {
  if (word.toLowerCase() === 'analyses') return word; // Mehrzahl von „analysis“, kein britisches Verb
  const us = usSpelling(word.toLowerCase());
  if (us === word.toLowerCase()) return word;
  if (word === word.toUpperCase() && word.length > 1) return us.toUpperCase();
  return word[0] === word[0]?.toUpperCase() ? `${us.charAt(0).toUpperCase()}${us.slice(1)}` : us;
}

/** Text mit US-Schreibweise: nur britische Wörter ändern sich (jeopardising → jeopardizing, colour → color). */
export function toUSText(text: string): string {
  return text.replace(/[A-Za-z]+/g, (w) => usWordCase(w));
}
