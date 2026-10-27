/* Paket A „Wörter“ (Nora-A): Vokabeltrainer H17–H20, Wörter sammeln H21, Tempo H22, Wort verwalten H23.
   Quelle: docs/relaunch/vokabeltrainer.md (Lena, Mara) · luecken.md Muss 3, 4, 5 und Soll 21 · inhalte-kapitel1.md.
   Lernregeln werden nur gezeigt, nicht umgedeutet. Durchgehende Geschichte: heute ist Donnerstag, 29.10.;
   14 Wörter fällig; Serie 12 vor, 13 nach der Pflicht; quote heute neu (ruht bis morgen früh); flexibility ruht bis 12.11. */

/* ---------- gemeinsame Daten ---------- */
/* Die 10 Wörter des Vorschlags „10 fällige Wörter“, sortiert nach niedrigster Abrufwahrscheinlichkeit. */
const TW_ROUND = () => [
  ['budget approval', L('Budgetfreigabe', 'budget approval'), 'S2'],
  ['revise a quote', L('ein Angebot überarbeiten', 'revise a quote'), 'S3'],
  ['follow up', L('nachfassen', 'follow up'), 'S3'],
  ['sign off on', L('freigeben, absegnen', 'approve'), 'S5'],
  ['procurement', L('Einkauf, Beschaffung', 'purchasing'), 'S5'],
  ['reduce', L('senken, verringern', 'lower, cut'), 'S5'],
  ['discount', L('Rabatt', 'discount'), 'S3'],
  ['supplier', L('Lieferant', 'supplier'), 'S3'],
  ['call back', L('zurückrufen', 'call back'), 'S2'],
  ['deliver on time', L('pünktlich liefern', 'deliver on time'), 'S3']
];
const twNorm = s => (s || '').replace(/[’‘]/g, '\'').replace(/\s+/g, ' ').trim().toLowerCase();

/* ---------- Rahmen des Trainers ---------- */
/* Eigener, einteiliger Balken „4 von 10“ (+1 für Wiederkehrer) und die Marke „Extra“ (VT 4.1). */
function twTop(cur, total, o) {
  o = o || {};
  const fill = Math.max(0.04, Math.min(1, (cur - (o.done ? 0 : 1) + (o.done ? 0 : 0.35)) / total));
  return '<div class="ex-top gx tw-top">' +
    '<button class="iconbtn" id="ex-close" data-go="' + (o.closeTo || 'h12-list') + '" aria-label="' + esc(L('Schließen', 'Close')) + '">' + ic('close') + '</button>' +
    '<div class="tw-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + cur + '" aria-label="' + esc(L('Fortschritt der Runde', 'Round progress')) + '"><i style="width:' + Math.round(fill * 100) + '%"></i></div>' +
    '<span class="tw-count num">' + L(cur + ' von ' + total, cur + ' of ' + total) + (o.plus ? ' <em>+' + o.plus + '</em>' : '') + '</span>' +
    '<span class="tw-badge">' + L('Extra', 'Extra') + '</span>' +
    (o.noMenu ? '' : '<button class="iconbtn" id="ex-more" data-act="menu" aria-label="' + esc(L('Mehr Möglichkeiten', 'More options')) + '">' + ic('more') + '</button>') + '</div>';
}
/* Menü „…“ im Trainer: „Fertig“ steht hier (VT 4.3), X schließt ohne Rückfrage. */
function twMenu(o) {
  o = o || {};
  return '<div class="scrim" data-act="closesheet" style="background:transparent"></div><div class="menu" id="ex-menu" role="menu">' +
    '<button id="m-claude" data-go="h15-claude" role="menuitem">' + ic('claude', 'sm') + L('Claude fragen', 'Ask Claude') + '</button>' +
    '<button id="m-trans" data-go="h15-translate" role="menuitem">' + ic('trans', 'sm') + L('Übersetzer', 'Translator') + '</button>' +
    '<button id="m-whytask" data-act="whysheet" role="menuitem">' + ic('info', 'sm') + L('Warum diese Aufgabe?', 'Why this task?') + '</button>' +
    (o.checked ? '<button id="m-explain" data-go="h15-claude" role="menuitem">' + ic('bulb', 'sm') + L('Erklär mir meine Antwort', 'Explain my answer') + '</button>' : '') +
    '<hr><button id="m-finish" data-go="' + (o.finish || 'h20-stopped') + '" role="menuitem">' + ic('check', 'sm') + L('Fertig, Runde beenden', 'Done, end the round') + '</button>' +
    '<hr><button id="m-report" data-act="noop" role="menuitem">' + ic('flag', 'sm') + L('Problem melden', 'Report a problem') + '</button></div>';
}
function twOverlays(o) {
  let s = '';
  if (S.ui.menu) s += twMenu(o);
  if (S.ui.sheet === 'why') s += whySheet(o.why || '');
  if (S.ui.sheet === 'more' && o.task) s += twMoreSheet(o.task);
  return s;
}
const twActsBase = {
  whysheet() { S.ui.menu = false; S.ui.sheet = 'why'; render(); },
  more() { S.ui.sheet = 'more'; render(); },
  also() { go('h15-claude'); }
};
function twMoreSheet(t) {
  const m = t.more || {};
  return sheet('tw-more-sheet', L('Mehr zu ', 'More about ') + t.word,
    '<div class="stack s16"><div class="stack s6"><div class="lbl">' + L('Bedeutung', 'Meaning') + '</div><p class="p">' + (m.meaning || '') + '</p></div>' +
    (m.ex ? '<div class="stack s6"><div class="lbl">' + L('Beispiel', 'Example') + '</div><div class="tw-trans"><b class="en">' + m.ex[0] + '</b><span>' + m.ex[1] + '</span></div></div>' : '') +
    (m.partners ? '<div class="stack s6"><div class="lbl">' + L('Wortpartner', 'Collocations') + '</div><p class="p en">' + m.partners + '</p></div>' : '') +
    (m.trap ? '<div class="stack s6"><div class="lbl">' + L('Typische Falle', 'Common trap') + '</div><p class="p">' + m.trap + '</p></div>' : '') +
    '<p class="p2">' + L('Gesehen zählt: Kommt das Wort in den nächsten 30 Min. wieder, ist es Übung ohne Wirkung auf den Plan.', 'Seen counts: if the word comes up again within 30 min, it is practice with no effect on your plan.') + '</p></div>',
    '<button class="btn pri full" id="tw-more-ok" data-act="closesheet">' + L('Zurück zur Aufgabe', 'Back to the task') + '</button>', { h: '72%' });
}

/* ---------- H18 Aufgaben (eine Tabelle, ein Ablauf) ---------- */
/* Lage: due = fällig, zählt · early = noch nicht fällig, Übung · seen = Rückkehrer, gesehen (ohne Wirkung). */
function TW_T() {
  const dueWhy = L('Fällig: zählt für deinen Plan.', 'Due: counts for your plan.');
  const earlyWhy = L('Noch nicht fällig: Übung, dein nächster Termin wird ab jetzt gerechnet.', 'Not due yet: practice. Your next review is counted from now.');
  return {
    free: {
      n: 1, lage: 'due', word: 'budget approval', form: 'big',
      bl: L('Wörter üben · fällig', 'Practice words · due'),
      instr: L('Wie heißt das auf Englisch?', 'What is this in English?'),
      prompt: L('die Budgetfreigabe', 'die Budgetfreigabe'), hint: L('im Einkauf · 2 Wörter', 'in purchasing · 2 words'),
      tip: L('Tipp: beginnt mit <em class="en">b</em>, das zweite Wort mit <em class="en">a</em>', 'Hint: starts with <em>b</em>, the second word with <em>a</em>'),
      right: 'budget approval', rightShow: 'budget approval', alts: [],
      you: { ok: 'budget approval', typo: 'budget aproval', wrong: 'budget release', idk: '' },
      whyl: {
        ok: L('<em class="en">approval</em> ist die Freigabe. Im Einkauf wartet ein Angebot oft auf die <em class="en">budget approval</em>.', '<em>approval</em> is the sign-off. In purchasing, a quote often waits for <em>budget approval</em>.'),
        typo: L('Das Wort sitzt. Achte auf das doppelte p: a-p-p-r-o-v-a-l.', 'You know the word. Watch the double p: a-p-p-r-o-v-a-l.'),
        wrong: L('<em class="en">release</em> heißt freigeben im Sinn von loslassen. Für Geld, das genehmigt wird, sagt man <em class="en">approval</em>.', '<em>release</em> means letting go. For money that gets approved, say <em>approval</em>.'),
        idk: L('<em class="en">budget approval</em> = Budgetfreigabe. Von <em class="en">approve</em>, genehmigen.', '<em>budget approval</em> comes from <em>approve</em>.')
      },
      why: dueWhy + ' ' + L('budget approval ist von deinen fälligen Wörtern das, das du am ehesten vergessen hast. Deshalb kommt es zuerst, frei und ohne Satz.', 'Of your due words, budget approval is the one you are most likely to have forgotten. That is why it comes first, free and without a sentence.'),
      more: { meaning: L('Die Genehmigung, Geld aus einem Budget auszugeben.', 'Permission to spend money from a budget.'), partners: 'get · wait for · need budget approval', trap: L('<em class="en">budget release</em> ist kein fester Ausdruck.', '<em>budget release</em> is not a set phrase.') },
      next: 'h18-partner'
    },
    partner: {
      n: 2, lage: 'due', word: 'revise a quote', form: 'sent',
      bl: L('Wörter üben · fällig · Wortpartner', 'Practice words · due · collocation'),
      instr: L('Welches Verb passt? Ein Angebot überarbeiten.', 'Which verb fits? Revise a quote.'),
      before: '', after: 'a quote', hint: L('Gesucht: überarbeiten · 1 Wort', 'Wanted: überarbeiten · 1 word'),
      tip: L('Tipp: daher kommt <em class="en">the re… quote</em>', 'Hint: that is where <em>the re… quote</em> comes from'),
      right: 'revise', rightShow: 'revise', alts: ['update'],
      you: { ok: 'revise', typo: 'revice', wrong: 'review', idk: '' },
      whyl: {
        ok: L('Ein Angebot schickt man (<em class="en">send</em>), überarbeitet es (<em class="en">revise</em>) und nimmt es an (<em class="en">accept</em>).', 'You send a quote, revise it and accept it.'),
        typo: L('Fast: <em class="en">revise</em> schreibt sich mit s.', 'Almost: <em>revise</em> is spelled with an s.'),
        wrong: L('<em class="en">review</em> heißt prüfen. Wer das Angebot ändert, <em class="en">revises</em> it.', '<em>review</em> means check. If you change the quote, you <em>revise</em> it.'),
        idk: L('<em class="en">revise a quote</em> = ein Angebot überarbeiten. Daher <em class="en">the revised quote</em>.', 'Hence <em>the revised quote</em>.')
      },
      why: dueWhy + ' ' + L('Wörter auf „Anwenden“ übst du mit ihren Wortpartnern. So sitzt nicht nur das Wort, sondern auch, wie man es benutzt.', 'Words at “apply” are practiced with their collocations, so you learn how the word is used, not just the word.'),
      more: { meaning: L('Ein Angebot ändern und neu schicken, z. B. mit neuem Preis.', 'Change a quote and send it again, e.g. with a new price.'), ex: ['We sent the revised quote on Monday.', L('Wir haben das überarbeitete Angebot am Montag geschickt.', 'Past simple, time named.')], partners: 'send · revise · accept a quote' },
      next: 'h18-situation'
    },
    situation: {
      n: 3, lage: 'due', word: 'follow up', form: 'field',
      bl: L('Wörter üben · fällig · Situation', 'Practice words · due · situation'),
      instr: L('Du willst beim Kunden zum Angebot nachfassen. Was sagst du?', 'You want to follow up with the client about the quote. What do you say?'),
      hint: L('mit <em class="en">follow up</em> · ein Satz · Angebot vom Montag', 'with <em>follow up</em> · one sentence · quote from Monday'),
      tip: L('Tipp: <em class="en">I’m following up on …</em>', 'Hint: <em>I’m following up on …</em>'),
      right: 'i\'m following up on the quote we sent on monday.', rightShow: 'I’m following up on the quote we sent on Monday.',
      judge(t) { const x = twNorm(t); if (!x) return 'idk'; if (/follow(ing)? up on/.test(x)) return 'ok'; if (/follow(ing)? up/.test(x)) return 'typo'; return 'wrong'; },
      you: { ok: 'I’m following up on the quote we sent on Monday.', typo: 'I’m following up the quote we sent on Monday.', wrong: 'I’m asking about the quote we sent on Monday.', idk: '' },
      whyl: {
        ok: L('<em class="en">follow up on</em> + Sache: höflich nachfassen. Dazu past simple, weil Montag ein vergangener Zeitpunkt ist.', '<em>follow up on</em> + thing: a polite nudge. Past simple, because Monday is a past time.'),
        typo: L('Fast: Mit einer Sache danach heißt es <em class="en">follow up on</em> the quote.', 'Almost: with a thing after it, say <em>follow up on</em> the quote.'),
        wrong: L('Verständlich, aber das gesuchte Wort fehlt. Im Vertrieb sagt man <em class="en">I’m following up on …</em>', 'Clear, but the word you are practicing is missing. In sales, say <em>I’m following up on …</em>'),
        idk: L('<em class="en">I’m following up on …</em> ist der übliche Einstieg, wenn du nachfasst.', '<em>I’m following up on …</em> is the usual opener when you follow up.')
      },
      why: dueWhy + ' ' + L('Auf „Anwenden“ fragen wir das Wort in einer echten Lage ab, nicht nur als Übersetzung.', 'At “apply” we test the word in a real situation, not just as a translation.'),
      more: { meaning: L('nachfassen, sich wieder melden, um etwas voranzubringen', 'check back to move something forward'), partners: 'follow up on a quote · follow up with a client · follow up on every open order' },
      next: 'h18-recognize'
    },
    recognize: {
      n: 4, lage: 'due', word: 'sign off on', form: 'big', promptEn: true,
      bl: L('Wörter üben · fällig · Erkennen', 'Practice words · due · recognize'),
      instr: L('Was heißt das auf Deutsch?', 'What does this mean in German?'),
      prompt: 'sign off on', hint: L('Verb mit zwei Partikeln · im Einkauf', 'verb with two particles · in purchasing'),
      tip: L('Tipp: Die Chefin muss das Budget noch …', 'Hint: the boss still has to … the budget'),
      right: 'freigeben', rightShow: 'freigeben, absegnen', alts: ['absegnen', 'genehmigen', 'abzeichnen', 'freigeben, absegnen'],
      you: { ok: 'freigeben', typo: 'freigebn', wrong: 'abmelden', idk: '' },
      whyl: {
        ok: L('<em class="en">sign off on</em> + Sache: offiziell freigeben, zum Beispiel ein Budget oder ein Angebot.', '<em>sign off on</em> + thing: officially approve, e.g. a budget or a quote.'),
        typo: L('Fast: freigeben. Die Bedeutung stimmt.', 'Almost: the meaning is right.'),
        wrong: L('Ohne <em class="en">on</em> heißt <em class="en">sign off</em> auch sich verabschieden. Mit <em class="en">on</em> und einer Sache: freigeben.', 'Without <em>on</em>, <em>sign off</em> can mean saying goodbye. With <em>on</em> and a thing: approve.'),
        idk: L('<em class="en">sign off on</em> = freigeben, absegnen.', '<em>sign off on</em> = approve.')
      },
      why: dueWhy + ' ' + L('Jeder zweite Termin fragt die Bedeutung ab. Das zählt für „Erkennst du“, damit du das Wort auch beim Hören sicher verstehst.', 'Every other review asks for the meaning. That counts toward “you recognize”, so you understand the word when you hear it.'),
      more: { meaning: L('etwas offiziell genehmigen, oft mit Unterschrift', 'officially approve something, often with a signature'), partners: 'sign off on a budget · sign off on a quote', trap: L('<em class="en">sign off</em> ohne <em class="en">on</em>: sich verabschieden, abmelden.', '<em>sign off</em> without <em>on</em>: say goodbye, log off.') },
      next: 'h18-listen'
    },
    listen: {
      n: 5, lage: 'due', word: 'procurement', form: 'listen',
      bl: L('Wörter üben · fällig · Hören', 'Practice words · due · listening'),
      instr: L('Hör dir das Wort an. Was heißt es?', 'Listen to the word. What does it mean?'),
      hint: L('ein Wort · eine Abteilung', 'one word · a department'),
      tip: L('Tipp: Laura Keller arbeitet dort.', 'Hint: Laura Keller works there.'),
      right: 'einkauf', rightShow: 'Einkauf, Beschaffung', alts: ['beschaffung', 'der einkauf', 'die beschaffung', 'einkauf, beschaffung'],
      you: { ok: 'Einkauf', typo: 'Einkuaf', wrong: 'Produktion', idk: '' },
      whyl: {
        ok: L('<em class="en">procurement</em> ist der Einkauf eines Unternehmens: Lieferanten finden, Preise verhandeln, bestellen.', '<em>procurement</em> is a company’s purchasing: finding suppliers, negotiating, ordering.'),
        typo: L('Fast: Einkauf. Die Bedeutung stimmt.', 'Almost: the meaning is right.'),
        wrong: L('Produktion wäre <em class="en">production</em>. <em class="en">procurement</em> heißt Einkauf oder Beschaffung.', 'That would be <em>production</em>. <em>procurement</em> means purchasing.'),
        idk: L('<em class="en">procurement</em> = Einkauf, Beschaffung. Betont auf <em class="en">-cure-</em>.', 'Stress on <em>-cure-</em>.')
      },
      why: dueWhy + ' ' + L('Ton zu Bedeutung: Im Call hörst du das Wort, bevor du es liest.', 'Sound to meaning: on a call you hear the word before you read it.'),
      more: { meaning: L('der Einkauf, die Beschaffung (Abteilung und Vorgang)', 'purchasing (department and process)'), ex: ['Many of them have moved part of their procurement to suppliers closer to home.', L('Viele haben einen Teil ihres Einkaufs zu Lieferanten in der Nähe verlagert.', 'From the daily article.')] },
      next: 'h18-speak'
    },
    speak: {
      n: 6, lage: 'due', word: 'reduce', form: 'speak',
      bl: L('Wörter üben · fällig · Sprechen', 'Practice words · due · speaking'),
      instr: L('Sag es auf Englisch, mit <em class="en">reduce</em>.', 'Say it in English, with <em>reduce</em>.'),
      prompt: L('„Wir haben den Preis schon um 5 Prozent gesenkt.“', '“Wir haben den Preis schon um 5 Prozent gesenkt.”'),
      hint: L('Tippe aufs Mikrofon und sprich den ganzen Satz.', 'Tap the mic and say the whole sentence.'),
      right: 'we\'ve already reduced the price by 5 percent.', rightShow: 'We’ve already reduced the price by 5 percent.',
      judge(t) { const x = twNorm(t); if (!x) return 'idk'; if (/reduced the price by/.test(x)) return 'ok'; if (/reduce the price by/.test(x)) return 'typo'; return 'wrong'; },
      you: { ok: 'We’ve already reduced the price by 5 percent.', typo: 'We’ve already reduce the price by 5 percent.', wrong: 'We’ve already reduced the price of 5 percent.', idk: '' },
      whyl: {
        ok: L('Ergebnis ohne Zeitpunkt: present perfect mit <em class="en">already</em>. Um 5 Prozent heißt <em class="en">by</em> 5 percent.', 'A result with no time: present perfect with <em>already</em>. The amount takes <em>by</em>.'),
        typo: L('Fast: Nach <em class="en">have</em> kommt die dritte Form, <em class="en">reduced</em>.', 'Almost: after <em>have</em> comes the past participle, <em>reduced</em>.'),
        wrong: L('Um 5 Prozent heißt <em class="en">by 5 percent</em>. <em class="en">of 5 percent</em> wäre ein Preis von 5 Prozent.', 'The change takes <em>by</em>. <em>of 5 percent</em> would be a price of 5 percent.'),
        idk: L('<em class="en">reduce the price by 5 percent</em>: um 5 Prozent senken.', 'reduce … by: lower by an amount.')
      },
      why: dueWhy + ' ' + L('reduce sitzt beim Tippen. Gesprochen zählt es erst, wenn das Diktat es unverändert und richtig erkennt.', 'You type reduce reliably. Spoken, it only counts if dictation picks it up unchanged and correct.'),
      more: { meaning: L('senken, verringern; mit <em class="en">by</em> für die Menge', 'lower, cut; with <em>by</em> for the amount'), ex: ['We’ve already reduced the lead time to eight weeks.', L('Wir haben die Lieferzeit schon auf acht Wochen verkürzt.', '<em>to</em> for the new value.')], partners: 'reduce the price by · reduce the lead time to' },
      next: 'h18-return'
    },
    'return': {
      n: 7, plus: 1, lage: 'seen', word: 'budget approval', form: 'big',
      bl: L('Wörter üben · kommt zurück', 'Practice words · coming back'),
      instr: L('Noch einmal: Wie heißt das auf Englisch?', 'Once more: what is this in English?'),
      prompt: L('die Budgetfreigabe', 'die Budgetfreigabe'), hint: L('im Einkauf · 2 Wörter', 'in purchasing · 2 words'),
      tip: L('Tipp: das doppelte p', 'Hint: the double p'),
      right: 'budget approval', rightShow: 'budget approval', alts: [],
      you: { ok: 'budget approval', typo: 'budget aproval', wrong: 'budget release', idk: '' },
      whyl: {
        ok: L('Jetzt sitzt die Schreibung. Diese zweite Antwort ist Übung, der echte Test ist morgen.', 'The spelling is there now. This second answer is practice; the real test is tomorrow.'),
        typo: L('Wieder das doppelte p. Morgen kommt das Wort noch einmal, ohne Satz.', 'The double p again. It comes back tomorrow, without a sentence.'),
        wrong: L('<em class="en">approval</em>, nicht <em class="en">release</em>. Morgen kommt das Wort wieder.', '<em>approval</em>, not <em>release</em>. It comes back tomorrow.'),
        idk: L('<em class="en">budget approval</em>. Morgen kommt das Wort wieder.', 'It comes back tomorrow.')
      },
      why: L('Kommt zurück, weil es vorhin nicht ganz saß. Abschreiben direkt nach dem Fehler hilft nicht, deshalb liegen 5 Karten dazwischen.', 'Coming back because it wasn’t quite right earlier. Copying right after a mistake doesn’t help, so 5 cards sit in between.'),
      more: { meaning: L('Die Genehmigung, Geld aus einem Budget auszugeben.', 'Permission to spend money from a budget.'), partners: 'get · wait for · need budget approval' },
      next: 'h20-normal', nextLabel: L('Weiter', 'Continue')
    },
    gap: {
      n: 3, total: 9, lage: 'early', word: 'lead time', form: 'sent',
      bl: L('Wörter üben · Schwierig · nicht fällig', 'Practice words · hard · not due'),
      instr: L('Setz das fehlende Wort ein.', 'Fill in the missing word.'),
      before: 'Can you reduce the', after: 'to four weeks?', hint: L('Gesucht: Lieferzeit', 'Wanted: Lieferzeit'),
      tip: L('Tipp: beginnt mit <em class="en">l</em>, zwei Wörter', 'Hint: starts with <em>l</em>, two words'),
      right: 'lead time', rightShow: 'lead time', alts: ['delivery time', 'turnaround time'],
      alsoOk: L('Auch richtig. Im Einkauf hörst du meist <em class="en">lead time</em>.', 'Also correct. In purchasing you usually hear <em>lead time</em>.'),
      you: { ok: 'lead time', typo: 'lead tme', wrong: 'delivery', idk: '' },
      whyl: WORD.why,
      why: earlyWhy + ' ' + L('Schwieriges Wort: zweimal danebengelegen in 30 Tagen.', 'Hard word: missed twice in 30 days.'),
      more: { meaning: L('Die Zeit zwischen Bestellung und Lieferung, meist in Wochen.', 'The time between order and delivery, usually in weeks.'), ex: ['Our standard lead time is ten weeks.', L('Unsere normale Lieferzeit beträgt zehn Wochen.', 'Normal delivery time.')], partners: 'reduce · shorten · quote a lead time', trap: L('<em class="en">delivery</em> ist die Lieferung selbst, nicht ihre Dauer.', '<em>delivery</em> is the delivery itself, not its duration.') },
      next: 'h20-all-early', nextWrong: 'h18-contrast'
    },
    /* „Dieses Wort üben“ aus dem Wort-Detail: 5 Karten, das Wort an Stelle 5 (VT 3.7). */
    word: {
      n: 5, total: 5, lage: 'early', word: 'lead time', form: 'sent',
      bl: L('Dieses Wort üben · nicht fällig', 'Practice this word · not due'),
      instr: L('Setz das fehlende Wort ein.', 'Fill in the missing word.'),
      before: 'Our standard', after: 'is ten weeks.', hint: L('Gesucht: Lieferzeit', 'Wanted: Lieferzeit'),
      tip: L('Tipp: beginnt mit <em class="en">l</em>, zwei Wörter', 'Hint: starts with <em>l</em>, two words'),
      right: 'lead time', rightShow: 'lead time', alts: ['delivery time', 'turnaround time'],
      alsoOk: L('Auch richtig. Im Einkauf hörst du meist <em class="en">lead time</em>.', 'Also correct. In purchasing you usually hear <em>lead time</em>.'),
      you: { ok: 'lead time', typo: 'lead tme', wrong: 'delivery', idk: '' },
      whyl: WORD.why,
      why: earlyWhy + ' ' + L('Du hast es aus dem Wort-Detail geöffnet. Vier andere Karten kamen vorher, damit es nicht direkt aus dem Gedächtnis abgeschrieben ist.', 'You opened it from the word detail. Four other cards came first so you aren’t just copying from short-term memory.'),
      more: { meaning: L('Die Zeit zwischen Bestellung und Lieferung, meist in Wochen.', 'The time between order and delivery, usually in weeks.'), ex: ['Our standard lead time is ten weeks.', L('Unsere normale Lieferzeit beträgt zehn Wochen.', 'Normal delivery time.')], partners: 'reduce · shorten · quote a lead time' },
      next: 'h12-detail', nextLabel: L('Zurück zum Wort', 'Back to the word')
    }
  };
}
function twSt(t) {
  if (S.typed != null && S.ui.ownInput) return t.judge ? t.judge(S.typed) : judge(twNorm(S.typed), t.right, t.alts);
  return S.demo;
}
const TW_GAPST = { ok: 'ok', typo: 'near', wrong: 'bad', idk: 'idk' };
function twLageLine(t, st) {
  let txt = '';
  if (t.lage === 'early') txt = (st === 'wrong' || st === 'idk') ? L('Zählt trotzdem: Nochmal, morgen wieder dran.', 'Still counts: again, back tomorrow.') : L('Noch nicht fällig: gute Übung. Dein nächster Termin startet ab jetzt neu.', 'Not due yet: good practice. Your next review starts from now.');
  else if (t.lage === 'seen') txt = L('Vorhin gesehen: Übung, ändert keinen Termin.', 'Seen earlier: practice, changes no review date.');
  else if (st === 'wrong' || st === 'idk') txt = L('Kommt am Ende der Runde noch einmal und morgen wieder.', 'Comes back at the end of this round and again tomorrow.');
  return txt ? '<p class="tw-lage">' + ic('clock', 'xs') + '<span>' + txt + '</span></p>' : '';
}
function twBand(t, st) {
  const you = Object.assign({}, t.you, S.typed && S.ui.ownInput ? { [st]: esc(S.typed) } : {});
  const why = Object.assign({}, t.whyl);
  if (st === 'ok' && S.ui.ownInput && t.alsoOk && t.alts.indexOf(twNorm(S.typed)) >= 0) why.ok = t.alsoOk;
  const next = (st === 'wrong' || st === 'idk') && t.nextWrong ? t.nextWrong : t.next;
  return band(st, { you, right: t.rightShow, why }, { next, nextLabel: next.indexOf('h20') === 0 ? L('Zum Ergebnis', 'See result') : t.nextLabel })
    .replace('<div class="bandbtns">', twLageLine(t, st) + '<div class="bandbtns">');
}
function twShown(t, st, checked) {
  if (!checked) return S.typed || '';
  if (st === 'idk') return t.rightShow;
  return S.typed && S.ui.ownInput ? S.typed : t.you[st];
}
function h18(v) {
  if (v === 'contrast') return twContrast();
  const T = TW_T();
  const t = T[v === 'band-early' ? 'gap' : v];
  const checked = v === 'band-early' || !!S.ui.checked;
  const st = checked ? twSt(t) : null;
  const total = t.total || 10;
  let s = twTop(t.n, total, { plus: t.plus, done: checked }) + '<div class="ex-body gx' + (checked ? ' with-band' : '') + '">' + blockLine('w', t.bl) + instr(t.instr, 'tw-why');
  const shown = twShown(t, st, checked);
  const gst = checked ? TW_GAPST[st] : '';
  let typing = true;
  if (t.form === 'big') {
    s += '<div class="stagec">' + (t.promptEn
      ? '<div style="display:flex;align-items:center;gap:12px"><div class="prompt disp en">' + t.prompt + '</div><button class="iconbtn" id="tw-say" data-act="noop" aria-label="' + esc(L('Anhören', 'Listen')) + '" style="margin:0;background:var(--surface-2)">' + ic('speaker', 'sm') + '</button></div>'
      : '<div class="prompt disp">' + t.prompt + '</div>') +
      '<div class="hintline">' + t.hint + '</div><div style="padding-top:8px">' + gapHtml(shown, { big: true, caret: !checked, input: !checked, st: gst }) + '</div></div>';
  } else if (t.form === 'sent') {
    s += '<div class="stagec"><div class="sent en" id="sent">' + (t.before ? words(t.before) + ' ' : '') + gapHtml(shown, { caret: !checked, input: !checked, st: gst }) + ' ' + words(t.after) + '</div><div class="hintline">' + t.hint + '</div></div>';
  } else if (t.form === 'field') {
    s += '<div class="stagec" style="justify-content:flex-start;padding-top:22px"><div class="hintline">' + t.hint + '</div>' +
      (checked ? '<div class="tw-said en ' + 'st-' + gst + '">' + esc(shown) + '</div>'
        : '<textarea class="field en" id="tw-field" rows="3" style="min-height:96px" placeholder="' + esc(L('Dein Satz …', 'Your sentence …')) + '" autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false">' + esc(S.typed || '') + '</textarea>') + '</div>';
  } else if (t.form === 'listen') {
    s += '<div class="stagec" style="align-items:center;text-align:center"><button class="tw-play" id="tw-play" data-act="noop" aria-label="' + esc(L('Abspielen', 'Play')) + '">' + ic('speaker') + '</button>' +
      '<div class="hintline">' + (checked ? '<span class="en" style="color:var(--fg);font-weight:600">procurement</span> · /prəˈkjʊrmənt/' : t.hint) + '</div>' +
      '<div style="padding-top:4px">' + gapHtml(shown, { big: true, caret: !checked, input: !checked, st: gst }) + '</div></div>';
  } else if (t.form === 'speak') {
    typing = false;
    s += '<div class="stagec"><div class="prompt disp" style="font-size:26px;line-height:33px">' + t.prompt + '</div><div class="hintline">' + t.hint + '</div>' +
      (checked ? '<div class="tw-said en st-' + gst + '">' + (st === 'idk' ? esc(t.rightShow) : esc(shown)) + '</div>'
        : '<div class="tw-micwrap"><button class="tw-mic" id="tw-mic" data-act="check" aria-label="' + esc(L('Sprechen', 'Speak')) + '">' + ic('mic') + '</button><span>' + L('Tippen, sprechen, nochmal tippen', 'Tap, speak, tap again') + '</span></div>') + '</div>';
  }
  s += '</div>';
  if (checked) s += twBand(t, st);
  else if (!typing) s += exFoot(btnSec('tw-idk', L('Weiß ich nicht', 'Don’t know'), 'data-act="idk"') + btnPri('tw-check', L('Sprechen', 'Speak'), '', ' data-act="check"'));
  else s += exFoot(btnSec('tw-tip', L('Tipp', 'Hint'), 'data-act="tip"') + btnSec('tw-idk', L('Weiß ich nicht', 'Don’t know'), 'data-act="idk"') + btnPri('tw-check', L('Prüfen', 'Check'), '', ' data-act="check"'), true) + drawnKbd({ go: t.form === 'field' ? 'return' : 'go' });
  s += twOverlays({ why: t.why, checked, task: t });
  return s;
}
/* Kontrastkarte: Fehler bei einem schwierigen Wort → sofort eigene Aufgabe (VT 3.9). */
function twContrast() {
  const pick = S.ui.pick;
  const checked = !!pick;
  const st = pick === 'lead time' ? 'ok' : 'wrong';
  const t = { word: 'lead time', more: TW_T().gap.more };
  let s = twTop(4, 9, { done: checked }) + '<div class="ex-body gx' + (checked ? ' with-band' : '') + '">' + blockLine('w', L('Wörter üben · Kontrast', 'Practice words · contrast')) +
    instr(L('Was passt in die Lücke?', 'What fits the gap?'), 'tw-why') +
    '<div class="stagec" style="gap:18px"><div class="card stack s8 tw-ctr"><div class="contrast en"><span class="k">A</span><span><b>delivery</b> <span class="tw-de">' + L('die Lieferung selbst', 'the delivery itself') + '</span></span><span class="k">B</span><span><b>lead time</b> <span class="tw-de">' + L('die Dauer bis zur Lieferung', 'the time until delivery') + '</span></span></div></div>' +
    '<div class="sent en">' + words('Our standard') + ' ' + gapHtml(checked ? pick : '', { st: checked ? TW_GAPST[st] : '' }) + ' ' + words('is ten weeks.') + '</div>' +
    (checked ? '' : '<div class="stack s8">' + [['delivery', 1], ['lead time', 2]].map(c => '<button class="choice en" id="tw-c' + c[1] + '" data-act="pick" data-v="' + c[0] + '"><span class="n">' + c[1] + '</span>' + c[0] + '</button>').join('') + '</div>') + '</div></div>';
  if (checked) {
    const D = { you: { ok: 'lead time', wrong: 'delivery' }, right: 'lead time', why: { ok: L('Richtig. Es geht um die Dauer, also <em class="en">lead time</em>. Die Lieferung selbst kommt danach.', 'Correct. It is about duration, so <em>lead time</em>.'), wrong: L('Zehn Wochen sind eine Dauer. Die Dauer bis zur Lieferung heißt <em class="en">lead time</em>.', 'Ten weeks is a duration: <em>lead time</em>.') } };
    s += band(st, D, { next: 'h20-all-early', nextLabel: L('Zum Ergebnis', 'See result') }).replace('<div class="bandbtns">', '<p class="tw-lage">' + ic('clock', 'xs') + '<span>' + L('Auswahl ist Rettung nach dem Fehler: Übung, keine Wirkung auf die Stufe.', 'A choice after a mistake is a rescue: practice, no effect on the stage.') + '</span></p><div class="bandbtns">');
  }
  s += twOverlays({ why: L('Du hast <em class="en">delivery</em> geschrieben, obwohl <em class="en">lead time</em> gesucht war. Bei Wörtern, die sich so nah sind, hilft ein direkter Vergleich mehr als eine Wiederholung.', 'You wrote <em>delivery</em> where <em>lead time</em> was wanted. With words this close, a direct comparison helps more than a repeat.'), checked, task: t, finish: 'h20-all-early' });
  return s;
}
function twFieldType(text) {
  const f = document.getElementById('tw-field');
  if (!f || !text) return;
  let i = 0;
  const step = () => { if (i >= text.length) return; i++; f.value = text.slice(0, i); S.typed = f.value; autoTimer = setTimeout(step, S.motion === 'off' ? 0 : 45); };
  autoTimer = setTimeout(step, S.motion === 'off' ? 0 : 450);
}
reg('h18', {
  code: 'H18', name: 'Trainer-Aufgabe', kind: 'phone', demo: true,
  variants: [['free', 'frei ohne Satz'], ['partner', 'Wortpartner'], ['situation', 'Situation'], ['recognize', 'Erkennen'], ['listen', 'Hören'], ['speak', 'Sprechen'], ['return', 'Rückkehrer (+1)'], ['gap', 'Lücke, nicht fällig'], ['band-early', 'Band: nicht fällig'], ['contrast', 'Kontrastkarte'], ['word', 'Dieses Wort üben (5/5)']],
  render: h18,
  after(v) {
    if (v === 'contrast' || v === 'band-early' || S.ui.checked) return;
    const t = TW_T()[v];
    if (!t) return;
    if (t.form === 'field') {
      const f = $('#tw-field');
      if (f) f.addEventListener('input', () => { clearTimeout(autoTimer); S.typed = f.value; });
      if (S.typed == null) twFieldType(t.you[S.demo]);
      return;
    }
    if (t.form === 'speak') return;
    wireGap('gap', () => act('check'));
    if (S.typed == null) { const x = t.you[S.demo]; if (x) autoType('gap', x); }
  },
  acts: Object.assign({}, twActsBase, {
    check() {
      const t = TW_T()[curVariant()];
      const inp = $('#gap-in') || $('#tw-field');
      if (inp && inp.value && t && inp.value !== t.you[S.demo]) { S.ui.ownInput = true; S.typed = inp.value; }
      S.ui.checked = true; render();
    },
    idk() { S.ui.ownInput = false; S.demo = 'idk'; S.ui.checked = true; render(); },
    tip() { const t = TW_T()[curVariant()]; const h = $('.hintline'); if (h && t) h.innerHTML = t.tip; },
    pick(el) { S.ui.pick = el.getAttribute('data-v'); render(); }
  })
});

/* ---------- H17 Trainer-Start ---------- */
const TW_CFG0 = { was: 'due', n: '10', art: 'normal', dir: 'produce' };
function twCfg() { if (!S.ui.cfg) S.ui.cfg = Object.assign({}, TW_CFG0); return S.ui.cfg; }
function twGroups() {
  return [
    ['was', L('Was', 'What'), [['due', L('Fällig', 'Due'), '14'], ['hard', L('Schwierig', 'Hard'), '9'], ['workshop', L('Wort-Werkstatt', 'Word workshop'), '5'], ['week', L('Thema der Woche', 'Topic of the week'), ''], ['new', L('Neue Wörter', 'New words'), L('noch 1', '1 left')], ['phrases', L('Wendungen und Wortpartner', 'Phrases and collocations'), ''], ['own', L('Eigene Liste', 'My list'), ''], ['stage', L('Nach Stand', 'By status'), '']]],
    ['n', L('Wie viele', 'How many'), [['10', '10', ''], ['20', '20', ''], ['30', '30', ''], ['all', L('bis Fälliges leer', 'until nothing is due'), '']]],
    ['art', L('Art', 'Mode'), [['normal', L('Normal', 'Normal'), ''], ['anki', 'Anki', ''], ['listen', L('Nur Hören', 'Listening only'), ''], ['speak', L('Nur Sprechen', 'Speaking only'), ''], ['tempo', L('Tempo', 'Speed'), L('nur Fest', 'solid only')]]],
    ['dir', L('Richtung', 'Direction'), [['produce', L('Bilden · Deutsch → Englisch', 'Produce · German → English'), ''], ['recognize', L('Erkennen · Englisch → Deutsch', 'Recognize · English → German'), '']]]
  ];
}
/* Wohin der eine Knopf führt und was er sagt, je nach Auswahl. */
function twStartBtn(c, v) {
  if (v === 'new-words') return [L('Los: 1 neues + 9 fällige', 'Go: 1 new + 9 due'), 'h18-free'];
  if (v === 'nothing-due') return [L('Los: 9 schwierige Wörter', 'Go: 9 hard words'), 'h18-gap'];
  if (c.art === 'tempo') return [L('Los: Tempo · 90 Sek.', 'Go: speed · 90 sec'), 'h22-run'];
  if (c.art === 'anki') return [L('Los: Anki · 10 Karten', 'Go: Anki · 10 cards'), c.dir === 'recognize' ? 'h19-recognize-front' : 'h19-produce-front'];
  if (c.was === 'new') return [L('Weiter: neue Wörter', 'Continue: new words'), 'h17-new-words'];
  if (c.was === 'hard') return [L('Los: 9 schwierige Wörter', 'Go: 9 hard words'), 'h18-gap'];
  if (c.was === 'workshop') return [L('Los: 5 Werkstatt-Wörter', 'Go: 5 workshop words'), 'h18-situation'];
  if (c.art === 'listen') return [L('Los: 10 Wörter hören', 'Go: listen to 10 words'), 'h18-listen'];
  if (c.art === 'speak') return [L('Los: 10 Wörter sprechen', 'Go: speak 10 words'), 'h18-speak'];
  if (c.dir === 'recognize') return [L('Los: 10 Wörter erkennen', 'Go: recognize 10 words'), 'h18-recognize'];
  const lbl = { '10': L('Los: 10 fällige Wörter', 'Go: 10 due words'), '20': L('Los: 14 fällige + 6 vorgezogene', 'Go: 14 due + 6 early'), '30': L('Los: 14 fällige + 16 vorgezogene', 'Go: 14 due + 16 early'), all: L('Los: alle 14 fälligen', 'Go: all 14 due') }[c.n];
  return [lbl, 'h18-free'];
}
function twNote(c) {
  if (c.art === 'anki' && c.dir === 'produce') return L('Fällige Wörter übst du im Modus Normal, dort zählen sie.', 'Practice due words in Normal mode, that is where they count.');
  if (c.art === 'anki') return L('Anki plant nur dein Erkennen. Stufen steigen hier nie.', 'Anki only schedules recognition. Stages never go up here.');
  if (c.art === 'tempo') return L('Nur Wörter, die fest sitzen. Abgelaufene Zeit heißt langsam, nicht falsch.', 'Only solid words. Running out of time means slow, not wrong.');
  if (c.art === 'listen') return L('Zählt nur für „Erkennst du“. „Anhören“ ohne Abfrage zählt nichts.', 'Counts only toward “you recognize”. Plain listening counts nothing.');
  if (c.dir === 'recognize') return L('Zählt nur für „Erkennst du“.', 'Counts only toward “you recognize”.');
  if (c.was === 'stage') return L('„Auf dem Weg“ ab 3 Wochen Ruhe ist nicht wählbar: Diese Wörter warten auf ihre Probe.', 'Words resting before their 3-week check can’t be picked.');
  if (c.n === '20' || c.n === '30') return L('Vorgezogene sind Übung: ihr nächster Termin wird ab jetzt gerechnet.', 'Early ones are practice: their next review is counted from now.');
  return '';
}
function twAdjust(c, idp) {
  idp = idp || '';
  const note = twNote(c);
  return '<div class="tw-adjbody springopen" id="' + idp + 'tw-adjbody">' + twGroups().map(g => '<div class="tw-grp"><div class="lbl">' + g[1] + '</div><div class="tw-chips">' +
    g[2].map(o => '<button class="tw-chip' + (c[g[0]] === o[0] ? ' on' : '') + '" id="' + idp + 'twc-' + g[0] + '-' + o[0] + '" data-act="cfg" data-k="' + g[0] + '" data-v="' + o[0] + '" aria-pressed="' + (c[g[0]] === o[0] ? 'true' : 'false') + '">' + o[1] + (o[2] ? ' <span class="num">' + o[2] + '</span>' : '') + '</button>').join('') + '</div></div>').join('') +
    (note ? '<p class="tw-note">' + ic('info', 'xs') + '<span>' + note + '</span></p>' : '') + '</div>';
}
function twPreview(list) {
  return '<div class="tw-words en">' + list.map(w => '<span>' + w + '</span>').join('') + '</div>';
}
function twLockLine(v) {
  const t = v === 'before-duty'
    ? L('12 Wörter warten in deiner Pflicht · <em class="en">quote</em> ist von gestern noch offen im Gestern-Check · 3 ruhen bis zur Probe', '12 words are waiting in your daily plan · 3 rest until their check')
    : L('Gesperrt: <em class="en">quote</em> ruht bis morgen früh · 3 Wörter ruhen bis zur 3-Wochen-Probe', 'Locked: <em>quote</em> rests until tomorrow morning · 3 words rest until their 3-week check');
  return '<p class="tw-lockline" id="tw-locks">' + ic('lock', 'xs') + '<span>' + t + '</span></p>';
}
function twStartHero(v, c, idp) {
  idp = idp || '';
  const btn = twStartBtn(c, v);
  const round = TW_ROUND().map(w => w[0]);
  if (v === 'brake') {
    return '<div class="tw-hero"><div class="lbl">' + L('Neue Wörter', 'New words') + '</div><div class="tw-big disp">' + L('Heute keine neuen.', 'No new words today.') + '</div>' +
      '<p class="p">' + L('Erst sitzen lassen, was neu ist.', 'Let what’s new settle first.') + '</p>' +
      '<p class="p2">' + L('Im Gestern-Check saßen heute 4 von 7. Unter 70 % warten neue Wörter, bis die letzten frei kommen.', 'Today’s yesterday check: 4 of 7. Below 70 %, new words wait until the last ones come freely.') + '</p></div>' +
      '<div class="tw-hero tw-sub"><div class="lbl">' + L('Stattdessen', 'Instead') + '</div><div class="tw-mid disp">' + L('10 fällige Wörter', '10 due words') + '</div>' + twPreview(round.slice(0, 6).concat(['…'])) +
      '<button class="btn pri full" id="' + idp + 'tw-go" data-go="h18-free">' + L('Los: 10 fällige Wörter', 'Go: 10 due words') + '</button></div>';
  }
  if (v === 'nothing-due') {
    return '<div class="tw-hero"><div class="lbl">' + L('Heute', 'Today') + '</div><div class="tw-big disp">' + L('Nichts fällig.', 'Nothing due.') + '</div>' +
      '<p class="p2">' + L('Alles Fällige ist erledigt. Morgen sind 9 Wörter dran.', 'Everything due is done. Tomorrow 9 words are due.') + '</p></div>' +
      '<div class="tw-hero tw-sub"><div class="lbl">' + L('Vorschlag', 'Suggestion') + '</div><div class="tw-mid disp">' + L('9 schwierige Wörter', '9 hard words') + '</div>' +
      '<p class="p2">' + L('Warum diese? Bei jedem lagst du in den letzten 30 Tagen zweimal daneben.', 'Why these? You missed each of them twice in the last 30 days.') + '</p>' +
      twPreview(['lead time', 'deadline', 'shortlist', 'upfront', 'invoice', '…']) +
      '<p class="tw-note">' + ic('info', 'xs') + '<span>' + L('Nicht fällig heißt Übung: ihr nächster Termin wird ab jetzt gerechnet.', 'Not due means practice: their next review is counted from now.') + '</span></p>' +
      '<button class="btn pri full" id="' + idp + 'tw-go" data-go="' + btn[1] + '">' + btn[0] + '</button></div>';
  }
  if (v === 'new-words') {
    return '<div class="tw-hero"><div class="lbl">' + L('Vorschlag · Neue Wörter', 'Suggestion · new words') + '</div><div class="tw-big disp">' + L('1 neues + 9 fällige', '1 new + 9 due') + '</div>' +
      '<p class="p2">' + L('Heute kamen schon 4 neue in deinem Plan. 5 am Tag ist die Grenze, also ist noch 1 Platz frei.', 'Your plan already brought 4 new words today. The limit is 5 a day, so 1 spot is left.') + '</p>' +
      '<div class="tw-newcard"><div><b class="en">upfront</b><span>' + L('offen, ehrlich (vorab)', 'open, honest (in advance)') + '</span></div><span class="tw-tag">' + L('aus dem Thema', 'from the topic') + '</span></div>' +
      '<p class="tw-note">' + ic('cal', 'xs') + '<span>' + L('Morgen kommt es im Gestern-Check (+1 Min.).', 'Tomorrow it comes up in the yesterday check (+1 min).') + '</span></p>' +
      '<button class="btn pri full" id="' + idp + 'tw-go" data-go="' + btn[1] + '">' + btn[0] + '</button></div>';
  }
  return '<div class="tw-hero"><div class="lbl">' + L('Vorschlag', 'Suggestion') + '</div><div class="tw-big disp">' + L('10 fällige Wörter', '10 due words') + '</div>' +
    '<p class="p2"><b>' + L('Warum diese?', 'Why these?') + '</b> ' + L('Die 10 mit der niedrigsten Chance, dass du sie noch weißt.', 'The 10 you are least likely to still remember.') + '</p>' +
    twPreview(round) +
    '<p class="tw-meta"><span>' + L('≈ 6 Min.', '≈ 6 min') + '</span><span>' + L('zählt als Extra', 'counts as extra') + '</span></p>' +
    '<button class="btn pri full" id="' + idp + 'tw-go" data-go="' + btn[1] + '">' + btn[0] + '</button></div>';
}
function h17(v) {
  const c = twCfg();
  const open = v === 'adjust' ? S.ui.adj !== false : !!S.ui.adj;
  const head = '<header class="phead gx"><div class="tw-hl"><button class="iconbtn" id="tw-back" data-go="h12-list" aria-label="' + esc(L('Zurück', 'Back')) + '" style="margin-left:-10px;margin-right:0">' + ic('chevL') + '</button><h1 class="disp">' + L('Üben', 'Practice') + '</h1></div><span class="tw-badge">' + L('Extra', 'Extra') + '</span></header>';
  const pre = v === 'before-duty' ? '<div class="notice tw-notice">' + ic('info', 'sm') + '<span>' + L('<b>Deine Pflicht ist noch offen.</b> Hier übst du zusätzlich. Die Wörter deines Plans bleiben für die Pflicht.', '<b>Your daily plan is still open.</b> This is extra practice. Your plan’s words stay reserved for it.') + '</span></div>' : '';
  const adjRow = (v === 'brake' || v === 'nothing-due' || v === 'new-words') ? '' :
    '<button class="tw-adj" id="tw-adj" data-act="adj" aria-expanded="' + (open ? 'true' : 'false') + '"><span>' + L('Anpassen', 'Adjust') + '</span><span class="tw-sum">' + twSummary(c) + '</span>' + ic(open ? 'chevU' : 'chevD', 'sm') + '</button>' + (open ? twAdjust(c) : '');
  return head + '<div class="scroll"><div class="gx stack s16" style="padding-bottom:28px">' + pre + twStartHero(v, c) + adjRow + twLockLine(v) + '</div></div>';
}
function twSummary(c) {
  const name = (k, val) => { const g = twGroups().filter(x => x[0] === k)[0]; const o = g[2].filter(x => x[0] === val)[0]; return o ? o[1].split(' · ')[0] : val; };
  return [name('was', c.was), name('n', c.n), name('art', c.art), name('dir', c.dir)].join(' · ');
}
const twCfgActs = {
  adj() { S.ui.adj = !(curVariant() === 'adjust' ? S.ui.adj !== false : !!S.ui.adj); render(); },
  cfg(el) {
    const c = twCfg(); const k = el.getAttribute('data-k'), val = el.getAttribute('data-v');
    c[k] = val;
    if (k === 'art' && val === 'tempo') c.dir = 'produce';
    if (k === 'was' && val === 'new' && S.screen === 'h17') { go('h17-new-words'); return; }
    if (S.screen === 'h17' && curVariant() !== 'adjust') S.ui.adj = true;
    render();
  }
};
reg('h17', {
  code: 'H17', name: 'Trainer-Start', kind: 'phone',
  variants: [['default', 'Vorschlag'], ['adjust', 'Anpassen offen'], ['before-duty', 'Pflicht noch offen'], ['new-words', 'neue Wörter (noch 1)'], ['brake', 'Bremse: keine neuen'], ['nothing-due', 'nichts fällig']],
  render: h17,
  acts: twCfgActs
});

/* ---------- H19 Anki ---------- */
function twAnkiHead(dir, n) {
  return '<div class="gx" style="padding-top:6px"><div class="seg2" role="tablist"><button id="tw-seg-rec" data-go="h19-recognize-front" role="tab" class="' + (dir === 'rec' ? 'on' : '') + '"' + (dir === 'rec' ? ' aria-selected="true"' : '') + '>' + L('Erkennen', 'Recognize') + '</button><button id="tw-seg-prod" data-go="h19-produce-front" role="tab" class="' + (dir === 'prod' ? 'on' : '') + '"' + (dir === 'prod' ? ' aria-selected="true"' : '') + '>' + L('Bilden', 'Produce') + '</button></div></div>';
}
function h19(v) {
  const rec = v.indexOf('recognize') === 0 || v === 'undo' || v === 'control';
  const back = /back$/.test(v);
  const n = v === 'undo' ? 4 : (v === 'control' ? 1 : 3);
  let s = twTop(n, 10, { done: back }) + twAnkiHead(rec ? 'rec' : 'prod');
  const why = rec
    ? L('Anki · Erkennen: Du deckst auf und sagst selbst, wie gut es saß. Das plant nur dein Erkennen. Stufen steigen hier nie, dafür braucht es eine Antwort, die die App prüft.', 'Anki · recognize: you reveal and rate yourself. This only schedules recognition. Stages never go up here; that takes an answer the app checks.')
    : L('Anki · Bilden: Selbsturteil plant hier nichts. Zählen tut das freie Tippen. „Wusste ich nicht“ holt das Wort höchstens auf morgen vor.', 'Anki · produce: self-rating schedules nothing here. Free typing is what counts. “Didn’t know” moves the word to tomorrow at most.');
  if (v === 'control') {
    const checked = !!S.ui.checked;
    const st = checked ? S.demo : null;
    s += '<div class="ex-body gx' + (checked ? ' with-band' : '') + '">' + blockLine('w', L('Anki · Kontrolle', 'Anki · check')) +
      instr(L('Du hattest bei <em class="en">discount</em> „Leicht“ gewählt. Was heißt es?', 'You rated <em>discount</em> “easy”. What does it mean?'), 'tw-why') +
      '<div class="stagec"><div style="display:flex;align-items:center;gap:12px"><div class="prompt disp en">discount</div><button class="iconbtn" id="tw-say" data-act="noop" aria-label="' + esc(L('Anhören', 'Listen')) + '" style="margin:0;background:var(--surface-2)">' + ic('speaker', 'sm') + '</button></div>' +
      '<div class="hintline">' + L('Kontrolle zum Termin, nie vorgezogen', 'Checked on its due date, never early') + '</div>' +
      '<div style="padding-top:8px">' + gapHtml(checked ? (st === 'idk' ? 'Rabatt' : { ok: 'Rabatt', typo: 'Rabat', wrong: 'Rechnung', idk: '' }[st]) : (S.typed || ''), { big: true, caret: !checked, input: !checked, st: checked ? TW_GAPST[st] : '' }) + '</div></div></div>';
    if (checked) {
      s += band(st, { you: { ok: 'Rabatt', typo: 'Rabat', wrong: 'Rechnung', idk: '' }, right: 'Rabatt', why: { ok: L('„Leicht“ war ehrlich. Dein Erkennen von <em class="en">discount</em> plant weiter mit 21 Tagen.', '“Easy” was honest. Recognition of <em>discount</em> keeps its 21-day interval.'), typo: L('Ein Buchstabe fehlt, die Bedeutung sitzt.', 'One letter missing; you know the meaning.'), wrong: L('Rechnung wäre <em class="en">invoice</em>. Das Erkennen von <em class="en">discount</em> kommt morgen wieder.', 'That would be <em>invoice</em>. Recognition comes back tomorrow.'), idk: L('<em class="en">discount</em> = Rabatt. Kommt morgen wieder.', 'Comes back tomorrow.') } }, { next: 'h19-recognize-front' });
    } else s += exFoot(btnSec('tw-idk', L('Weiß ich nicht', 'Don’t know'), 'data-act="idk"') + btnPri('tw-check', L('Prüfen', 'Check'), '', ' data-act="check"'), true) + drawnKbd({ go: 'go' });
    return s + twOverlays({ why: L('Nach „Leicht“ prüft die App beim nächsten Termin selbst. So bleibt dein Selbsturteil ehrlich, ohne dass jemand es bezweifelt.', 'After “easy”, the app checks for itself at the next due date. That keeps self-rating honest.'), checked: checked });
  }
  const card = rec
    ? { front: '<div style="display:flex;align-items:center;gap:12px;justify-content:center"><div class="prompt disp en">' + (v === 'undo' ? 'supplier' : 'discount') + '</div><button class="iconbtn" id="tw-say" data-act="noop" aria-label="' + esc(L('Anhören', 'Listen')) + '" style="margin:0;background:var(--surface-2)">' + ic('speaker', 'sm') + '</button></div>' +
        '<p class="tw-cardsent en">' + (v === 'undo' ? 'Another supplier has also offered us a lead time of six weeks, and yours is ten.' : 'A further discount would be difficult for us, but we could offer a two-year contract with fixed prices.') + '</p>',
      backHtml: '<div class="tw-back"><div class="disp tw-mean">' + L('der Rabatt', 'der Rabatt') + '</div><div class="p2"><span class="en">' + L('Nomen', 'noun') + '</span> · <span class="en">offer · give · a further discount</span></div></div>' }
    : { front: '<div class="prompt disp" style="text-align:center">' + L('die Frist', 'die Frist') + '</div><div class="hintline" style="text-align:center">' + L('bis wann etwas fertig sein muss', 'by when something must be done') + '</div>',
      backHtml: '<div class="tw-back"><div style="display:flex;align-items:center;gap:10px;justify-content:center"><div class="disp tw-mean en">deadline</div><button class="iconbtn" id="tw-say2" data-act="noop" aria-label="' + esc(L('Anhören', 'Listen')) + '" style="margin:0;background:var(--surface-2)">' + ic('speaker', 'sm') + '</button></div><div class="p2 en">meet · miss · extend a deadline</div></div>' };
  s += '<div class="ex-body gx">' + blockLine('w', rec ? L('Anki · Erkennen · zählt nur für „Erkennst du“', 'Anki · recognize · counts only toward “you recognize”') : L('Anki · Bilden · plant nichts', 'Anki · produce · schedules nothing')) +
    instr(back ? (rec ? L('Wie gut saß es?', 'How well did you know it?') : L('Wusstest du es?', 'Did you know it?')) : L('Erst denken, dann aufdecken.', 'Think first, then reveal.'), 'tw-why') +
    '<div class="stagec"><div class="tw-card' + (back ? ' flipped' : '') + '">' + card.front + (back ? '<div class="tw-cardline"></div>' + card.backHtml : '') + '</div></div></div>';
  if (!back) {
    s += exFoot(btnPri('tw-reveal', L('Aufdecken', 'Reveal'), rec ? 'h19-recognize-back' : 'h19-produce-back'));
  } else if (rec) {
    const r = [['again', L('Nochmal', 'Again'), L('1 T', '1 d')], ['hard', L('Schwer', 'Hard'), L('3 T', '3 d')], ['good', L('Gut', 'Good'), L('9 T', '9 d')], ['easy', L('Leicht', 'Easy'), L('21 T', '21 d')]];
    s += '<div class="ex-foot gx tw-rate">' + r.map((x, i) => '<button class="tw-rb" id="tw-r-' + x[0] + '" data-go="' + (x[0] === 'easy' ? 'h19-control' : 'h19-undo') + '"><b>' + x[1] + '</b><span class="num">' + x[2] + '</span><i class="num">' + (i + 1) + '</i></button>').join('') + '</div>' +
      '<p class="tw-footnote gx">' + L('Plant nur dein Erkennen · nach „Leicht“ prüft die App beim nächsten Termin', 'Schedules recognition only · after “easy” the app checks at the next due date') + '</p>';
  } else {
    s += '<div class="ex-foot gx">' + btnSec('tw-no', L('Wusste ich nicht', 'Didn’t know'), 'data-go="h19-produce-front"') + '<button class="btn sec" id="tw-yes" data-go="h19-produce-front" style="flex:1">' + L('Wusste ich', 'Knew it') + '</button></div>' +
      '<p class="tw-footnote gx">' + L('Plant nichts. Zählen tut das freie Tippen.', 'Schedules nothing. Free typing is what counts.') + '</p>';
  }
  if (v === 'undo') s += '<div class="tw-undo gx" role="status"><span>' + L('<em class="en">discount</em> · Gut · in 9 Tagen', '<em>discount</em> · good · in 9 days') + '</span><button class="link" id="tw-undo" data-go="h19-recognize-back">' + L('Rückgängig', 'Undo') + '</button><i></i></div>';
  return s + twOverlays({ why: why });
}
reg('h19', {
  code: 'H19', name: 'Anki-Karte', kind: 'phone', demo: true,
  variants: [['recognize-front', 'Erkennen · vorn'], ['recognize-back', 'Erkennen · aufgedeckt'], ['produce-front', 'Bilden · vorn'], ['produce-back', 'Bilden · aufgedeckt'], ['undo', 'Rückgängig (5 s)'], ['control', 'Kontrolle nach „Leicht“']],
  render: h19,
  after(v) { if (v === 'control' && !S.ui.checked) { wireGap('gap', () => act('check')); if (S.typed == null) { const x = { ok: 'Rabatt', typo: 'Rabat', wrong: 'Rechnung', idk: '' }[S.demo]; if (x) autoType('gap', x); } } },
  acts: Object.assign({}, twActsBase, {
    check() { S.ui.checked = true; render(); },
    idk() { S.demo = 'idk'; S.ui.checked = true; render(); }
  })
});

/* ---------- H20 Ergebnis ---------- */
function twResultLines(v) {
  const I = n => ic(n, 'sm');
  if (v === 'all-early') return [
    [I('repeat'), L('9 Wörter geübt · keins war fällig.', '9 words practiced · none were due.')],
    [I('near'), L('<em class="en">lead time</em> war nah dran: 1 Buchstabe.', '<em>lead time</em> was close: 1 letter.')],
    [I('clock'), L('Gute Übung: ihr nächster Termin startet ab heute.', 'Good practice: their next review starts from today.')],
    [I('cal'), L('Morgen fällig: <b class="num">9</b>', 'Due tomorrow: <b class="num">9</b>')]];
  if (v === 'stopped') return [
    [I('repeat'), L('4 Wörter geübt · alle 4 waren fällig und zählen.', '4 words practiced · all 4 were due and count.')],
    [I('near'), L('<em class="en">budget approval</em> war nah dran: 1 Buchstabe.', '<em>budget approval</em> was close: 1 letter.')],
    [I('cal'), L('Die anderen 6 bleiben fällig. Gespeichert ist alles, was du beantwortet hast.', 'The other 6 stay due. Everything you answered is saved.')]];
  const lines = [[I('repeat'), L('10 Wörter geübt · alle 10 waren fällig und zählen.', '10 words practiced · all 10 were due and count.')]];
  if (v === 'with-step') lines.push(['<span class="tw-step">' + ic('up', 'sm') + '</span>', L('<em class="en">budget approval</em>: frei an 2 Tagen, jetzt auf dem Weg.', '<em>budget approval</em>: free on 2 days, now on the way.'), 'step']);
  lines.push([I('cross'), v === 'with-step' ? L('<em class="en">discount</em> kommt morgen wieder.', '<em>discount</em> comes back tomorrow.') : L('<em class="en">discount</em> kommt morgen wieder. <em class="en">budget approval</em> war nah dran: 1 Buchstabe.', '<em>discount</em> comes back tomorrow. <em>budget approval</em> was close: 1 letter.')]);
  lines.push([I('cal'), L('Noch 4 fällig für heute.', '4 more due today.')]);
  return lines;
}
function twResultCard(v) {
  return '<div class="card tw-res" style="padding:6px 18px">' + twResultLines(v).map(l => '<div class="st' + (l[2] ? ' tw-st-step' : '') + '" style="min-height:56px;gap:14px;font-size:16px;line-height:22px"><span style="color:var(--fg-2);flex:none">' + l[0] + '</span><span>' + l[1] + '</span></div>').join('') + '</div>';
}
reg('h20', {
  code: 'H20', name: 'Trainer-Ergebnis', kind: 'phone',
  variants: [['normal', 'normal'], ['with-step', 'mit echtem Schritt'], ['all-early', 'alles vorgezogen'], ['stopped', 'nach 4 Karten beendet']],
  render(v) {
    const title = { normal: L('Runde fertig', 'Round done'), 'with-step': L('Runde fertig', 'Round done'), 'all-early': L('Übung fertig', 'Practice done'), stopped: L('Runde beendet', 'Round ended') }[v];
    const more = v === 'all-early' ? '' : (v === 'stopped' ? btnSec('tw-more10', L('Noch 10', '10 more'), 'data-go="h18-free"') : btnSec('tw-more4', L('Noch 4', '4 more'), 'data-go="h18-free"'));
    const hint = v === 'all-early' ? '<div class="notice tw-notice">' + ic('info', 'sm') + '<span>' + L('Heute bringt mehr Vorziehen wenig. Morgen zählt jeder Abruf mehr.', 'More early practice won’t help much today. Tomorrow every recall counts for more.') + '</span></div>' : '';
    return '<div class="ex-body gx" style="justify-content:center;gap:22px;padding-top:32px">' +
      '<div class="tw-resicon"><span>' + ic(v === 'all-early' ? 'repeat' : 'check') + '</span></div>' +
      '<div class="stack s6" style="text-align:center"><div class="disp" style="font-size:28px;line-height:34px;font-weight:700">' + title + '</div><div class="p2"><span class="tw-badge">' + L('Extra', 'Extra') + '</span> ' + L('zählt nicht zur Pflicht und nicht zur Serie', 'doesn’t count toward your plan or streak') + '</div></div>' +
      twResultCard(v) + hint + '</div>' +
      exFoot(more + btnPri('tw-done', L('Fertig', 'Done'), 'h12-list'));
  }
});

/* ---------- H21 Wörter sammeln ---------- */
function twSearchField(val, idp) {
  return '<label class="field tw-search" style="min-height:46px;display:flex;align-items:center;gap:10px;padding:0 14px;color:var(--fg-3)">' + ic('search', 'sm') + '<input id="' + (idp || '') + 'w-search" value="' + esc(val || '') + '" placeholder="' + esc(L('Wort suchen', 'Search words')) + '" autocomplete="off"></label>';
}
function twSearchEmpty() {
  return '<header class="phead gx"><div class="tw-hl"><button class="iconbtn" id="tw-back" data-go="h12-list" aria-label="' + esc(L('Zurück', 'Back')) + '" style="margin-left:-10px;margin-right:0">' + ic('chevL') + '</button><h1 class="disp">' + L('Wörter', 'Words') + '</h1></div></header>' +
    '<div class="scroll"><div class="gx stack s16" style="padding-bottom:24px">' + twSearchField('backlog') +
    '<div class="tw-empty"><b>' + L('„backlog“ ist noch nicht in deinen Wörtern.', '“backlog” isn’t in your words yet.') + '</b><span>' + L('Gesucht in Englisch, Deutsch, Wortpartnern und deinen Sätzen.', 'Searched English, German, collocations and your sentences.') + '</span></div>' +
    '<div class="card stack s8"><div class="lbl">' + L('Im Wörterbuch', 'In the dictionary') + '</div><div style="display:flex;align-items:center;gap:10px"><div class="disp en" style="font-size:26px;line-height:32px;font-weight:650">backlog</div><button class="iconbtn" id="tw-say" data-act="noop" aria-label="' + esc(L('Anhören', 'Listen')) + '" style="margin:0">' + ic('speaker', 'sm') + '</button></div>' +
    '<div class="p2 en">/ˈbækˌlɔɡ/ · ' + L('Nomen', 'noun') + '</div><p class="p">' + L('der Rückstand, unerledigte Aufträge', 'a pile of work or orders not yet done') + '</p>' +
    '<button class="btn pri full" id="tw-add" data-go="h21-add-sheet">' + ic('plus', 'sm') + L('Hinzufügen', 'Add') + '</button></div>' +
    '<button class="row" id="tw-fromtext" data-go="h21-from-text"><span class="ri">' + ic('list', 'sm') + '</span><span class="rt"><b>' + L('Aus einem Text sammeln', 'Collect from a text') + '</b><span>' + L('Text einfügen, 5 bis 15 Vorschläge', 'paste text, 5 to 15 suggestions') + '</span></span><span class="chev">' + ic('chevR', 'sm') + '</span></button>' +
    '</div></div>' + tabbar('h12');
}
const TW_ART = () => '<p class="sent en tw-art">' + words('Last spring, a packaging supplier in the region lost two large contracts because it could not deliver on time. Since then, the company has invested in a second') + ' <span class="w sel" data-act="noop">warehouse</span> ' + words('and has hired a team to follow up on every') + ' <span class="w' + (S.v === 'phrase' ? ' sel' : '') + '">open</span> <span class="w' + (S.v === 'phrase' ? ' sel' : '') + '">order</span> ' + words('within 48 hours.') + '</p>';
function twReader(v) {
  const art = TW_ART().replace(v === 'phrase' ? '<span class="w sel" data-act="noop">warehouse</span>' : '@@', '<span class="w">warehouse</span>');
  return '<header class="phead gx"><div class="tw-hl"><button class="iconbtn" id="tw-back" data-go="h13-reader" aria-label="' + esc(L('Zurück', 'Back')) + '" style="margin-left:-10px;margin-right:0">' + ic('chevL') + '</button><h1 class="disp" style="font-size:22px">' + L('Lesen', 'Reading') + '</h1></div></header>' +
    '<div class="scroll gx"><div class="lbl" style="padding-top:6px">' + L('Lieferketten unter Druck · Absatz 2', 'Supply chains under pressure · paragraph 2') + '</div>' + art + '</div>';
}
function twSenses(sel) {
  const s = [[L('das Lager, die Lagerhalle', 'storage building'), L('passt zum Satz', 'fits the sentence')], [L('der Großmarkt (US)', 'wholesale store (US)'), '']];
  return '<div class="stack s8">' + s.map((x, i) => '<button class="choice' + (i === sel ? ' sel' : '') + '" id="tw-sense-' + i + '" data-act="sense" data-v="' + i + '"><span class="n">' + (i + 1) + '</span><span style="flex:1">' + x[0] + '</span>' + (x[1] ? '<span class="tw-tag">' + x[1] + '</span>' : '') + '</button>').join('') + '</div>';
}
function twChoose(full) {
  const quota = full ? '<p class="tw-note">' + ic('info', 'xs') + '<span>' + L('Heute schon 5 neue. Weitere kommen als „erkennst du“ dazu, aktiv lernen geht ab morgen.', 'Already 5 new today. More come in as “you recognize”; active learning works from tomorrow.') + '</span></p>'
    : '<p class="tw-note">' + ic('cal', 'xs') + '<span>' + L('Kommt nach deiner Pflicht dran, heute noch 1 Platz frei.', 'Comes after your daily plan; 1 spot left today.') + '</span></p>';
  const pick = S.ui.mode || (full ? 'rec' : 'act');
  return '<div class="stack s8"><div class="lbl">' + L('Wie willst du es lernen?', 'How do you want to learn it?') + '</div><div class="tw-modes">' +
    '<button class="tw-mode' + (pick === 'rec' ? ' on' : '') + '" id="tw-m-rec" data-act="mode" data-v="rec"><b>' + L('Erkennen reicht', 'Recognizing is enough') + '</b><span>' + L('Verstehen beim Lesen und Hören', 'understand when reading and listening') + '</span></button>' +
    '<button class="tw-mode' + (pick === 'act' ? ' on' : '') + (full ? ' off' : '') + '" id="tw-m-act" data-act="' + (full ? 'noop' : 'mode') + '" data-v="act"' + (full ? ' aria-disabled="true"' : '') + '><b>' + L('Aktiv lernen', 'Learn actively') + '</b><span>' + (full ? L('ab morgen wieder frei', 'free again tomorrow') : L('selbst sagen und schreiben können', 'be able to say and write it')) + '</span></button></div>' + quota + '</div>';
}
function twAddSheet(full) {
  return sheet('tw-add-sheet', L('In deine Wörter', 'Add to your words'),
    '<div class="stack s16"><div class="stack s6"><div class="lbl">' + L('Wort', 'Word') + '</div><div class="field tw-in en">backlog</div></div>' +
    '<div class="stack s6"><div class="lbl">' + L('Bedeutung', 'Meaning') + '</div><div class="field tw-in">' + L('der Rückstand, unerledigte Aufträge', 'backlog of open orders') + '</div></div>' +
    '<div class="stack s6"><div class="lbl">' + L('Satz', 'Sentence') + ' <span class="tw-tag">' + ic('claude', 'xs') + L('Vorschlag von Claude', 'suggested by Claude') + '</span></div><div class="field tw-in en" style="min-height:0">We’re still working through a backlog of open orders.</div>' +
    '<p class="p2" style="font-size:13px">' + L('Ohne Satz keine Karte. Ändere ihn ruhig, oder nimm einen eigenen.', 'No sentence, no card. Feel free to change it or use your own.') + '</p></div>' +
    twChoose(full) + '</div>',
    '<button class="btn pri full" id="tw-save" data-go="h12-list">' + L('Speichern', 'Save') + '</button>', { h: '88%' });
}
function h21(v) {
  if (v === 'search-empty') return twSearchEmpty();
  if (v === 'add-sheet' || v === 'quota-full') return twSearchEmpty() + twAddSheet(v === 'quota-full');
  if (v === 'from-text') {
    const sug = [['warehouse', L('Lager', 'storage building'), 1], ['packaging', L('Verpackung', 'packaging'), 1], ['invest in', L('investieren in', 'invest in'), 1], ['open order', L('offener Auftrag', 'open order'), 1], ['contract', L('Vertrag', 'contract'), 0], ['mid-sized', L('mittelständisch', 'mid-sized'), 1], ['supply chain', L('Lieferkette', 'supply chain'), 0], ['rebuild', L('wieder aufbauen', 'rebuild'), 0]];
    const on = sug.filter(x => x[2]).length;
    return '<header class="phead gx"><div class="tw-hl"><button class="iconbtn" id="tw-back" data-go="h21-search-empty" aria-label="' + esc(L('Zurück', 'Back')) + '" style="margin-left:-10px;margin-right:0">' + ic('chevL') + '</button><h1 class="disp" style="font-size:22px">' + L('Aus Text sammeln', 'Collect from text') + '</h1></div></header>' +
      '<div class="scroll"><div class="gx stack s16" style="padding-bottom:24px"><div class="tw-src en">Mid-sized manufacturers have spent the past two years rebuilding their supply chains. … Since then, the company has invested in a second warehouse …</div>' +
      '<div class="lbl">' + L('8 Vorschläge · neu für dich', '8 suggestions · new to you') + '</div><div>' +
      sug.map((x, i) => '<button class="row tw-pick" id="tw-s-' + i + '" data-act="noop" aria-pressed="' + (x[2] ? 'true' : 'false') + '"><span class="ck' + (x[2] ? ' y' : '') + '">' + (x[2] ? ic('check', 'xs') : '') + '</span><span class="rt"><b class="en">' + x[0] + '</b><span>' + x[1] + '</span></span></button>').join('') + '</div>' +
      '<p class="p2">' + L('Sie kommen als „erkennst du“ dazu, jedes mit seinem Satz aus dem Text. Aktiv lernen wählst du danach einzeln.', 'They come in as “you recognize”, each with its sentence from the text. Choose active learning one by one afterward.') + '</p></div></div>' +
      exFoot(btnPri('tw-addn', L(on + ' hinzufügen', 'Add ' + on), 'h12-list'));
  }
  // unknown-word · phrase: Wort-Popup im Lesetext
  const phrase = v === 'phrase';
  const body = phrase
    ? '<div class="stack s16"><div class="p2">' + L('Zwei Wörter angetippt: als Wendung speichern.', 'Two words tapped: save as a phrase.') + '</div>' +
      '<div style="display:flex;align-items:center;gap:10px"><span class="p2 en">' + L('Wendung', 'phrase') + '</span><button class="iconbtn" id="tw-say" data-act="noop" aria-label="' + esc(L('Anhören', 'Listen')) + '" style="margin:0">' + ic('speaker', 'sm') + '</button></div>' +
      '<div class="disp" style="font-size:24px;line-height:30px;font-weight:600">' + L('offener Auftrag, noch nicht geliefert', 'an order not yet delivered') + '</div>' +
      '<div class="card stack s6"><div class="lbl">' + L('Fundsatz', 'Found in') + '</div><p class="p en">… has hired a team to follow up on every <b>open order</b> within 48 hours.</p></div></div>'
    : '<div class="stack s16"><div style="display:flex;align-items:center;gap:10px"><span class="p2 en">/ˈwerˌhaʊs/ · ' + L('Nomen', 'noun') + '</span><button class="iconbtn" id="tw-say" data-act="noop" aria-label="' + esc(L('Anhören', 'Listen')) + '" style="margin:0">' + ic('speaker', 'sm') + '</button></div>' +
      twSenses(S.ui.sense != null ? S.ui.sense : 0) +
      '<p class="p2">' + L('Neu für dich. Der Satz aus dem Artikel kommt als Ursprungssatz mit.', 'New to you. The article sentence comes along as the source sentence.') + '</p></div>';
  return twReader(v) + sheet('tw-word-sheet', phrase ? 'open order' : 'warehouse', body,
    '<button class="btn pri full" id="tw-keep" data-go="h21-add-sheet">' + ic('plus', 'sm') + L('In die Wörter', 'Add to words') + '</button>', { h: phrase ? '62%' : '60%', closeAct: 'noop' });
}
reg('h21', {
  code: 'H21', name: 'Wörter sammeln', kind: 'phone',
  variants: [['search-empty', 'Suche ohne Treffer'], ['unknown-word', 'unbekanntes Wort'], ['phrase', 'zwei Wörter = Wendung'], ['add-sheet', 'Hinzufügen-Blatt'], ['from-text', 'aus Text'], ['quota-full', 'Tagesgrenze erreicht']],
  render: h21,
  acts: {
    sense(el) { S.ui.sense = +el.getAttribute('data-v'); render(); },
    mode(el) { S.ui.mode = el.getAttribute('data-v'); render(); }
  }
});

/* ---------- H22 Tempo ---------- */
const TW_TEMPO = () => [
  ['die Frist', 'deadline', 'deadline'], ['Einkauf, Beschaffung', 'procurement', 'procurement'], ['freigeben, absegnen', 'sign off on', 'sign off'], ['senken, verringern', 'reduce', 'reduce'],
  ['das Preisangebot (schriftlich)', 'quote', 'quote'], ['nachfassen', 'follow up', 'follow up'], ['der Lieferant', 'supplier', 'suplier'], ['pünktlich liefern', 'deliver on time', 'deliver in time']
];
reg('h22', {
  code: 'H22', name: 'Tempo', kind: 'phone',
  variants: [['run', 'läuft'], ['end', 'Ende']],
  render(v) {
    const top = twTop(v === 'end' ? 12 : 7, 12, { done: v === 'end', noMenu: v === 'end' });
    if (v === 'run') {
      return top + '<div class="ex-body gx">' + blockLine('w', L('Tempo · nur Wörter, die fest sitzen', 'Speed · only solid words')) + instr(L('So schnell es geht, ohne Hetze.', 'As fast as you can, no rush.'), 'tw-why') +
        '<div class="stagec"><div class="prompt disp">' + L('die Frist', 'die Frist') + '</div><div style="padding-top:8px;position:relative">' + gapHtml('deadl', { big: true, caret: true }) + '</div>' +
        '<div class="tw-time"><div class="timeline"><i style="width:58%"></i></div><span class="num">0:38</span></div></div></div>' +
        exFoot(btnPri('tw-check', L('Prüfen', 'Check'), 'h22-end'), true) + drawnKbd({ go: 'go' }) +
        twOverlays({ why: L('Tempo holt feste Wörter schnell ab. So wird aus „ich weiß es“ ein „es kommt sofort“. Läuft die Zeit ab, heißt das nur langsam, nicht falsch.', 'Speed recalls solid words fast, turning “I know it” into “it comes right away”. Running out of time means slow, not wrong.') });
    }
    const list = TW_TEMPO();
    return top + '<div class="ex-body gx">' + blockLine('w', L('Tempo · 90 Sekunden', 'Speed · 90 seconds')) +
      '<div class="stack s16" style="padding:14px 0 18px"><div class="h2 disp" style="font-size:26px;line-height:32px">' + L('12 Wörter in 90 Sek., 10 auf Anhieb.', '12 words in 90 sec, 10 right away.') + '</div>' +
      '<div class="card tw-tlist" style="padding:2px 16px">' + list.map((x, i) => {
        const bad = x[1] !== x[2];
        return '<div class="tw-ti' + (bad ? ' bad' : '') + '"><div class="tw-tr"><span class="ck' + (bad ? '' : ' y') + '"' + (bad ? ' style="color:var(--bad);box-shadow:0 0 0 1.5px var(--bad) inset"' : '') + '>' + ic(bad ? 'cross' : 'check', 'xs') + '</span><span class="tw-tq">' + L(x[0], x[0]) + '</span><b class="en">' + x[1] + '</b></div>' +
          (bad ? '<div class="tw-tx"><div class="cmp en"><span class="you">' + L('Du:', 'You:') + '</span> <s>' + x[2] + '</s> <span class="you">→</span> <b>' + x[1] + '</b></div><p class="p2">' + (x[1] === 'supplier' ? L('Doppeltes p: <em class="en">supplier</em>, von <em class="en">supply</em>.', 'Double p: <em>supplier</em>, from <em>supply</em>.') : L('<em class="en">on time</em> = pünktlich. <em class="en">in time</em> = rechtzeitig, noch bevor es zu spät ist.', '<em>on time</em> = punctual. <em>in time</em> = early enough.')) + '</p></div>' : '') + '</div>';
      }).join('') + '<div class="tw-ti"><div class="tw-tr" style="color:var(--fg-3)">' + L('+ 4 weitere richtig', '+ 4 more correct') + '</div></div></div>' +
      '<p class="p2">' + L('Fehler bringen das Wort morgen zurück. Langsame Antworten zählen nicht als Fehler.', 'Mistakes bring the word back tomorrow. Slow answers don’t count as mistakes.') + '</p></div></div>' +
      exFoot(btnPri('tw-done', L('Fertig', 'Done'), 'h12-list'));
  },
  acts: twActsBase
});

/* ---------- H23 Wort verwalten ---------- */
function twManageRows(idp, compact) {
  idp = idp || '';
  const rows = [
    ['pen', L('Bearbeiten', 'Edit'), L('Bedeutung, Satz, Notiz', 'meaning, sentence, note'), 'h23-edit'],
    ['check', L('Kenne ich sicher', 'I know this well'), L('Wir fragen es morgen einmal frei ab. Sitzt es, springt es eine Stufe weiter.', 'We’ll ask for it once tomorrow, without help. If you get it, it moves up one stage.'), ''],
    ['cal', L('Morgen wieder', 'Again tomorrow'), L('Termin auf morgen, die Stufe bleibt.', 'Due tomorrow, the stage stays.'), ''],
    ['pause', L('Pausieren', 'Pause'), L('Setzt keine Termine. Die Daten bleiben.', 'Sets no dates. Your data stays.'), ''],
    ['list', L('Zu Stapel', 'Add to a deck'), L('z. B. „Kunde Keller“ oder „Messe“', 'e.g. “Keller account” or “trade fair”'), ''],
    ['refresh', L('Von vorn', 'Start over'), L('Startet wieder bei der Einführung. Dein Verlauf bleibt.', 'Starts again with the introduction. Your history stays.'), ''],
    ['close', L('Ausblenden', 'Hide'), L('Kommt nirgends mehr vor. Gelöscht wird nichts.', 'Never shows up again. Nothing is deleted.'), 'h23-hidden']
  ];
  return '<div>' + rows.map((r, i) => '<button class="row" id="' + idp + 'tw-a-' + i + '"' + (r[3] ? ' data-go="' + r[3] + '"' : ' data-act="noop"') + '><span class="ri">' + ic(r[0], 'sm') + '</span><span class="rt"><b>' + r[1] + '</b><span>' + r[2] + '</span></span>' + (r[3] && !compact ? '<span class="chev">' + ic('chevR', 'sm') + '</span>' : '') + '</button>').join('') +
    '<button class="row tw-danger" id="' + idp + 'tw-a-del" data-go="h23-delete-confirm"><span class="ri">' + ic('cross', 'sm') + '</span><span class="rt"><b>' + L('Löschen', 'Delete') + '</b><span>' + L('mit Rückfrage', 'asks first') + '</span></span></button></div>';
}
function twWordHead(back) {
  return '<header class="phead gx"><div class="tw-hl"><button class="iconbtn" id="tw-back" data-go="' + back + '" aria-label="' + esc(L('Zurück', 'Back')) + '" style="margin-left:-10px;margin-right:0">' + ic('chevL') + '</button><h1 class="disp en" style="font-size:24px">lead time</h1></div><span class="stagepill">S3</span></header>';
}
function h23(v) {
  if (v === 'edit') {
    return twWordHead('h23-actions') + '<div class="scroll"><div class="gx stack s16" style="padding:8px 20px 24px">' +
      '<div class="stack s6"><div class="lbl">' + L('Englisch', 'English') + '</div><div class="field tw-in en">lead time</div></div>' +
      '<div class="stack s6"><div class="lbl">' + L('Bedeutung', 'Meaning') + '</div><div class="field tw-in tw-focus">' + L('die Lieferzeit (Bestellung bis Lieferung)', 'time from order to delivery') + '<span class="caret"></span></div></div>' +
      '<div class="stack s6"><div class="lbl">' + L('Ursprungssatz', 'Source sentence') + '</div><div class="field tw-in en" style="min-height:0">Another supplier has also offered us a lead time of six weeks, and yours is ten.</div></div>' +
      '<div class="stack s6"><div class="lbl">' + L('Notiz', 'Note') + '</div><div class="field tw-in" style="color:var(--fg-3)">' + L('nur für dich', 'just for you') + '</div></div>' +
      '<p class="p2">' + L('Änderungen behalten Stand und Verlauf.', 'Changes keep the status and history.') + '</p></div></div>' +
      exFoot(btnSec('tw-cancel', L('Abbrechen', 'Cancel'), 'data-go="h23-actions"') + btnPri('tw-save', L('Speichern', 'Save'), 'h23-actions'));
  }
  if (v === 'hidden') {
    return twWordHead('h12-list') + '<div class="scroll"><div class="gx stack s16" style="padding-bottom:24px">' +
      '<div class="notice tw-notice">' + ic('info', 'sm') + '<span>' + L('<b>Ausgeblendet.</b> Kommt in keiner Übung und keiner Liste vor. Stand, Verlauf und Sätze bleiben gespeichert.', '<b>Hidden.</b> It won’t appear in any exercise or list. Status, history and sentences are kept.') + '</span></div>' +
      '<div class="tw-dim">' + wordDetail() + '</div>' +
      '<button class="btn pri full" id="tw-unhide" data-go="h12-detail">' + L('Wieder einblenden', 'Show again') + '</button></div></div>' + tabbar('h12');
  }
  const base = twWordHead('h12-detail') + '<div class="scroll"><div class="gx" style="padding-bottom:24px">' + twManageRows() + '</div></div>' + tabbar('h12');
  if (v === 'delete-confirm') {
    return base + sheet('tw-del-sheet', L('lead time löschen?', 'Delete lead time?'),
      '<div class="stack s16"><p class="p">' + L('Löschen ist endgültig: Stand, Verlauf und Sätze gehen verloren. Ausblenden behält alles und nimmt das Wort trotzdem aus jeder Übung.', 'Deleting is final: status, history and sentences are lost. Hiding keeps everything and still removes the word from every exercise.') + '</p></div>',
      '<div class="stack s8"><button class="btn pri full" id="tw-hide-inst" data-go="h23-hidden">' + L('Lieber ausblenden', 'Hide instead') + '</button><button class="btn ghost full tw-delbtn" id="tw-del-ok" data-go="h12-list">' + L('Endgültig löschen', 'Delete for good') + '</button></div>', { h: '46%', closeAct: 'closedel' });
  }
  return base;
}
reg('h23', {
  code: 'H23', name: 'Wort verwalten', kind: 'phone',
  variants: [['actions', 'Aktionen'], ['edit', 'Bearbeiten'], ['delete-confirm', 'Löschen-Rückfrage'], ['hidden', 'ausgeblendet']],
  render: h23,
  acts: { closedel() { go('h23-actions'); } }
});
