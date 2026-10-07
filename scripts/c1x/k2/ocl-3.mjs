// P21 Charge ocl-3: Kleines Wort, Kapitel 3 (Bedingungen: conditionals, cond-alt). Felder wie ocl-1.
export const meta = { file: 'k2-3' };
export const items = [
  // ---- conditionals ----
  {
    p: 'cn.zero', lv: 'B2', dom: 'biz', cls: 'conj', a: ['if', 'when', 'whenever', 'once'],
    t: '___ a customer pays by credit card, our system automatically sends a receipt to the registered address.',
    c: {
      although: 'although heißt „obwohl“ und passt nicht zu einer festen Regel. || although means “even though” and does not fit a fixed rule.',
      unless: 'unless heißt „außer wenn“; hier gilt die Regel gerade, wenn gezahlt wird. || unless means “except if”; here the rule applies exactly when someone pays.',
      despite: 'despite braucht ein Nomen oder -ing, keinen ganzen Satz. || despite needs a noun or -ing, not a full clause.',
    },
    ok: 'Feste Regel, die immer gilt: if/when + Gegenwart, Gegenwart. || A fixed rule that always applies: if/when + present, present.',
  },
  {
    p: 'cn.zero', lv: 'B2', dom: 'life', cls: 'aux', a: ['is', 'stays', 'shines'],
    t: 'If the sun ___ out all day, the plants on my balcony grow much faster than in cloudy weeks.',
    c: {
      will: 'will steht nicht im if-Satz; nach if bleibt die Gegenwart. || will does not belong in the if-clause; after if the present stays.',
      was: 'was ist Vergangenheit, die Regel gilt aber immer (grow). || was is past, but the rule always applies (grow).',
      would: 'would steht nicht im if-Satz. || would does not belong in the if-clause.',
    },
    ok: 'Zero Conditional: if + Gegenwart, Gegenwart; hier is out (oder stays out). || Zero conditional: if + present, present; here is out (or stays out).',
  },
  {
    p: 'cn.first', lv: 'B2', dom: 'biz', cls: 'aux', a: ['will', 'may', 'might', 'could'],
    t: 'If you do not hurry with the proposal, you ___ miss the deadline, and the client will go to a competitor.',
    c: {
      would: 'would passt zu einer unwahrscheinlichen Annahme, hier ist die Folge real möglich. || would fits an unlikely assumption, but here the result is really possible.',
      did: 'did miss gibt es hier nicht; es geht um die Zukunft. || did miss does not fit here; this is about the future.',
      were: 'were miss gibt es nicht. || were miss does not exist.',
    },
    ok: 'Reale Möglichkeit: if + Gegenwart, will (oder may/might) + Grundform. || A real possibility: if + present, will (or may/might) + base form.',
  },
  {
    p: 'cn.were', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['were', 'was'],
    t: 'If I ___ you, I would sleep on it before signing such a long-term contract.',
    c: {
      am: 'Nach if I steht in dieser Rede were; „if I am you“ passt nicht zu einem Ratschlag. || After if I this advice form takes were; “if I am you” does not fit advice.',
      be: 'if I be you gibt es im modernen Englisch nicht. || if I be you does not exist in modern English.',
      would: 'would steht im Hauptsatz, nicht im if-Satz. || would belongs in the main clause, not the if-clause.',
    },
    ok: 'Rat und Annahme: If I were you, … (were auch bei I). || Advice and assumption: If I were you, … (were even with I).',
  },
  {
    p: 'tc.noun-clause', lv: 'B2+', dom: 'biz', cls: 'pron', a: ['who'],
    t: 'Could you tell me ___ is responsible for the archive migration, because I need to send them the contract?',
    c: {
      whom: 'whom wäre Objektform; hier ist die Lücke das Subjekt von is responsible. || whom is the object form; here the gap is the subject of is responsible.',
      whose: 'whose zeigt Besitz („wessen“), hier wird nach der Person gefragt. || whose shows possession, but here the person is asked for.',
      what: 'what fragt nach Sachen, nicht nach einer verantwortlichen Person. || what asks about things, not about a responsible person.',
    },
    ok: 'Indirekte Frage nach einer Person als Subjekt: tell me who is responsible (kein do, keine Umstellung). || An indirect question about a person as subject: tell me who is responsible (no do, no inversion).',
  },
  {
    p: 'cn.second', lv: 'B2', dom: 'biz', cls: 'aux', a: ['had'],
    t: 'If our company ___ more money to spend, we would hire another developer for the cloud team immediately.',
    c: {
      has: 'has passt nicht zu if + Vergangenheitsform; hier geht es um eine unwirkliche Annahme. || has does not fit if + past form; this is an unreal assumption.',
      have: 'have ist Gegenwart; für die unwirkliche Annahme braucht der if-Satz die Vergangenheit. || have is present; the unreal if-clause needs the past.',
      would: 'would steht im Hauptsatz, nicht nach if. || would belongs in the main clause, not after if.',
    },
    ok: 'Unwirkliche Gegenwart: if + Past Simple, would + Grundform. || Unreal present: if + past simple, would + base form.',
  },
  {
    p: 'cn.second', lv: 'B2+', dom: 'life', cls: 'aux', a: ['would', 'could', 'might'],
    t: 'If I won the lottery next week, I ___ quit my job and travel around the world for a year.',
    c: {
      will: 'will passt zu realen Annahmen; „won“ zeigt hier eine unwirkliche. || will fits real conditions; “won” shows an unreal one here.',
      did: 'did quit gibt es hier nicht; es geht um Wünsche in der Zukunft. || did quit does not fit; this is about wishes for the future.',
      had: 'had quit wäre Vergangenheit. || had quit would be past.',
    },
    ok: 'Unwirkliche Annahme: if + Past Simple, would + Grundform. || An unreal assumption: if + past simple, would + base form.',
  },
  {
    p: 'cn.third', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['would', 'could', 'might'],
    t: 'If the vendor had warned us earlier, we ___ have switched the provider before the outage.',
    c: {
      will: 'will have steht nicht in einer verpassten Vergangenheit. || will have does not belong to a missed past.',
      had: 'had have gibt es nicht; im Hauptsatz steht would have + Partizip. || had have does not exist; the main clause takes would have + participle.',
      did: 'did have drückt keine verpasste Möglichkeit aus. || did have does not express a missed possibility.',
    },
    ok: 'Verpasste Chance: if + Past Perfect, would have + Partizip. || A missed chance: if + past perfect, would have + participle.',
  },
  {
    p: 'cn.third', lv: 'B2', dom: 'life', cls: 'aux', a: ['have'],
    t: 'If the weather had been better, we would ___ finished the roof by the end of March.',
    c: {
      had: 'would had gibt es nicht; nach would steht have. || would had does not exist; would is followed by have.',
      be: 'would be delivered wäre Passiv und passt nicht zum Sinn. || would be delivered would be passive and does not fit the meaning.',
      has: 'would has gibt es nicht. || would has does not exist.',
    },
    ok: 'Hauptsatz der dritten Bedingung: would have + Partizip. || The main clause of the third conditional: would have + participle.',
  },
  {
    p: 'cn.if-words', lv: 'B2+', dom: 'biz', cls: 'conj', a: ['provided', 'providing'],
    t: 'You may use the company car this weekend ___ that you promise to bring it back with a full tank by Monday.',
    c: {
      unless: 'unless würde die Bedingung umkehren: nur wenn du es nicht versprichst. || unless would reverse the condition: only if you do not promise it.',
      although: 'although heißt „obwohl“ und nennt keine Bedingung. || although means “even though” and names no condition.',
      until: 'until nennt einen Zeitpunkt, keine Bedingung. || until names a point in time, not a condition.',
    },
    ok: 'Bedingung mit Auflage: provided/providing (that) + Gegenwart. || A condition with a requirement: provided/providing (that) + present.',
  },
  {
    p: 'cn.if-words', lv: 'B2+', dom: 'biz', cls: 'conj', a: ['unless', 'until', 'before', 'till'],
    t: 'We will not start the implementation ___ the client has paid the first invoice in full.',
    c: {
      if: 'if würde die Bedeutung umkehren: Wir starten nicht, falls bezahlt wurde. || if would reverse the meaning: we do not start if it has been paid.',
      although: 'although heißt „obwohl“ und passt nicht zu einer Voraussetzung. || although means “even though” and does not fit a requirement.',
      since: 'since heißt „seit“ oder „weil“ und passt nicht zu einer Voraussetzung. || since means “from the time” or “because” and does not fit a requirement.',
    },
    ok: 'Voraussetzung: not … unless/until + Gegenwart, ohne extra not im Nebensatz. || A requirement: not … unless/until + present, with no extra not in the clause.',
  },
  // ---- cond-alt ----
  {
    p: 'ca.unless', lv: 'B2+', dom: 'biz', cls: 'conj', a: ['unless'],
    t: 'We will cancel the order ___ the supplier confirms the delivery date by Monday at the latest.',
    c: {
      if: 'if würde die Bedeutung umkehren: Wir stornieren, falls er bestätigt. || if would reverse the meaning: we cancel if he confirms.',
      until: 'until nennt einen Endpunkt, keine Ausnahme. || until names an end point, not an exception.',
      although: 'although heißt „obwohl“ und passt nicht zu einer Ausnahme. || although means “even though” and does not fit an exception.',
    },
    ok: 'unless = if … not: außer, der Lieferant bestätigt. Im Nebensatz steht kein zweites not. || unless = if … not: except if the supplier confirms. No second not in the clause.',
  },
  {
    p: 'ca.unless', lv: 'B2', dom: 'life', cls: 'conj', a: ['unless'],
    t: 'Please do not call me before noon ___ it is really urgent, because I am working night shifts this week.',
    c: {
      if: 'if würde die Bitte umkehren: „ruf nicht an, wenn es dringend ist“. || if would reverse the request: “do not call if it is urgent”.',
      until: 'until nennt einen Endpunkt, hier fehlt die Ausnahme. || until names an end point, but the exception is missing.',
      because: 'because gibt einen Grund an, keine Ausnahme. || because gives a reason, not an exception.',
    },
    ok: 'Ausnahme: do not call … unless it is urgent. || An exception: do not call … unless it is urgent.',
  },
  {
    p: 'ca.as-long-as', lv: 'B2', dom: 'biz', cls: 'conj', a: ['as', 'so'],
    t: 'You can use my laptop for the demo ___ long as you save all the files on the shared company drive.',
    c: {
      too: 'too long as ist keine Wendung. || too long as is not a phrase.',
      very: 'very long as ist keine Wendung. || very long as is not a phrase.',
      how: 'how long as ist keine Wendung. || how long as is not a phrase.',
    },
    ok: 'Nur unter einer Bedingung: as long as (oder so long as) + Gegenwart. || Only under one condition: as long as (or so long as) + present.',
  },
  {
    p: 'ca.as-long-as', lv: 'B2+', dom: 'life', cls: 'conj', a: ['as'],
    t: 'You can stay in our guest room as long ___ you need; we are not using it before June.',
    c: {
      than: 'as long than ist falsch; die Wendung ist as long as. || as long than is wrong; the phrase is as long as.',
      so: 'as long so gibt es nicht. || as long so does not exist.',
      like: 'as long like gibt es nicht. || as long like does not exist.',
    },
    ok: 'as long as = solange: die Bedingung gilt, bis sie endet. || as long as = for as long as: the condition holds until it ends.',
  },
  {
    p: 'ca.otherwise', lv: 'B2', dom: 'biz', cls: 'adv', a: ['otherwise'],
    t: 'Please send the signed copy by this afternoon. ___, we cannot start the project on Monday as planned.',
    c: {
      therefore: 'therefore nennt eine Folge, hier folgt aber eine Warnung („sonst“). || therefore names a result, but here a warning (“or else”) follows.',
      moreover: 'moreover fügt etwas Gleichartiges hinzu, keine Warnung. || moreover adds something similar, not a warning.',
      instead: 'instead heißt „stattdessen“. || instead means “in place of that”.',
    },
    ok: 'Otherwise = sonst: sagt, was passiert, wenn die Bitte nicht erfüllt wird. || Otherwise = or else: it says what happens if the request is not met.',
  },
  {
    p: 'ca.otherwise', lv: 'B2', dom: 'life', cls: 'adv', a: ['otherwise'],
    t: 'You should back up your files every week; ___, you may lose important data when the laptop fails.',
    c: {
      therefore: 'therefore nennt eine Folge, keine Warnung. || therefore names a result, not a warning.',
      moreover: 'moreover fügt nur etwas hinzu. || moreover only adds something.',
      furthermore: 'furthermore fügt nur etwas hinzu. || furthermore only adds something.',
    },
    ok: 'Otherwise = sonst: die Folge, falls man es nicht tut. || Otherwise = or else: the consequence if you do not do it.',
  },
  {
    p: 'ca.but-for', lv: 'C1', dom: 'life', cls: 'conj', a: ['but'],
    t: '___ for the quick help of our neighbors, the whole cellar would have been flooded last night.',
    c: {
      only: 'Only for gibt es hier nicht; die Wendung heißt But for. || Only for does not fit here; the phrase is But for.',
      not: 'Not for ergibt eine andere Bedeutung. || Not for gives a different meaning.',
      just: 'Just for bedeutet „nur für“. || Just for means “only for”.',
    },
    ok: 'But for + Nomen = ohne (eine verpasste Hilfe): But for X, … would have … || But for + noun = without (a help that was there): But for X, … would have …',
  },
  {
    p: 'ca.but-for', lv: 'C1', dom: 'life', cls: 'aux', a: ['had'],
    t: 'If it ___ not been for your advice, I would have accepted the first offer without any negotiation.',
    c: {
      was: 'was been ist keine Form; es braucht had been. || was been is not a form; it needs had been.',
      were: 'were been ist keine Form. || were been is not a form.',
      has: 'has not been passt zur Gegenwart, hier geht es um die Vergangenheit. || has not been is present, but this is about the past.',
    },
    ok: 'If it had not been for … = hätte es … nicht gegeben (dritte Bedingung). || If it had not been for … = had it not been for … (third conditional).',
  },
  {
    p: 'ca.inversion', lv: 'C1', dom: 'biz', cls: 'aux', a: ['had'],
    t: '___ we known about the supplier\'s financial problems earlier, we would have changed the order immediately.',
    c: {
      have: 'Have we known gibt es hier nicht; die Umstellung der dritten Bedingung steht mit Had. || Have we known does not fit; the inverted third conditional starts with Had.',
      did: 'Did we known ist falsch; nach did steht die Grundform. || Did we known is wrong; after did comes the base form.',
      would: 'Would we known gibt es nicht. || Would we known does not exist.',
    },
    ok: 'Förmlich ohne if: Had + Subjekt + Partizip, would have … (= If we had known). || Formal without if: Had + subject + participle, would have … (= If we had known).',
  },
  {
    p: 'ca.inversion', lv: 'C1', dom: 'biz', cls: 'aux', a: ['should'],
    t: '___ the client decide to cancel the contract, we will need to find a new buyer for the machines quickly.',
    c: {
      would: 'Would the client decide ist keine Bedingungsform für etwas Mögliches. || Would the client decide is not a conditional form for a real possibility.',
      could: 'Could the client decide ist eine Frage nach Möglichkeit, keine Bedingung. || Could the client decide is a question of possibility, not a condition.',
      will: 'Will the client decide wäre eine Frage. || Will the client decide would be a question.',
    },
    ok: 'Förmlich für „falls“: Should + Subjekt + Grundform, … (= If the client decides). || Formal for “if”: Should + subject + base form, … (= If the client decides).',
  },
  {
    p: 'ca.inversion', lv: 'C1', dom: 'biz', cls: 'part', a: ['to'],
    t: 'Were we ___ extend the offer by another month, the price would have to go up by about five percent.',
    c: {
      not: 'Were we not extend ist falsch; es heißt Were we to + Grundform. || Were we not extend is wrong; it is Were we to + base form.',
      for: 'Were we for extend gibt es nicht. || Were we for extend does not exist.',
      going: 'Were we going extend ist falsch; going bräuchte to. || Were we going extend is wrong; going would need to.',
    },
    ok: 'Förmlich für eine unwahrscheinliche Annahme: Were + Subjekt + to + Grundform, … would … || Formal for an unlikely assumption: Were + subject + to + base form, … would …',
  },
  {
    p: 'ca.in-case', lv: 'B2', dom: 'life', cls: 'prep', a: ['in'],
    t: 'Pack a warm jacket ___ case the evening gets cold, because the mountain weather can change quickly.',
    c: {
      on: 'on case gibt es nicht; die feste Wendung heißt in case. || on case does not exist; the fixed phrase is in case.',
      at: 'at case gibt es nicht. || at case does not exist.',
      by: 'by case gibt es nicht. || by case does not exist.',
    },
    ok: 'Vorsorge: in case + Gegenwart (nicht if), wegen etwas, das passieren könnte. || Precaution: in case + present (not if), because of something that might happen.',
  },
  {
    p: 'ca.in-case', lv: 'B2', dom: 'biz', cls: 'prep', a: ['in'],
    t: 'Let me give you my cell phone number just ___ case you cannot reach me at the office during the trade fair.',
    c: {
      on: 'just on case gibt es nicht. || just on case does not exist.',
      at: 'just at case gibt es nicht. || just at case does not exist.',
      for: 'just for case gibt es nicht; es heißt just in case. || just for case does not exist; it is just in case.',
    },
    ok: 'Just in case = für alle Fälle, mit Gegenwart im Nebensatz. || Just in case = to be on the safe side, with the present in the clause.',
  },
  {
    p: 'dip.possible', lv: 'C1', dom: 'biz', cls: 'aux', a: ['could', 'would', 'can', 'will'],
    t: 'I would be grateful if you ___ send me the revised draft by Friday, so that I can forward it to the board.',
    c: {
      did: 'if you did send ist betont und passt nicht zu einer höflichen Bitte. || if you did send is emphatic and does not fit a polite request.',
      were: 'if you were send gibt es nicht. || if you were send does not exist.',
      had: 'if you had send gibt es nicht; had braucht ein Partizip (sent). || if you had send does not exist; had needs a participle (sent).',
    },
    ok: 'Höfliche Bitte: I would be grateful if you could/would + Grundform. || A polite request: I would be grateful if you could/would + base form.',
  },
  {
    p: 'cn.if-words', lv: 'B2+', dom: 'life', cls: 'conj', a: ['unless'],
    t: 'I will join you for dinner tonight ___ my flight from Hamburg is delayed by more than an hour.',
    c: {
      if: 'if würde die Bedeutung umkehren: Ich komme nur, falls der Flug verspätet ist. || if would reverse the meaning: I only come if the flight is delayed.',
      until: 'until nennt einen Endpunkt und passt hier nicht. || until names an end point and does not fit here.',
      although: 'although heißt „obwohl“ und nennt keine Ausnahme. || although means “even though” and names no exception.',
    },
    ok: 'unless = außer wenn: nur eine Ausnahme verhindert es. || unless = except if: only one exception would stop it.',
  },
  {
    p: 'ca.unless', lv: 'B2+', dom: 'life', cls: 'conj', a: ['unless'],
    t: 'The street festival will take place on Saturday ___ the forecast shows heavy rain on Friday night.',
    c: {
      if: 'if würde die Bedeutung umkehren: Start, falls Probleme auftauchen. || if would reverse the meaning: go live if problems appear.',
      although: 'although passt nicht zu einer möglichen Ausnahme. || although does not fit a possible exception.',
      when: 'when meint einen sicheren Zeitpunkt, hier geht es um eine Ausnahme. || when means a certain moment, but this is an exception.',
    },
    ok: 'Eine Ausnahme verhindert den Plan: unless + Gegenwart. || One exception would stop the plan: unless + present.',
  },
];
