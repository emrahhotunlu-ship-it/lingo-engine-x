// „Verbform nach Hilfsverb“ (Auswertung 15.10.2026, Punkt 5): die fünf Muster, die Emrahs häufigsten wiederkehrenden Fehler abdecken
// (will worked, wouldn't missed, had sign, has been felt, have been worked, Having wrote, had choosen, catched). Aus dem Grammatik-System abgeleitet:
// die Muster entsprechen den Regeln der Themen future-forms, conditionals (would have), past-perfect / pres-perf (Partizip), pres-perf-cont (been + -ing)
// und c1-participle (Having + Partizip). Je Muster sechs bis acht Lückensätze (Berufsalltag: Dokumentenmanagement, Vertrieb, Verträge), bevorzugt mit
// unregelmäßigen Verben (wrote, chosen, caught): Sein Fehlerbild sind die Partizipien. Die Übung zeigt je Durchgang ein Muster einmal (bei „been“ ein Paar).
// Jede Lücke ist genau ein Wort (die Verbform). `base` = Grundform des Verbs, `wrong` = die typische falsche Form (nur Muster „modal“: sie steht im Hinweis zum Verbessern).

export type AuxPatternId = 'modal' | 'wouldHave' | 'perfect' | 'been' | 'having';

/** Bei „been“: Passiv (has been signed) gegen Dauer bis jetzt (has been working). Ein Durchgang zeigt beides. */
export type AuxKind = 'passive' | 'ongoing';

export type AuxSentence = { sentence: string; gap: string; base: string; de: string; wrong?: string; kind?: AuxKind };

export type AuxPattern = {
  id: AuxPatternId;
  /** Kurzregel (zweisprachig), erscheint als Erklärung nach dem Prüfen. */
  rule: { de: string; en: string };
  /** Die Form, die nach dem Hilfsverb steht (zweisprachig, für „Nach … steht …“). */
  form: { de: string; en: string };
  items: readonly AuxSentence[];
};

/** Zusatzhinweis zum Verb bei „been“ (Passiv gegen Dauer). */
export const AUX_KIND_CUE: Readonly<Record<AuxKind, { de: string; en: string }>> = {
  passive: { de: 'Passiv: etwas wurde gemacht', en: 'passive: something was done' },
  ongoing: { de: 'Dauer bis jetzt', en: 'still going on' },
};

export const AUX_PATTERNS: readonly AuxPattern[] = [
  {
    id: 'modal',
    rule: { de: 'Nach will, would, can, should, might, must steht die Grundform, ohne -ed, -ing oder -s (will work).', en: 'After will, would, can, should, might, must comes the base form, with no -ed, -ing or -s (will work).' },
    form: { de: 'die Grundform', en: 'the base form' },
    items: [
      { sentence: 'We will work on the proposal tomorrow morning.', gap: 'work', base: 'work', de: 'arbeiten', wrong: 'worked' },
      { sentence: 'The customer might cancel the contract next month.', gap: 'cancel', base: 'cancel', de: 'kündigen', wrong: 'canceled' },
      { sentence: 'Our team can archive all signed contracts automatically.', gap: 'archive', base: 'archive', de: 'archivieren', wrong: 'archived' },
      { sentence: 'Should we send the quote before the meeting?', gap: 'send', base: 'send', de: 'senden', wrong: 'sent' },
      { sentence: 'I will call the client as soon as the numbers are ready.', gap: 'call', base: 'call', de: 'anrufen', wrong: 'called' },
      { sentence: 'The new system must replace the old archive by June.', gap: 'replace', base: 'replace', de: 'ersetzen', wrong: 'replaced' },
      { sentence: 'You can export every document as a PDF.', gap: 'export', base: 'export', de: 'exportieren', wrong: 'exporting' },
      { sentence: 'Our sales team would never share customer data without consent.', gap: 'share', base: 'share', de: 'teilen', wrong: 'shared' },
    ],
  },
  {
    id: 'wouldHave',
    rule: { de: 'would / could / should have + Partizip: Nach „have“ steht das Partizip (would have lost), nicht die Grundform.', en: 'would / could / should have + past participle: after "have" comes the participle (would have lost), not the base form.' },
    form: { de: 'das Partizip (3. Form)', en: 'the past participle' },
    items: [
      { sentence: "If we had followed up earlier, we wouldn't have lost the deal.", gap: 'lost', base: 'lose', de: 'verlieren' },
      { sentence: 'We could have signed the contract last week.', gap: 'signed', base: 'sign', de: 'unterschreiben' },
      { sentence: 'The customer should have received the invoice by Friday.', gap: 'received', base: 'receive', de: 'erhalten' },
      { sentence: 'Without the discount, they would have chosen the competitor.', gap: 'chosen', base: 'choose', de: 'wählen' },
      { sentence: 'I might have sent the wrong file to the client.', gap: 'sent', base: 'send', de: 'senden' },
      { sentence: 'She would have won the deal if the price had been lower.', gap: 'won', base: 'win', de: 'gewinnen' },
      { sentence: 'We must have deleted the folder by mistake.', gap: 'deleted', base: 'delete', de: 'löschen' },
      { sentence: 'They could have written to us earlier.', gap: 'written', base: 'write', de: 'schreiben' },
    ],
  },
  {
    id: 'perfect',
    rule: { de: 'have / has / had + Partizip: Nach dem Hilfsverb steht die 3. Form, nicht die Grundform und nicht die 2. Form (had sent, has written).', en: 'have / has / had + past participle: the 3rd form follows the auxiliary, not the base form and not the simple past (had sent, has written).' },
    form: { de: 'das Partizip (3. Form)', en: 'the past participle' },
    items: [
      { sentence: 'Markus had already sent the contract before the price went up.', gap: 'sent', base: 'send', de: 'senden' },
      { sentence: 'Have you written the report for the board yet?', gap: 'written', base: 'write', de: 'schreiben' },
      { sentence: 'Our competitor has chosen a new supplier.', gap: 'chosen', base: 'choose', de: 'wählen' },
      { sentence: 'We have not heard back from the customer since Monday.', gap: 'heard', base: 'hear', de: 'hören' },
      { sentence: 'By the time we called, they had signed with someone else.', gap: 'signed', base: 'sign', de: 'unterschreiben' },
      { sentence: 'I have lost the link to the shared folder.', gap: 'lost', base: 'lose', de: 'verlieren' },
      { sentence: 'She has taken over the Berlin account.', gap: 'taken', base: 'take', de: 'übernehmen' },
      { sentence: 'The auditors had found three missing documents.', gap: 'found', base: 'find', de: 'finden' },
    ],
  },
  {
    id: 'been',
    rule: {
      de: 'been + Wort auf -ing: Für etwas, das bis jetzt dauert, steht nach „been“ die -ing-Form (has been feeling), nicht das Partizip. Ausnahme Passiv: has been signed = wurde unterschrieben.',
      en: 'been + -ing: for something that is still going on, "been" is followed by the -ing form (has been feeling), not the participle. Exception, the passive: has been signed = was signed.',
    },
    form: { de: 'die -ing-Form (Passiv: das Partizip)', en: 'the -ing form (passive: the participle)' },
    items: [
      { sentence: 'The client has been asking for a discount since March.', gap: 'asking', base: 'ask', de: 'fragen nach', kind: 'ongoing' },
      { sentence: 'We have been working with this supplier since 2017.', gap: 'working', base: 'work', de: 'arbeiten', kind: 'ongoing' },
      { sentence: 'They have been waiting for our answer for two weeks.', gap: 'waiting', base: 'wait', de: 'warten', kind: 'ongoing' },
      { sentence: 'I have been reading the contract all morning.', gap: 'reading', base: 'read', de: 'lesen', kind: 'ongoing' },
      { sentence: 'The contract has been signed by both sides.', gap: 'signed', base: 'sign', de: 'unterschreiben', kind: 'passive' },
      { sentence: 'All invoices have been archived in the new system.', gap: 'archived', base: 'archive', de: 'archivieren', kind: 'passive' },
      { sentence: 'Her proposal had been rejected before we even met.', gap: 'rejected', base: 'reject', de: 'ablehnen', kind: 'passive' },
      { sentence: 'The files have been sent to the customer today.', gap: 'sent', base: 'send', de: 'senden', kind: 'passive' },
    ],
  },
  {
    id: 'having',
    rule: { de: 'Having + Partizip: Ein Satz, der mit „Having“ beginnt, braucht die 3. Form (Having written the report), nicht die 2. Form.', en: 'Having + past participle: a sentence that starts with "Having" needs the 3rd form (Having written the report), not the simple past.' },
    form: { de: 'das Partizip (3. Form)', en: 'the past participle' },
    items: [
      { sentence: 'Having written the report, he sent it to the board.', gap: 'written', base: 'write', de: 'schreiben' },
      { sentence: 'Having chosen the smaller package, we cut our upfront costs.', gap: 'chosen', base: 'choose', de: 'wählen' },
      { sentence: 'Having lost the first bid, they tried a new approach.', gap: 'lost', base: 'lose', de: 'verlieren' },
      { sentence: 'Having spoken to the customer, I updated the notes.', gap: 'spoken', base: 'speak', de: 'sprechen' },
      { sentence: 'Having taken the training, she led the project.', gap: 'taken', base: 'take', de: 'machen (Kurs)' },
      { sentence: 'Having found the error, the team fixed it within an hour.', gap: 'found', base: 'find', de: 'finden' },
      { sentence: 'Having sent the offer, we waited for their reply.', gap: 'sent', base: 'send', de: 'senden' },
    ],
  },
] as const;

/** Aufgabe des abschließenden freien Satzes (zweisprachig): ein eigener Satz mit „would have“, in seiner Branche. */
export const AUX_FREE_PROMPT: { de: string; en: string } = {
  de: 'Schreib einen eigenen Satz: Was hätte passieren können, wenn ihr den Deal gewonnen hättet? Benutze „would have“ und ein Partizip.',
  en: 'Write your own sentence: what could have happened if you had won the deal? Use "would have" and a participle.',
};
