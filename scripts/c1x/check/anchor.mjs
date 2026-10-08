// P41 C1-Check: die 4 Ankeraufgaben. Sie stehen in JEDER Form (A, B, C) und tragen deshalb keine Form (`probe: true`, ohne `form`).
// Über die Anker lassen sich die Formen vergleichen (gleiche Aufgaben, gleiche Wertung). Quellformate: siehe scripts/c1x/build-check.mjs.
export const meta = { file: 'anchor', form: null };
const W = (w, cat, text) => [w, cat, text];
export const items = [
  {
    k: 'mcc', p: 'mc.wish-past', lv: 'C1', dom: 'biz',
    t: 'Looking back, I wish we ___ the contract terms more carefully before signing.',
    o: [['had checked'],
      W('checked', 'grammar', 'wish + Past Simple meint die Gegenwart; Bedauern über Vergangenes braucht had checked. || wish + past simple is about the present; regret about the past needs had checked.'),
      W('would check', 'calque', 'Deutsch „ich wünschte, wir würden“; für Vergangenes steht wish + had + Partizip. || German “ich wünschte, wir würden”; for the past English uses wish + had + participle.'),
      W('have checked', 'grammar', 'Nach wish steht kein Present Perfect; Vergangenes braucht had checked. || No present perfect after wish; the past needs had checked.')],
    ok: 'Bedauern über etwas Vergangenes: wish + had + Partizip (I wish we had checked). Looking back und before signing zeigen die Vergangenheit. || Regret about the past: wish + had + participle (I wish we had checked). Looking back and before signing point to the past.',
  },
  {
    k: 'ocl', p: 'rc.whose', lv: 'B2+', dom: 'biz', cls: 'rel', a: ['whose'],
    t: 'We are looking for a partner ___ software can handle documents in more than twenty languages.',
    c: {
      which: 'which braucht direkt ein Verb (which can …); hier fehlt das „dessen“. || which needs a verb right after it (which can …); the sentence needs “whose”.',
      "who's": "who's heißt who is; „who is software“ ergibt keinen Sinn. || who's means who is; “who is software” makes no sense.",
      that: 'that kann kein „dessen“ ausdrücken; vor einem Nomen steht whose. || that cannot mean “whose”; whose goes before a noun.',
    },
    ok: 'Besitz im Relativsatz: whose + Nomen (a partner whose software = ein Partner, dessen Software). || Possession in a relative clause: whose + noun (a partner whose software).',
  },
  {
    k: 'wf', p: 'lx.wf-noun', lv: 'B2+', dom: 'biz',
    t: 'Several customers have complained about the ___ of the new login process.',
    stem: 'COMPLEX', a: ['complexity', 'complexities'], pos: 'noun', parts: { base: 'complex', suf: ['ity'] },
    fam: ['complex', 'complexity', 'complexities', 'complexly'],
    w: {
      complex: '„complex“ ist ein Adjektiv; nach „the“ und vor „of“ braucht der Satz ein Nomen. || “complex” is an adjective; after “the” and before “of” the sentence needs a noun.',
      complexly: '„complexly“ ist ein Adverb; hier braucht der Satz ein Nomen. || “complexly” is an adverb; the sentence needs a noun here.',
    },
    ok: 'Nach „the“ und vor „of“ steht ein Nomen: complex + -ity = die Komplexität. Auch der Plural complexities passt. || A noun goes after “the” and before “of”: complex + -ity = complexity. The plural complexities also fits.',
  },
  {
    k: 'kwt', p: 'pp.personal', lv: 'C1', dom: 'biz',
    lead: 'People say that the new CEO is planning a major restructuring.', key: 'SAID',
    before: 'The new CEO', after: 'a major restructuring.', a: ['is said'], b: ['to be planning'], x: ['plan', 'that', 'been'],
    traps: [
      ['is said to plan', 'Das Planen läuft gerade (is planning): to be planning, nicht to plan.', 'The planning is going on now (is planning): to be planning, not to plan.'],
      ['said to be planning', 'Es fehlt is: The new CEO is said to be planning.', 'is is missing: The new CEO is said to be planning.'],
    ],
    ok: ['Teil 1: is said, die Person wird Subjekt (neutral berichten). Teil 2: to be planning, weil das Planen gerade läuft.', 'Part 1: is said, the person becomes the subject (neutral reporting). Part 2: to be planning, because the planning is going on now.'],
  },
];
