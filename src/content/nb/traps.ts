// Startsatz der Deutsch-Fallen (docs/neubau/lehrer.md W9, Plan N43). Daten, kein Code (A6.11):
// Kennungen `f01`…`f25` nie ändern (Wochenziele und `Fix.trapId` verweisen darauf).
// - `wrong`/`right`: Beispiel, `why`/`hint` zweisprachig, `drills`: 3 Übungssätze zum Umschreiben
//   (falscher Satz, erlaubte Lösungen; die erste ist die Musterlösung, US-Englisch).
// - `detect`: reguläre Ausdrücke (ohne Groß-/Kleinschreibung), die die falsche Form in freiem Text
//   finden (`matchTrap`). Leer, wenn die Falle nur im Zusammenhang erkennbar ist.

import type { Bi } from './themes';

export type TrapGroup = 'false-friend' | 'numbers-time' | 'one-to-many' | 'grammar' | 'register';
export type TrapDrill = { wrong: string; right: readonly string[]; de?: string };
export type Trap = {
  id: string;
  group: TrapGroup;
  title: Bi;
  wrong: string;
  right: string;
  why: Bi;
  hint: Bi;
  drills: readonly TrapDrill[];
  detect: readonly string[];
};

export const TRAPS: readonly Trap[] = [
  {
    id: 'f01',
    group: 'false-friend',
    title: { de: 'actual ≠ aktuell', en: 'actual ≠ current' },
    wrong: 'Please send me the actual version of the contract.',
    right: 'Please send me the current version of the contract.',
    why: {
      de: '„actual“ heißt „tatsächlich“. „Aktuell“ ist current oder latest.',
      en: '"Actual" means "real". For the German "aktuell", use current or latest.',
    },
    hint: { de: 'Meinst du „tatsächlich“ oder „gerade gültig“?', en: 'Do you mean "real" or "valid right now"?' },
    drills: [
      { wrong: 'What is the actual status of the project?', right: ['What is the current status of the project?', 'What is the latest status of the project?'] },
      { wrong: 'Our actual price list is attached.', right: ['Our current price list is attached.', 'Our latest price list is attached.'] },
      { wrong: 'The actual situation in the market is difficult.', right: ['The current situation in the market is difficult.', 'The situation in the market is currently difficult.'] },
    ],
    detect: ['\\bactual (?:version|status|situation|price list|release|offer|trends?|topics?|state of the project)\\b'],
  },
  {
    id: 'f02',
    group: 'false-friend',
    title: { de: 'eventually ≠ eventuell', en: 'eventually ≠ possibly' },
    wrong: 'Eventually we can meet next week.',
    right: 'We could possibly meet next week.',
    why: {
      de: '„eventually“ heißt „schließlich, am Ende“. „Eventuell“ ist possibly, maybe oder might.',
      en: '"Eventually" means "in the end". For the German "eventuell", use possibly, maybe, or might.',
    },
    hint: { de: 'Geht es um „am Ende“ oder um „vielleicht“?', en: 'Is it "in the end" or "maybe"?' },
    drills: [
      { wrong: 'Eventually we can move the call to Friday.', right: ['We could possibly move the call to Friday.', 'Maybe we can move the call to Friday.', 'We might be able to move the call to Friday.', 'We may be able to move the call to Friday.'] },
      { wrong: 'Eventually I can join the meeting at three.', right: ['I might be able to join the meeting at three.', 'I may be able to join the meeting at three.', 'Maybe I can join the meeting at three.'] },
      { wrong: 'Eventually you could send me the slides?', right: ['Could you possibly send me the slides?', 'Could you send me the slides?', 'Maybe you could send me the slides?'] },
    ],
    detect: ['\\beventually,? (?:we|you|i|they|he|she) (?:can|could|might|may)\\b(?=[^.!?]*(?:\\?|\\b(?:today|tomorrow|next|this week|monday|tuesday|wednesday|thursday|friday|at \\w+)\\b))'],
  },
  {
    id: 'f03',
    group: 'false-friend',
    title: { de: 'become ≠ bekommen', en: 'become ≠ get' },
    wrong: 'Did you become my email?',
    right: 'Did you get my email?',
    why: {
      de: '„become“ heißt „werden“. „Bekommen“ ist get oder receive.',
      en: '"Become" means "werden" (to turn into). For the German "bekommen", use get or receive.',
    },
    hint: { de: 'Wirst du etwas, oder erhältst du etwas?', en: 'Are you turning into something, or receiving it?' },
    drills: [
      { wrong: 'When will I become the invoice?', right: ['When will I get the invoice?', 'When will I receive the invoice?'] },
      { wrong: 'We became a lot of positive feedback.', right: ['We got a lot of positive feedback.', 'We received a lot of positive feedback.'] },
      { wrong: 'Can I become a glass of water?', right: ['Can I get a glass of water?', 'Could I get a glass of water?', 'Could I have a glass of water?', 'Can I have a glass of water?'] },
    ],
    detect: [
      '\\b(?:become|became|becomes|becoming) (?:my|your|our|the|an?|his|her|their) (?:e-?mail|mail|message|invoice|offer|quote|discount|reply|letter|package|feedback|information|order|confirmation|refund|glass|coffee|table)s?\\b',
      '\\b(?:become|became) a lot of\\b',
      '\\b(?:can|could|may) (?:i|we) become (?:a|an|the|some) (?:glass|cup|coffee|table|receipt|invoice|discount|copy)\\b',
    ],
  },
  {
    id: 'f04',
    group: 'false-friend',
    title: { de: 'provision ≠ Provision', en: 'provision ≠ commission' },
    wrong: 'Our partners get a provision of 20 percent.',
    right: 'Our partners get a commission of 20 percent.',
    why: {
      de: '„provision“ heißt „Bereitstellung“. Die Provision im Vertrieb ist commission.',
      en: '"Provision" means supplying something. The sales payment is a commission.',
    },
    hint: { de: 'Geht es um Geld für einen Verkauf?', en: 'Is it money for a sale?' },
    drills: [
      { wrong: 'How much provision does a reseller get?', right: ['How much commission does a reseller get?', 'What commission does a reseller get?'] },
      { wrong: 'The partner earns a provision on every license.', right: ['The partner earns a commission on every license.'] },
      { wrong: 'We pay 15 percent provision in the first year.', right: ['We pay 15 percent commission in the first year.', 'We pay a 15 percent commission in the first year.'] },
    ],
    detect: [
      '\\b(?:get|gets|got|earn|earns|earned|pay|pays|paid|receive|receives|received) (?:an? |the |their |your |our )?provisions?\\b',
      '\\bmuch provision\\b',
      '\\b(?:percent|%) provision\\b',
    ],
  },
  {
    id: 'f05',
    group: 'false-friend',
    title: { de: 'prospect ≠ Prospekt', en: 'prospect ≠ brochure' },
    wrong: 'Could you send me a prospect about your product?',
    right: 'Could you send me a brochure about your product?',
    why: {
      de: 'Ein „prospect“ ist ein möglicher Kunde (Interessent). Der Prospekt ist brochure.',
      en: 'A prospect is a potential customer. The printed booklet is a brochure.',
    },
    hint: { de: 'Ist es ein Mensch oder ein Heft?', en: 'Is it a person or a booklet?' },
    drills: [
      { wrong: 'I attached our new prospect about the archive solution.', right: ['I attached our new brochure about the archive solution.', 'I attached our new brochure on the archive solution.'] },
      { wrong: 'Please read the prospect before the meeting.', right: ['Please read the brochure before the meeting.'] },
      { wrong: 'Can you send me a prospect?', right: ['Can you send me a brochure?'] },
    ],
    detect: [
      "\\b(?:attach(?:ed)?|print(?:ed)?|read) (?:a |the |our |your |this )?(?:new )?prospects?\\b(?!'| (?:list|data|call|meeting|our|a|an|the|some)\\b)",
      "\\bsend (?:me|us) (?:a|the|your) (?:new )?prospect\\b(?!'| (?:list|data|details|contact|name|info)\\b)",
      '\\bprospects? (?:about|on) (?:your|our|the) (?:product|products|solution|company|services|archive)',
    ],
  },
  {
    id: 'f06',
    group: 'false-friend',
    title: { de: 'Chance = opportunity', en: 'Chance = opportunity' },
    wrong: 'This is a big chance for our company.',
    right: 'This is a big opportunity for our company.',
    why: {
      de: '„chance“ passt für kleine Gelegenheiten (I didn’t get a chance to …) und für Wahrscheinlichkeit (a good chance of winning). Eine geschäftliche Chance ist opportunity.',
      en: '"Chance" works for small openings (I didn\'t get a chance to …) and for likelihood (a good chance of winning). A business opening is an opportunity.',
    },
    hint: { de: 'Kleine Gelegenheit oder Wahrscheinlichkeit – oder eine geschäftliche Chance?', en: 'A small opening or a likelihood – or a business opening?' },
    drills: [
      { wrong: 'The new mandate is a great chance for our partners.', right: ['The new mandate is a great opportunity for our partners.'] },
      { wrong: 'We see a big chance in the public sector.', right: ['We see a big opportunity in the public sector.', 'We see a major opportunity in the public sector.'] },
      { wrong: 'This is a unique chance to modernize your archive.', right: ['This is a unique opportunity to modernize your archive.'] },
    ],
    detect: ['\\b(?:big|great|huge|unique) chances? (?:for|to|in)\\b'],
  },
  {
    id: 'f07',
    group: 'false-friend',
    title: { de: 'serious ≠ seriös', en: 'serious ≠ reputable' },
    wrong: 'We only work with serious partners.',
    right: 'We only work with reputable partners.',
    why: {
      de: '„serious“ heißt „ernst“ oder „ernsthaft“. Seriös ist reputable, trustworthy oder professional.',
      en: '"Serious" means grave or earnest. For "seriös", use reputable, trustworthy, or professional.',
    },
    hint: { de: 'Geht es um Ernst oder um Vertrauen?', en: 'Is it about being grave or being trustworthy?' },
    drills: [
      { wrong: 'We are a serious provider with 20 years of experience.', right: ['We are a reputable provider with 20 years of experience.', 'We are a trusted provider with 20 years of experience.'] },
      { wrong: "Their website doesn't look very serious.", right: ["Their website doesn't look very professional.", "Their website doesn't look very trustworthy."] },
      { wrong: 'Is this a serious company?', right: ['Is this a reputable company?', 'Is this a trustworthy company?'] },
    ],
    detect: [
      '\\b(?:an?|very|really) serious (?:company|partner|partners|provider|vendor|supplier|firm)\\b',
      '\\bwith serious partners\\b',
      "\\b(?:website|site|company|offer|provider|vendor|firm)(?: does(?:n't| not))? looks? (?:very |really )?serious\\b",
    ],
  },
  {
    id: 'f08',
    group: 'false-friend',
    title: { de: 'sympathetic ≠ sympathisch', en: 'sympathetic ≠ likable' },
    wrong: 'Our new account manager is very sympathetic.',
    right: 'Our new account manager is very likable.',
    why: {
      de: '„sympathetic“ heißt „mitfühlend“. Sympathisch ist likable, nice oder friendly.',
      en: '"Sympathetic" means showing understanding for someone\'s problem. For "sympathisch", use likable, nice, or friendly.',
    },
    hint: { de: 'Fühlt die Person mit, oder magst du sie?', en: 'Does the person show pity, or do you like them?' },
    drills: [
      { wrong: 'I found the CFO very sympathetic.', right: ['I found the CFO very likable.', 'I found the CFO very nice.'] },
      { wrong: 'She is a sympathetic person.', right: ['She is a likable person.', 'She is a nice person.', 'She is a friendly person.'] },
      { wrong: 'Their team was really sympathetic.', right: ['Their team was really nice.', 'Their team was really likable.', 'Their team was really friendly.'] },
    ],
    detect: [
      '\\b(?:is|was|are|were|seems?|seemed|found \\w+) (?:very |really |so )?sympathetic\\b(?! (?:to|toward|towards)\\b)',
      '\\ban? sympathetic (?:person|guy|woman|man|colleague|team)\\b',
      '\\b(?:very|really|so) sympathetic\\b(?! (?:to|toward|towards)\\b)',
    ],
  },
  {
    id: 'f09',
    group: 'numbers-time',
    title: { de: 'Zahlen: Milliarde = billion, Punkt statt Komma', en: 'Numbers: billion, decimal point' },
    wrong: 'The market is worth 1,5 milliards euros.',
    right: 'The market is worth 1.5 billion euros.',
    why: {
      de: 'Eine Milliarde ist billion. Dezimalstellen trennt im Englischen der Punkt, und nach einer Zahl steht million/billion ohne -s.',
      en: 'German "Milliarde" is billion. English uses a decimal point, and million/billion take no -s after a number.',
    },
    hint: { de: 'Achte auf das Wort für 1.000 Millionen und auf das Zeichen vor den Nachkommastellen.', en: 'Check the word for 1,000 million and the mark before the decimals.' },
    drills: [
      { wrong: 'Revenue grew by 2,5 percent.', right: ['Revenue grew by 2.5 percent.', 'Revenue grew by 2.5%.'] },
      { wrong: 'They process 3 millions invoices a year.', right: ['They process 3 million invoices a year.', 'They process three million invoices a year.'] },
      { wrong: 'The deal is worth 1 milliard.', right: ['The deal is worth 1 billion.', 'The deal is worth one billion.'] },
    ],
    detect: ['\\bmilliards?\\b', '\\b\\d+,\\d{1,2} ?(?:million|billion|percent|%|m\\b|bn\\b)', '\\b\\d+ (?:millions|billions)\\b'],
  },
  {
    id: 'f10',
    group: 'numbers-time',
    title: { de: 'Termin = meeting, appointment, deadline', en: 'Termin = meeting, appointment, deadline' },
    wrong: 'I have a date with the CFO on Monday.',
    right: 'I have a meeting with the CFO on Monday.',
    why: {
      de: '„date“ ist ein Rendezvous oder ein Kalenderdatum. Beruflich: meeting; beim Arzt: appointment; als Frist: deadline.',
      en: '"Date" is a romantic meeting or a calendar day. At work, use meeting; at the doctor, appointment; for a cutoff, deadline.',
    },
    hint: { de: 'Ist es ein Treffen, ein Arztbesuch oder eine Frist?', en: 'Is it a meeting, a doctor\'s visit, or a cutoff?' },
    drills: [
      { wrong: 'Can we make a date for the demo?', right: ['Can we set a date for the demo?', 'Can we schedule a time for the demo?', 'Can we set up a meeting for the demo?', 'Can we schedule the demo?'] },
      { wrong: 'The termin for the proposal is Friday.', right: ['The deadline for the proposal is Friday.'] },
      { wrong: 'I have a date at the doctor tomorrow.', right: ["I have a doctor's appointment tomorrow.", 'I have an appointment with the doctor tomorrow.'] },
    ],
    detect: [
      '\\b(?:make|made) an? date (?:with|for)\\b',
      '\\b(?:have|had) an? date with\\b',
      '\\bdate with (?:the|a|our|my) (?:customer|client|prospect|cfo|ceo|team|partner)\\b',
      '\\bdate (?:at|with) the (?:doctor|dentist)\\b',
      '\\btermins?\\b',
    ],
  },
  {
    id: 'f11',
    group: 'numbers-time',
    title: { de: 'bis = by (Frist) oder until (Dauer)', en: 'bis = by (deadline) or until (duration)' },
    wrong: 'Please send the offer until Friday.',
    right: 'Please send the offer by Friday.',
    why: {
      de: '„by“ nennt den spätesten Zeitpunkt (Frist). „until“ beschreibt, dass etwas bis dahin andauert.',
      en: '"By" gives the latest point in time (a deadline). "Until" means something continues up to that point.',
    },
    hint: { de: 'Frist oder Dauer?', en: 'Deadline or duration?' },
    drills: [
      { wrong: 'Can you sign the contract until Friday?', right: ['Can you sign the contract by Friday?'] },
      { wrong: 'We need your decision until the end of the month.', right: ['We need your decision by the end of the month.'] },
      { wrong: 'Please pay the invoice until March 31.', right: ['Please pay the invoice by March 31.'] },
    ],
    detect: [
      "(?<!(?:\\bnot|\\bcannot|n't|\\bnever|\\bonly|\\bpostpon\\w*|\\bdelay\\w*|\\bput off|\\bpush(?:ed)? back|\\bwait\\w*|\\bhold|\\bheld)\\b[^.?!]{0,60})\\b(?:send|sent|finish|finished|deliver|submit|pay|sign|confirm|complete|decide|reply|respond)\\b[^.?!,;]{0,40}?\\buntil (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|the end|end of|next week|january|february|march|april|may|june|july|august|september|october|november|december|\\d)",
      "(?<!(?:\\bnot|\\bcannot|n't|\\bnever|\\bonly|\\bpostpon\\w*|\\bdelay\\w*|\\bput off|\\bpush(?:ed)? back|\\bwait\\w*|\\bhold|\\bheld)\\b[^.?!]{0,60})\\b(?:decision|answer|feedback|reply|confirmation|payment|offer|quote|signature)s? until\\b",
    ],
  },
  {
    id: 'f12',
    group: 'numbers-time',
    title: { de: 'seit = for/since mit Present Perfect', en: 'seit = for/since with the present perfect' },
    wrong: 'We are waiting for the invoice since two weeks.',
    right: 'We have been waiting for the invoice for two weeks.',
    why: {
      de: 'Was bis jetzt andauert, steht im Present Perfect. „for“ nennt die Dauer (for two weeks), „since“ den Startpunkt (since May).',
      en: 'Something that continues until now takes the present perfect. "For" gives the length (for two weeks), "since" the starting point (since May).',
    },
    hint: { de: 'Dauert es bis heute? Dann Present Perfect. Dauer oder Startpunkt?', en: 'Does it continue until today? Then use the present perfect. Length or starting point?' },
    drills: [
      { wrong: 'I work here since 2019.', right: ["I've worked here since 2019.", 'I have worked here since 2019.', "I've been working here since 2019.", 'I have been working here since 2019.'] },
      { wrong: 'They use our archive since three years.', right: ["They've been using our archive for three years.", 'They have been using our archive for three years.', "They've used our archive for three years.", 'They have used our archive for three years.'] },
      { wrong: 'I know him since the trade show in Munich.', right: ["I've known him since the trade show in Munich.", 'I have known him since the trade show in Munich.'] },
    ],
    detect: [
      '\\bsince (?:one|two|three|four|five|six|seven|eight|nine|ten|a few|several|many|\\d+) (?:days?|weeks?|months?|years?|hours?)\\b',
      '\\b(?:i|we|you|they) (?:am|are|work|know|use|live|wait)\\b[^.?!]{0,30}?\\bsince(?! (?:i|we|you|they|he|she|it|this|that|there|(?:the|our|your|their|my) \\w+ (?:is|are|was|were|has|have|will|can))\\b)\\b',
      '\\b(?:he|she|it) (?:is|works|knows|uses|lives|waits)\\b[^.?!]{0,30}?\\bsince(?! (?:i|we|you|they|he|she|it|this|that|there|(?:the|our|your|their|my) \\w+ (?:is|are|was|were|has|have|will|can))\\b)\\b',
    ],
  },
  {
    id: 'f13',
    group: 'one-to-many',
    title: { de: 'Sicherheit = security, safety, certainty', en: 'Sicherheit = security, safety, certainty' },
    wrong: 'We guarantee the safety of your data.',
    right: 'We guarantee the security of your data.',
    why: {
      de: 'security = Schutz vor Angriffen und Zugriff; safety = Schutz vor Unfällen und Gefahr; certainty = Gewissheit.',
      en: 'Security protects against attacks and access; safety protects against accidents and danger; certainty means being sure.',
    },
    hint: { de: 'Angriff, Unfall oder Gewissheit?', en: 'Attack, accident, or being sure?' },
    drills: [
      { wrong: 'Data safety is our top priority.', right: ['Data security is our top priority.'] },
      { wrong: "I can't say that with security.", right: ["I can't say that with certainty.", "I can't say that for sure."] },
      { wrong: 'Our warehouse follows strict work security rules.', right: ['Our warehouse follows strict workplace safety rules.', 'Our warehouse follows strict work safety rules.', 'Our warehouse follows strict safety rules.'] },
    ],
    detect: [
      '\\b(?:data|it|cyber|information|network|cloud|server) safety\\b',
      '\\bsafety of (?:your|our|the) (?:data|documents|files|servers|systems?|information)\\b',
      '\\b(?:say|know|tell) (?:this |that |it )?with security\\b',
      '\\bwork(?:place)? security\\b',
    ],
  },
  {
    id: 'f14',
    group: 'grammar',
    title: { de: 'Unzählbare Nomen ohne -s', en: 'Uncountable nouns without -s' },
    wrong: 'Thank you for the informations.',
    right: 'Thank you for the information.',
    why: {
      de: 'information, feedback, advice, software und equipment sind im Englischen unzählbar: kein -s, kein „a“.',
      en: 'Information, feedback, advice, software, and equipment are uncountable in English: no -s and no "a".',
    },
    hint: { de: 'Kann man das Wort im Englischen zählen?', en: 'Can you count this noun in English?' },
    drills: [
      { wrong: 'Thank you for your feedbacks.', right: ['Thank you for your feedback.'] },
      { wrong: 'Could you give me an advice?', right: ['Could you give me some advice?', 'Could you give me a piece of advice?', 'Could you give me advice?'] },
      { wrong: 'We need more informations about your archive.', right: ['We need more information about your archive.'] },
    ],
    detect: [
      '\\b(?:informations|feedbacks|advices|softwares|equipments|furnitures|knowledges|evidences|luggages|baggages)\\b',
      '\\ban? (?:information|advice|feedback)\\b(?! (?:loop|form|session|call|survey|request|security|system|sheet|meeting|round|management|officer|event|page|desk|culture|process|tool|platform|technology)\\b)',
    ],
  },
  {
    id: 'f15',
    group: 'grammar',
    title: { de: 'discuss ohne „about“', en: 'discuss without "about"' },
    wrong: "Let's discuss about the price.",
    right: "Let's discuss the price.",
    why: {
      de: '„discuss“ hat direkt ein Objekt. „about“ passt zu talk about.',
      en: '"Discuss" takes a direct object. "About" goes with talk about.',
    },
    hint: { de: 'Braucht „discuss“ eine Präposition?', en: 'Does "discuss" need a preposition?' },
    drills: [
      { wrong: 'We discussed about the timeline yesterday.', right: ['We discussed the timeline yesterday.', 'We talked about the timeline yesterday.'] },
      { wrong: "I'd like to discuss about next steps.", right: ["I'd like to discuss next steps.", "I'd like to talk about next steps."] },
      { wrong: 'Can we discuss about the contract terms?', right: ['Can we discuss the contract terms?', 'Can we talk about the contract terms?'] },
    ],
    detect: ['\\bdiscuss(?:es|ed|ing)? about\\b'],
  },
  {
    id: 'f16',
    group: 'grammar',
    title: { de: 'explain to me', en: 'explain to me' },
    wrong: 'Can you explain me the process?',
    right: 'Can you explain the process to me?',
    why: {
      de: 'Nach „explain“ steht die Person mit „to“: explain something to someone.',
      en: 'After "explain", the person needs "to": explain something to someone.',
    },
    hint: { de: 'Wo steht die Person, und mit welchem Wort?', en: 'Where does the person go, and with which word?' },
    drills: [
      { wrong: 'Could you explain me how the migration works?', right: ['Could you explain to me how the migration works?', 'Could you explain how the migration works?'] },
      { wrong: 'He explained us the new pricing model.', right: ['He explained the new pricing model to us.'] },
      { wrong: 'Let me explain you the three options.', right: ['Let me explain the three options to you.', 'Let me walk you through the three options.'] },
    ],
    detect: ['\\bexplain(?:s|ed|ing)? (?:me|us|him|them|you)\\b(?! (?:to|for)\\b)'],
  },
  {
    id: 'f17',
    group: 'grammar',
    title: { de: 'look forward to + -ing', en: 'look forward to + -ing' },
    wrong: 'I look forward to hear from you.',
    right: 'I look forward to hearing from you.',
    why: {
      de: 'Das „to“ in „look forward to“ ist eine Präposition. Danach kommt die -ing-Form.',
      en: 'The "to" in "look forward to" is a preposition, so the -ing form follows.',
    },
    hint: { de: 'Ist „to“ hier Teil des Infinitivs oder eine Präposition?', en: 'Is "to" part of the infinitive here, or a preposition?' },
    drills: [
      { wrong: 'We look forward to work with you.', right: ['We look forward to working with you.'] },
      { wrong: "I'm looking forward to meet you at the trade show.", right: ["I'm looking forward to meeting you at the trade show."] },
      { wrong: 'Looking forward to see the proposal.', right: ['Looking forward to seeing the proposal.'] },
    ],
    detect: ['\\blook(?:ing)? forward to (?:hear|see|meet|work|speak|talk|discuss|receive|get|welcome|have|start|join|visit|learn|read|continue)\\b'],
  },
  {
    id: 'f18',
    group: 'grammar',
    title: { de: 'interested in, depend on', en: 'interested in, depend on' },
    wrong: 'We are interested for your solution.',
    right: 'We are interested in your solution.',
    why: {
      de: 'Feste Präpositionen: interested in, depend on. Die deutsche Präposition hilft hier nicht.',
      en: 'Fixed prepositions: interested in, depend on. The German preposition does not help here.',
    },
    hint: { de: 'Welche Präposition gehört fest zu diesem Wort?', en: 'Which preposition always goes with this word?' },
    drills: [
      { wrong: 'Our CFO is interested for a pilot.', right: ['Our CFO is interested in a pilot.'] },
      { wrong: 'The price depends from the number of users.', right: ['The price depends on the number of users.'] },
      { wrong: 'Are you interested about a demo?', right: ['Are you interested in a demo?'] },
    ],
    detect: ['\\binterested (?:for|about|on|of)\\b', '\\bdepend(?:s|ed|ing)? (?:of|from)\\b'],
  },
  {
    id: 'f19',
    group: 'grammar',
    title: { de: 'give a discount, take a photo, do business', en: 'give a discount, take a photo, do business' },
    wrong: 'Can you make us a discount?',
    right: 'Can you give us a discount?',
    why: {
      de: 'Feste Verbindungen: give/offer a discount, take a photo, do business. „make“ passt hier nicht.',
      en: 'Fixed combinations: give/offer a discount, take a photo, do business. "Make" does not fit here.',
    },
    hint: { de: 'Welches Verb gehört fest zu diesem Nomen?', en: 'Which verb always goes with this noun?' },
    drills: [
      { wrong: 'We made a photo of the booth.', right: ['We took a photo of the booth.', 'We took a picture of the booth.'] },
      { wrong: 'We want to make business with you.', right: ['We want to do business with you.'] },
      { wrong: 'If you sign today, we can make a special discount.', right: ['If you sign today, we can give you a special discount.', 'If you sign today, we can offer a special discount.', 'If you sign today, we can give a special discount.', 'If you sign today, we can offer you a special discount.'] },
    ],
    detect: [
      '\\b(?:make|makes|made|making) (?:you |them |him |her |us |me )?(?:an? |the |some |any |no )?(?:special |small |big |bigger |better )?(?:discount|photo|price reduction)s?\\b',
      '\\b(?:make|makes|made|making) (?:you |them |us |me )?an? (?:\\w+ )?pictures?\\b',
      '\\b(?:make|makes|made|making) business\\b',
    ],
  },
  {
    id: 'f20',
    group: 'grammar',
    title: { de: 'Fragen: „do“ und Wortstellung', en: 'Questions: "do" and word order' },
    wrong: 'Can you tell me how many users do you have?',
    right: 'Can you tell me how many users you have?',
    why: {
      de: 'Direkte Fragen brauchen do/does/did. Indirekte Fragen (Can you tell me …) haben normale Wortstellung und kein „do“.',
      en: 'Direct questions need do/does/did. Indirect questions (Can you tell me …) use normal word order and no "do".',
    },
    hint: { de: 'Ist es eine direkte oder eine indirekte Frage?', en: 'Is it a direct or an indirect question?' },
    drills: [
      { wrong: 'Could you tell me what do you use today?', right: ['Could you tell me what you use today?'] },
      { wrong: 'Why you want to change your system?', right: ['Why do you want to change your system?'] },
      { wrong: "I'd like to know how long does the migration take.", right: ["I'd like to know how long the migration takes.", "I'd like to know how long the migration will take."] },
    ],
    detect: [
      '\\b(?:tell me|know|ask|wonder(?:ing)?|explain|remember|sure|idea) (?:what|how|when|where|why|which)(?: (?:many|much|long|often)(?: \\w+)?)? (?:do|does|did) (?:you|we|they|he|she|it|your|the|our)\\b',
      '(?:^|[.!?]\\s+)(?:why|what|how|where) (?:you|we|they) (?:need|want|think|use|have|mean|see|plan|know|like|do)\\b[^.!?,]*\\?',
    ],
  },
  {
    id: 'f21',
    group: 'grammar',
    title: { de: 'ein Meeting halten, nicht „machen“', en: 'hold a meeting, not "make" one' },
    wrong: "Let's make a meeting next week.",
    right: "Let's have a meeting next week.",
    why: {
      de: 'Meetings, Kickoffs und Workshops hat, hält oder leitet man: have, hold, run, schedule. Richtig ist aber „make the meeting“ = es zum Meeting schaffen.',
      en: 'You have, hold, run, or schedule meetings, kickoffs, and workshops. But "make the meeting" is correct when it means managing to attend.',
    },
    hint: { de: 'Welches Verb passt zu „meeting“?', en: 'Which verb goes with "meeting"?' },
    drills: [
      { wrong: 'We need to make a kickoff with the new partner.', right: ['We need to hold a kickoff with the new partner.', 'We need to run a kickoff with the new partner.', 'We need to have a kickoff with the new partner.', 'We need to schedule a kickoff with the new partner.'] },
      { wrong: 'We made a workshop with the IT team.', right: ['We held a workshop with the IT team.', 'We ran a workshop with the IT team.', 'We had a workshop with the IT team.'] },
      { wrong: 'Can we make a meeting on Thursday?', right: ['Can we have a meeting on Thursday?', 'Can we schedule a meeting on Thursday?', 'Can we set up a meeting on Thursday?', 'Can we meet on Thursday?'] },
    ],
    detect: ['\\b(?:make|makes|made|making) (?:a|an) (?:meeting|kickoff|kick-off|workshop)\\b'],
  },
  {
    id: 'f22',
    group: 'grammar',
    title: { de: 'Abgeschlossene Zeit: Past Simple', en: 'Finished time: past simple' },
    wrong: 'I have been in London last week.',
    right: 'I was in London last week.',
    why: {
      de: 'Mit abgeschlossener Zeit (yesterday, last week, ago, in 2020) steht das Past Simple, auch wenn man im Deutschen das Perfekt benutzt.',
      en: 'Finished time (yesterday, last week, ago, in 2020) takes the past simple, even where German uses the perfect.',
    },
    hint: { de: 'Steht ein Zeitpunkt in der Vergangenheit im Satz?', en: 'Is there a finished time in the sentence?' },
    drills: [
      { wrong: 'We have signed the contract two weeks ago.', right: ['We signed the contract two weeks ago.'] },
      { wrong: 'I have met the CFO yesterday.', right: ['I met the CFO yesterday.'] },
      { wrong: 'She has visited our booth last year.', right: ['She visited our booth last year.'] },
    ],
    detect: [
      "\\b(?:have|has|'ve) (?:been|seen|met|visited|had|done|sent|spoken|talked|called|signed|received|made|gone|written|finished)\\b(?:(?!\\bsince\\b)[^.?!]){0,40}?(?<!\\b(?:since|over the|in the|for the|during the) )\\b(?:yesterday|last (?:week|month|year|monday|tuesday|wednesday|thursday|friday|night|time)|ago|in (?:19|20)\\d\\d)\\b",
    ],
  },
  {
    id: 'f23',
    group: 'false-friend',
    title: { de: 'Rezept = prescription, Kaution = deposit', en: 'Rezept = prescription, Kaution = deposit' },
    wrong: 'The doctor gave me a recipe for antibiotics.',
    right: 'The doctor gave me a prescription for antibiotics.',
    why: {
      de: '„recipe“ ist ein Kochrezept, „caution“ heißt Vorsicht. Beim Arzt: prescription; bei der Wohnung: deposit.',
      en: 'A recipe is for cooking, and caution means care. From a doctor, it is a prescription; for an apartment, a deposit.',
    },
    hint: { de: 'Küche oder Arzt? Vorsicht oder Geld?', en: 'Kitchen or doctor? Care or money?' },
    drills: [
      { wrong: 'I need a recipe for my medication.', right: ['I need a prescription for my medication.'] },
      { wrong: 'When do I get my caution back?', right: ['When do I get my deposit back?', 'When will I get my deposit back?'] },
      { wrong: 'The pharmacy needs the recipe from my doctor.', right: ['The pharmacy needs the prescription from my doctor.', "The pharmacy needs my doctor's prescription."] },
    ],
    detect: [
      '\\brecipes? (?:for|from) (?:the |my |your )?(?:doctor|pharmacy|antibiotics|medication|medicine|pills)\\b',
      '\\b(?:doctor|pharmacy|pharmacist)\\b[^.?!]{0,40}?\\brecipes?\\b',
      '\\b(?:pay|paid|return|returned|keep|kept|get|got|refund) (?:my |the |your |our )?caution\\b',
      '\\bcaution (?:back|money)\\b',
    ],
  },
  {
    id: 'f24',
    group: 'register',
    title: { de: 'Nice to meet you / Nice to see you', en: 'Nice to meet you / Nice to see you' },
    wrong: 'Nice to meet you again!',
    right: 'Nice to see you again!',
    why: {
      de: '„Nice to meet you“ sagt man nur beim ersten Treffen. Kennt man sich schon: „Nice to see you (again)“.',
      en: '"Nice to meet you" is only for the first meeting. If you already know each other: "Nice to see you (again)".',
    },
    hint: { de: 'Kennt ihr euch schon?', en: 'Do you already know each other?' },
    drills: [
      { de: 'Ihr trefft euch zum zweiten Mal auf der Messe.', wrong: 'Great to meet you again!', right: ['Great to see you again!', 'Good to see you again!', 'Nice to see you again!'] },
      { de: 'Ihr trefft euch zum ersten Mal.', wrong: 'Nice to see you, I am the new account manager.', right: ["Nice to meet you, I'm the new account manager.", 'Nice to meet you, I am the new account manager.'] },
      { de: 'Der Kunde von letzter Woche kommt an deinen Stand.', wrong: 'Nice to meet you again, how have you been?', right: ['Nice to see you again, how have you been?', 'Good to see you again, how have you been?'] },
    ],
    detect: ['\\b(?:nice|good|great|lovely) to meet you again\\b', "\\b(?:nice|good|great|lovely) to see you,? (?:i am|i'm|my name is)\\b"],
  },
  {
    id: 'f25',
    group: 'register',
    title: { de: 'Zu direkt: „This is not possible.“', en: 'Too direct: "This is not possible."' },
    wrong: 'This is not possible.',
    right: "I'm afraid that won't be possible.",
    why: {
      de: 'Im US-Business klingt ein direktes Nein hart. Man federt ab: I\'m afraid …, That\'s not something I can …, Could you …?',
      en: 'In US business, a flat no sounds harsh. Soften it: I\'m afraid …, That\'s not something I can …, Could you …?',
    },
    hint: { de: 'Wie klingt der Satz für den Kunden? Wie kannst du ihn abfedern?', en: 'How does it sound to the customer? How can you soften it?' },
    drills: [
      { wrong: 'You must send the documents today.', right: ['Could you send the documents today?', 'Would you be able to send the documents today?', 'Could you please send the documents today?'] },
      { wrong: 'That is wrong.', right: ["I'm not sure that's quite right.", 'I see it a bit differently.', "I don't think that's quite right."] },
      { wrong: 'This is not possible for us.', right: ["I'm afraid that won't be possible for us.", "That's not something we can do.", "Unfortunately, that won't work for us."] },
    ],
    detect: ['\\b(?:this|that|it) is not possible\\b', '\\byou must\\b(?! (?:be|have|feel|know)\\b)', "\\bthat(?:'s| is) wrong\\b"],
  },
];

const BY_ID = new Map<string, Trap>(TRAPS.map((t) => [t.id, t]));

export function trapById(id: unknown): Trap | null {
  return typeof id === 'string' ? (BY_ID.get(id) ?? null) : null;
}
