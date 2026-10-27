// screens-soll.js: Paket C „Soll“ (H33–H37), siehe bauliste.md. Alle Namen mit Präfix ts.

/* ---------- gemeinsame Bausteine (nur hier) ---------- */
function tsHead(back, right) {
  return '<header class="phead gx"><button class="iconbtn" id="ts-back" data-go="' + back + '" aria-label="' + esc(L('Zurück', 'Back')) + '" style="margin-left:-10px;margin-right:0">' + ic('chevL') + '</button>' + (right || '') + '</header>';
}
function tsPage(back, right, inner, tab) {
  return tsHead(back, right) + '<div class="scroll gx" style="padding-bottom:28px"><div class="stack s16 springopen">' + inner + '</div></div>' + tabbar(tab);
}
const tsExtra = () => '<span class="ts-extra">' + L('Extra', 'Extra') + '</span>';
function tsTitle(t, sub) {
  return '<div class="stack s6"><div class="h2 disp ts-title">' + t + '</div>' + (sub ? '<p class="p2">' + sub + '</p>' : '') + '</div>';
}
function tsSec(t, right) {
  return '<div class="ts-sec"><span>' + t + '</span>' + (right || '') + '</div>';
}
function tsRow(id, icon, title, sub, target, right) {
  const tgt = target && target.indexOf('act:') === 0 ? ' data-act="' + target.slice(4) + '"' : ' data-go="' + (target || '') + '"';
  return '<button class="row" id="' + id + '"' + tgt + '><span class="ri">' + ic(icon, 'sm') + '</span><span class="rt"><b>' + title + '</b><span>' + sub + '</span></span>' + (right || '') + '<span class="chev">' + ic('chevR', 'sm') + '</span></button>';
}
function tsSubnav(items, cur) {
  return '<div class="ts-subnav" role="tablist">' + items.map(x => '<button class="chip' + (x[0] === cur ? ' on' : '') + '" id="ts-nav-' + x[0] + '" data-go="' + x[1] + '" role="tab"' + (x[0] === cur ? ' aria-selected="true"' : '') + '>' + x[2] + '</button>').join('') + '</div>';
}
const tsAi = () => '<p class="ts-ai">' + ic('claude', 'xs') + L('Von Claude geprüft · kann sich irren', 'Checked by Claude · may be wrong') + '</p>';

/* =========================================================
   H33 Mehr üben
   ========================================================= */
function tsGrid(prefix, items) {
  return '<div class="ts-grid">' + items.map((x, i) => '<button class="ts-gi" id="' + prefix + '-' + i + '" data-go="' + (x[2] || '') + '"' + (x[2] ? '' : ' data-act="noop"') + '><b>' + x[0] + '</b><span>' + x[1] + '</span></button>').join('') + '</div>';
}
function tsMoreList() {
  const trainings = [
    [L('Wortpartner', 'Collocations'), '<span class="en">reduce the lead time</span>', 'h18-partner'],
    [L('Umformen', 'Rephrasing'), L('ein Satz, zwei Formen', 'one sentence, two forms')],
    [L('Wortform', 'Word forms'), '<span class="en">approve → approval</span>'],
    [L('Förmlicher sagen', 'Say it more formally'), '<span class="en">get → receive</span>'],
    ['Phrasal Verbs', '<span class="en">follow up on</span>'],
    [L('Übergänge', 'Transitions'), '<span class="en">As for the price, …</span>']
  ];
  const formats = [
    [L('Umformen mit Schlüsselwort', 'Key word transformation'), L('gleicher Sinn, ein Wort vorgegeben', 'same meaning, one word given')],
    [L('Fehler finden', 'Find the error'), L('ein Satz, eine falsche Stelle', 'one sentence, one wrong spot')],
    [L('Kleines Wort', 'Small word'), L('eine Lücke, ein kurzes Wort', 'one gap, one short word')],
    [L('Passendes Wort', 'Right word'), L('vier Wörter, eins passt', 'four words, one fits')]
  ];
  return tsTitle(L('Mehr üben', 'More practice'), L('Alles hier ist freiwillig und zählt als Extra, nie als Pflicht. Nimm, was dich gerade interessiert.', 'Everything here is optional and counts as extra, never as your daily plan. Pick whatever interests you.')) +
    '<div class="stack s6">' + tsSec(L('Wörter', 'Words'), tsExtra()) +
    '<div>' + tsRow('mo-ws', 'pen', L('Wort-Werkstatt', 'Word workshop'), L('5 Wörter brauchen eine neue Darstellung', '5 words need a fresh look'), 'h33-workshop', '<span class="ts-count num">5</span>') +
    tsRow('mo-extra', 'repeat', L('Freiwillige Zusatzrunde', 'Optional extra round'), L('10 Wiederholungen, zählt als Extra', '10 reviews, counts as extra'), 'h17-default') +
    tsRow('mo-tempo', 'clock', L('Tempo-Runde', 'Speed round'), L('2 Minuten, nur Wörter, die du selbst bildest', '2 minutes, only words you produce'), 'h22-run') + '</div></div>' +
    '<div class="stack s8">' + tsSec(L('Grammatik', 'Grammar'), tsExtra()) +
    '<div>' + tsRow('mo-topic', 'gram', L('Thema frei üben', 'Practice a topic freely'), '<span class="en">past simple vs. present perfect</span>', 'h27-topic') + '</div>' +
    '<div class="lbl" style="padding-top:4px">' + L('Sechs Trainings', 'Six trainings') + '</div>' + tsGrid('mo-tr', trainings) + '</div>' +
    '<div class="stack s8">' + tsSec(L('C1-Formate', 'C1 formats'), tsExtra()) +
    '<p class="p2" style="font-size:14px">' + L('So sehen Aufgaben in C1-Prüfungen aus. Kurz und gemischt.', 'This is what tasks in C1 exams look like. Short and mixed.') + '</p>' + tsGrid('mo-c1', formats) + '</div>' +
    '<div class="stack s6">' + tsSec(L('Eigene Texte prüfen', 'Check your own texts')) +
    '<div>' + tsRow('mo-clinic', 'pen', L('Satz-Klinik', 'Sentence clinic'), L('einen eigenen Satz prüfen lassen', 'have one of your sentences checked'), 'h36-sentence') +
    tsRow('mo-mail', 'send', L('Mail-Werkstatt', 'Email workshop'), L('eine Mail vor dem Senden prüfen', 'check an email before you send it'), 'h36-mail') + '</div></div>' +
    '<div class="stack s6">' + tsSec(L('Tests, wenn du willst', 'Tests, if you want')) +
    '<div>' + tsRow('mo-c1check', 'flag', L('C1-Check', 'C1 check'), L('etwa 20 Minuten, gemischt', 'about 20 minutes, mixed'), 'act:test') +
    tsRow('mo-vocab', 'words', L('Wortschatztest', 'Vocabulary test'), L('etwa 10 Minuten', 'about 10 minutes'), 'act:test') + '</div>' +
    '<p class="p2" style="font-size:14px">' + L('Tests startest nur du. Die App plant sie nie ein.', 'Only you start tests. The app never schedules them.') + '</p></div>' +
    '<p class="p2 ts-foot">' + L('Hören, Sprechen und Lesen findest du unter ', 'Listening, speaking and reading are under ') + '<button class="link" id="mo-praxis" data-go="h13-main" style="min-height:0;display:inline;font-size:15px">' + L('Praxis', 'Practice') + '</button>.</p>';
}
function tsTestSheet() {
  return sheet('ts-test', L('C1-Check starten?', 'Start the C1 check?'),
    '<div class="stack s16"><p class="p">' + L('Etwa 20 Minuten: Wörter, Grammatik, Hören und ein kurzer Text. Du kannst jederzeit aufhören.', 'About 20 minutes: words, grammar, listening and a short text. You can stop at any time.') + '</p>' +
    '<div class="notice">' + ic('info', 'sm') + '<span>' + L('Freiwillig. Zählt als Extra und ändert deinen Tagesplan nicht.', 'Optional. Counts as extra and doesn’t change your daily plan.') + '</span></div></div>',
    '<div style="display:flex;gap:8px"><button class="btn sec" id="ts-test-later" data-act="closesheet" style="flex:1">' + L('Später', 'Later') + '</button><button class="btn pri" id="ts-test-go" data-go="h31-passed" style="flex:1">' + L('Test starten', 'Start test') + '</button></div>');
}
function tsXTop(n, i) {
  return '<div class="ex-top gx ts-xtop"><button class="iconbtn" id="ex-close" data-go="h33-list" aria-label="' + esc(L('Schließen', 'Close')) + '">' + ic('close') + '</button>' +
    '<div class="ts-xprog" aria-label="' + esc(L('Wort ' + (i + 1) + ' von ' + n, 'Word ' + (i + 1) + ' of ' + n)) + '">' + Array.from({ length: n }, (_, k) => '<i class="' + (k < i ? 'd' : k === i ? 'c' : '') + '"></i>').join('') + '</div>' +
    '<button class="iconbtn" id="ex-more" data-act="menu" aria-label="' + esc(L('Mehr Möglichkeiten', 'More options')) + '">' + ic('more') + '</button></div>';
}
function tsWorkshop() {
  const whyTask = L('Dieses Wort ist dir zweimal in 30 Tagen entwischt. Noch mehr Wiederholung hilft dann wenig. Eine neue Darstellung hilft mehr.', 'This word slipped away twice in 30 days. More repetition rarely helps then. A fresh look helps more.');
  return tsXTop(5, 0) + '<div class="ex-body gx">' +
    blockLine('w', L('Extra · Wort-Werkstatt · Wort 1 von 5', 'Extra · word workshop · word 1 of 5')) +
    instr(L('Schau dir das Wort neu an. Danach ruht es zwei Tage.', 'Take a fresh look at the word. Then it rests for two days.')) +
    '<div class="stagec" style="justify-content:flex-start;gap:16px;padding-top:16px">' +
    '<div class="stack s6"><div class="prompt disp en">commission</div><div class="p2"><span class="en">/kəˈmɪʃən/</span> · ' + L('Nomen · die Provision', 'noun · a share of a sale') + ' · <span class="stagepill">S2</span></div></div>' +
    '<div class="card stack s8"><div class="lbl">' + L('Was passiert ist', 'What happened') + '</div>' +
    '<p class="p">' + L('Zweimal in 30 Tagen hast du statt <b class="en">commission</b> das Wort <s class="en ts-no">provision</s> geschrieben.', 'Twice in 30 days you wrote <s class="en ts-no">provision</s> instead of <b class="en">commission</b>.') + '</p>' +
    '<p class="p2 num" style="font-size:13px">' + L('19.10. · 26.10.', 'Oct 19 · Oct 26') + '</p></div>' +
    '<div class="ts-vs">' +
    '<div class="ts-vc on"><div class="ts-vh"><b class="en">commission</b><span>' + L('die Provision', 'share of a sale') + '</span></div><p class="en">Our sales team earns a <b>commission</b> on every new contract.</p></div>' +
    '<div class="ts-vc"><div class="ts-vh"><b class="en">provision</b><span>' + L('die Bestimmung im Vertrag', 'a clause in a contract') + '</span></div><p class="en">The contract includes a <b>provision</b> for price changes.</p></div></div>' +
    '<div class="notice">' + ic('bulb', 'sm') + '<span>' + L('<b>Deutsch-Falle:</b> „Provision“ sieht aus wie <span class="en">provision</span>, heißt aber <span class="en">commission</span>. Merksatz: Die <span class="en">commission</span> bringt Geld, die <span class="en">provision</span> steht im Vertrag.', '<b>German trap:</b> the German word “Provision” looks like provision but means commission. Memory hook: the commission brings money, the provision sits in the contract.') + '</span></div>' +
    '<div class="stack s6"><div class="lbl">' + L('Wortpartner', 'Collocations') + '</div><p class="p en">earn · pay · a commission on</p></div>' +
    tsAi() +
    '<p class="p2">' + L('Am Samstag fragt dich die App wieder, neu ab Stufe S2.', 'On Saturday the app asks you again, restarting at stage S2.') + '</p></div></div>' +
    exFoot(btnSec('ts-listen', ic('speaker', 'sm') + L('Anhören', 'Listen'), 'data-act="noop"') + btnPri('ts-ws-next', L('Weiter', 'Continue'), 'h33-result')) +
    overlays({ whyTask });
}
function tsResult() {
  const lines = [
    [ic('pen', 'sm'), L('<b class="num">5</b> Wörter neu dargestellt', '<b class="num">5</b> words given a fresh look')],
    [ic('cal', 'sm'), L('Sie ruhen bis Samstag und starten dann neu in S2.', 'They rest until Saturday, then restart at S2.')],
    [ic('repeat', 'sm'), L('Zählt als Extra. Deine Pflicht bleibt, wie sie ist.', 'Counts as extra. Your daily plan stays as it is.')]
  ];
  return '<div class="ex-body gx" style="justify-content:center;gap:24px;padding-top:32px">' +
    '<div class="stack s8" style="align-items:center;text-align:center"><span class="ts-done">' + ic('check') + '</span>' + tsExtra() +
    '<div class="disp" style="font-size:28px;line-height:34px;font-weight:700">' + L('Wort-Werkstatt fertig', 'Word workshop done') + '</div></div>' +
    '<div class="card" style="padding:6px 18px">' + lines.map(l => '<div class="st" style="min-height:56px;gap:14px;font-size:16px;line-height:22px"><span style="color:var(--fg-2)">' + l[0] + '</span><span>' + l[1] + '</span></div>').join('') + '</div></div>' +
    exFoot(btnPri('ts-res-done', L('Fertig', 'Done'), 'h33-list'));
}
reg('h33', {
  code: 'H33', name: 'Mehr üben', kind: 'phone',
  variants: [['list', 'Liste'], ['workshop', 'Wort-Werkstatt'], ['result', 'Ergebnis Extra']],
  render(v) {
    if (v === 'workshop') return tsWorkshop();
    if (v === 'result') return tsResult();
    return tsPage('h1-done', askBtn(), tsMoreList(), 'h1') + (S.ui.sheet === 'test' ? tsTestSheet() : '');
  },
  acts: {
    whysheet() { S.ui.menu = false; S.ui.sheet = 'why'; render(); },
    test() { S.ui.sheet = 'test'; render(); }
  }
});

/* =========================================================
   H34 Fortschritt-Details und Verlauf
   ========================================================= */
const tsProgNav = cur => tsSubnav([
  ['words', 'h34-words', L('Wörter', 'Words')], ['grammar', 'h34-grammar', L('Grammatik', 'Grammar')],
  ['listening', 'h34-listening', L('Hören', 'Listening')], ['history', 'h34-history', L('Verlauf', 'History')]], cur);
function tsCols(vals, labels, max) {
  return '<div class="ts-cols" aria-hidden="true">' + vals.map((x, i) => '<div class="ts-col' + (i === vals.length - 1 ? ' last' : '') + '"><span class="num">' + x + '</span><i style="height:' + (x / max * 100).toFixed(1) + '%"></i></div>').join('') + '</div>' +
    '<div class="ts-colx num"><span>' + labels[0] + '</span><span>' + labels[1] + '</span></div>';
}
function tsCurve(pts, lo, hi) {
  const X = i => 6 + i * (88 / (pts.length - 1)), Y = v => 72 - (v - lo) / (hi - lo) * 62;
  return '<svg viewBox="0 0 100 80" style="width:100%;height:160px" preserveAspectRatio="none" aria-hidden="true">' +
    [0, 1, 2].map(i => '<line x1="0" x2="100" y1="' + (10 + i * 31) + '" y2="' + (10 + i * 31) + '" stroke="var(--line)" vector-effect="non-scaling-stroke"/>').join('') +
    '<polyline fill="none" stroke="var(--fg)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" points="' + pts.map((p, i) => X(i).toFixed(1) + ',' + Y(p).toFixed(1)).join(' ') + '"/>' +
    pts.map((p, i) => '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p).toFixed(1) + '" r="1.1" fill="var(--fg)"/>').join('') + '</svg>';
}
function tsWords() {
  const tot = 491, f5 = 38 / tot * 100, f34 = 41 / tot * 100;
  return tsProgNav('words') + tsTitle(L('Wörter', 'Words'), L('Gezählt wird nur, was du frei abrufst. Auswählen zählt nicht.', 'Only free recall counts. Choosing from options doesn’t.')) +
    '<div class="card stack s16"><div class="ts-bign"><b class="disp num">38</b><span>' + L('bildest du selbst', 'you produce') + '</span></div>' +
    '<div class="ts-wbar" role="img" aria-label="' + esc(L('38 bildest du selbst, 41 auf dem Weg, 412 erkennst du', '38 you produce, 41 on the way, 412 you recognize')) + '"><i class="f5" style="width:' + f5.toFixed(1) + '%"></i><i class="f34" style="left:' + f5.toFixed(1) + '%;width:' + f34.toFixed(1) + '%"></i></div>' +
    '<div class="ts-leg">' +
    '<div><span class="ts-sw f5"></span><span>' + L('Bildest du selbst', 'You produce') + ' <em>S5</em></span><b class="num">38</b></div>' +
    '<div><span class="ts-sw f34"></span><span>' + L('Auf dem Weg', 'On the way') + ' <em>S3–S4</em></span><b class="num">41</b></div>' +
    '<div><span class="ts-sw out"></span><span>' + L('Erkennst du', 'You recognize') + '</span><b class="num">412</b></div>' +
    '<div class="tot"><span></span><span>' + L('Alle Wörter', 'All words') + '</span><b class="num">491</b></div></div></div>' +
    '<div class="card stack s8"><div class="lbl">' + L('Zuwachs · bildest du selbst · 8 Wochen', 'Growth · you produce · 8 weeks') + '</div>' +
    tsCols([14, 17, 20, 24, 27, 31, 35, 38], [L('KW 36', 'Wk 36'), L('KW 43', 'Wk 43')], 38) +
    '<p class="p2">' + L('Diese Woche <b class="num">+3</b>. Ein Wort kommt erst dazu, wenn es nach 21 Tagen Pause noch sitzt.', 'This week <b class="num">+3</b>. A word only counts once it still works after 21 days without practice.') + '</p></div>' +
    '<div class="card stack s8"><div class="lbl">' + L('Vorher, nachher', 'Before and after') + '</div>' +
    '<div class="ts-ba"><div><span class="num">0/10</span><em>' + L('am ersten Tag', 'on day one') + '</em></div><span class="ts-arrow">' + ic('arrowR', 'sm') + '</span><div><span class="num">7/10</span><em>' + L('eine Woche später', 'one week later') + '</em></div></div>' +
    '<p class="p2">' + L('Die 10 Wörter deines ersten Tages, frei abgerufen.', 'The 10 words from your first day, recalled freely.') + '</p></div>' +
    '<p class="quote">' + L('Frei abrufen fühlt sich schwerer an als Auswählen. Genau das macht es wirksam.', 'Free recall feels harder than choosing. That is exactly what makes it work.') + '</p>' +
    '<div>' + tsRow('pw-ws', 'pen', L('In der Wort-Werkstatt', 'In the word workshop'), L('5 Wörter mit neuer Darstellung', '5 words with a fresh look'), 'h33-workshop') +
    tsRow('pw-stages', 'info', L('Wie ein Wort wandert', 'How a word moves along'), L('die Stufen S0 bis S5', 'stages S0 to S5'), 'h37-stages') +
    tsRow('pw-all', 'words', L('Alle Wörter', 'All words'), L('Liste mit Suche und Filtern', 'list with search and filters'), 'h12-list') + '</div>';
}
function tsGrammar() {
  const topics = [
    ['past simple vs. present perfect', L('in Arbeit · Schritt 3 von 7', 'in progress · step 3 of 7'), 'run'],
    ['present perfect continuous', L('offen', 'open'), 'open'],
    [L('Zeitpräpositionen (for, since, by, until)', 'Time prepositions (for, since, by, until)'), L('offen', 'open'), 'open'],
    ['past perfect', L('offen', 'open'), 'open']
  ];
  const ch = CHAPTERS();
  return tsProgNav('grammar') + tsTitle(L('Grammatik', 'Grammar'), L('Dein Weg zu C1 in 8 Kapiteln, je etwa zwei Wochen.', 'Your path to C1 in 8 chapters, about two weeks each.')) +
    '<div class="card c1"><p class="s disp">' + L('C1 voraussichtlich zwischen Oktober 2027 und Januar 2028', 'C1 expected between October 2027 and January 2028') + '</p>' + c1Band(false) +
    '<p class="p2" style="font-size:13px">' + L('aus 2 Meilensteinen und 5 belegten Kann-Beschreibungen · ein Trend, keine geeichte Note', 'from 2 milestones and 5 proven can-do statements · a trend, not a calibrated grade') + '</p></div>' +
    '<div class="stack s8"><div class="lbl">' + L('C1-Karte · 8 Kapitel', 'C1 map · 8 chapters') + '</div>' +
    '<div class="ts-map">' +
    '<div class="ts-mi run"><span class="ts-mn num">1</span><div class="ts-mb"><b>' + ch[0][1] + '</b><span>' + L('in Arbeit · Thema 1 von 4', 'in progress · topic 1 of 4') + '</span>' +
    '<div class="ts-topics">' + topics.map(t => '<div class="st ' + t[2] + '"><span class="mk"></span><span class="nm"><span class="en">' + t[0] + '</span><em>' + t[1] + '</em></span></div>').join('') + '</div>' +
    '<button class="link" id="pg-chapter" data-go="h6-chapter" style="font-size:14px">' + L('Kapitel 1 öffnen', 'Open chapter 1') + '</button></div></div>' +
    ch.slice(1).map(c => '<div class="ts-mi"><span class="ts-mn num">' + c[0] + '</span><div class="ts-mb"><b>' + c[1] + '</b><span>' + L('offen · ', 'open · ') + c[2] + '</span></div></div>').join('') + '</div></div>' +
    '<div class="card stack s8"><div class="lbl">' + L('So wandert ein Thema', 'How a topic moves along') + '</div>' +
    '<p class="p">' + L('offen → in Arbeit → abgeschlossen → gefestigt', 'open → in progress → finished → consolidated') + '</p>' +
    '<p class="p2">' + L('Was du in der Diagnose schon zeigst, wird bestätigt und übersprungen.', 'Whatever you already show in the diagnosis is confirmed and skipped.') + '</p></div>' +
    '<div class="stack s6"><div class="lbl">' + L('Abgeschlossen heißt', 'Finished means') + '</div><p class="p2">' + L('alle vier Themen bestanden, Kapitel-Test mit 12 gemischten Aufgaben ab 80 %, beide Kapitelaufgaben erfüllt.', 'all four topics passed, chapter test with 12 mixed tasks at 80 % or more, both chapter tasks done.') + '</p></div>';
}
function tsListening() {
  const lv = [['0,85×', '0.85×', L('langsam', 'slow')], ['1,0×', '1.0×', L('normal', 'normal')], ['1,1×', '1.1×', L('schnell', 'fast')]];
  return tsProgNav('listening') + tsTitle(L('Hören', 'Listening'), L('Diktate bei normalem Tempo und Verstehensfragen, letzte 14 Tage.', 'Dictations at normal speed and comprehension questions, last 14 days.')) +
    '<div class="card stack s16"><div class="ts-bign"><b class="disp num">71 %</b><span>' + L('verstanden', 'understood') + '</span></div>' +
    '<div class="ts-lv" role="img" aria-label="' + esc(L('Hörstufe normal, 1,0×', 'Listening level normal, 1.0×')) + '">' + lv.map((x, i) => '<div class="' + (i === 1 ? 'on' : '') + '"><b class="num">' + L(x[0], x[1]) + '</b><span>' + x[2] + '</span></div>').join('') + '</div></div>' +
    '<div class="card">' + tsCurve([58, 60, 63, 62, 65, 67, 69, 71], 50, 80) +
    '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--fg-3)" class="num"><span>' + L('KW 36', 'Wk 36') + '</span><span>' + L('KW 43', 'Wk 43') + '</span></div></div>' +
    '<div class="stack s6"><div class="lbl">' + L('Was oft untergeht', 'What often gets lost') + '</div><p class="p">' + L('Kurze Endungen bei schnellem Sprechen, etwa das -t in <em class="en">sent</em>.', 'Short endings in fast speech, like the -t in <em>sent</em>.') + '</p></div>' +
    '<div class="notice">' + ic('pen', 'sm') + '<span>' + L('Lehrerin am 14.10.: „Versteht Zahlen und Fristen sicher. Bei schnellen Sprechern fehlen noch Endungen.“', 'Teacher on Oct 14: “Understands numbers and deadlines reliably. Still misses endings with fast speakers.”') + '</span></div>' +
    '<p class="p2">' + L('Die Stufe wechselt erst, wenn die Belege es tragen. Das Lehrer-Urteil kommt einmal im Monat.', 'The level only changes when the evidence supports it. The teacher’s verdict comes once a month.') + '</p>';
}
// Oktober 2026: 1.10. ist ein Donnerstag, heute ist Donnerstag, 29.10.
const TS_REST = [4, 11, 18, 25], TS_MISS = [8, 14], TS_EXTRA = [3, 10, 17, 21, 24, 27, 28];
function tsDayInfo(d) {
  const wd = (d + 2) % 7; // 0 = Montag
  const names = S.lang === 'en' ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] : ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  const title = S.lang === 'en' ? names[wd] + ', October ' + d : names[wd] + ', ' + d + '. Oktober';
  let body;
  if (d === 29) body = L('Heute. Die Pflicht läuft noch.', 'Today. Your daily plan is still running.');
  else if (d > 29) body = L('Noch nicht da.', 'Not here yet.');
  else if (TS_REST.indexOf(d) >= 0) body = L('Ruhetag. Er unterbricht die Serie nicht.', 'Rest day. It doesn’t break your streak.');
  else if (TS_MISS.indexOf(d) >= 0) body = L('Keine Pflicht an diesem Tag.', 'No daily plan done that day.');
  else body = L('Pflicht erledigt: Wörter, Grammatik, Hören, Sprechen', 'Daily plan done: words, grammar, listening, speaking') + (TS_EXTRA.indexOf(d) >= 0 ? '<br>' + L('Extra: Tagesartikel gelesen', 'Extra: daily article read') : '');
  return '<div class="card stack s6 ts-dayinfo" id="ts-dayinfo"><b>' + title + '</b><p class="p2">' + body + '</p></div>';
}
function tsHistory() {
  const sel = S.ui.tsDay || 28;
  const heads = S.lang === 'en' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['M', 'D', 'M', 'D', 'F', 'S', 'S'];
  let cells = '';
  for (let k = 0; k < 3; k++) cells += '<span></span>';
  for (let d = 1; d <= 31; d++) {
    const st = d === 29 ? 'today' : d > 29 ? 'future' : TS_REST.indexOf(d) >= 0 ? 'rest' : TS_MISS.indexOf(d) >= 0 ? 'miss' : 'done';
    cells += '<button class="ts-day ' + st + (d === sel ? ' sel' : '') + '" id="ts-d-' + d + '" data-act="day" data-d="' + d + '"' + (d > 29 ? ' disabled' : '') + ' aria-label="' + d + '"><span class="num">' + d + '</span>' + (TS_EXTRA.indexOf(d) >= 0 ? '<i></i>' : '') + '</button>';
  }
  return tsProgNav('history') + tsTitle(L('Verlauf', 'History'), L('Welche Tage du gelernt hast. Ohne Minuten und ohne Punkte.', 'Which days you studied. No minutes, no points.')) +
    '<div class="card stack s16"><div class="ts-month"><button class="iconbtn" id="ts-prev" data-act="noop" aria-label="' + esc(L('September', 'September')) + '">' + ic('chevL', 'sm') + '</button><b>' + L('Oktober 2026', 'October 2026') + '</b><button class="iconbtn" id="ts-next" data-act="noop" aria-label="' + esc(L('November', 'November')) + '" disabled style="opacity:.35">' + ic('chevR', 'sm') + '</button></div>' +
    '<div class="ts-cal">' + heads.map(h => '<span class="ts-ch">' + h + '</span>').join('') + cells + '</div>' +
    '<div class="ts-calleg"><span><i class="done"></i>' + L('Pflicht erledigt', 'Daily plan done') + '</span><span><i class="rest"></i>' + L('Ruhetag', 'Rest day') + '</span><span><i class="ex"></i>' + L('mit Extra', 'with extra') + '</span></div></div>' +
    tsDayInfo(sel) +
    '<div class="row" style="border:0"><span class="ri">' + ic('today', 'sm') + '</span><span class="rt"><b class="num">' + L('12 Tage Serie', '12-day streak') + '</b><span>' + L('Ein Ruhetag pro Woche ist eingeplant und unterbricht nichts.', 'One rest day a week is planned and breaks nothing.') + '</span></span></div>';
}
reg('h34', {
  code: 'H34', name: 'Fortschritt-Details und Verlauf', kind: 'phone',
  variants: [['words', 'Detail Wörter'], ['grammar', 'Detail Grammatik'], ['listening', 'Detail Hören'], ['history', 'Verlauf']],
  render(v) {
    const inner = v === 'grammar' ? tsGrammar() : v === 'listening' ? tsListening() : v === 'history' ? tsHistory() : tsWords();
    return tsPage('h14-main', gearBtn(), inner, 'h14');
  },
  acts: { day(el) { S.ui.tsDay = +el.getAttribute('data-d'); render(); } }
});

/* =========================================================
   H35 Lesen: Kurse und Archiv
   ========================================================= */
const TS_LESSONS = () => [
  [L('Ziel und Grenze festlegen', 'Setting your target and your limit'), 'done'],
  [L('Den ersten Anker setzen', 'Setting the first anchor'), 'done'],
  [L('Zugeständnisse tauschen', 'Trading concessions'), S.tsL3 ? 'done' : 'run'],
  [L('Auf Preis-Einwände antworten', 'Answering price objections'), 'open'],
  [L('Zeit gewinnen', 'Buying time'), 'lock'],
  [L('Pakete statt Rabatte', 'Packages instead of discounts'), 'lock'],
  [L('Heikle Fragen höflich stellen', 'Asking tricky questions politely'), 'lock'],
  [L('Nein sagen, ohne zu blockieren', 'Saying no without shutting down'), 'lock'],
  [L('Die Einigung festhalten', 'Putting the agreement in writing'), 'lock'],
  [L('Nachfassen nach der Verhandlung', 'Following up after the negotiation'), 'lock']
];
function tsCourse() {
  const ls = TS_LESSONS();
  const stTxt = { done: L('fertig', 'done'), run: L('angefangen', 'started'), open: L('offen', 'open'), lock: L('nach Lektion 4', 'after lesson 4') };
  const cur = S.tsL3 ? 3 : 2;
  return '<div class="stack s6"><div class="lbl" style="display:flex;align-items:center;gap:8px">' + L('Kurs', 'Course') + ' ' + tsExtra() + '</div>' +
    '<div class="h2 disp ts-title">' + L('Verhandeln auf Englisch', 'Negotiating in English') + '</div>' +
    '<p class="p2">' + L('10 Lektionen, je 10 bis 12 Minuten: Text, Wendungen, drei Fragen, ein eigener Satz. Zählt als Extra, nicht zur Pflicht.', '10 lessons, 10 to 12 minutes each: text, phrases, three questions, one sentence of your own. Counts as extra, not toward your daily plan.') + '</p></div>' +
    '<div class="bar" style="height:6px" aria-hidden="true">' + ls.map(l => l[1] === 'done' ? '<i class="d" style="flex:1"></i>' : l[1] === 'run' ? '<i style="flex:1"><b style="width:40%"></b></i>' : '<i style="flex:1"></i>').join('') + '</div>' +
    '<div class="card stack s8" style="box-shadow:var(--shadow)"><div class="lbl">' + L('Weiter bei', 'Continue with') + '</div>' +
    '<div class="h2 disp">' + L('Lektion ' + (cur + 1) + ': ', 'Lesson ' + (cur + 1) + ': ') + ls[cur][0] + '</div>' +
    '<p class="p2">' + (cur === 2 ? L('angefangen · etwa 7 Minuten übrig', 'started · about 7 minutes left') : L('offen · etwa 11 Minuten', 'open · about 11 minutes')) + '</p>' +
    '<button class="btn pri full" id="ts-course-go" data-go="h35-lesson" style="margin-top:6px">' + L('Weiter mit Lektion ' + (cur + 1), 'Continue with lesson ' + (cur + 1)) + '</button></div>' +
    '<div class="card" style="padding:4px 16px">' + ls.map((l, i) => '<div class="st ' + (l[1] === 'lock' ? 'open ts-lock' : l[1]) + '" style="min-height:54px"><span class="mk">' + (l[1] === 'done' ? ic('check', 'xs') : l[1] === 'lock' ? ic('lock', 'xs') : '') + '</span><span class="nm" style="display:flex;flex-direction:column"><span style="font-weight:550"><span class="num" style="color:var(--fg-3)">' + (i + 1) + '&nbsp;&nbsp;</span>' + l[0] + '</span><span class="p2" style="font-size:13px">' + stTxt[l[1]] + '</span></span></div>').join('') + '</div>' +
    '<div class="stack s6">' + tsSec(L('Deine anderen Kurse', 'Your other courses')) + '<div>' +
    tsRow('ts-c-ai', 'spark', L('KI im Unternehmen', 'AI in the company'), L('Lektion 2 von 10 · angefangen', 'lesson 2 of 10 · started'), 'act:noop') +
    tsRow('ts-c-cc', 'laptop', 'Claude Code in 10 Tagen', L('Lektion 5 von 10 · angefangen', 'lesson 5 of 10 · started'), 'act:noop') +
    tsRow('ts-c-arch', 'book', L('Ältere Tagesartikel', 'Older daily articles'), L('Archiv aller Artikel', 'archive of all articles'), 'h35-archive') + '</div></div>';
}
const TS_TEXT = [
  ['In a negotiation, every concession should buy you something.', 'In einer Verhandlung sollte dir jedes Zugeständnis etwas einbringen.'],
  ['If you lower your price, ask for something <b>in return</b>: a longer contract, a larger order, or faster payment.', 'Wenn du mit dem Preis heruntergehst, verlange etwas dafür: einen längeren Vertrag, eine größere Bestellung oder schnellere Zahlung.'],
  ['The easiest way to do this is a <b>conditional offer</b>: “If you can <b>commit to</b> two years, we can reduce the price by 5 percent.”', 'Am einfachsten geht das mit einem Angebot unter einer Bedingung: „Wenn Sie sich auf zwei Jahre festlegen, können wir den Preis um 5 Prozent senken.“'],
  ['The other side hears two things at once: you are <b>willing to move</b>, but only if they move too.', 'Die andere Seite hört zwei Dinge zugleich: Du bist bereit, dich zu bewegen, aber nur, wenn sie sich auch bewegt.'],
  ['A common mistake is to offer a discount first and hope for goodwill later.', 'Ein häufiger Fehler: erst einen Rabatt anbieten und dann auf Entgegenkommen hoffen.'],
  ['Experienced buyers will accept the discount and then ask for more.', 'Erfahrene Einkäufer nehmen den Rabatt an und fordern dann mehr.']
];
function tsLesson() {
  const sel = S.ui.tsSent == null ? 1 : S.ui.tsSent;
  const sent = i => '<span class="ts-s' + (i === sel ? ' on' : '') + '" id="ts-s-' + i + '" data-act="sent" data-i="' + i + '" role="button" tabindex="0">' + TS_TEXT[i][0] + '</span>' + (i === sel ? '<span class="ts-pair">' + TS_TEXT[i][1] + '</span>' : '');
  const q = S.ui.tsQ;
  const opts = [L('Etwas dafür verlangen', 'Ask for something in return'), L('Auf Entgegenkommen hoffen', 'Hope for goodwill'), L('Den Rabatt zuerst anbieten', 'Offer the discount first')];
  return '<div class="stack s6"><div class="lbl" style="display:flex;align-items:center;gap:8px">' + L('Lektion 3 von 10 · etwa 11 Min.', 'Lesson 3 of 10 · about 11 min') + ' ' + tsExtra() + '</div>' +
    '<div class="h2 disp ts-title">' + L('Zugeständnisse tauschen', 'Trading concessions') + '</div>' +
    '<p class="p2">' + L('Ziel: Du bietest ein Zugeständnis nur gegen eine Gegenleistung an.', 'Goal: you only offer a concession in exchange for something.') + '</p></div>' +
    '<div class="stack s8"><div class="lbl">' + L('Schlüsselwendungen', 'Key phrases') + '</div><div class="ts-chips en"><span class="chip">in return</span><span class="chip">commit to</span><span class="chip">a conditional offer</span><span class="chip">be willing to move</span></div></div>' +
    '<div class="stack s8"><div class="lbl">' + L('Text · Satz antippen für Deutsch', 'Text · tap a sentence for German') + '</div>' +
    '<article class="ts-art en"><h3 class="disp">Never give a concession for free</h3>' +
    '<p>' + sent(0) + ' ' + sent(1) + '</p><p>' + sent(2) + ' ' + sent(3) + '</p><p>' + sent(4) + ' ' + sent(5) + '</p></article></div>' +
    '<div class="card stack s8"><div class="lbl">' + ic('bulb', 'xs') + ' ' + L('Sprachtipp', 'Language tip') + '</div>' +
    '<p class="p"><b class="en">If you can …, we can …</b></p><p class="p2">' + L('Erst die Bedingung, dann dein Zugeständnis. So hört die andere Seite zuerst, was du dafür willst. Mehr dazu in Kapitel 4.', 'Condition first, then your concession. That way the other side first hears what you want for it. More in chapter 4.') + '</p></div>' +
    '<div class="stack s8"><div class="lbl">' + L('Frage 1 von 3', 'Question 1 of 3') + '</div><p class="p" style="font-weight:550">' + L('Was rät der Text, wenn du den Preis senkst?', 'What does the text advise when you lower your price?') + '</p>' +
    opts.map((o, i) => '<button class="choice' + (q === i ? (i === 0 ? ' ok' : ' sel') : '') + '" id="ts-q-' + i + '" data-act="q" data-i="' + i + '"><span class="n num">' + (i + 1) + '</span>' + o + (q === i && i === 0 ? '<span style="margin-left:auto;color:var(--ok)">' + ic('check', 'sm') + '</span>' : '') + '</button>').join('') +
    (q != null ? '<p class="p2 springopen">' + (q === 0 ? L('Richtig. Jedes Zugeständnis soll dir etwas einbringen.', 'Correct. Every concession should buy you something.') : L('Noch nicht. Der Text sagt: Verlange etwas dafür, sonst fordern Einkäufer nur mehr.', 'Not yet. The text says: ask for something in return, or buyers will just ask for more.')) + '</p>' : '') + '</div>' +
    '<div class="stack s8"><div class="lbl">' + L('Selbst anwenden', 'Use it yourself') + '</div>' +
    '<p class="p2">' + L('Schreib ein Angebot mit <em class="en">If you can …, we can …</em> für deinen Call am Dienstag.', 'Write an offer with <em>If you can …, we can …</em> for your call on Tuesday.') + '</p>' +
    '<div class="field" style="min-height:76px;color:var(--fg-3)">' + L('Dein Satz …', 'Your sentence …') + '</div></div>' +
    '<button class="btn pri full" id="ts-lesson-done" data-act="finish">' + L('Lektion abschließen', 'Finish lesson') + '</button>';
}
const TS_ARCH = () => [
  [L('Diese Woche', 'This week'), [
    [L('Do 29.10.', 'Thu, Oct 29'), 'Shorter supply chains, faster answers', L('heute', 'today'), 'new', 'h13-reader'],
    [L('Mi 28.10.', 'Wed, Oct 28'), 'Why buyers ask for a second quote', L('gelesen', 'read'), 'read'],
    [L('Di 27.10.', 'Tue, Oct 27'), 'The hidden cost of late payments', L('gelesen', 'read'), 'read'],
    [L('Mo 26.10.', 'Mon, Oct 26'), 'Pricing when costs keep rising', L('angefangen', 'started'), 'run']]],
  [L('Letzte Woche', 'Last week'), [
    [L('Fr 23.10.', 'Fri, Oct 23'), 'How procurement teams test AI tools', L('gelesen', 'read'), 'read'],
    [L('Do 22.10.', 'Thu, Oct 22'), 'Small suppliers, big contracts', L('nicht geöffnet', 'not opened'), 'new'],
    [L('Mi 21.10.', 'Wed, Oct 21'), 'When to walk away from a deal', L('gelesen', 'read'), 'read']]]
];
function tsArchive() {
  const f = S.ui.tsF || 0;
  const filters = [L('Alle', 'All'), L('Angefangen', 'Started'), L('Nicht geöffnet', 'Not opened')];
  const keep = a => f === 0 || (f === 1 && a[3] === 'run') || (f === 2 && a[3] === 'new' && !a[4]);
  let n = 0;
  return tsTitle(L('Tagesartikel', 'Daily articles'), L('Jeden Tag ein neuer, erfundener Artikel zu deinem Beruf, etwa 4 Minuten. Freiwillig.', 'A new invented article about your work every day, about 4 minutes. Optional.')) +
    '<label class="field ts-search">' + ic('search', 'sm') + '<input id="ts-a-search" placeholder="' + esc(L('Artikel suchen', 'Search articles')) + '" autocomplete="off"></label>' +
    '<div class="ts-subnav">' + filters.map((x, i) => '<button class="chip' + (i === f ? ' on' : '') + '" id="ts-af-' + i + '" data-act="filter" data-i="' + i + '">' + x + '</button>').join('') + '</div>' +
    TS_ARCH().map(g => {
      const rows = g[1].filter(keep);
      if (!rows.length) return '';
      return '<div class="stack s6"><div class="lbl">' + g[0] + '</div><div>' + rows.map(a => {
        n++;
        const mk = a[3] === 'read' ? '<span class="ts-am read">' + ic('check', 'xs') + '</span>' : a[3] === 'run' ? '<span class="ts-am run"></span>' : '<span class="ts-am"></span>';
        return '<button class="row" id="ts-a-' + n + '" data-go="' + (a[4] || 'h13-reader') + '">' + mk + '<span class="rt"><b class="en">' + a[1] + '</b><span>' + a[0] + ' · ' + a[2] + '</span></span><span class="chev">' + ic('chevR', 'sm') + '</span></button>';
      }).join('') + '</div></div>';
    }).join('') +
    '<div>' + tsRow('ts-a-course', 'list', L('Kurse', 'Courses'), L('Verhandeln auf Englisch · Lektion 3', 'Negotiating in English · lesson 3'), 'h35-course') + '</div>';
}
reg('h35', {
  code: 'H35', name: 'Lesen: Kurse und Archiv', kind: 'phone',
  variants: [['course', 'Kursseite'], ['lesson', 'Lektion'], ['archive', 'Archiv']],
  render(v) {
    if (v === 'lesson') return tsPage('h35-course', askBtn(), tsLesson(), 'h13');
    if (v === 'archive') return tsPage('h13-main', askBtn(), tsArchive(), 'h13');
    return tsPage('h13-main', askBtn(), tsCourse(), 'h13');
  },
  acts: {
    sent(el) { S.ui.tsSent = +el.getAttribute('data-i'); render(); },
    q(el) { S.ui.tsQ = +el.getAttribute('data-i'); render(); },
    filter(el) { S.ui.tsF = +el.getAttribute('data-i'); render(); },
    finish() { S.tsL3 = true; go('h35-course'); }
  }
});

/* =========================================================
   H36 Prüfen (Satz-Klinik, Mail-Werkstatt) im Fragen-Blatt
   ========================================================= */
const TS_PURPOSE = () => [L('Verhandlung', 'Negotiation'), L('Einwand', 'Objection'), L('Status-Update', 'Status update'), L('Kunden-Mail', 'Client email'), L('Präsentation', 'Presentation'), 'Small Talk', L('Eskalation', 'Escalation')];
function tsPurpose(sel) {
  return '<div class="stack s6"><div class="lbl">' + L('Wofür? (freiwillig)', 'What for? (optional)') + '</div><div class="ts-chips">' + TS_PURPOSE().map((p, i) => '<span class="chip' + (i === sel ? ' on' : '') + '">' + p + '</span>').join('') + '</div></div>';
}
const tsMark = (n, t) => '<span class="ts-x">' + t + '<sup class="num">' + n + '</sup></span>';
function tsSpot(n, from, to, why, pat) {
  return '<div class="ts-spot"><span class="ts-sn num">' + n + '</span><div class="stack s6"><div class="en"><s class="ts-no">' + from + '</s> → <b>' + to + '</b></div><p class="p2">' + why + '</p>' + (pat ? '<span class="chip en" style="align-self:flex-start">' + pat + '</span>' : '') + '</div></div>';
}
function tsVerdict(text) {
  return '<div class="verdict" style="color:var(--near);font-size:18px"><span class="vi" style="background:color-mix(in oklch, var(--near) 22%, transparent)">' + ic('near', 'xs') + '</span>' + text + '</div>';
}
function tsClinic() {
  const raw = 'We have received your feedback last week and will send you an answer until Friday.';
  const open = !!S.ui.tsC1;
  return '<div class="stack s16">' +
    '<div class="stack s6"><div class="ts-fl"><span class="lbl">' + L('Dein Satz', 'Your sentence') + '</span><span class="lbl num">' + raw.length + ' / 300</span></div>' +
    '<div class="field ts-mine en">We ' + tsMark(1, 'have received') + ' your feedback last week and will send you an answer ' + tsMark(2, 'until') + ' Friday.</div></div>' +
    tsPurpose(3) +
    tsVerdict(L('Fast richtig · 2 Stellen', 'Almost right · 2 spots')) +
    '<div class="card stack s6"><div class="lbl">' + L('Richtig wäre', 'Correct would be') + '</div><p class="p en" style="font-size:18px;line-height:26px">We <b class="ts-fix">received</b> your feedback last week and will send you an answer <b class="ts-fix">by</b> Friday.</p></div>' +
    '<div>' + tsSpot(1, 'have received', 'received', L('<em class="en">last week</em> ist ein vergangener Zeitpunkt. Dazu passt past simple.', '<em>last week</em> is a past time expression. It goes with the past simple.'), 'past simple + last week') +
    tsSpot(2, 'until Friday', 'by Friday', L('„Bis Freitag“ als Frist heißt <em class="en">by Friday</em>. <em class="en">until</em> heißt: die ganze Zeit bis dahin.', 'A deadline is <em>by Friday</em>. <em>until</em> means: the whole time up to then.'), 'by + deadline') + '</div>' +
    '<button class="ts-tog" id="ts-c1" data-act="c1" aria-expanded="' + open + '"><span>' + L('C1-Fassung', 'C1 version') + '</span>' + ic(open ? 'chevU' : 'chevD', 'sm') + '</button>' +
    (open ? '<div class="card stack s6 springopen"><p class="p en" style="font-size:17px;line-height:25px">Thanks for last week’s feedback. We’ll get back to you by Friday.</p><p class="p2">' + L('Neu: <em class="en">get back to you</em> = sich zurückmelden.', 'New: <em>get back to you</em> = reply later.') + '</p></div>' : '') +
    '<div class="notice">' + ic('info', 'sm') + '<span>' + L('Ton: sachlich und freundlich, passt zu einer Kunden-Mail.', 'Tone: factual and friendly, fits a client email.') + '</span></div>' +
    '<p class="p2">' + L('Die zwei Stellen übst du ab morgen in deiner Wiederholung.', 'You’ll practice the two spots in your reviews from tomorrow.') + '</p>' + tsAi() + '</div>';
}
const TS_MAIL_RAW = 'Hello Mr. Brandt,\nthank you for your email. Unfortunately we have still not received the spare parts. We have ordered them already on October 12. Can you please tell me until when you can deliver?\nMany greetings,';
function tsMail() {
  const added = !!S.ui.tsAdded;
  const areas = [
    [L('Inhalt und Wirkung', 'Content and impact'), L('Klar: was fehlt, seit wann und was du brauchst. Die Bitte steht am Ende, gut so.', 'Clear: what’s missing, since when and what you need. The request comes last, good.')],
    [L('Register', 'Register'), L('<s class="en ts-no">Many greetings</s> ist wörtlich aus „Viele Grüße“. Üblich: <b class="en">Best regards</b>. Mit <b class="en">Could you</b> klingt die Bitte höflicher.', '<s class="ts-no">Many greetings</s> is a literal translation from German. Usual: <b>Best regards</b>. <b>Could you</b> makes the request more polite.')],
    [L('Aufbau', 'Structure'), L('Kurz und in guter Reihenfolge. Nach <em class="en">Hello Mr. Brandt,</em> beginnt die nächste Zeile groß: <b class="en">Thank you</b>.', 'Short and well ordered. After <em>Hello Mr. Brandt,</em> the next line starts with a capital: <b>Thank you</b>.')],
    [L('Sprache', 'Language'), L('<s class="en ts-no">have ordered them already on</s> → <b class="en">ordered them on</b>: vergangener Zeitpunkt, also past simple. <s class="en ts-no">until when</s> → <b class="en">when</b>: „bis wann“ fragst du mit <em class="en">when</em>.', '<s class="ts-no">have ordered them already on</s> → <b>ordered them on</b>: a past point in time, so past simple. <s class="ts-no">until when</s> → <b>when</b>.')]
  ];
  return '<div class="stack s16">' +
    '<div class="stack s6"><div class="ts-fl"><span class="lbl">' + L('Deine Mail', 'Your email') + '</span><span class="lbl num">' + TS_MAIL_RAW.length + ' / 1500</span></div>' +
    '<div class="field ts-mine ts-mail en">Hello Mr. Brandt,<br>' + tsMark(1, 'thank') + ' you for your email. Unfortunately we have still not received the spare parts. We ' + tsMark(2, 'have ordered them already') + ' on October 12. Can you please tell me ' + tsMark(3, 'until when') + ' you can deliver?<br>' + tsMark(4, 'Many greetings') + ',</div></div>' +
    tsVerdict(L('Verständlich · 4 Stellen', 'Clear · 4 spots')) +
    '<div class="ex-list ts-areas">' + areas.map(a => '<div><b>' + a[0] + '</b><span>' + a[1] + '</span></div>').join('') + '</div>' +
    '<div class="card stack s6"><div class="lbl">' + L('Verbesserte Fassung', 'Improved version') + '</div><p class="p en ts-mail">Hello Mr. Brandt,<br><b class="ts-fix">Thank</b> you for your email. Unfortunately, we still haven’t received the spare parts. We <b class="ts-fix">ordered them</b> on October 12.<br><b class="ts-fix">Could you please let me know when we can expect them?</b><br><b class="ts-fix">Best regards</b>,</p></div>' +
    '<div class="stack s8"><div class="lbl">' + L('Neue Wendungen', 'New phrases') + '</div><div class="ts-chips en"><span class="chip">let me know when we can expect them</span><span class="chip">Best regards</span></div></div>' +
    '<p class="p2">' + L('Die Stellen 2 und 3 übst du ab morgen in deiner Wiederholung.', 'You’ll practice spots 2 and 3 in your reviews from tomorrow.') + '</p>' + tsAi() +
    (added ? '<p class="p2 springopen" style="color:var(--ok)">' + L('2 Wendungen sind jetzt in deinen Wörtern.', '2 phrases are now in your words.') + '</p>' : '') + '</div>';
}
reg('h36', {
  code: 'H36', name: 'Prüfen (Satz-Klinik, Mail-Werkstatt)', kind: 'phone',
  variants: [['sentence', 'Satz-Klinik'], ['mail', 'Mail-Werkstatt']],
  render(v) {
    S.typed = null; S.ui.checked = true;
    const under = gramTask({ checked: true, st: 'wrong' });
    const seg = '<div class="seg2 ts-seg3" role="tablist"><button id="ask-claude" data-go="h15-claude" role="tab">Claude</button><button id="ask-trans" data-go="h15-translate" role="tab">' + L('Übersetzen', 'Translate') + '</button><button id="ask-check" data-go="h36-sentence" class="on" role="tab" aria-selected="true">' + L('Prüfen', 'Check') + '</button></div>';
    const sub = '<div class="ts-sub"><button id="ts-k-sent" data-go="h36-sentence" class="' + (v === 'mail' ? '' : 'on') + '">' + L('Satz', 'Sentence') + '</button><button id="ts-k-mail" data-go="h36-mail" class="' + (v === 'mail' ? 'on' : '') + '">' + L('Mail', 'Email') + '</button></div>';
    const body = v === 'mail' ? tsMail() : tsClinic();
    const foot = v === 'mail'
      ? '<div style="display:flex;gap:8px"><button class="btn sec" id="ts-add" data-act="add" style="flex:1">' + (S.ui.tsAdded ? L('Hinzugefügt', 'Added') : L('In die Wörter', 'Add to words')) + '</button><button class="btn pri" id="ts-copy" data-act="copy" style="flex:1">' + (S.ui.tsCopied ? ic('check', 'sm') + L('Kopiert', 'Copied') : L('Kopieren', 'Copy')) + '</button></div>'
      : '<div style="display:flex;gap:8px"><button class="btn sec" id="ts-new" data-act="noop" style="flex:1">' + L('Neuer Satz', 'New sentence') + '</button><button class="btn pri" id="ts-three" data-go="h27-free-round" style="flex:1">' + L('Dazu üben', 'Practice this') + '</button></div>';
    return under + '<div class="scrim" data-go="h4-band"></div><div class="sheet" id="ask-sheet" role="dialog" aria-label="' + esc(L('Fragen', 'Ask')) + '" style="height:88%;max-height:88%"><div class="grab"></div><div class="gx" style="padding-bottom:6px">' + seg + '</div><div class="sb gx"><div class="stack s16">' + sub + body + '</div></div><div class="sf gx">' + foot + '</div></div>';
  },
  acts: {
    c1() { S.ui.tsC1 = !S.ui.tsC1; render(); },
    add() { S.ui.tsAdded = true; render(); },
    copy() { S.ui.tsCopied = true; render(); }
  }
});

/* =========================================================
   H37 So funktioniert's
   ========================================================= */
function tsMiniRing() {
  const segs = dayBlocks('normal'), T = segs.reduce((a, b) => a + b.m, 0), r = 15, C = 2 * Math.PI * r, gap = 2.2;
  let off = 0;
  return '<svg viewBox="0 0 40 40" class="ts-ring" aria-hidden="true">' + segs.map((b, i) => {
    const len = b.m / T * C - gap;
    const s = '<circle cx="20" cy="20" r="' + r + '" fill="none" stroke="' + (i < 3 ? 'var(--act)' : 'var(--surface-3)') + '" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 20 20)"/>';
    off += b.m / T * C;
    return s;
  }).join('') + '</svg>';
}
function tsHow() {
  const items = [
    [tsMiniRing(), L('Der Ring', 'The ring'), L('Er zeigt deine Pflicht von heute: 6 Blöcke, etwa 28 Minuten. Ist er voll, ist der Tag erledigt. Mehr braucht es nicht.', 'It shows today’s plan: 6 blocks, about 28 minutes. When it’s full, the day is done. Nothing more is needed.')],
    [ic('today'), L('Die Serie', 'The streak'), L('Ein Tag zählt, wenn die Pflicht erledigt ist. Ein Ruhetag pro Woche ist eingeplant und unterbricht nichts. Der Tag wechselt um 4 Uhr nachts.', 'A day counts when the plan is done. One rest day a week is planned and breaks nothing. The day changes at 4 a.m.')],
    [ic('speak'), L('Die Mission', 'The mission'), L('Einmal pro Woche ein Gespräch mit Abhakliste, als Teil der Pflicht. Diese Woche am Freitag.', 'Once a week a conversation with a checklist, as part of your plan. This week on Friday.')],
    [ic('flag'), L('Der Meilenstein', 'The milestone'), L('Alle 4 Wochen ein kurzer Test. Er zeigt einen Trend, keine geeichte Note. Aus ihm und deinen Kann-Beschreibungen kommt die C1-Schätzung.', 'A short test every 4 weeks. It shows a trend, not a calibrated grade. Together with your can-do statements it feeds the C1 estimate.')],
    [ic('plus'), L('Pflicht und Extra', 'Plan and extra'), L('Pflicht ist der Ring. Alles unter „Wenn du mehr willst“ ist Extra: gut, wenn du es machst, kein Vorwurf, wenn nicht.', 'The plan is the ring. Everything under “If you want more” is extra: good if you do it, no blame if you don’t.')],
    [ic('check'), L('Wie bewertet wird', 'How you’re assessed'), L('Du bewertest dich nicht selbst, außer im Anki-Modus. Die App urteilt aus Richtigkeit, Zeit und Hilfe. Punkte gibt es keine.', 'You don’t rate yourself, except in Anki mode. The app judges from accuracy, time and help. There are no points.')]
  ];
  return tsTitle(L('So funktioniert’s', 'How it works'), L('Die wichtigsten Regeln der App, in Ruhe erklärt.', 'The app’s key rules, explained calmly.')) +
    '<div class="ts-how">' + items.map((x, i) => '<div class="ts-hi" id="ts-how-' + i + '"><span class="ts-hic">' + x[0] + '</span><div class="stack s6"><b>' + x[1] + '</b><p class="p2">' + x[2] + '</p></div></div>').join('') + '</div>' +
    '<div>' + tsRow('ts-how-stages', 'words', L('Wie ein Wort wandert', 'How a word moves along'), L('die Stufen S0 bis S5', 'stages S0 to S5'), 'h37-stages') +
    tsRow('ts-how-prog', 'prog', L('Dein Fortschritt im Detail', 'Your progress in detail'), L('Wörter, Grammatik, Hören, Verlauf', 'words, grammar, listening, history'), 'h34-words') + '</div>';
}
function tsStages() {
  const st = [
    ['S0', L('Neu', 'New'), L('Du lernst das Wort kennen: Bedeutung, Ton, ein Satz aus dem Thema.', 'You meet the word: meaning, sound, a sentence from the topic.'), L('weiter, sobald du die Karte gesehen hast', 'moves on once you’ve seen the card')],
    ['S1', L('Tag 0', 'Day 0'), L('Am selben Tag zweimal frei abrufen, beim ersten Mal mit Anfangsbuchstaben.', 'Recall it freely twice on the same day, the first time with its first letter.'), L('weiter, wenn der zweite Abruf ohne Hilfe sitzt', 'moves on when the second recall works without help')],
    ['S2', L('Im Aufbau', 'Building'), L('Frei tippen, im neuen Satz oder ganz ohne Satz.', 'Type it freely, in a new sentence or with no sentence at all.'), L('weiter nach 2 späteren Tagen frei richtig, einer davon ohne Satz', 'moves on after 2 later days of free recall, one of them without a sentence')],
    ['S3', L('Anwenden', 'Using it'), L('Wortpartner, Umformen, Übersetzen, Sprechen. Hier schreibst du eigene Sätze.', 'Collocations, rephrasing, translating, speaking. Here you write your own sentences.'), L('weiter nach 3 freien Tagen über mindestens eine Woche und einem richtigen eigenen Satz', 'moves on after 3 free days over at least a week and one correct sentence of your own')],
    ['S4', L('Sicher', 'Solid'), L('Gemischte Aufgaben, manchmal mit sanftem Zeitdruck.', 'Mixed tasks, sometimes with gentle time pressure.'), L('weiter, wenn es nach mindestens 21 Tagen Pause frei sitzt', 'moves on when it still works after at least 21 days without practice')],
    ['S5', L('Fest', 'Solid for good'), L('Du bildest das Wort selbst. Es kommt nur noch selten, damit es bleibt.', 'You produce the word yourself. It only comes back now and then so it stays.'), '']
  ];
  const groups = [[0, 3, L('erkennst du', 'you recognize')], [3, 5, L('auf dem Weg', 'on the way')], [5, 6, L('bildest du selbst', 'you produce')]];
  return tsTitle(L('Wie ein Wort wandert', 'How a word moves along'), L('Sechs Stufen vom ersten Sehen bis „bildest du selbst“. Gezählt wird nur, was du frei abrufst.', 'Six stages from first sight to “you produce”. Only free recall counts.')) +
    groups.map(g => '<div class="stack s6"><div class="lbl">' + g[2] + '</div><div class="card ts-stages">' + st.slice(g[0], g[1]).map(s => '<div class="ts-stg"><span class="stagepill' + (s[0] === 'S5' ? ' s5' : '') + '">' + s[0] + '</span><div class="stack s6"><b>' + s[1] + '</b><p class="p2">' + s[2] + '</p>' + (s[3] ? '<p class="ts-next">' + ic('arrowR', 'xs') + s[3] + '</p>' : '') + '</div></div>').join('') + '</div></div>').join('') +
    '<div class="card stack s8"><div class="lbl">' + L('Wenn ein Wort wackelt', 'When a word slips') + '</div>' +
    '<p class="p2">' + L('Ein Fehler beim freien Abruf setzt das Wort eine Stufe zurück, nie unter S2. „Weiß ich nicht“ genauso, ohne Fehlerton.', 'A mistake in free recall moves the word back one stage, never below S2. “Don’t know” does the same, without an error sound.') + '</p>' +
    '<p class="p2">' + L('Zwei Fehler in 30 Tagen oder vier insgesamt: Das Wort kommt in die Wort-Werkstatt, bekommt eine neue Darstellung, ruht 2 Tage und startet neu in S2. Ab sechs Fehlern kannst du es vorerst pausieren.', 'Two mistakes in 30 days or four in total: the word goes to the word workshop, gets a fresh look, rests for 2 days and restarts at S2. From six mistakes you can pause it for now.') + '</p>' +
    '<button class="link" id="ts-st-ws" data-go="h33-workshop" style="font-size:14px">' + L('Wort-Werkstatt ansehen', 'See the word workshop') + '</button></div>' +
    '<p class="quote">' + L('Frei abrufen fühlt sich schwerer an als Auswählen. Genau das macht es wirksam.', 'Free recall feels harder than choosing. That is exactly what makes it work.') + '</p>';
}
reg('h37', {
  code: 'H37', name: 'So funktioniert’s', kind: 'phone',
  variants: [['overview', 'Übersicht'], ['stages', 'Stufen S0–S5']],
  render(v) {
    if (v === 'stages') return tsPage('h37-overview', gearBtn(), tsStages(), 'h14');
    return tsPage('h14-main', gearBtn(), tsHow(), 'h14');
  }
});
