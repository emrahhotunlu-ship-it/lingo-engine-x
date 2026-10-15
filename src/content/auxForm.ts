// „Verbform nach Hilfsverb“ (Auswertung 15.10.2026, Punkt 5): die fünf Muster, die Emrahs häufigsten wiederkehrenden Fehler abdecken
// (will worked, wouldn't missed, had sign, has been felt, have been worked, Having wrote, had choosen, catched). Aus dem Grammatik-System abgeleitet:
// die Muster entsprechen den Regeln der Themen future-forms, conditionals (would have), past-perfect / pres-perf (Partizip), pres-perf-cont (been + -ing)
// und c1-participle (Having + Partizip). Je Muster zwei Lückensätze (Berufsalltag); die Übung zeigt je Durchgang ein Muster einmal.
// Jede Lücke ist genau ein Wort (die Verbform). `base` = Grundform des Verbs, `form` = Name der gesuchten Form für die Rückmeldung.

export type AuxPatternId = 'modal' | 'wouldHave' | 'perfect' | 'been' | 'having';

export type AuxSentence = { sentence: string; gap: string; base: string; de: string };

export type AuxPattern = {
  id: AuxPatternId;
  /** Kurzregel (zweisprachig), erscheint als Erklärung nach dem Prüfen. */
  rule: { de: string; en: string };
  /** Die Form, die nach dem Hilfsverb steht (zweisprachig, für „Nach … steht …“). */
  form: { de: string; en: string };
  items: readonly [AuxSentence, AuxSentence];
};

export const AUX_PATTERNS: readonly AuxPattern[] = [
  {
    id: 'modal',
    rule: { de: 'Nach will, would, can, should, might, must steht die Grundform, ohne -ed, -ing oder -s (will work).', en: 'After will, would, can, should, might, must comes the base form, with no -ed, -ing or -s (will work).' },
    form: { de: 'die Grundform', en: 'the base form' },
    items: [
      { sentence: 'We will work on the proposal tomorrow morning.', gap: 'work', base: 'work', de: 'arbeiten' },
      { sentence: 'The customer might cancel the contract next month.', gap: 'cancel', base: 'cancel', de: 'kündigen' },
    ],
  },
  {
    id: 'wouldHave',
    rule: { de: 'would / could / should have + Partizip: Nach „have“ steht das Partizip (would have missed), nicht die Grundform.', en: 'would / could / should have + past participle: after "have" comes the participle (would have missed), not the base form.' },
    form: { de: 'das Partizip (3. Form)', en: 'the past participle' },
    items: [
      { sentence: 'If they had left earlier, they would not have missed the train.', gap: 'missed', base: 'miss', de: 'verpassen' },
      { sentence: 'We could have signed the contract last week.', gap: 'signed', base: 'sign', de: 'unterschreiben' },
    ],
  },
  {
    id: 'perfect',
    rule: { de: 'have / has / had + Partizip: Nach dem Hilfsverb steht die 3. Form, nicht die Grundform und nicht die 2. Form (had signed, has written).', en: 'have / has / had + past participle: the 3rd form follows the auxiliary, not the base form and not the simple past (had signed, has written).' },
    form: { de: 'das Partizip (3. Form)', en: 'the past participle' },
    items: [
      { sentence: 'Markus had signed the contract before the price went up.', gap: 'signed', base: 'sign', de: 'unterschreiben' },
      { sentence: 'Have you written the report for the board yet?', gap: 'written', base: 'write', de: 'schreiben' },
    ],
  },
  {
    id: 'been',
    rule: { de: 'been + Wort auf -ing: Für etwas, das bis jetzt dauert, steht nach „been“ die -ing-Form (has been feeling), nicht das Partizip.', en: 'been + -ing: for something that is still going on, "been" is followed by the -ing form (has been feeling), not the participle.' },
    form: { de: 'die -ing-Form', en: 'the -ing form' },
    items: [
      { sentence: 'He has been feeling tired all week.', gap: 'feeling', base: 'feel', de: 'sich fühlen' },
      { sentence: 'We have been working with this supplier since 2017.', gap: 'working', base: 'work', de: 'arbeiten' },
    ],
  },
  {
    id: 'having',
    rule: { de: 'Having + Partizip: Ein Satz, der mit „Having“ beginnt, braucht die 3. Form (Having written the report), nicht die 2. Form.', en: 'Having + past participle: a sentence that starts with "Having" needs the 3rd form (Having written the report), not the simple past.' },
    form: { de: 'das Partizip (3. Form)', en: 'the past participle' },
    items: [
      { sentence: 'Having written the report, he sent it to the board.', gap: 'written', base: 'write', de: 'schreiben' },
      { sentence: 'Having chosen the smaller package, we saved the upfront cost.', gap: 'chosen', base: 'choose', de: 'wählen' },
    ],
  },
] as const;
