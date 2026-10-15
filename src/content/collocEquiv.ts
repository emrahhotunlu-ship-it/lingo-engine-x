// Gleichwertige Wortpartner (Auswertung 15.10.2026, Punkt 2): Zu manchen Substantiven passen mehrere Verben gleich gut („hold a meeting“, „have a meeting“;
// „meet a deadline“, „hit a deadline“ in den USA üblich; „make a decision“, „take a decision“ britisch). Die Wortpartner-Übungen (`colloc`, `colloc_gap`, Lückenjagd)
// dürfen solche Antworten nicht als falsch werten und solche Wörter nie als falschen Ablenker zeigen. Daten, kein Code.
// Formen je Verb: Grundform, 3. Person, Vergangenheit, Partizip, -ing (die Lücke im Satz kann in jeder Form stehen).

export type VerbForms = readonly [base: string, third: string, past: string, participle: string, ing: string];

export const VERB_FORMS: Readonly<Record<string, VerbForms>> = {
  meet: ['meet', 'meets', 'met', 'met', 'meeting'],
  hit: ['hit', 'hits', 'hit', 'hit', 'hitting'],
  make: ['make', 'makes', 'made', 'made', 'making'],
  beat: ['beat', 'beats', 'beat', 'beaten', 'beating'],
  hold: ['hold', 'holds', 'held', 'held', 'holding'],
  have: ['have', 'has', 'had', 'had', 'having'],
  run: ['run', 'runs', 'ran', 'run', 'running'],
  arrange: ['arrange', 'arranges', 'arranged', 'arranged', 'arranging'],
  schedule: ['schedule', 'schedules', 'scheduled', 'scheduled', 'scheduling'],
  organize: ['organize', 'organizes', 'organized', 'organized', 'organizing'],
  call: ['call', 'calls', 'called', 'called', 'calling'],
  chair: ['chair', 'chairs', 'chaired', 'chaired', 'chairing'],
  take: ['take', 'takes', 'took', 'taken', 'taking'],
  reach: ['reach', 'reaches', 'reached', 'reached', 'reaching'],
  give: ['give', 'gives', 'gave', 'given', 'giving'],
  deliver: ['deliver', 'delivers', 'delivered', 'delivered', 'delivering'],
  do: ['do', 'does', 'did', 'done', 'doing'],
  book: ['book', 'books', 'booked', 'booked', 'booking'],
  achieve: ['achieve', 'achieves', 'achieved', 'achieved', 'achieving'],
};

export type CollocGroup = {
  /** Substantive in der Einzahl; die Mehrzahl (+s) zählt mit. */
  nouns: readonly string[];
  /** Gleichwertige Verben (Schlüssel aus `VERB_FORMS`). */
  verbs: readonly string[];
};

export const COLLOC_GROUPS: readonly CollocGroup[] = [
  { nouns: ['deadline'], verbs: ['meet', 'hit', 'make', 'beat'] },
  { nouns: ['target', 'goal', 'quota'], verbs: ['meet', 'hit', 'reach', 'achieve'] },
  { nouns: ['meeting'], verbs: ['hold', 'have', 'run', 'arrange', 'schedule', 'organize', 'call', 'chair'] },
  { nouns: ['decision'], verbs: ['make', 'take', 'reach'] },
  { nouns: ['presentation'], verbs: ['give', 'deliver', 'make', 'do'] },
  { nouns: ['appointment'], verbs: ['make', 'schedule', 'book', 'arrange'] },
];
