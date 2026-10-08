// P43 Ergänzungen nach der Lehrerprüfung (08.10.2026): Aufgaben mit fester Nummer ab 0829, hinter den 8 Grundaufgaben je Thema (Versuch 5 und folgende).
// Sie füllen die Fokus-Lücken der Kapitel 2 und 3: be due to / be set to, time, by; provided that, if only, would rather.
export const items = [
  {
    k: 'kwt', n: 829, p: 'ff.fixed-times', lv: 'B2+', dom: 'biz',
    lead: 'The new release is scheduled to go live at the end of May.', key: 'DUE',
    before: 'The new release', after: 'at the end of May.', a: ['is due'], b: ['to go live', 'to be released'], x: ['set', 'about', 'going'],
    traps: [['is due go live', 'Nach due steht to + Grundform: due to go live.', 'To + base form follows due: due to go live.']],
    ok: ['Teil 1: is due, so sagst du „ist für … vorgesehen“. Teil 2: to go live, danach steht to und die Grundform.', 'Part 1: is due, that is how you say “is scheduled for”. Part 2: to go live, to and the base form follow.'],
  },
  {
    k: 'kwt', n: 830, p: 'ff.fixed-times', lv: 'B2+', dom: 'biz',
    lead: 'The conference is planned to start on Monday morning.', key: 'SET',
    before: 'The conference', after: 'on Monday morning.', a: ['is set'], b: ['to start', 'to begin'], x: ['due', 'about', 'will'],
    traps: [['is set start', 'Nach set steht to + Grundform: set to start.', 'To + base form follows set: set to start.']],
    ok: ['Teil 1: is set, so sagst du „ist angesetzt“. Teil 2: to start, danach steht to und die Grundform.', 'Part 1: is set, that is how you say “is scheduled”. Part 2: to start, to and the base form follow.'],
  },
  {
    k: 'kwt', n: 831, p: 'tc.by-the-time', lv: 'B2+', dom: 'biz',
    lead: 'We will finish the documents before the auditors arrive on Monday.', key: 'TIME',
    before: 'We will have finished the documents', after: 'on Monday.', a: ['by the time'], b: ['the auditors arrive'], x: ['until', 'when', 'before'],
    traps: [['by the time auditors will arrive', 'Nach by the time steht die Gegenwart, kein will: arrive.', 'The present follows by the time, no will: arrive.']],
    ok: ['Teil 1: by the time heißt „spätestens bis“. Teil 2: the auditors arrive, danach steht die Gegenwart.', 'Part 1: by the time means “no later than”. Part 2: the auditors arrive, the present follows.'],
  },
  {
    k: 'kwt', n: 832, p: 'fut.perfect', lv: 'B2+', dom: 'biz',
    lead: "The vendor's team will complete the migration no later than March 31.", key: 'BY',
    before: "The vendor's team", after: 'March 31.', a: ['will have completed', 'will have finished', "'ll have completed", "'ll have finished", 'will complete', 'will finish', "'ll complete", "'ll finish"], b: ['the migration by'], x: ['until', 'within', 'been'], tiles: ['will', 'have', 'completed', 'the', 'migration'], nc: true,
    traps: [['will have complete the migration by', 'Nach will have steht das Partizip: completed.', 'The participle follows will have: completed.']],
    ok: ['Das Future Perfect (will have completed) betont „bis dahin fertig“; will complete ist auch richtig. by nennt die Frist.', 'The future perfect (will have completed) stresses “finished by then”; will complete is also correct. by names the deadline.'],
  },
  {
    k: 'kwt', n: 833, p: 'cn.if-words', lv: 'B2+', dom: 'biz',
    lead: 'We will accept the terms only if the client signs by Friday.', key: 'PROVIDED',
    before: 'We will accept the terms', after: 'by Friday.', a: ['provided that'], b: ['the client signs'], v: [{ a: ['provided'], b: ['the client signs'] }], x: ['unless', 'if', 'when'],
    traps: [['provided that the client will sign', 'Nach provided that steht wie nach if das Present Simple, kein will.', 'After provided that the present simple is used, as after if, no will.']],
    ok: ['Teil 1: provided that, so sagst du „unter der Bedingung, dass“. Teil 2: the client signs, danach steht die Gegenwart, kein will.', 'Part 1: provided that, that is how you say “on condition that”. Part 2: the client signs, the present follows, no will.'],
  },
  {
    k: 'kwt', n: 834, p: 'mc.wish-past', lv: 'B2+', dom: 'life',
    lead: 'I am sorry that I did not listen to your advice.', key: 'ONLY',
    before: '', after: 'to your advice.', a: ['if only'], b: ['I had listened'], x: ['wish', 'would', 'have'], tiles: ['If', 'I', 'had', 'listened'],
    traps: [['if only I would listen', 'If only + had + Partizip drückt Bedauern über Vergangenes aus, nicht would.', 'If only + had + participle expresses regret about the past, not would.']],
    ok: ['Teil 1: if only, so beginnt ein starker Wunsch. Teil 2: I had listened, für Vergangenes steht had + Partizip.', 'Part 1: if only, that is how a strong wish begins. Part 2: I had listened, the past takes had + participle.'],
  },
  {
    k: 'kwt', n: 835, p: 'mc.wish-now', lv: 'B2+', dom: 'biz',
    lead: 'I prefer not to discuss the budget on the phone.', key: 'RATHER',
    before: 'I', after: 'the budget on the phone.', a: ['would rather'], b: ['not discuss'], x: ['prefer', 'than', 'better'],
    traps: [['would rather not to discuss', 'Nach would rather steht die Grundform ohne to.', 'The base form without to follows would rather.']],
    ok: ['Teil 1: would rather, so sagst du „ich möchte lieber“. Teil 2: not discuss, danach steht die Grundform ohne to.', 'Part 1: would rather, that is how you say “I would prefer to”. Part 2: not discuss, the base form without to follows.'],
  },
];
