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
  set: ['set', 'sets', 'set', 'set', 'setting'],
  lead: ['lead', 'leads', 'led', 'led', 'leading'],
  close: ['close', 'closes', 'closed', 'closed', 'closing'],
  seal: ['seal', 'seals', 'sealed', 'sealed', 'sealing'],
  clinch: ['clinch', 'clinches', 'clinched', 'clinched', 'clinching'],
  land: ['land', 'lands', 'landed', 'landed', 'landing'],
  win: ['win', 'wins', 'won', 'won', 'winning'],
  handle: ['handle', 'handles', 'handled', 'handled', 'handling'],
  address: ['address', 'addresses', 'addressed', 'addressed', 'addressing'],
  overcome: ['overcome', 'overcomes', 'overcame', 'overcome', 'overcoming'],
  strike: ['strike', 'strikes', 'struck', 'struck', 'striking'],
  cut: ['cut', 'cuts', 'cut', 'cut', 'cutting'],
  reduce: ['reduce', 'reduces', 'reduced', 'reduced', 'reducing'],
  lower: ['lower', 'lowers', 'lowered', 'lowered', 'lowering'],
  place: ['place', 'places', 'placed', 'placed', 'placing'],
};

export type CollocGroup = {
  /** Substantive in der Einzahl; die Mehrzahl (+s) zählt mit. */
  nouns: readonly string[];
  /** Gleichwertige Verben (Schlüssel aus `VERB_FORMS`). */
  verbs: readonly string[];
};

// Gruppen nur, wo die Verben dasselbe bedeuten. „meeting“ sind drei verschiedene Dinge: ansetzen (arrange), stattfinden lassen (hold, have), leiten (run, chair):
// „We chaired a meeting for Monday“ oder „Who will schedule the meeting?“ (leiten) wären sonst richtig. „hold a presentation“ und „make a meeting“ bleiben
// bewusst falsche Antworten (typisch deutsche Fehler).
export const COLLOC_GROUPS: readonly CollocGroup[] = [
  { nouns: ['deadline'], verbs: ['meet', 'hit', 'make', 'beat'] },
  { nouns: ['target', 'goal'], verbs: ['meet', 'hit', 'reach', 'achieve'] },
  // „Did you make quota?“ ist Kern-Vertriebssprache in den USA; „achieve a quota“ klingt schief.
  { nouns: ['quota'], verbs: ['meet', 'hit', 'make', 'reach'] },
  { nouns: ['meeting'], verbs: ['arrange', 'schedule', 'organize', 'set', 'book', 'call'] },
  { nouns: ['meeting'], verbs: ['hold', 'have'] },
  { nouns: ['meeting'], verbs: ['run', 'chair', 'lead'] },
  { nouns: ['decision'], verbs: ['make', 'take', 'reach'] },
  { nouns: ['presentation'], verbs: ['give', 'deliver', 'make', 'do'] },
  // „set an appointment“ ist sehr üblich im US-Vertrieb.
  { nouns: ['appointment'], verbs: ['make', 'schedule', 'book', 'arrange', 'set'] },
  { nouns: ['deal'], verbs: ['close', 'seal', 'clinch', 'land', 'win'] },
  { nouns: ['objection'], verbs: ['handle', 'address', 'overcome'] },
  { nouns: ['agreement'], verbs: ['reach', 'strike'] },
  { nouns: ['cost'], verbs: ['cut', 'reduce', 'lower'] },
  { nouns: ['order'], verbs: ['place', 'make'] },
];
