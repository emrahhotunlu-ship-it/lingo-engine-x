/* Lingo Vorschau · Handy-Bildschirme H1–H16, Termin, Wochenfrage.
   Inhalte: Kapitel 1 „Zeiten im Projektverlauf“ (past simple vs. present perfect), Welt: Vertrieb, Einkauf, Preis-Einwand.
   Alle Personen und Firmen sind erfunden. */

/* ---------- Gemeinsame Inhalte ---------- */
const WORD = {
  right: 'lead time',
  you: { ok: 'lead time', typo: 'lead tme', wrong: 'delivery', idk: '' },
  get why() {
    return {
      ok: L('lead time ist im Einkauf die Zeit von der Bestellung bis zur Lieferung.', 'In purchasing, lead time is the time from order to delivery.'),
      typo: L('Ein Buchstabe fehlt. Das Wort sitzt, achte auf die Schreibung: t-i-m-e.', 'One letter is missing. You know the word, watch the spelling: t-i-m-e.'),
      wrong: L('delivery ist die Lieferung selbst. Die Dauer bis dahin heißt lead time.', 'delivery is the delivery itself. The time it takes is the lead time.'),
      idk: L('lead time = Lieferzeit, also die Dauer von der Bestellung bis zur Lieferung.', 'lead time = the time from order to delivery.')
    };
  }
};
const WHY_GRAM = () => L('Ein vergangener Zeitpunkt wie yesterday oder last week verlangt past simple. Present perfect passt hier nicht.',
  'A past time expression like yesterday or last week needs the past simple. The present perfect doesn’t fit here.');
const GRAM = {
  right: 'sent',
  /* Lehrer M1: andere Zeitform oder falsche Verbform ist ein Fehler, kein Tippfehler. */
  wrongForms: ['send', 'sends', 'sended', 'have sent', 'has sent'],
  you: { ok: 'sent', typo: 'snet', wrong: 'have sent', idk: '' },
  get why() { const w = WHY_GRAM(); return { ok: w, typo: w, wrong: w, idk: w }; }
};
const typedFor = (data, st) => data.you[st];
/* Auch richtig (Lehrer-Gegenlesung L-10, L-11): andere Formen zählen als richtig, mit eigener Warum-Zeile. */
const ALSO = {
  recall: () => ({ 'delivery time': L('Richtig. Im Einkauf ist <em class="en">lead time</em> das Standardwort.', 'Correct. In purchasing, <em>lead time</em> is the standard word.') }),
  gap: () => { const t = L('Auch richtig. Im Einkauf hörst du meist <em class="en">lead time</em>.', 'Also correct. In purchasing you usually hear <em>lead time</em>.'); return { 'delivery time': t, 'turnaround time': t }; }
};
function wordData(kind) {
  const m = ALSO[kind]();
  const t = (S.typed || '').trim().toLowerCase();
  const d = Object.assign({}, WORD, { alts: Object.keys(m), why: Object.assign({}, WORD.why) });
  if (S.ui.ownInput && m[t]) d.why.ok = m[t];
  return d;
}
function curSt(data) {
  if (S.typed != null && S.ui.ownInput) return judge(S.typed, data.right, data.alts, data.wrongForms);
  return S.demo;
}
function words(str) {
  return str.split(' ').map(w => '<span class="w">' + esc(w) + '</span>').join(' ');
}
const NORMAL = () => dayBlocks('normal');
const MISSION = () => dayBlocks('mission');

function menuHtml(opts) {
  opts = opts || {};
  return '<div class="scrim" data-act="closesheet" style="background:transparent"></div><div class="menu" id="ex-menu" role="menu">' +
    '<button id="m-claude" data-go="h15-claude" role="menuitem">' + ic('claude', 'sm') + L('Claude fragen', 'Ask Claude') + '</button>' +
    '<button id="m-trans" data-go="h15-translate" role="menuitem">' + ic('trans', 'sm') + L('Übersetzer', 'Translator') + '</button>' +
    '<button id="m-howto" data-go="h8-guide" role="menuitem">' + ic('mic', 'sm') + L('So sprichst du', 'How to speak') + '</button>' +
    '<button id="m-whytask" data-act="whysheet" role="menuitem">' + ic('info', 'sm') + L('Warum diese Aufgabe?', 'Why this task?') + '</button>' +
    (opts.checked ? '<button id="m-explain" data-go="h15-claude" role="menuitem">' + ic('bulb', 'sm') + L('Erklär mir meine Antwort', 'Explain my answer') + '</button>' : '') +
    (opts.easy ? '<button id="m-easy" data-act="tooeasy" data-w="' + opts.easy + '" role="menuitem">' + ic('check', 'sm') + L('Zu leicht · kenne ich längst', 'Too easy · I’ve known this for ages') + '</button>' : '') +
    (opts.pause ? '<hr><button id="m-pause" data-go="h1-mid" role="menuitem">' + ic('clock', 'sm') + L('Pause, später weiter', 'Pause, continue later') + '</button>' : '') +
    '<hr><button id="m-report" data-act="report" role="menuitem">' + ic('flag', 'sm') + L('Problem melden', 'Report a problem') + '</button></div>';
}
/* E8: „Zu leicht“ nimmt das Wort aus dem Lernen und prüft es nur noch selten, mit Rückgängig. */
ACTS.tooeasy = el => toast(L('<em class="en">' + el.getAttribute('data-w') + '</em>: kenne ich längst · nur noch eine Kontrolle in 30 Tagen', '<em>' + el.getAttribute('data-w') + '</em>: known for ages · just one check in 30 days'));
function whySheet(text) {
  return sheet('why-sheet', L('Warum diese Aufgabe?', 'Why this task?'), '<p class="p">' + text + '</p>',
    '<button class="btn pri full" id="why-ok" data-act="closesheet">' + L('Weiter', 'Continue') + '</button>');
}
function overlays(o) {
  let s = '';
  if (S.ui.menu) s += menuHtml(o);
  if (S.ui.sheet === 'why') s += whySheet(o.whyTask || '');
  return s;
}
function exFoot(btns, above) { return '<div class="ex-foot gx' + (above ? ' abovekb' : '') + '">' + btns + '</div>'; }
const btnPri = (id, label, go, extra) => '<button class="btn pri" id="' + id + '"' + (go ? ' data-go="' + go + '"' : '') + (extra || '') + '>' + label + '</button>';
const btnSec = (id, label, attr) => '<button class="btn sec" id="' + id + '" ' + (attr || '') + '>' + label + '</button>';

/* =========================================================
   H1 Heute
   ========================================================= */
/* today: Index des heutigen Tags (Mo = 0). Vorschau-Standard ist Donnerstag; Missionstag Freitag, Wochenabschluss Samstag. */
function weekStrip(todayDone, today) {
  if (today == null) today = 3;
  const names = S.lang === 'en' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['M', 'D', 'M', 'D', 'F', 'S', 'S'];
  const st = [0, 1, 2, 3, 4, 5, 6].map(i => i === 6 ? 'rest' : i < today ? 'done' : i === today ? (todayDone ? 'done today' : 'today') : '');
  return '<div class="gx"><div class="week" aria-label="' + esc(L('Diese Woche', 'This week')) + '">' + names.map((n, i) =>
    '<div class="wd ' + st[i] + '"><i>' + (st[i].indexOf('done') >= 0 ? ic('check', 'xs') : '') + '</i>' + n + '</div>').join('') +
    '<div class="streak"><b class="disp num">14</b>' + L('Tage Serie', 'day streak') + '</div></div></div>';
}
/* „Wenn du mehr willst“: höchstens 3 Zeilen. Der Vokabeltrainer steht nur nach erledigter Pflicht dort, dann an erster Stelle
   und verdrängt „Kurse“ (Vokabeltrainer §1). trainer: 'due' | 'resume' | null. Ohne Angabe gilt L1 „erledigt“ als nach der Pflicht. */
function moreRows(missionDay, trainer) {
  if (trainer === undefined) trainer = (S.screen === 'l1' && curVariant() === 'done') ? 'due' : null;
  const rows = [];
  if (trainer === 'resume') rows.push(['repeat', L('Runde fortsetzen', 'Resume round'), L('6 von 10 · zählt als Extra', '6 of 10 · counts as extra'), 'h18-speak']);
  else if (trainer === 'due') rows.push(['words', L('Wörter üben', 'Practice words'), L('14 fällig, zählt als Extra', '14 due, counts as extra'), 'h17-default']);
  rows.push(['book', L('Lesen', 'Reading'), L('Lieferketten unter Druck · 4 Min.', 'Daily article: supply chains under pressure · 4 min'), 'h13-reader']);
  rows.push(['pen', L('Wort-Werkstatt', 'Word workshop'), L('5 Wörter brauchen eine neue Darstellung', '5 words need a fresh look'), 'h33-workshop']);
  if (!trainer) rows.push(['list', L('Kurse', 'Courses'), L('Verhandeln auf Englisch · Lektion 3', 'Negotiating in English · lesson 3'), 'h35-course']);
  return '<div class="more-div gx">' + L('Wenn du mehr willst', 'If you want more') + '</div><div class="gx">' + rows.map((r, i) =>
    '<button class="row" id="more-' + i + '" data-go="' + r[3] + '"><span class="ri">' + ic(r[0], 'sm') + '</span><span class="rt"><b>' + r[1] + '</b><span>' + r[2] + '</span></span><span class="chev">' + ic('chevR', 'sm') + '</span></button>').join('') +
    '<div style="display:flex;justify-content:flex-end"><button class="link" id="more-all" data-go="h33-list" style="font-size:14px">' + L('Alles anzeigen', 'Show all') + '</button></div></div>';
}
function h1(v) {
  if (v === 'skeleton') {
    return '<div class="scroll">' + '<header class="phead gx"><div class="sk" style="width:110px;height:30px"></div></header>' +
      '<div class="gx"><div class="daycard" style="align-items:center"><div class="sk" style="width:188px;height:188px;border-radius:50%"></div>' +
      '<div class="sk" style="width:72%;height:22px"></div><div class="sk" style="width:54%;height:16px"></div><div class="sk" style="width:100%;height:52px;border-radius:14px"></div></div></div>' +
      '<div class="gx" style="padding-top:22px;display:flex;gap:10px">' + '<div class="sk" style="flex:1;height:44px"></div>'.repeat(3) + '</div></div>' + tabbar('h1');
  }
  const kind = v === 'first' ? 'placement' : (v === 'mission' || v === 'termin') ? 'mission' : (v === 'catchup' || v === 'writing' || v === 'test' || v === 'review') ? v : 'normal';
  let blocks = dayBlocks(kind);
  /* Kurzer Tag: Pflicht anteilig gekürzt (Konzept 2.4, Kai E2). Lange Pause: ruhiger Neustart. Urlaub: vorher leicht vorgezogen. */
  if (v === 'short') blocks = blocks.map((b, i) => Object.assign({}, b, { m: [2, 3, 3, 2, 2, 2][i] }));
  if (v === 'pause') blocks = blocks.slice(0, 5).map((b, i) => Object.assign({}, b, { m: [3, 5, 3, 2, 2][i] }));
  if (v === 'vacation') blocks = blocks.map((b, i) => Object.assign({}, b, { m: [3, 10, 5, 4, 4, 5][i] }));
  const isDone = v === 'done' || v === 'resume';
  if (isDone) v = 'done';
  const total = blocks.reduce((a, b) => a + b.m, 0);
  let done = 0, partial = 0;
  if (v === 'mid' || v === 'ring') { done = 2; partial = 0.4; }
  if (v === 'writing') done = 4;
  if (v === 'test') done = 2;
  if (v === 'review') { done = 4; partial = 0.9; }
  if (v === 'done') done = blocks.length;
  const used = blocks.slice(0, done).reduce((a, b) => a + b.m, 0) + (blocks[done] ? blocks[done].m * partial : 0);
  const rem = Math.round(total - used);
  const showList = v === 'ring' || S.ui.ring;
  const draw = S.drawOnce; S.drawOnce = false;
  const center = v === 'done'
    ? '<div class="ringc"><span style="color:var(--act-text)">' + ic('check') + '</span><b class="disp num" style="font-size:34px;line-height:40px">' + total + ' Min.</b><span>' + L('geschafft', 'done') + '</span></div>'
    : '<div class="ringc"><b class="disp num">' + rem + '</b><span>' + (done || partial ? L('Min. übrig', 'min left') : L('Min. heute', 'min today')) + '</span></div>';
  let sub = '';
  if (kind === 'catchup') sub = '<div class="sub">' + L('noch 3 Tage Aufholen, danach normal', '3 more catch-up days, then back to normal') + '</div>';
  if (v === 'mission') sub = '<div class="sub">' + L('Heute mit Mission: <em>Rückruf zum Angebot</em>', 'Today with mission: <em>follow-up call on the quote</em>') + '</div>';
  if (v === 'termin') sub = '<div class="sub">' + L('Heute mit Mission: <em>dein Call mit dem Einkauf</em>', 'Today with mission: <em>your call with purchasing</em>') + '</div>';
  if (v === 'done') sub = '<div class="sub">' + L('Pflicht geschafft. Morgen geht es mit Schritt 4 von 7 weiter.', 'Daily plan done. Tomorrow continues with step 4 of 7.') + '</div>';
  if (v === 'short') sub = '<div class="sub">' + L('Kurzer Tag: 14 statt 28 Min. Die Serie zählt.', 'Short day: 14 instead of 28 min. Your streak counts.') + '</div>';
  if (v === 'pause') sub = '<div class="sub">' + L('Willkommen zurück. Wir starten ruhig und steigern in 5 Lerntagen auf deine 28 Min.', 'Welcome back. We start gently and build up to your 28 min over 5 learning days.') + '</div>';
  if (v === 'first') sub = '<div class="sub">' + L('Heute Sitzung 1, morgen Sitzung 2. Danach beginnt dein Plan.', 'Session 1 today, session 2 tomorrow. Then your plan begins.') + '</div>';
  if (v === 'day1') sub = '<div class="sub">' + L('Erster Tag mit deinem Plan: Kapitel 1 beginnt.', 'First day with your plan: chapter 1 begins.') + '</div>';
  if (v === 'writing') sub = '<div class="sub">' + L('Schreibtag: heute schreibst du deine Wochen-Mail.', 'Writing day: today you write your weekly email.') + '</div>';
  if (v === 'test') sub = '<div class="sub">' + L('Testtag: Thema 1 ist reif für den Test.', 'Test day: topic 1 is ready for its test.') + '</div>';
  if (v === 'review') sub = '<div class="sub">' + L('Wochenabschluss: dein Rückblick auf die Woche.', 'Week review: a look back at your week.') + '</div>';
  if (v === 'vacation') sub = '<div class="sub">' + L('Vor dem Urlaub: ein paar Wiederholungen leicht vorgezogen.', 'Before your vacation: a few reviews moved slightly forward.') + '</div>';
  let next = '', btn = '', extra = '';
  if (v !== 'done') {
    if (v === 'writing') next = '<div class="nextl"><span class="dot s"></span><span>' + L('Als Nächstes: Wochen-Mail · <em>Projekt-Update an den Einkauf</em>', 'Next: weekly email · <em>project update to purchasing</em>') + '</span></div>';
    else if (v === 'test') next = '<div class="nextl"><span class="dot g"></span><span>' + L('Als Nächstes: Themen-Test · <em>past simple vs. present perfect</em>', 'Next: topic test · <em>past simple vs. present perfect</em>') + '</span></div>';
    else if (v === 'review') next = '<div class="nextl"><span class="dot s"></span><span>' + L('Zum Schluss: Wochenfrage, dann dein Wochenbericht', 'Last step: week question, then your weekly report') + '</span></div>';
    else if (v === 'first') next = '<div class="nextl"><span class="dot g"></span><span>' + L('Als Nächstes: Einstufung · <em>Grammatik, passt sich an</em>', 'Next: placement · <em>grammar, adaptive</em>') + '</span></div>';
    else if (done === 0) next = '<div class="nextl"><span class="dot w"></span><span>' + L('Als Nächstes: Gestern-Check · <em>6 Wörter</em>', 'Next: yesterday check · <em>6 words</em>') + '</span></div>';
    else next = '<div class="nextl"><span class="dot g"></span><span>' + L('Als Nächstes: Grammatik · <em>past simple vs. present perfect</em>', 'Next: grammar · <em>past simple vs. present perfect</em>') + '</span></div>';
    btn = done === 0 ? btnPri('today-go', L('Los geht’s', 'Let’s go'), 'h2-intro', ' style="width:100%"') : btnPri('today-go', L('Weiter', 'Continue'), 'h4-task', ' style="width:100%"');
    if (v === 'writing') btn = btnPri('today-go', L('Weiter', 'Continue'), 'h32-task', ' style="width:100%"');
    if (v === 'first') btn = btnPri('today-go', L('Los geht’s', 'Let’s go'), 'h25-welcome', ' style="width:100%"');
    if (v === 'test') btn = btnPri('today-go', L('Test starten', 'Start test'), 'h31-passed', ' style="width:100%"');
    if (v === 'review') btn = btnPri('today-go', L('Weiter', 'Continue'), 'woche-ask', ' style="width:100%"');
    /* Kai E2: leiser Weg zum kurzen Tag direkt unter dem Knopf, nur vor dem ersten Block. */
    if (v === 'start') extra = '<button class="tw-quiet" id="today-short" data-go="h1-short">' + L('Heute wenig Zeit?', 'Short on time today?') + '</button>';
    if (v === 'short') extra = '<button class="tw-quiet" id="today-full" data-go="h1-start">' + L('Doch den ganzen Plan', 'Do the full plan after all') + '</button>';
  }
  let strip = weekStrip(v === 'done', kind === 'mission' ? 4 : kind === 'review' ? 5 : 3);
  /* Erster Start nach dem Umstieg: ruhiger Hinweis unter der Tageskarte, kein zweiter Hauptknopf. */
  if (v === 'pause') strip = '<div class="gx"><div class="tw-restart"><div class="tw-rs-h">' + L('Neustart-Woche', 'Restart week') + '<span>' + L('nichts geht verloren, deine Wörter warten', 'nothing is lost, your words are waiting') + '</span></div><div class="tw-rs-row" style="grid-template-columns:repeat(6,1fr)">' +
    [[L('Do', 'Thu'), 15, 'on'], [L('Fr', 'Fri'), 18, ''], [L('Sa', 'Sat'), 22, ''], [L('So', 'Sun'), 0, 'rest'], [L('Mo', 'Mon'), 25, ''], [L('Di', 'Tue'), 28, '']].map(d => '<div class="tw-rs-d ' + d[2] + '"><i style="height:' + Math.round(d[1] / 28 * 100) + '%"></i><b class="num">' + (d[1] || L('Ruhetag', 'rest')) + '</b><span>' + d[0] + '</span></div>').join('') + '</div></div></div>';
  if (v === 'vacation') strip = '<div class="gx"><div class="notice tw-notice">' + ic('cal', 'sm') + '<span>' + L('<b>Urlaub 2.–6.11.</b> Deine Serie ruht in der Zeit. Bis Sonntag ziehen wir Wiederholungen leicht vor, damit danach nichts drängt.', '<b>Vacation Nov 2–6.</b> Your streak rests during that time. Until Sunday we move reviews slightly forward so nothing piles up afterward.') + '</span></div></div>' + strip;
  const stateList = '<div class="statelist springopen" id="ring-list" aria-label="' + esc(L('Blöcke von heute', 'Today’s blocks')) + '">' + blocks.map((b, i) => {
    const st = i < done ? 'done' : (i === done && partial ? 'run' : 'open');
    return '<div class="st ' + st + '"><span class="mk">' + (st === 'done' ? ic('check', 'xs') : '') + '</span><span class="dot ' + b.c + '"></span><span class="nm">' + b.n + (b.mission ? ' · ' + MISSION_NAME() : '') + '</span><span class="sm num">' + (st === 'run' ? L('läuft', 'in progress') : b.m + ' Min.') + '</span></div>';
  }).join('') + '</div>';
  return '<div class="scroll">' + phead(L('Heute', 'Today'), askBtn()) +
    '<div class="gx"><div class="daycard">' +
    '<div class="ringwrap">' + ringSvg(blocks, done, partial, { draw }) + center + '</div>' +
    (showList ? stateList : '<div class="dtopic"><div class="t disp">' + (v === 'first' ? L('Einstufung 1 von 2', 'Placement 1 of 2') : TOPIC()) + '</div>' + sub + '</div>' + next) +
    btn + extra + '</div></div>' +
    strip + moreRows(kind === 'mission', isDone ? (S.v === 'resume' ? 'resume' : 'due') : null) + '<div style="height:20px"></div></div>' + tabbar('h1');
}
reg('h1', {
  code: 'H1', name: 'Heute', kind: 'phone',
  variants: [['start', 'Tagesanfang'], ['mid', 'unterwegs'], ['ring', 'Ring angetippt'], ['done', 'erledigt'], ['catchup', 'Aufholen'], ['mission', 'Missionstag'], ['termin', 'Missionstag mit Termin'], ['skeleton', 'Lade-Skelett'], ['resume', 'Runde fortsetzen'], ['pause', 'nach langer Pause'], ['vacation', 'Urlaub angekündigt'], ['short', 'Heute wenig Zeit'], ['writing', 'Schreibtag (Do)'], ['test', 'Testtag'], ['review', 'Wochenabschluss (Sa)'], ['first', 'erster Start nach dem Umstieg'], ['day1', 'erster Lerntag nach der Einstufung']],
  render: h1
});

/* =========================================================
   H2 Wörter-Block
   ========================================================= */
function h2(v) {
  const blocks = NORMAL();
  const fr = { intro: 0.15, type: 0.35, gap: 0.6, band: 0.6, more: 0.6, menu: 0.6, word: 0.6 }[v] || 0.5;
  const top = exTop(blocks, 1, fr);
  const bl = blockLine('w', L('Wörter · ', 'Words · ') + TOPIC());
  const whyTask = H2_WHY();
  if (v === 'intro') {
    return top + '<div class="ex-body gx">' + bl + instr(L('Neues Wort. Hör es dir an und lies den Satz.', 'New word. Listen and read the sentence.')) +
      '<div class="stagec" style="justify-content:center;gap:18px">' +
      '<div class="stack s6"><div style="display:flex;align-items:center;gap:12px"><div class="prompt disp en" style="font-size:40px;line-height:46px">quote</div>' +
      '<button class="iconbtn" id="say-quote" data-act="noop" aria-label="' + esc(L('Anhören', 'Listen')) + '" style="margin:0;background:var(--surface-2)">' + ic('speaker', 'sm') + '</button></div>' +
      '<div class="p2 en">/kwoʊt/ · ' + L('Nomen', 'noun') + '</div></div>' +
      '<div class="disp" style="font-size:26px;line-height:32px;font-weight:600">' + L('das Preisangebot', 'price quote') + '</div>' +
      '<div class="card stack s8"><div class="lbl">' + L('Ursprungssatz', 'Source sentence') + '</div><div class="sent en" style="font-size:19px;line-height:28px">' + words('We sent the') + ' <b style="font-weight:650">quote</b> ' + words('on Monday.') + '</div>' +
      '<div class="hr"></div><div class="lbl">' + L('Wortpartner', 'Collocations') + '</div><div class="p en">send · revise · accept a quote</div></div>' +
      '<div class="notice">' + ic('info', 'sm') + '<span>' + L('Für ein schriftliches Preisangebot sagt man meist <em class="en">a quote</em>. <em class="en">An offer</em> ist allgemeiner.', 'For a written price quote, people usually say <em>a quote</em>. <em>An offer</em> is more general.') + '</span></div>' +
      '</div></div>' + exFoot(btnPri('intro-next', L('Weiter', 'Continue'), 'h2-type')) + overlays({ whyTask, easy: 'quote' });
  }
  if (v === 'type') {
    const checked = S.ui.checked;
    const D = wordData('recall');
    const st = checked ? curSt(D) : null;
    const shown = checked ? (st === 'idk' ? WORD.right : (S.typed && S.ui.ownInput ? S.typed : WORD.you[st])) : (S.typed || '');
    return top + '<div class="ex-body gx' + (checked ? ' with-band' : '') + '">' + bl + instr(L('Wie heißt das auf Englisch?', 'What is this in English?')) +
      '<div class="stagec"><div class="prompt disp">' + L('die Lieferzeit', 'die Lieferzeit') + '</div><div class="hintline">' + L('im Einkauf · 2 Wörter', 'in purchasing · 2 words') + '</div>' +
      '<div style="padding-top:8px">' + gapHtml(shown, { big: true, caret: !checked, input: !checked, st: checked ? ({ ok: 'ok', typo: 'near', wrong: 'bad', idk: 'idk' }[st]) : '' }) + '</div></div></div>' +
      (checked ? band(st, Object.assign({}, D, { you: Object.assign({}, WORD.you, S.typed ? { [st]: esc(S.typed) } : {}) }), { next: 'h2-gap' }) :
        exFoot(btnSec('hint', L('Tipp', 'Hint'), 'data-act="tip"') + btnSec('idk', L('Weiß ich nicht', 'Don’t know'), 'data-act="idk"') + btnPri('check', L('Prüfen', 'Check'), '', ' data-act="check"'), true) + drawnKbd({ go: 'go' })) +
      overlays({ whyTask, checked, easy: 'lead time' });
  }
  // gap / band / also / more / menu / word: Lückensatz
  if (v === 'also') { S.typed = 'delivery time'; S.ui.ownInput = true; S.ui.checked = true; }
  const checked = v === 'band' || v === 'more' || S.ui.checked;
  const D = wordData('gap');
  const st = checked ? curSt(D) : null;
  const shown = checked ? (st === 'idk' ? WORD.right : (S.typed && S.ui.ownInput ? S.typed : WORD.you[st])) : (S.typed || '');
  const gapSt = checked ? ({ ok: 'ok', typo: 'near', wrong: 'bad', idk: 'idk' }[st]) : '';
  let s = top + '<div class="ex-body gx' + (checked ? ' with-band' : '') + '">' + bl + instr(L('Setz das fehlende Wort ein.', 'Fill in the missing word.')) +
    '<div class="stagec"><div class="sent en" id="sent">' + words('Can you') + ' <span class="w' + (v === 'word' ? ' sel' : '') + '" data-go="h2-word">reduce</span> ' + words('the') + ' ' +
    gapHtml(shown, { caret: !checked, input: !checked, st: gapSt }) + ' ' + words('to four weeks?') + '</div>' +
    '<div class="hintline">' + L('Gesucht: Lieferzeit', 'Wanted: Lieferzeit') + '</div></div></div>';
  if (checked) s += band(st, Object.assign({}, D, { you: Object.assign({}, WORD.you, S.typed && S.ui.ownInput ? { [st]: esc(S.typed) } : {}) }), { next: 'h3-before' });
  else s += exFoot(btnSec('hint', L('Tipp', 'Hint'), 'data-act="tip"') + btnSec('idk', L('Weiß ich nicht', 'Don’t know'), 'data-act="idk"') + btnPri('check', L('Prüfen', 'Check'), '', ' data-act="check"'), true) + drawnKbd({ go: 'go' });
  if (v === 'more' || S.ui.sheet === 'more') s += moreWordSheet();
  if (v === 'word') s += wordPopup();
  if (v === 'menu' && S.ui.menu == null) S.ui.menu = true;
  s += overlays({ whyTask, checked, easy: 'lead time' });
  return s;
}
function moreWordSheet() {
  return sheet('more-sheet', L('Mehr zu lead time', 'More about lead time'),
    '<div class="stack s16"><div class="stack s6"><div class="lbl">' + L('Bedeutung', 'Meaning') + '</div><p class="p">' + L('Die Zeit zwischen Bestellung und Lieferung. Im Einkauf das Standardwort, oft in Wochen angegeben.', 'The time between order and delivery. The standard word in purchasing, usually given in weeks.') + '</p></div>' +
    '<div class="stack s6"><div class="lbl">' + L('Dieser Satz auf Deutsch', 'This sentence in German') + '</div><div class="tw-trans"><b class="en">Can you reduce the lead time to four weeks?</b><span>Können Sie die Lieferzeit auf vier Wochen verkürzen?</span></div></div>' +
    '<div class="stack s6"><div class="lbl">' + L('Eselsbrücke', 'Memory hook') + '</div><div class="tw-hook">' + ic('bulb', 'sm') + '<p class="p">' + L('<em class="en">to lead</em> heißt vorangehen: die <em class="en">lead time</em> ist die Zeit, die der Lieferung vorausgeht.', '<em>to lead</em> means to go ahead: the <em>lead time</em> is the time that goes ahead of the delivery.') + '</p></div></div>' +
    '<div class="stack s6"><div class="lbl">' + L('Beispiele', 'Examples') + '</div><div class="ex-list en"><div><b>Our standard lead time is ten weeks.</b><span>' + L('Unsere normale Lieferzeit beträgt zehn Wochen.', 'Normal delivery time.') + '</span></div><div><b>We’ve already reduced the lead time to eight weeks.</b><span>' + L('Wir haben die Lieferzeit schon auf acht Wochen verkürzt.', 'Present perfect, no past time named.') + '</span></div></div></div>' +
    '<div class="stack s6"><div class="lbl">' + L('Wortpartner', 'Collocations') + '</div><p class="p en">reduce · shorten · quote a lead time</p></div>' +
    '<div class="stack s6"><div class="lbl">' + L('Typische Falle', 'Common trap') + '</div><p class="p">' + L('<em class="en">delivery</em> ist die Lieferung selbst, nicht ihre Dauer. <em class="en">delivery time</em> geht auch, im Einkauf hörst du meist <em class="en">lead time</em>.', '<em>delivery</em> is the delivery itself, not its duration.') + '</p></div></div>',
    '<button class="btn pri full" id="more-next" data-go="h3-before">' + L('Weiter', 'Continue') + '</button>', { h: '85%' });
}
function wordPopup() {
  return sheet('word-sheet', 'reduce',
    '<div class="stack s16"><div style="display:flex;align-items:center;gap:10px"><span class="p2 en">/rɪˈduːs/ · ' + L('Verb', 'verb') + '</span><button class="iconbtn" id="say-reduce" data-act="noop" aria-label="' + esc(L('Anhören', 'Listen')) + '" style="margin:0">' + ic('speaker', 'sm') + '</button></div>' +
    '<div class="disp" style="font-size:24px;line-height:30px;font-weight:600">' + L('senken, verringern', 'to lower, cut') + '</div>' +
    '<p class="p2">' + L('Hier: die Lieferzeit verkürzen. Mit Preisen: <em class="en">reduce the price by 5 percent</em>.', 'Here: shorten the lead time. With prices: <em>reduce the price by 5 percent</em>.') + '</p>' +
    '<div class="stack s8"><span class="chip">' + ic('check', 'xs') + L('Bildest du selbst · seit 3 Wochen', 'You produce it · for 3 weeks') + '</span></div></div>',
    '<div style="display:flex;gap:8px"><button class="btn sec" id="word-ask" data-go="h15-claude" style="flex:1">' + L('Claude fragen', 'Ask Claude') + '</button><button class="btn pri" id="word-close" data-go="h2-gap" style="flex:1">' + L('Schließen', 'Close') + '</button></div>');
}
reg('h2', {
  code: 'H2', name: 'Wörter-Block', kind: 'phone', demo: true, closeTo: { word: 'h2-gap' },
  variants: [['intro', 'Neues Wort'], ['type', 'frei tippen'], ['gap', 'Lücke'], ['band', 'Band'], ['also', 'Band: auch richtig'], ['more', '„Mehr“-Blatt'], ['menu', 'Menü „…“'], ['word', 'Wort angetippt']],
  render: h2,
  after(v) {
    if (v === 'type' || v === 'gap') {
      if (!S.ui.checked) {
        wireGap('gap', () => act('check'));
        if (S.typed == null) { const t = WORD.you[S.demo]; if (t) autoType('gap', t); }
      }
    }
  },
  acts: {
    check() { const inp = $('#gap-in'); if (inp && inp.value && inp.value !== WORD.you[S.demo]) S.ui.ownInput = true; S.ui.checked = true; render(); },
    idk() { S.ui.ownInput = false; S.demo = 'idk'; S.ui.checked = true; render(); },
    tip() { const h = $('.hintline'); if (h) h.innerHTML = L('Tipp: beginnt mit <em class="en">l</em>, zwei Wörter', 'Hint: starts with <em>l</em>, two words'); },
    more() { S.ui.sheet = 'more'; render(); },
    also() { go('h15-claude'); },
    whysheet() { S.ui.menu = false; S.ui.sheet = 'why'; render(); }
  }
});

/* =========================================================
   H3 Blockwechsel
   ========================================================= */
const H2_WHY = () => L('lead time hast du vorgestern neu gelernt. Heute holst du es frei ab, ohne Auswahl. So wird es dein Wort.', 'You learned lead time two days ago. Today you recall it freely, without choices. That is how it becomes yours.');
reg('h3', {
  code: 'H3', name: 'Blockwechsel', kind: 'phone', demo: true, borrow: ['h4'],
  variants: [['before', 'letzte Wort-Aufgabe'], ['after', 'Lichtimpuls + Blockzeile']],
  render(v) {
    const blocks = NORMAL();
    if (v === 'before') {
      const st = S.demo;
      const shown = st === 'idk' ? WORD.right : WORD.you[st];
      return exTop(blocks, 1, 1) + '<div class="ex-body gx with-band">' + blockLine('w', L('Wörter · ', 'Words · ') + TOPIC()) + instr(L('Setz das fehlende Wort ein.', 'Fill in the missing word.')) +
        '<div class="stagec"><div class="sent en">' + words('Can you reduce the') + ' ' + gapHtml(shown, { st: { ok: 'ok', typo: 'near', wrong: 'bad', idk: 'idk' }[st] }) + ' ' + words('to four weeks?') + '</div></div></div>' +
        band(st, wordData('gap'), { next: 'h3-after', nextLabel: L('Weiter: Grammatik', 'Continue: Grammar') }) + (S.ui.sheet === 'more' ? moreWordSheet().replace('data-go="h3-before"', 'data-act="closesheet"') : '') + overlays({ whyTask: H2_WHY() });
    }
    return gramTask({ pulse: 1, flash: true });
  }
});

/* =========================================================
   H4 Grammatik-Block
   ========================================================= */
function gramPattern(hl) {
  return '<div class="pattern en" aria-label="' + esc(L('Muster', 'Pattern')) + '"><span class="' + (hl ? 'on' : '') + '">past simple · sent</span><span>present perfect · have sent</span><span style="background:transparent;padding-left:2px">+ yesterday</span></div>';
}
function gramTask(o) {
  o = o || {};
  const blocks = NORMAL();
  const v = o.v || 'task';
  const checked = o.checked || S.ui.checked;
  const st = checked ? (o.st || curSt(GRAM)) : null;
  const hint = o.hint;
  let shown;
  if (checked) shown = st === 'idk' ? GRAM.right : (S.typed && S.ui.ownInput ? S.typed : GRAM.you[st]);
  else if (hint) shown = S.typed != null ? S.typed : (S.carry || 'have sent');
  else shown = S.typed || '';
  const gapSt = checked ? ({ ok: 'ok', typo: 'near', wrong: 'bad', idk: 'idk' }[st]) : '';
  const whyTask = L('Du bist in Schritt 3: gelenkt üben. Jede richtige Antwort im ersten Versuch bringt dich näher an „frei“.', 'You are in step 3: guided practice. Every first-try answer brings you closer to “free”.');
  let s = exTop(blocks, 2, checked ? 0.3 : 0.2, { pulse: o.pulse }) +
    '<div class="ex-body gx' + (checked ? ' with-band' : '') + '">' +
    blockLine('g', L('Grammatik · <em>past simple vs. present perfect</em> · Schritt 3 von 7', 'Grammar · <em>past simple vs. present perfect</em> · step 3 of 7'), o.flash) +
    instr(L('Setz das Verb in der passenden Zeitform ein.', 'Put the verb in the right tense.')) +
    '<div class="stagec">' + gramPattern(checked && st !== 'wrong') +
    '<div class="sent en" id="sent">' + words('We') + ' ' + gapHtml(shown, { caret: !checked, input: !checked, st: gapSt }) + ' <span class="w" style="color:var(--fg-3)">(send)</span> ' + words('the revised quote yesterday.') + '</div></div></div>';
  if (checked) s += band(st, Object.assign({}, GRAM, { you: Object.assign({}, GRAM.you, S.typed && S.ui.ownInput ? { [st]: esc(S.typed) } : {}) }), { next: 'h7-dictation', nextLabel: L('Weiter: Hören', 'Continue: Listening') });
  else {
    if (hint) s += '<div class="hintband gx" id="hintband" style="position:relative">' + ic('bulb', 'sm') + '<span>' + L('Noch nicht. Welche Zeitform passt zu <em class="en">yesterday</em>?', 'Not yet. Which tense goes with <em>yesterday</em>?') + '</span></div>';
    s += exFoot((hint ? '' : btnSec('hint', L('Tipp', 'Hint'), 'data-act="tip"') + btnSec('idk', L('Weiß ich nicht', 'Don’t know'), 'data-act="idk"')) + btnPri('check', L('Prüfen', 'Check'), '', ' data-act="check"'), true) + drawnKbd({ go: 'go' });
  }
  if (v === 'more' || S.ui.sheet === 'more') s += gramMoreSheet();
  s += overlays({ whyTask, checked, pause: true });
  return s;
}
function gramMoreSheet() {
  return sheet('more-sheet', L('Mehr: Zeitpunkt genannt', 'More: time is named'),
    '<div class="stack s16"><div class="contrast en"><span class="k">DE</span><span style="font-family:var(--font)">' + L('Wir haben das Angebot gestern geschickt.', 'Wir haben das Angebot gestern geschickt.') + '</span>' +
    '<span class="k" style="color:var(--ok)">' + ic('check', 'xs') + '</span><span><b>We sent the quote yesterday.</b></span>' +
    '<span class="k" style="color:var(--bad)">' + ic('cross', 'xs') + '</span><span class="no">We have sent the quote yesterday.</span></div>' +
    '<p class="p">' + L('Im Deutschen passt „haben … geschickt“ zu jedem Zeitpunkt. Im Englischen entscheidet die Zeitangabe: Ist der Zeitpunkt genannt oder klar, nimmst du past simple.', 'In German, “haben … geschickt” fits any time. In English the time word decides: if the time is named or clear, use the past simple.') + '</p>' +
    '<div class="stack s6"><div class="lbl">' + L('Mit Zeitpunkt, also past simple', 'With a time, so past simple') + '</div><div class="ex-list en"><div><b>The buyer called on Tuesday.</b></div><div><b>We agreed on the price last week.</b></div></div></div>' +
    '<div class="stack s6"><div class="lbl">' + L('Ohne Zeitpunkt, bis jetzt: present perfect', 'No time, up to now: present perfect') + '</div><div class="ex-list en"><div><b>The client hasn’t replied yet.</b></div></div></div></div>',
    '<button class="btn pri full" id="more-next" data-go="h7-dictation">' + L('Weiter', 'Continue') + '</button>', { h: '85%' });
}
reg('h4', {
  code: 'H4', name: 'Grammatik-Block', kind: 'phone', demo: true,
  variants: [['task', 'Aufgabe'], ['hint', 'Hinweis-Runde'], ['band', 'Band (längste Warum-Zeile)'], ['more', '„Mehr“-Blatt']],
  render(v) {
    if (v === 'hint') return gramTask({ v, hint: true });
    if (v === 'band' || v === 'more') return gramTask({ v, checked: true });
    return gramTask({ v });
  },
  after(v) {
    if ((v === 'task' || v === 'hint') && !S.ui.checked) {
      wireGap('gap', () => act('check'));
      if (v === 'task' && S.typed == null) { const t = GRAM.you[S.demo]; if (t) autoType('gap', t); }
    }
  },
  acts: {
    check() {
      const inp = $('#gap-in');
      const v = curVariant();
      if (inp && inp.value && inp.value !== GRAM.you[S.demo] && !(v === 'hint' && inp.value === 'have sent')) S.ui.ownInput = true;
      if (v === 'task' && !S.ui.ownInput && S.demo === 'wrong') { go('h4-hint'); return; }
      if (v === 'task' && S.ui.ownInput && judge(S.typed, GRAM.right, null, GRAM.wrongForms) === 'wrong') { S.carry = S.typed; go('h4-hint'); return; }
      S.ui.checked = true; render();
    },
    idk() { S.ui.ownInput = false; S.demo = 'idk'; savePrefs(); S.ui.checked = true; render(); },
    tip() { const p = $('.pattern'); if (p) p.classList.add('fadein'); const b = $('#sent'); if (b && !$('#tipline')) b.insertAdjacentHTML('afterend', '<div class="hintline" id="tipline">' + L('Tipp: Achte auf <em class="en">yesterday</em>.', 'Hint: look at <em>yesterday</em>.') + '</div>'); },
    more() { S.ui.sheet = 'more'; render(); },
    also() { go('h15-claude'); },
    whysheet() { S.ui.menu = false; S.ui.sheet = 'why'; render(); }
  }
});

/* =========================================================
   H5 Grammatik-Erklärung (Kapitel 1, echter Inhalt)
   ========================================================= */
function explainBody() {
  return '<h2 class="disp" style="font-size:28px;line-height:34px;font-weight:700;margin:6px 0 0">' + L('Abgeschlossen oder bis jetzt?', 'Finished or up to now?') + '</h2>' +
    '<p class="p" style="color:var(--fg-2)">' + L('Im gesprochenen Deutsch sagst du fast immer „habe … gemacht“. Im Englischen entscheidest du: Ist die Zeit vorbei (gestern, letzte Woche), oder reicht sie bis jetzt?', 'In spoken German you almost always say “habe … gemacht”. In English you decide: is the time over (yesterday, last week), or does it reach up to now?') + '</p>' +
    '<div class="card stack s8"><div class="lbl">' + L('Deutsch → Englisch', 'German → English') + '</div><div class="contrast en">' +
    '<span class="k">DE</span><span style="font-family:var(--font)">Ich habe den Vertrag gestern unterschrieben.</span>' +
    '<span class="k" style="color:var(--ok)">' + ic('check', 'xs') + '</span><span><b>I signed the contract yesterday.</b></span>' +
    '<span class="k" style="color:var(--bad)">' + ic('cross', 'xs') + '</span><span class="no">I have signed the contract yesterday.</span></div></div>' +
    '<div class="card" style="padding:14px 16px 6px"><table class="tbl en"><thead><tr><th></th><th>past simple</th><th>present perfect</th></tr></thead><tbody>' +
    '<tr><td>' + L('Form', 'Form') + '</td><td class="hl">sent · signed</td><td class="hl">have / has sent</td></tr>' +
    '<tr><td>' + L('Wann', 'When') + '</td><td style="font-family:var(--font)">' + L('abgeschlossen, Zeitpunkt genannt oder klar', 'finished, time named or clear') + '</td><td style="font-family:var(--font)">' + L('bis jetzt, Zeitpunkt offen', 'up to now, time open') + '</td></tr>' +
    '<tr><td>' + L('Signal (typisch)', 'Signal (typical)') + '</td><td>yesterday, last week, on Monday, two days ago, in 2025 <span style="font-family:var(--font)">' + L('(vorbei)', '(over)') + '</span></td><td>yet, already, so far, ever (Have you ever …?), since, for <span style="font-family:var(--font)">' + L('(bis heute)', '(up to today)') + '</span></td></tr>' +
    '<tr><td>' + L('Beispiel', 'Example') + '</td><td>We sent the quote on Monday.</td><td>We’ve already sent the quote.</td></tr></tbody></table></div>' +
    '<div class="stack s6"><div class="lbl">' + L('Aus dem Vertrieb', 'From sales') + '</div><div class="ex-list en">' +
    '<div><b>We sent the revised quote on Monday.</b><span>' + L('Zeitpunkt genannt → past simple', 'time named → past simple') + '</span></div>' +
    '<div><b>Finance hasn’t signed off on the budget yet.</b><span>' + L('bis jetzt, noch offen → present perfect', 'up to now, still open → present perfect') + '</span></div>' +
    '<div><b>We’ve already reduced the price by 5 percent.</b><span>' + L('Ergebnis zählt, kein Zeitpunkt → present perfect', 'result matters, no time → present perfect') + '</span></div>' +
    '<div><b>Last quarter, we closed 14 deals in the region.</b><span>' + L('abgeschlossener Zeitraum → past simple', 'finished period → past simple') + '</span></div>' +
    '<div><b>Have you had a chance to look at our proposal?</b><span>' + L('höfliche Nachfrage, bis jetzt → present perfect', 'polite follow-up, up to now → present perfect') + '</span></div></div></div>' +
    '<div class="card stack s8"><div class="lbl">' + L('Typische Falle', 'Common trap') + '</div><div class="contrast en">' +
    '<span class="k" style="color:var(--bad)">' + ic('cross', 'xs') + '</span><span class="no">Have you sent the quote yesterday?</span>' +
    '<span class="k" style="color:var(--ok)">' + ic('check', 'xs') + '</span><span><b>Did you send the quote yesterday?</b></span></div>' +
    '<p class="p2">' + L('Auch in Fragen: Steht ein vergangener Zeitpunkt dabei, fragst du mit <em class="en">did</em>.', 'In questions too: with a past time expression, ask with <em>did</em>.') + '</p>' +
    '<p class="p2">' + L('Auch bei <em class="en">When …?</em> fragst du mit <em class="en">did</em>: <s class="en" style="text-decoration-color:var(--bad);color:var(--fg-2)">When have you sent it?</s> → <b class="en">When did you send it?</b>', 'With <em>When …?</em> you also ask with <em>did</em>: <s>When have you sent it?</s> → <b>When did you send it?</b>') + '</p></div>' +
    '<div class="notice">' + ic('pen', 'sm') + '<span>' + L('Dein Satz aus Schritt 1: <span class="en" style="text-decoration:line-through;text-decoration-color:var(--bad);color:var(--fg-2)">We have won three new customers last month.</span> → <em class="en">We won three new customers last month.</em>', 'Your sentence from step 1: <s>We have won three new customers last month.</s> → <em>We won three new customers last month.</em>') + '</span></div>';
}
function explainMoreSheet() {
  return sheet('more-sheet', L('Mehr zu diesem Thema', 'More on this topic'),
    '<div class="stack s16">' +
    '<div class="stack s6"><div class="lbl">' + L('Zeitraum läuft noch', 'Period still running') + '</div><p class="p">' + L('Mit <em class="en">this week</em>, <em class="en">today</em> oder <em class="en">this year</em> geht present perfect, solange der Zeitraum noch läuft: <em class="en">We’ve had three calls this week.</em>', 'With this week, today or this year, use present perfect while the period is still running.') + '</p></div>' +
    '<div class="stack s6"><div class="lbl">' + L('US- und britisches Englisch', 'US and British English') + '</div><p class="p">' + L('Im amerikanischen Alltagsenglisch hörst du oft <em class="en">Did you get my email yet?</em> und <em class="en">I just sent it.</em> Mit present perfect (<em class="en">Have you received my email yet?</em> · <em class="en">I’ve just sent it.</em>) liegst du in beiden Varianten richtig, besonders schriftlich. Das gilt nur für <em class="en">just, already, yet</em>: Mit <em class="en">yesterday</em> oder <em class="en">last week</em> bleibt present perfect falsch.', 'In everyday American English you often hear Did you get my email yet? and I just sent it. With the present perfect (Have you received my email yet? · I’ve just sent it.) you are right in both varieties, especially in writing. This only applies to just, already, yet: with yesterday or last week the present perfect stays wrong.') + '</p></div>' +
    '<div class="stack s6"><div class="lbl">' + L('Neuigkeit, dann Einzelheiten', 'News first, then details') + '</div><p class="p">' + L('Die Neuigkeit kommt im present perfect, die Einzelheiten im past simple: <em class="en">We’ve signed the contract. We signed it on Friday after a short call.</em>', 'News in the present perfect, details in the past simple.') + '</p></div>' +
    '<div class="stack s6"><div class="lbl">since · for</div><p class="p">' + L('Für etwas, das bis heute andauert: <em class="en">I’ve known the buyer since 2019.</em> · <em class="en">We’ve worked with them for six years.</em> Nicht: <span class="en" style="text-decoration:line-through;text-decoration-color:var(--bad);color:var(--fg-2)">I know the buyer since 2019.</span>', 'For something that continues until today: I’ve known the buyer since 2019.') + '</p>' +
    '<p class="p">' + L('Auch <em class="en">since yesterday</em> oder <em class="en">since last week</em> heißt „bis jetzt“: <em class="en">We haven’t heard from them since last week.</em> Und: <em>seit sechs Jahren</em> heißt <em class="en">for six years</em>, nicht <s class="en" style="text-decoration-color:var(--bad);color:var(--fg-2)">since six years</s>.', 'since yesterday or since last week also means “up to now”: We haven’t heard from them since last week. And: seit sechs Jahren is for six years, not <s>since six years</s>.') + '</p></div></div>',
    '<button class="btn pri full" id="more-next" data-act="closesheet">' + L('Weiter', 'Continue') + '</button>', { h: '85%' });
}
reg('h5', {
  code: 'H5', name: 'Grammatik-Erklärung', kind: 'phone', closeTo: { more: 'h5-explain' },
  variants: [['problem', 'Problem zuerst'], ['explain', 'Erklärung (Muster-Tabelle)'], ['more', '„Mehr“ aufgeklappt']],
  render(v) {
    const blocks = NORMAL();
    if (v === 'problem') {
      const items = ['Ich habe das Angebot gestern geschickt.', 'Der Kunde hat noch nicht geantwortet.', 'Wir haben letzten Monat drei neue Kunden gewonnen.', 'Haben Sie unser Angebot schon erhalten?'];
      return exTop(blocks, 2, 0.05) + '<div class="ex-body gx">' + blockLine('g', L('Grammatik · <em>past simple vs. present perfect</em> · Schritt 1 von 7', 'Grammar · <em>past simple vs. present perfect</em> · step 1 of 7')) +
        instr(L('Wie sagst du das auf Englisch? Fehler sind hier erwartet.', 'How do you say this in English? Mistakes are expected here.')) +
        '<div class="stagec" style="justify-content:flex-start;gap:10px;padding-top:18px">' + items.map((t, i) =>
          '<div class="card" style="display:flex;gap:12px;align-items:flex-start;padding:14px 16px"><span class="num" style="color:var(--fg-3);font-weight:650;width:16px">' + (i + 1) + '</span><span class="p">' + t + '</span></div>').join('') +
        '<p class="p2" style="padding-top:6px">' + L('Du sprichst oder tippst jeden Satz. Das zählt noch nicht, es zeigt nur, wo du stehst.', 'You say or type each sentence. It doesn’t count yet, it only shows where you are.') + '</p></div></div>' +
        '<div class="gx" style="flex:none">' + pageDots(2, 0) + '</div>' + exFoot(btnPri('ex-next', L('Los geht’s', 'Let’s go'), 'h5-explain')) +
        overlays({ whyTask: L('Erst versuchen, dann die Regel: Wenn du zuerst merkst, wo es hakt, bleibt die Erklärung danach besser hängen.', 'Try first, then the rule: once you notice where it gets tricky, the explanation sticks better.') });
    }
    const body = '<div class="ex-body gx" style="padding-bottom:12px">' + blockLine('g', L('Grammatik · Erklärung · ca. 70 Sekunden', 'Grammar · explanation · about 70 seconds')) + '<div class="stack s16" style="padding-top:10px">' + explainBody() +
      '<button class="btn sec full" id="explain-more" data-act="more">' + L('Mehr', 'More') + ' ' + ic('chevD', 'sm') + '</button></div></div>';
    return exTop(blocks, 2, 0.1) + body + '<div class="gx" style="flex:none">' + pageDots(2, 1) + '</div>' + exFoot(btnPri('ex-next', L('Weiter', 'Continue'), 'h4-task')) + (v === 'more' || S.ui.sheet === 'more' ? explainMoreSheet() : '');
  },
  acts: { more() { S.ui.sheet = 'more'; render(); }, whysheet() { S.ui.menu = false; S.ui.sheet = 'why'; render(); } }
});

/* =========================================================
   H6 Reiter Grammatik
   ========================================================= */
const CHAPTERS = () => [
  [1, L('Zeiten im Projektverlauf', 'Tenses in project updates'), L('in Arbeit · Thema 1 von 4', 'in progress · topic 1 of 4'), 'run'],
  [2, L('Fragen, Wortstellung, Artikel', 'Questions, word order, articles'), L('etwa Woche 3–5', 'about weeks 3–5'), ''],
  [3, L('Zukunft, Pläne, Präzision', 'Future, plans, precision'), L('etwa Woche 5–8', 'about weeks 5–8'), ''],
  [4, L('Bedingen, Verhandeln, Diplomatie', 'Conditions, negotiating, diplomacy'), L('etwa Woche 8–11', 'about weeks 8–11'), ''],
  [5, L('Modalität und Hedging', 'Modality and hedging'), L('später, je nach Tempo', 'later, depending on pace'), ''],
  [6, L('Verbmuster, Relativsätze, Verbindungen', 'Verb patterns, relative clauses, linkers'), L('später, je nach Tempo', 'later, depending on pace'), ''],
  [7, L('Passiv, Berichten, Nominalstil', 'Passive, reporting, nominal style'), L('später, je nach Tempo', 'later, depending on pace'), ''],
  [8, L('Satzbau für Wirkung', 'Sentence structure for impact'), L('etwa Woche 18–22 · Ende des ersten Durchgangs', 'about weeks 18–22 · end of first pass'), '']
];
function hereCard() {
  return '<div class="card stack s8" style="box-shadow:var(--shadow)"><div class="lbl">' + L('Du bist hier', 'You are here') + '</div>' +
    '<div class="h2 disp">' + L('Thema <span class="en">past simple vs. present perfect</span>', 'Topic: past simple vs. present perfect') + '</div>' +
    '<div class="p2">' + L('Schritt 3 von 7 · noch 4 richtige bis frei', 'Step 3 of 7 · 4 more correct until free') + '</div>' +
    '<div class="bar" style="height:6px;margin-top:6px">' + [1, 1, 0.6, 0, 0, 0, 0].map(f => f === 1 ? '<i class="d" style="flex:1"></i>' : '<i style="flex:1"><b style="width:' + f * 100 + '%"></b></i>').join('') + '</div></div>';
}
function chapterDetail() {
  const topics = [
    ['past simple vs. present perfect', L('in Arbeit · Schritt 3 von 7', 'in progress · step 3 of 7'), 'run'],
    ['present perfect continuous', L('offen', 'open'), ''],
    [L('Zeitpräpositionen (for, since, by, until)', 'Time prepositions (for, since, by, until)'), L('offen', 'open'), ''],
    ['past perfect', L('offen', 'open'), '']
  ];
  return '<div class="stack s16 springopen">' +
    '<div class="stack s6"><div class="lbl">' + L('Kapitel 1 · jetzt Woche 2', 'Chapter 1 · now week 2') + '</div><div class="h2 disp" style="font-size:26px;line-height:32px">' + CHAPTERS()[0][1] + '</div></div>' +
    '<div class="card" style="padding:4px 16px">' + topics.map((t, i) => '<div class="st ' + (t[2] === 'run' ? 'run' : 'open') + '" style="min-height:58px"><span class="mk"></span>' + (i === 0 ? '<button class="nm" id="ch-topic" data-go="h27-topic" style="display:flex;flex-direction:column;flex:1;min-width:0;min-height:44px;justify-content:center;text-align:left">' : '<span class="nm" style="display:flex;flex-direction:column">') + '<span class="en" style="font-weight:600">' + t[0] + '</span><span class="p2" style="font-size:13px">' + t[1] + '</span>' + (i === 0 ? '</button>' : '</span>') +
      (i === 0 ? '<button class="link" id="ch-explain" data-go="h5-explain" style="margin-left:auto;font-size:14px">' + L('Erklärung', 'Explanation') + '</button>' : '') + '</div>').join('') + '</div>' +
    '<div>' + [['flag', L('Deine Fehler', 'Your errors'), L('3 offen in diesem Kapitel', '3 open in this chapter'), 'h26-list', 'ch-errors'],
      ['pen', L('Lehrerin', 'Teacher'), L('Korrekturen aus der Stunde einfügen', 'Paste corrections from your lesson'), 'h28-paste', 'ch-teacher']].map(r =>
      '<button class="row" id="' + r[4] + '" data-go="' + r[3] + '"><span class="ri">' + ic(r[0], 'sm') + '</span><span class="rt"><b>' + r[1] + '</b><span>' + r[2] + '</span></span><span class="chev">' + ic('chevR', 'sm') + '</span></button>').join('') + '</div>' +
    '<div class="stack s6"><div class="lbl">' + L('Kapitelaufgaben', 'Chapter tasks') + '</div><p class="p">' + L('Schreiben: ein Projekt-Update per Mail. Sprechen: ein Statusbericht von einer Minute per Diktat.', 'Writing: a project update by email. Speaking: a one-minute status report by dictation.') + '</p></div>' +
    '<div class="stack s6"><div class="lbl">' + L('Abgeschlossen heißt', 'Finished means') + '</div><p class="p2">' + L('alle vier Themen bestanden, Kapitel-Test mit 12 gemischten Aufgaben ab 80 %, beide Kapitelaufgaben erfüllt.', 'all four topics passed, chapter test with 12 mixed tasks at 80 % or more, both chapter tasks done.') + '</p></div></div>';
}
reg('h6', {
  code: 'H6', name: 'Reiter Grammatik', kind: 'phone',
  variants: [['path', 'Weg'], ['chapter', 'Kapitel 1 geöffnet']],
  render(v) {
    if (v === 'chapter') {
      return '<header class="phead gx"><button class="iconbtn" id="ch-back" data-go="h6-path" aria-label="' + esc(L('Zurück', 'Back')) + '" style="margin-left:-10px;margin-right:0">' + ic('chevL') + '</button>' + askBtn() + '</header>' +
        '<div class="scroll gx" style="padding-bottom:24px">' + chapterDetail() + '</div>' + tabbar('h6');
    }
    return '<div class="scroll">' + phead(L('Grammatik', 'Grammar'), askBtn()) + '<div class="gx stack s16" style="padding-bottom:24px">' + hereCard() +
      '<div class="stack s6"><div class="lbl" style="padding:6px 0 2px">' + L('Dein Weg zu C1 · 8 Kapitel, je zwei bis drei Wochen', 'Your path to C1 · 8 chapters, two to three weeks each') + '</div>' +
      CHAPTERS().map(c => '<button class="row" id="ch-' + c[0] + '"' + (c[3] === 'run' ? ' data-go="h6-chapter"' : ' data-act="locked" data-n="' + c[0] + '" aria-disabled="true" style="opacity:.62"') + '><span class="ri num' + (c[3] === 'run' ? ' pulsing' : '') + '" style="' + (c[3] === 'run' ? 'background:var(--act-soft);color:var(--act-text);font-weight:700' : 'font-weight:600') + '">' + c[0] + '</span><span class="rt"><b>' + c[1] + '</b><span>' + c[2] + '</span></span>' + (c[3] === 'run' ? '<span class="chev">' + ic('chevR', 'sm') + '</span>' : '<span class="chev" style="opacity:.6">' + ic('lock', 'sm') + '</span>') + '</button>').join('') +
      '</div><button class="tw-quiet" id="g-more" data-go="h33-list">' + L('Mehr üben, freiwillig', 'More practice, optional') + '</button></div></div>' + tabbar('h6');
  }
});

/* =========================================================
   H7 Hören
   ========================================================= */
function waveBars(n, played) {
  let s = '<div class="wave" aria-hidden="true">';
  for (let i = 0; i < n; i++) { const h = 8 + Math.round(Math.abs(Math.sin(i * 1.7) * 22 + Math.sin(i * 0.6) * 10)); s += '<i class="' + (i < played ? 'p' : '') + '" style="height:' + Math.min(40, h) + 'px"></i>'; }
  return s + '</div>';
}
function player(o) {
  o = o || {};
  const playing = S.ui.playing;
  const pct = o.pct || 0;
  return '<div class="player"><button class="playbtn" id="play" data-act="play" aria-label="' + esc(playing ? L('Pause', 'Pause') : L('Abspielen', 'Play')) + '">' +
    '<svg class="prog" viewBox="0 0 140 140" aria-hidden="true"><circle cx="70" cy="70" r="66" fill="none" stroke="var(--surface-3)" stroke-width="3"/><circle id="playprog" cx="70" cy="70" r="66" fill="none" stroke="var(--act)" stroke-width="3" stroke-linecap="round" pathLength="100" stroke-dasharray="' + pct + ' 100"/></svg>' +
    ic(playing ? 'pause' : 'play') + '</button>' + waveBars(36, Math.round(pct / 100 * 36)) +
    (o.speed === false ? '' : '<div class="speed" role="group" aria-label="' + esc(L('Tempo', 'Speed')) + '">' +
      [['slow', L('0,85×', '0.85×'), L('langsam', 'slow')], ['normal', L('1,0×', '1.0×'), L('normal', 'normal')], ['fast', L('1,1×', '1.1×'), L('schnell', 'fast')]].map(x =>
        '<button id="sp-' + x[0] + '" data-act="speed" data-v="' + x[0] + '" class="' + ((S.ui.speed || o.def || 'normal') === x[0] ? 'on' : '') + '">' + x[1] + '<small>' + x[2] + '</small></button>').join('') + '</div>') + '</div>';
}
const VOICEMAIL = 'Hi, this is Laura Keller from procurement. Thanks for sending over the revised quote on Monday. I’ve gone through it with my team, and to be honest, we’re not quite there yet. The total is still about 12 percent above our budget for this year. Another supplier has also offered us a lead time of six weeks, and yours is ten. I’m not saying no, but I can’t get this approved in its current form. Could you call me back before Thursday? Any time after two works for me. If there’s any flexibility on price or delivery, that would really help. Thanks, talk soon.';
function h7(v) {
  const blocks = NORMAL();
  const top = exTop(blocks, 3, { dictation: 0.1, dictres: 0.25, predict: 0.4, play: 0.55, question: 0.7, read: 0.85 }[v] || 0.1);
  const bl = (t) => blockLine('l', L('Hören · ', 'Listening · ') + t);
  if (v === 'dictation') {
    return top + '<div class="ex-body gx">' + bl(L('Mini-Diktat 1 von 2', 'Mini dictation 1 of 2')) + instr(L('Hör zu und schreib den Satz genau auf.', 'Listen and write the sentence exactly.')) +
      '<div class="stagec" style="gap:20px">' + player({ pct: S.ui.pct || 0 }) +
      '<textarea class="field en" id="dict-field" rows="2" placeholder="' + esc(L('Was hast du gehört?', 'What did you hear?')) + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" style="min-height:84px"></textarea></div></div>' +
      exFoot(btnPri('check', L('Prüfen', 'Check'), 'h7-dictres')) + overlays({ whyTask: L('Zahlen, Daten und Preise hörst du im Kundengespräch ständig. Das Diktat zeigt, welche Wörter du noch nicht hörst.', 'Numbers, dates and prices come up in every client call. Dictation shows which words you don’t hear yet.'), pause: true });
  }
  if (v === 'dictres') {
    return top + '<div class="ex-body gx with-band">' + bl(L('Mini-Diktat 1 von 2', 'Mini dictation 1 of 2')) + instr(L('Hör zu und schreib den Satz genau auf.', 'Listen and write the sentence exactly.')) +
      '<div class="stagec" style="gap:16px"><div class="card stack s8"><div class="lbl">' + L('Dein Satz', 'Your sentence') + '</div><div class="diffw en">We <span class="x">send</span> the revised quote on Monday.</div>' +
      '<div class="hr"></div><div class="lbl">' + L('Gesprochen', 'Spoken') + '</div><div class="diffw en">We <b>sent</b> the revised quote on Monday.</div></div></div></div>' +
      '<div class="band gx s-near" id="band"><div class="verdict"><span class="vi">' + ic('near', 'xs') + '</span>' + L('Fast', 'Almost') + '</div>' +
      '<div class="cmp">' + L('Nicht gehört:', 'Missed:') + ' <b class="en">sent</b></div>' +
      '<p class="whyl">' + L('Das -t von <em class="en">sent</em> geht beim schnellen Sprechen fast unter. Hilfe: <em class="en">on Monday</em> ist vergangen, also <em class="en">sent</em>.', 'The -t in <em>sent</em> almost disappears in fast speech. Clue: <em>on Monday</em> is past, so <em>sent</em>.') + '</p>' +
      '<div class="bandbtns"><button class="btn sec sm" id="replay-slow" data-act="noop">' + ic('speaker', 'sm') + L('Langsam anhören', 'Play slowly') + '</button></div>' +
      '<button class="btn pri full" id="band-next" data-go="h7-predict">' + L('Weiter', 'Continue') + '</button></div>';
  }
  if (v === 'predict') {
    const ch = [L('Sie sagt den Auftrag zu.', 'She accepts the order.'), L('Sie hat ein Problem mit dem Preis.', 'She has a problem with the price.'), L('Sie verschiebt den Termin.', 'She moves the meeting.')];
    return top + '<div class="ex-body gx">' + bl(L('Sprachnachricht vom Einkauf · 52 s', 'Voicemail from purchasing · 52 s')) + instr(L('Was erwartest du? Ein Tipp genügt.', 'What do you expect? One tap is enough.')) +
      '<div class="stagec"><div class="persona"><span class="avatar">LK</span><div><b>Laura Keller</b><div class="p2" style="font-size:13px">' + L('Leiterin Einkauf · erfunden', 'Head of Procurement · invented') + '</div></div></div>' +
      '<p class="p2">' + L('Du hast ihr am Montag das überarbeitete Angebot geschickt. Jetzt ruft sie zurück.', 'You sent her the revised quote on Monday. Now she calls back.') + '</p>' +
      '<div class="stack s8">' + ch.map((c, i) => '<button class="choice" id="pred-' + i + '" data-go="h7-play"><span class="n num">' + (i + 1) + '</span>' + c + '</button>').join('') + '</div></div></div>';
  }
  if (v === 'play') {
    return top + '<div class="ex-body gx">' + bl(L('Sprachnachricht vom Einkauf · 52 s', 'Voicemail from purchasing · 52 s')) + instr(L('Hör einmal zu. Danach kommt eine Frage.', 'Listen once. A question follows.')) +
      '<div class="stagec" style="gap:22px">' + player({ pct: S.ui.pct != null ? S.ui.pct : 38 }) +
      '<p class="p2" style="text-align:center">' + L('Stufe normal · 1,0× · ohne Text', 'Level normal · 1.0× · no text') + '</p></div></div>' +
      exFoot(btnPri('play-next', L('Weiter', 'Continue'), 'h7-question'));
  }
  if (v === 'question') {
    const ch = [L('Heute noch, vor 14 Uhr', 'Today, before 2 pm'), L('Vor Donnerstag, ab 14 Uhr', 'Before Thursday, after 2 pm'), L('Freitag früh', 'Friday morning'), L('Nächste Woche', 'Next week')];
    const chosen = S.ui.choice;
    return top + '<div class="ex-body gx' + (chosen != null ? ' with-band' : '') + '">' + bl(L('Sprachnachricht vom Einkauf', 'Voicemail from purchasing')) + instr(L('Wann sollst du zurückrufen?', 'When should you call back?')) +
      '<div class="stagec" style="justify-content:flex-start;padding-top:20px"><div class="stack s8">' + ch.map((c, i) => '<button class="choice' + (chosen != null && i === 1 ? ' ok' : '') + (chosen === i && i !== 1 ? ' sel' : '') + '" id="q-' + i + '" data-act="choose" data-i="' + i + '"><span class="n num">' + (i + 1) + '</span>' + c + '</button>').join('') + '</div></div></div>' +
      (chosen != null ? '<div class="band gx ' + (chosen === 1 ? 's-ok' : 's-bad') + '" id="band">' + verdictRow(chosen === 1 ? 'ok' : 'wrong') +
        '<div class="cmp en">„Could you call me back before Thursday? Any time after two works for me.“</div>' +
        '<p class="whyl">' + L('<em class="en">before Thursday</em> = spätestens Mittwoch (<em class="en">by Thursday</em> wäre: bis einschließlich Donnerstag). <em class="en">Any time after two</em> = jederzeit ab 14 Uhr.', '<em>before Thursday</em> = Wednesday at the latest (<em>by Thursday</em> would include Thursday). <em>Any time after two</em> = any time from 2 pm.') + '</p>' +
        '<button class="btn pri full" id="band-next" data-go="h7-read">' + L('Weiter: Mitlesen', 'Continue: read along') + '</button></div>' : '');
  }
  // read
  const marked = { 'procurement': 0.55, 'lead time': 0.3, 'approved': 0.75, 'flexibility': 0.75 };
  let text = esc(VOICEMAIL);
  Object.keys(marked).forEach(k => { text = text.replace(k, '<span style="background:color-mix(in oklch, var(--ch-words) ' + Math.round(marked[k] * 34) + '%, transparent);border-radius:4px;padding:0 2px">' + k + '</span>'); });
  return top + '<div class="ex-body gx">' + bl(L('Mitlesen · einzelne Sätze antippbar', 'Read along · tap any sentence')) + instr(L('Lies mit, ohne erneutes Abspielen. Markiert sind Wörter, die du gerade lernst.', 'Read along without replaying. Marked words are ones you’re learning.'), false) +
    '<div class="stagec" style="justify-content:flex-start;padding-top:16px"><p class="en" style="font-size:18px;line-height:29px;margin:0;max-width:680px">' + text + '</p></div></div>' +
    exFoot(btnPri('read-next', L('Letzte Runde: ohne Text, 1,1×', 'Last round: no text, 1.1×'), 'h8-scenario'));
}
reg('h7', {
  code: 'H7', name: 'Hören', kind: 'phone',
  variants: [['dictation', 'Mini-Diktat'], ['dictres', 'Diktat-Ergebnis'], ['predict', 'Vorhersage'], ['play', 'Abspielen'], ['question', 'Frage'], ['read', 'Mitlesen']],
  render: h7,
  after() { if (S.ui.playing) tickPlay(); },
  acts: {
    play() { S.ui.playing = !S.ui.playing; if (S.ui.pct == null || S.ui.pct >= 100) S.ui.pct = 0; render(); },
    speed(el) { S.ui.speed = el.getAttribute('data-v'); render(); },
    choose(el) { S.ui.choice = +el.getAttribute('data-i'); render(); },
    whysheet() { S.ui.menu = false; S.ui.sheet = 'why'; render(); }
  }
});
function tickPlay() {
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    if (!S.ui.playing) return;
    S.ui.pct = Math.min(100, (S.ui.pct || 0) + 2);
    const p = $('#playprog'); if (p) p.setAttribute('stroke-dasharray', S.ui.pct + ' 100');
    const bars = $$('.wave i'); const n = Math.round(S.ui.pct / 100 * bars.length); bars.forEach((b, i) => b.classList.toggle('p', i < n));
    if (S.ui.pct >= 100) { S.ui.playing = false; render(); return; }
    tickPlay();
  }, 120);
}

/* =========================================================
   H8 Sag es (Diktiertaste)
   ========================================================= */
const SAY_TEXT = 'Hi Laura, thanks for your message. I have sent you the revised quote on Monday. Since then we have talked to our logistics team, and we can reduce the lead time to eight weeks. Can we have a short call on Wednesday afternoon to follow up?';
function sayTaskCard() {
  return '<div class="card stack s8"><div class="persona"><span class="avatar">LK</span><div><b>' + L('Rückruf beim Einkauf', 'Calling purchasing back') + '</b><div class="p2" style="font-size:13px">Laura Keller · ' + L('erfunden', 'invented') + '</div></div></div>' +
    '<p class="p">' + L('Laura hat dein Angebot noch nicht freigegeben. Sag, wann du es geschickt hast, was seitdem passiert ist, und schlag einen Termin vor.', 'Laura hasn’t approved your quote yet. Say when you sent it, what has happened since, and suggest a call.') + '</p>' +
    '<div class="hr"></div><div style="display:flex;flex-wrap:wrap;gap:6px"><span class="chip en">follow up</span><span class="chip en">lead time</span><span class="chip en">past simple / present perfect</span></div></div>';
}
function reportPage(i, n, inner, nextGo, nextLabel, extraBtn) {
  return '<div class="ex-body gx">' + inner + '</div><div class="gx" style="flex:none">' + pageDots(n, i) + '</div>' +
    exFoot((extraBtn || '') + btnPri('rep-next', nextLabel || L('Weiter', 'Continue'), nextGo));
}
function h8(v) {
  const blocks = NORMAL();
  const top = exTop(blocks, 4, { scenario: 0.1, guide: 0.15, keyboard: 0.4, german: 0.4, p1: 0.7, p2: 0.8, p3: 0.9, p4: 0.95 }[v] || 0.2);
  const bl = blockLine('s', L('Sag es · ', 'Say it · ') + TOPIC());
  if (v === 'scenario') {
    return top + '<div class="ex-body gx">' + bl + instr(L('Sprich 3 bis 5 Sätze. Nutze <em class="en">follow up</em> und <em class="en">lead time</em> und beide Zeitformen.', 'Say 3 to 5 sentences. Use <em>follow up</em> and <em>lead time</em> and both tenses.')) +
      '<div class="stagec">' + sayTaskCard() + '<p class="p2" style="text-align:center">' + L('30 Sekunden zum Überlegen, dann sprichst du.', '30 seconds to think, then you speak.') + '</p></div></div>' +
      exFoot(btnSec('type-instead', L('Lieber tippen', 'Type instead'), 'data-go="h8-keyboard"') + btnPri('speak', L('Sprechen', 'Speak'), 'h8-keyboard')) + overlays({ whyTask: L('Hier verwendest du die neuen Wörter und die Zeitform selbst. Das ist der Beleg, dass du sie im Gespräch bildest.', 'Here you use the new words and the tense yourself. That is the proof you can produce them in a conversation.') });
  }
  if (v === 'guide') {
    return top + '<div class="ex-body gx">' + blockLine('s', L('So sprichst du', 'How to speak')) +
      '<div class="stagec" style="gap:20px"><div class="h2 disp" style="font-size:26px;line-height:32px">' + L('Du sprichst über die Diktiertaste deiner Tastatur.', 'You speak using your keyboard’s dictation key.') + '</div>' +
      '<ol class="stack s16" style="margin:0;padding:0;list-style:none">' +
      [[ic('globe', 'sm'), L('Globus gedrückt halten → <em>English</em> wählen.', 'Hold the globe key → choose <em>English</em>.')], [ic('mic', 'sm'), L('Mikrofon unten rechts antippen und sprechen.', 'Tap the microphone at the bottom right and speak.')], [ic('send', 'sm'), L('Senden.', 'Send.')]].map((x, i) =>
        '<li style="display:flex;gap:14px;align-items:center"><span class="ri" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--surface-2);color:var(--act-text);flex:none">' + x[0] + '</span><span class="p" style="font-size:17px"><span class="num" style="color:var(--fg-3);margin-right:6px">' + (i + 1) + '</span>' + x[1] + '</span></li>').join('') + '</ol>' +
      '<div style="border-radius:16px;overflow:hidden;box-shadow:0 0 0 1px var(--line-2);pointer-events:none;position:relative">' + drawnKbd({ globe: true, mic: true, sug: false, go: 'return' }) + '</div></div></div>' +
      exFoot(btnPri('guide-ok', L('Verstanden', 'Got it'), 'h8-keyboard'));
  }
  if (v === 'keyboard' || v === 'german') {
    const german = v === 'german';
    const txt = german ? 'Hallo Laura, danke für deine Nachricht. Ich habe dir das Angebot am Montag geschickt.' : SAY_TEXT;
    return top + '<div class="pinned gx">' + ic('pen', 'xs') + '<b>' + L('Wann geschickt, was seitdem, Termin vorschlagen', 'When sent, what since, suggest a call') + '</b></div>' +
      '<div class="ex-body gx" style="justify-content:flex-start">' +
      (german ? '<div class="notice" style="margin-bottom:10px">' + ic('globe', 'sm') + '<span>' + L('Das kam auf Deutsch an. Globus-Taste → English, dann noch einmal.', 'That came through in German. Globe key → English, then try again.') + '</span></div>' : '') +
      '<div class="fieldwrap"><textarea class="field" id="say-field" rows="5" style="min-height:' + (german ? 116 : 150) + 'px" aria-label="' + esc(L('Deine Antwort', 'Your answer')) + '">' + esc(txt) + '</textarea></div></div>' +
      '<div class="ex-foot gx abovekb">' + btnSec('type-instead', L('Lieber tippen', 'Type instead'), 'data-act="typeinstead"') + (german ? btnPri('again', L('Noch einmal', 'Try again'), 'h8-keyboard') : btnPri('send', L('Senden', 'Send'), 'h8-p1')) + '</div>' +
      '<div style="position:relative;flex:none">' + (german ? '' : '<div class="arrowtip" id="mic-tip">' + ic('mic', 'xs') + L('Mikrofon unten rechts', 'Microphone bottom right') + '</div>') + drawnKbd({ mic: !german, globe: german, go: 'return' }) + '</div>';
  }
  if (v === 'p1') {
    return top + reportPage(0, 4,
      blockLine('s', L('Sag es · Rückmeldung', 'Say it · feedback')) +
      '<div class="stack s16" style="padding-top:14px"><div class="verdict" style="color:var(--near)"><span class="vi" style="background:color-mix(in oklch, var(--near) 20%, transparent)">' + ic('near', 'xs') + '</span>' + L('Gut verständlich, ein Zeitform-Fehler', 'Clear, one tense mistake') + '</div>' +
      '<div class="checklist"><div class="ci"><span class="ck y">' + ic('check', 'xs') + '</span><span class="en">follow up</span></div><div class="ci"><span class="ck y">' + ic('check', 'xs') + '</span><span class="en">lead time</span></div><div class="ci"><span class="ck">' + '</span>' + L('Zeitform: 1 von 2 richtig', 'Tense: 1 of 2 right') + '</div></div>' +
      '<div class="stack s8"><div class="lbl">' + L('Das war stark', 'That was strong') + '</div><div class="quote en">„Since then we have talked to our logistics team.“</div><p class="p2">' + L('Genau so verbindest du das Damals mit dem Jetzt.', 'This is exactly how you connect then and now.') + '</p></div>' +
      '<div class="stack s8"><div class="lbl">' + L('2 Punkte üben', '2 things to practice') + '</div>' +
      '<div class="p en"><span class="num" style="color:var(--fg-3)">1</span>&nbsp; <s style="text-decoration-color:var(--bad);color:var(--fg-2)">I have sent you … on Monday</s> → <b>I sent you … on Monday</b></div>' +
      '<div class="p en"><span class="num" style="color:var(--fg-3)">2</span>&nbsp; <span style="color:var(--fg-2)">Can we have a short call</span> → <b>Could we have a short call</b></div></div>' +
      '<p class="p2" style="font-size:13px">' + L('Antworttempo 94 Wörter pro Minute', 'Response pace 94 words per minute') + '</p></div>', 'h8-p2');
  }
  if (v === 'p2' || v === 'p3') {
    const one = v === 'p2';
    return top + reportPage(one ? 1 : 2, 4,
      blockLine('s', L('Punkt ', 'Point ') + (one ? '1' : '2') + L(' von 2', ' of 2')) +
      '<div class="stack s16" style="padding-top:14px"><div class="h2 disp" style="font-size:24px;line-height:30px">' + (one ? L('Zeitpunkt genannt, also past simple', 'Time named, so past simple') : L('Höflicher vorschlagen', 'Suggest more politely')) + '</div>' +
      '<div class="card stack s8"><div class="lbl">' + L('Du hast gesagt', 'You said') + '</div><p class="p en" style="color:var(--fg-2)">' + (one ? 'I have sent you the revised quote on Monday.' : 'Can we have a short call on Wednesday afternoon?') + '</p><div class="hr"></div>' +
      '<div class="lbl">' + L('Besser so', 'Better') + '</div><div style="display:flex;align-items:center;gap:10px"><p class="p en" style="font-weight:600;flex:1">' + (one ? 'I sent you the revised quote on Monday.' : 'Could we have a short call on Wednesday afternoon?') + '</p><button class="iconbtn" id="say-better" data-act="noop" style="margin:0" aria-label="' + esc(L('Anhören', 'Listen')) + '">' + ic('speaker', 'sm') + '</button></div></div>' +
      '<p class="p2">' + (one ? L('<em class="en">on Monday</em> ist ein vergangener Zeitpunkt. Dazu passt past simple.', '<em>on Monday</em> is a past time. That calls for the past simple.') : L('Kein Fehler, nur ein Ton-Tipp: <em class="en">Could</em> klingt bei einer Bitte an die Kundin eine Spur höflicher.', 'Not a mistake, just a tone tip: <em>Could</em> sounds a touch more polite when asking the client.')) + '</p>' +
      '<button class="btn sec full" id="say-again" data-go="h8-keyboard">' + ic('mic', 'sm') + L('Nachsprechen', 'Say it again') + '</button></div>', one ? 'h8-p3' : 'h8-p4');
  }
  // p4
  const ph = [['Since then, we’ve …'], ['Could we have a quick call on …?', L('<em class="en">quick call</em> ist die häufigste Verbindung', '<em>quick call</em> is the most common combination')], ['We can reduce the lead time to …']];
  return top + reportPage(3, 4,
    blockLine('s', L('Wendungen zum Mitnehmen', 'Phrases to keep')) +
    '<div class="stack s8" style="padding-top:14px">' + ph.map((p, i) => '<div class="row" style="min-height:56px"><span class="rt"><b class="en">' + p[0] + '</b>' + (p[1] ? '<span>' + p[1] + '</span>' : '') + '</span><button class="iconbtn" id="ph-add-' + i + '" data-act="addw" data-w="' + esc(p[0]) + '" aria-label="' + esc(L('In die Wörter', 'Add to words')) + '" style="margin:0">' + ic('plus', 'sm') + '</button></div>').join('') +
    '<p class="p2" style="padding-top:8px">' + L('Ein Tipp aufs Plus legt die Wendung in deine Wörter.', 'Tap plus to add the phrase to your words.') + '</p></div>',
    'h9-antic', L('Weiter: Flüssigkeit', 'Continue: Fluency'), btnSec('again-better', L('Nochmal, aber besser', 'Again, but better'), 'data-go="h8-keyboard"'));
}
reg('h8', {
  code: 'H8', name: 'Sag es (Diktat)', kind: 'phone',
  variants: [['scenario', 'Aufgabe'], ['guide', 'Anleitung beim ersten Mal'], ['keyboard', 'offene Tastatur'], ['german', 'Deutsch erkannt'], ['p1', 'Seite 1'], ['p2', 'Punkt 1'], ['p3', 'Punkt 2'], ['p4', 'Wendungen']],
  render: h8,
  acts: { whysheet() { S.ui.menu = false; S.ui.sheet = 'why'; render(); } }
});

/* =========================================================
   H9 Flüssigkeit
   ========================================================= */
function h9(v) {
  const blocks = NORMAL();
  const top = exTop(blocks, 5, { antic: 0.2, serial: 0.45, quick: 0.75, end: 1 }[v] || 0.2);
  if (v === 'antic') {
    return top + '<div class="ex-body gx">' + blockLine('s', L('Flüssigkeit · Antizipation · 3 von 8', 'Fluency · anticipation · 3 of 8')) + instr(L('Sag es sofort auf Englisch.', 'Say it in English right away.'), false) +
      '<div class="stagec" style="gap:18px"><div class="p2">' + L('Der Einkauf sagt:', 'Purchasing says:') + '</div><div class="prompt disp" style="font-size:26px;line-height:33px">' + L('„Ihr Wettbewerber ist 10 Prozent günstiger.“', '“Your competitor is 10 percent cheaper.”') + '</div>' +
      '<p class="p">' + L('Bleib ruhig und frag höflich nach, mit welchem Angebot sie euch vergleichen.', 'Stay calm and ask politely which offer they’re comparing you with.') + '</p>' +
      '<div class="fieldwrap"><div class="field" style="min-height:72px;color:var(--fg-3)">' + L('Deine Antwort …', 'Your answer …') + '</div><div class="timeline"><i></i></div></div></div></div>' +
      exFoot(btnSec('aloud', L('Laut gesagt', 'Said aloud'), 'data-go="h9-serial"') + btnPri('speak', L('Sprechen', 'Speak'), 'h9-serial'));
  }
  if (v === 'serial') {
    return top + '<div class="pinned gx">' + ic('spark', 'xs') + '<b>' + L('4 von 8 · „Wir haben den Preis schon um 5 Prozent gesenkt.“', '4 of 8 · “We’ve already reduced the price by 5 percent.”') + '</b></div>' +
      '<div class="ex-body gx" style="justify-content:flex-start"><div class="fieldwrap"><textarea class="field en" id="serial-field" rows="3" style="min-height:96px">We’ve already reduced the price by 5</textarea><div class="timeline"><i style="width:48%"></i></div></div>' +
      '<p class="p2" style="padding-top:10px;display:flex;align-items:center;gap:6px">' + ic('mic', 'xs') + L('unten rechts · Feld und Tastatur bleiben offen', 'bottom right · field and keyboard stay open') + '</p></div>' +
      '<div class="ex-foot gx abovekb">' + btnSec('type-instead', L('Lieber tippen', 'Type instead'), 'data-act="typeinstead"') + btnPri('send', L('Senden', 'Send'), 'h9-quick') + '</div>' + drawnKbd({ mic: true, go: 'return' });
  }
  if (v === 'quick') {
    return top + '<div class="ex-body gx">' + blockLine('s', L('Flüssigkeit · Schnellabruf · 6 von 8', 'Fluency · quick recall · 6 of 8')) + instr(L('So schnell es geht, ohne Hetze.', 'As fast as you can, no rush.'), false) +
      '<div class="stagec"><div class="prompt disp">' + L('der Rabatt', 'der Rabatt') + '</div><div style="padding-top:8px;position:relative">' + gapHtml('disc', { big: true, caret: true }) + '</div>' +
      '<div class="timeline" style="position:relative;left:0;right:0;height:2px;width:200px"><i style="width:70%"></i></div></div></div>' +
      exFoot(btnPri('check', L('Prüfen', 'Check'), 'h9-end'), true) + drawnKbd({ go: 'go' });
  }
  const ph = [['Thanks for being upfront about that. Could you tell me which offer you’re comparing us with?', L('höflich nachfragen · auch richtig: <em>comparing us to</em>', 'ask politely · also right: <em>comparing us to</em>')], ['We’ve already reduced the price by 5 percent.', L('Ergebnis, kein Zeitpunkt · auch <em>lowered</em>, <em>cut</em>', 'result, no time · also <em>lowered</em>, <em>cut</em>')], ['We sent the quote on Monday.', L('vergangener Zeitpunkt', 'past time')]];
  return top + '<div class="ex-body gx">' + blockLine('s', L('Flüssigkeit · Sammelkarte', 'Fluency · summary card')) +
    '<div class="stagec" style="gap:18px"><div class="h2 disp" style="font-size:26px;line-height:32px">' + L('8 von 8 gesprochen, 7 auf Anhieb richtig.', '8 of 8 spoken, 7 right first time.') + '</div>' +
    '<div class="card" style="padding:4px 18px">' + '<div class="ex-list en">' + ph.map(p => '<div><b>' + p[0] + '</b><span style="font-family:var(--font)">' + p[1] + '</span></div>').join('') + '</div></div>' +
    '<p class="p2">' + L('Das waren deine schnellsten Antworten diese Woche.', 'These were your fastest answers this week.') + '</p></div></div>' +
    exFoot(btnPri('fl-next', L('Weiter', 'Continue'), 'h10-day'));
}
reg('h9', {
  code: 'H9', name: 'Flüssigkeit', kind: 'phone',
  variants: [['antic', 'Antizipation'], ['serial', 'Serie: Feld bleibt offen'], ['quick', 'Schnellabruf'], ['end', 'Sammelkarte']],
  render: h9
});

/* =========================================================
   H10 Abschlusskarte
   ========================================================= */
function closingCard(v) {
  const lines = v === 'adapt'
    ? [[ic('repeat', 'sm'), L('Wortpartner fielen dir schwer, deshalb kommen diese Woche mehr davon.', 'Collocations were hard for you, so more of them are coming this week.')],
      [ic('gram', 'sm'), '<span class="en">past simple vs. present perfect</span>: <b class="num">55 % → 70 %</b>'],
      [ic('today', 'sm'), L('Serie: <b class="num">14 Tage</b>', 'Streak: <b class="num">14 days</b>')]]
    : [[ic('words', 'sm'), L('Heute neu und gleich frei abgerufen: <em class="en">quote</em> · frei an 1 Tag', 'New today and recalled freely right away: <em>quote</em> · free on 1 day')],
      [ic('gram', 'sm'), '<span class="en">past simple vs. present perfect</span>: <b class="num">40 % → 55 %</b>'],
      [ic('today', 'sm'), L('Serie: <b class="num">14 Tage</b>', 'Streak: <b class="num">14 days</b>')]];
  return lines;
}
reg('h10', {
  code: 'H10', name: 'Abschlusskarte', kind: 'phone',
  variants: [['day', 'Tag'], ['adapt', 'mit Anpassungs-Satz']],
  render(v) {
    const blocks = v === 'adapt' ? dayBlocks('review') : NORMAL();
    return '<div class="ex-body gx" style="justify-content:center;gap:28px;padding-top:40px">' +
      '<div class="ringwrap">' + ringSvg(blocks, blocks.length, 0, { draw: true }).replace('id="ring"', 'id="ring-done"').replace('role="button" tabindex="0"', 'role="img"') + '<div class="ringc"><span style="color:var(--act-text)">' + ic('check') + '</span><b class="disp num" style="font-size:34px;line-height:40px">28 Min.</b></div></div>' +
      '<div class="stack s6" style="text-align:center"><div class="disp" style="font-size:28px;line-height:34px;font-weight:700">' + L('Heute erledigt', 'Done for today') + '</div></div>' +
      '<div class="card" style="padding:6px 18px">' + closingCard(v).map(l => '<div class="st" style="min-height:56px;gap:14px;font-size:16px;line-height:22px"><span style="color:var(--fg-2)">' + l[0] + '</span><span>' + l[1] + '</span></div>').join('') + '</div></div>' +
      exFoot(btnPri('close-day', L('Fertig', 'Done'), 'h1-done'));
  }
});

/* =========================================================
   H11 Mission im Rahmen
   ========================================================= */
function missionChecklist(states, open) {
  const items = [L('Nachfragen, wie das Angebot ankam', 'Ask how the quote was received'), L('Einwand Preis behandeln', 'Handle the price objection'), L('nächsten Termin fixieren', 'Set up the next meeting')];
  const marks = states.map(x => '<span class="ck' + (x ? ' y' : '') + '">' + (x ? ic('check', 'xs') : '') + '</span>').join('');
  return '<button class="checkrow gx" id="cl-toggle" data-act="cl" aria-expanded="' + (open ? 'true' : 'false') + '"><span class="cks">' + marks + '</span><span>' + L('Abhakliste', 'Checklist') + '</span><span style="margin-left:auto">' + ic(open ? 'chevU' : 'chevD', 'sm') + '</span></button>' +
    (open ? '<div class="checklist gx springopen">' + items.map((t, i) => '<div class="ci"><span class="ck' + (states[i] ? ' y' : '') + '">' + (states[i] ? ic('check', 'xs') : '') + '</span>' + t + '</div>').join('') +
      '<div class="ci" style="color:var(--fg-2);font-size:14px">' + L('Zielstruktur: <span class="en">past simple vs. present perfect</span> · <span class="en">discount, lead time, sign off on</span>', 'Target: past simple vs. present perfect · discount, lead time, sign off on') + '</div></div>' : '');
}
/* Kai D: Freie Mission (Extra) hat eine eigene Vorbereitung und öffnet nicht die Wochenmission. */
function h11Free() {
  const back = backTo('h11', 'h29-list');
  return '<div class="ex-top gx"><button class="iconbtn" id="ex-close" data-go="' + back + '" aria-label="' + esc(L('Schließen', 'Close')) + '">' + ic('close') + '</button><div style="flex:1"></div>' + tsExtra() + '</div>' +
    '<div class="ex-body gx">' + blockLine('s', L('Freie Mission · Rückfrage zum Liefertermin', 'Optional mission · Question about the delivery date')) +
    '<div class="stagec" style="gap:16px;justify-content:flex-start;padding-top:16px">' +
    '<div class="persona"><span class="avatar" style="width:52px;height:52px;font-size:17px">LK</span><div><b style="font-size:18px">Laura Keller</b><div class="p2">' + L('Leiterin Einkauf · erfundene Persona', 'Head of Procurement · invented persona') + '</div></div></div>' +
    '<div class="card stack s8"><div class="lbl">' + L('Dein Ziel', 'Your goal') + '</div><p class="p" style="font-size:18px;line-height:25px;font-weight:550">' + L('Kläre, ob der Liefertermin hält, und vereinbare den nächsten Schritt.', 'Find out whether the delivery date holds and agree on the next step.') + '</p></div>' +
    '<div class="stack s8"><div class="lbl">' + L('Abhakliste', 'Checklist') + '</div><div class="checklist" style="padding:0">' +
    [L('Nach dem Liefertermin fragen', 'Ask about the delivery date'), L('Die Lieferzeit bestätigen lassen', 'Get the lead time confirmed'), L('Den nächsten Schritt vereinbaren', 'Agree on the next step')].map(t => '<div class="ci"><span class="ck"></span>' + t + '</div>').join('') + '</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px;padding-top:4px"><span class="chip en">past simple / present perfect</span><span class="chip en">lead time</span><span class="chip en">follow up on</span></div></div>' +
    '<p class="p2">' + L('Etwa 6 Minuten, gesprochen. Freiwillig: zählt als Extra, nicht zur Pflicht.', 'About 6 minutes, spoken. Optional: counts as extra, not toward your daily plan.') + '</p></div></div>' +
    exFoot(btnSec('free-later', L('Später', 'Later'), 'data-go="' + back + '"') + btnPri('free-go', L('Los geht’s', 'Let’s go'), '', ' data-act="freego"'));
}
function h11(v) {
  if (v === 'free') return h11Free();
  const blocks = MISSION();
  const top = exTop(blocks, 4, { prep: 0.05, talk: 0.45, report: 0.9 }[v] || 0.1, { closeTo: 'mission' });
  if (v === 'prep') {
    return top + '<div class="ex-body gx">' + blockLine('s', L('Mission · ', 'Mission · ') + MISSION_NAME()) +
      '<div class="stagec" style="gap:16px;justify-content:flex-start;padding-top:16px">' +
      '<div class="persona"><span class="avatar" style="width:52px;height:52px;font-size:17px">LK</span><div><b style="font-size:18px">Laura Keller</b><div class="p2">' + L('Leiterin Einkauf · erfundene Persona', 'Head of Procurement · invented persona') + '</div></div></div>' +
      '<div class="card stack s8"><div class="lbl">' + L('Dein Ziel', 'Your goal') + '</div><p class="p" style="font-size:18px;line-height:25px;font-weight:550">' + L('Halte den Preis und sichere trotzdem den nächsten Termin.', 'Hold the price and still secure the next meeting.') + '</p></div>' +
      '<div class="stack s8"><div class="lbl">' + L('Abhakliste', 'Checklist') + '</div><div class="checklist" style="padding:0">' +
      [L('Nachfragen, wie das Angebot ankam', 'Ask how the quote was received'), L('Einwand Preis behandeln', 'Handle the price objection'), L('nächsten Termin fixieren', 'Set up the next meeting')].map(t => '<div class="ci"><span class="ck"></span>' + t + '</div>').join('') + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;padding-top:4px"><span class="chip en">past simple / present perfect</span><span class="chip en">discount</span><span class="chip en">lead time</span><span class="chip en">sign off on</span></div></div>' +
      '<p class="p2">' + L('Etwa 9 Minuten, gesprochen. In den ersten zwei Zügen läuft keine Zeit.', 'About 9 minutes, spoken. No timer in the first two turns.') + '</p></div></div>' +
      exFoot(btnSec('pause', L('Pause, später weiter', 'Pause, continue later'), 'data-go="h1-mission"') + btnPri('mission-go', L('Los geht’s', 'Let’s go'), 'h11-talk'));
  }
  if (v === 'talk') {
    return top + missionChecklist([1, 0, 0], !!S.ui.cl) +
      '<div class="ex-body gx" style="gap:10px;justify-content:flex-end;padding-bottom:8px">' +
      '<div class="bubble them en">Thanks for calling back. I’ll be honest: your price is still too high for us.</div>' +
      '<div class="bubble me en">I understand. Could you tell me which offer you’re comparing us with?</div>' +
      '<div class="bubble them en">Another supplier quoted about 10 percent less, and they can deliver in six weeks.</div>' +
      '<div class="fieldwrap" style="margin-top:6px"><div class="field" style="min-height:64px;color:var(--fg-3)">' + L('Deine Antwort …', 'Your answer …') + '</div><div class="timeline"><i style="width:22%"></i></div></div></div>' +
      exFoot(btnSec('aloud', L('Laut gesagt', 'Said aloud'), 'data-go="h11-report"') + btnPri('speak', L('Sprechen', 'Speak'), 'h11-report'));
  }
  return top + reportPage(0, 4,
    blockLine('s', L('Mission · Bericht', 'Mission · report')) +
    '<div class="stack s16" style="padding-top:14px"><div class="verdict" style="color:var(--ok)"><span class="vi" style="background:color-mix(in oklch, var(--ok) 20%, transparent)">' + ic('check', 'xs') + '</span>' + L('Einwand gut behandelt, Termin noch offen', 'Objection handled well, meeting still open') + '</div>' +
    '<div class="checklist" style="padding:0">' + [[1, L('Nachfragen, wie das Angebot ankam', 'Ask how the quote was received')], [1, L('Einwand Preis behandeln', 'Handle the price objection')], [0, L('nächsten Termin fixieren', 'Set up the next meeting')]].map(x => '<div class="ci"><span class="ck' + (x[0] ? ' y' : '') + '">' + (x[0] ? ic('check', 'xs') : '') + '</span>' + x[1] + '</div>').join('') + '</div>' +
    '<div class="stack s8"><div class="lbl">' + L('Das war stark', 'That was strong') + '</div><div class="quote en">„We’ve already reduced the lead time to eight weeks.“</div><p class="p2">' + L('Ergebnis zuerst, ohne Zeitpunkt: genau richtig im present perfect.', 'Result first, no time given: exactly right in the present perfect.') + '</p></div>' +
    '<div class="stack s8"><div class="lbl">' + L('2 Punkte üben', '2 things to practice') + '</div><div class="p">1&nbsp; ' + L('Termin aktiv vorschlagen', 'Suggest the meeting yourself') + '</div><div class="p">2&nbsp; ' + L('Zum Schluss zusammenfassen: <em class="en">So, just to recap: an eight-week lead time at the current price.</em>', 'Sum up at the end: <em>So, just to recap: an eight-week lead time at the current price.</em>') + '</div></div></div>', 'h10-day');
}
reg('h11', {
  code: 'H11', name: 'Mission im Rahmen', kind: 'phone',
  variants: [['prep', 'Vorbereiten'], ['talk', 'Gespräch'], ['report', 'Bericht Seite 1'], ['free', 'Freie Mission (Extra)']],
  render: h11,
  acts: {
    cl() { S.ui.cl = !S.ui.cl; render(); },
    freego() { toast(L('In der Vorschau ist nur die Wochenmission ausgebaut. Das Gespräch der freien Mission sieht gleich aus.', 'Only the weekly mission is built out in this preview. The optional mission’s conversation looks the same.'), 'info'); }
  }
});

/* =========================================================
   H12 Reiter Wörter
   ========================================================= */
/* Wortliste: [Wort, Bedeutung, Stufe, Zustand, Art] · Art: '' normal, 'rest' Wartefenster (S4, nur Wort + Datum), 'new' heute eingeführt. */
const WORDLIST = () => [
  ['quote', L('Preisangebot', 'price quote'), 'S1', L('neu · ruht bis morgen früh', 'new · rests until tomorrow morning'), 'new'],
  ['lead time', L('Lieferzeit', 'lead time'), 'S3', L('auf dem Weg · frei an 1 Tag', 'on the way · free on 1 day'), ''],
  ['follow up', L('nachfassen', 'follow up'), 'S3', L('auf dem Weg · fällig', 'on the way · due'), ''],
  ['procurement', L('Einkauf, Beschaffung', 'purchasing'), 'S5', L('bildest du selbst · fällig', 'you produce it · due'), ''],
  ['flexibility', '', 'S4', L('ruht bis 12.11.', 'rests until Nov 12'), 'rest'],
  ['discount', L('Rabatt', 'discount'), 'S3', L('auf dem Weg · fällig', 'on the way · due'), ''],
  ['budget approval', L('Budgetfreigabe', 'budget approval'), 'S2', L('im Aufbau · fällig', 'building · due'), ''],
  ['sign off on', L('freigeben, absegnen', 'approve'), 'S5', L('bildest du selbst · fällig', 'you produce it · due'), ''],
  ['deadline', L('Frist', 'deadline'), 'S5', L('bildest du selbst', 'you produce it'), '']
];
/* Eine Zeile je Wort. Ruhende Wörter im Wartefenster zeigen nur Wort und Datum (VT 3.5). */
function wordRows(idp, goDetail, goRest) {
  idp = idp || '';
  return WORDLIST().map((w, i) => w[4] === 'rest'
    ? '<button class="row tw-restrow" id="' + idp + 'w-' + i + '" data-go="' + (goRest || 'h12-resting-sheet') + '" data-w="' + w[0] + '"><span class="rt"><b class="en">' + w[0] + '</b><span>' + w[3] + '</span></span><span class="tw-lockic" aria-hidden="true">' + ic('lock', 'xs') + '</span></button>'
    : '<button class="row" id="' + idp + 'w-' + i + '" data-go="' + (goDetail || 'h12-detail') + '" data-w="' + w[0] + '"><span class="rt"><b class="en">' + w[0] + '</b><span>' + w[1] + ' · ' + w[3] + '</span></span><span class="stagepill' + (w[2] === 'S5' ? ' s5' : '') + '">' + w[2] + '</span></button>').join('');
}
function wordDetail() {
  const steps = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5'];
  return '<div class="stack s16 springopen"><div class="stack s6"><div class="prompt disp en" style="font-size:36px;line-height:42px">lead time</div><div class="p2 en">/ˈliːd ˌtaɪm/ · ' + L('Nomen', 'noun') + '</div></div>' +
    '<div class="disp" style="font-size:22px;line-height:28px;font-weight:600">' + L('die Lieferzeit', 'time from order to delivery') + '</div>' +
    '<div class="card stack s8"><div class="lbl">' + L('Stand', 'Status') + '</div><div style="display:flex;gap:4px">' + steps.map((s, i) => '<i style="flex:1;height:6px;border-radius:3px;background:' + (i <= 3 ? 'var(--fg)' : 'var(--surface-3)') + ';opacity:' + (i <= 3 ? (0.4 + i * 0.15) : 1) + '"></i>').join('') + '</div>' +
    '<p class="p">' + L('Auf dem Weg: frei an 1 von 2 Tagen. Nächster Abruf morgen, ohne Satz.', 'On the way: free on 1 of 2 days. Next recall tomorrow, without a sentence.') + '</p></div>' +
    '<div class="stack s6"><div class="lbl">' + L('Ursprungssatz · aus Sprachnachrichten, Di 27.10.', 'Source sentence · from voicemails, Tue Oct 27') + '</div><p class="p en" style="font-size:18px;line-height:26px">Another supplier has also offered us a <b>lead time</b> of six weeks.</p></div>' +
    '<div class="stack s6"><div class="lbl">' + L('Wortpartner', 'Collocations') + '</div><p class="p en">reduce · shorten · quote a lead time</p></div>' +
    '<div class="stack s6"><div class="lbl">' + L('Letzte Versuche', 'Recent attempts') + '</div><div style="display:flex;gap:6px">' +
    [['ok', 'check'], ['bad', 'cross'], ['ok', 'check']].map(x => '<span class="ck' + (x[0] === 'ok' ? ' y' : '') + '" style="' + (x[0] === 'bad' ? 'color:var(--bad);box-shadow:0 0 0 1.5px var(--bad) inset' : '') + '">' + ic(x[1], 'xs') + '</span>').join('') + '</div></div></div>';
}
/* Handlungen zum geöffneten Wort (VT 3.7, Muss 4). idp für die Laptop-Kontextspalte. */
function wordActions(idp) {
  idp = idp || '';
  const paused = !!S.ui.wpause;
  const sec = (id, icon, label, attr) => '<button class="tw-wa" id="' + idp + id + '" ' + attr + '>' + ic(icon, 'sm') + '<span>' + label + '</span></button>';
  return '<div class="stack s16 tw-wact">' +
    (paused ? '<div class="notice tw-notice">' + ic('pause', 'sm') + '<span>' + L('<b>Pausiert.</b> Setzt keine Termine, kommt in keiner Übung. Alles bleibt gespeichert.', '<b>Paused.</b> No dates are set and it won’t appear in exercises. Everything is kept.') + '</span></div>'
      : '<button class="btn pri full" id="' + idp + 'w-practice" data-go="h18-word">' + L('Dieses Wort üben', 'Practice this word') + '</button>' +
      '<p class="tw-note">' + ic('info', 'xs') + '<span>' + L('5 Karten, <em class="en">lead time</em> kommt als letzte. Noch nicht fällig: Übung, der Termin startet ab jetzt neu.', '5 cards, <em>lead time</em> comes last. Not due yet: practice, the review restarts from now.') + '</span></p>') +
    '<div class="tw-wagrid">' +
    sec('w-listen', 'speaker', S.ui.wloop ? L('Hört in Schleife · stoppen', 'Looping · stop') : L('Anhören in Schleife', 'Listen on loop'), 'data-act="wloop" style="grid-column:1/-1" aria-pressed="' + (S.ui.wloop ? 'true' : 'false') + '"') +
    sec('w-say', 'mic', L('Sag es', 'Say it'), 'data-go="h8-scenario"') +
    sec('w-pause', paused ? 'play' : 'pause', paused ? L('Fortsetzen', 'Resume') : L('Pausieren', 'Pause'), 'data-act="wpause" aria-pressed="' + (paused ? 'true' : 'false') + '"') +
    sec('w-ask', 'claude', L('Claude fragen', 'Ask Claude'), 'data-go="h15-claude"') +
    sec('w-manage', 'gear', L('Verwalten', 'Manage'), 'data-go="h23-actions"') + '</div></div>';
}
function restingSheetBody() {
  return '<p class="p">' + L('<b class="en">flexibility</b> ruht bis 12.11. Dann prüfen wir, ob es nach 3 Wochen ohne Kontakt noch sitzt. Öffnen setzt die 3 Wochen zurück.', '<b>flexibility</b> rests until Nov 12. Then we check whether it still holds after 3 weeks without contact. Opening it resets the 3 weeks.') + '</p>';
}
/* Gleiche Gruppen überall, Summe 491: 38 + 41 + 412. „Im Aufbau“ (S2) ist ein Teil von „Erkennst du“. */
const WF_STAND = () => [[L('Alle', 'All'), 491], [L('Bildest du selbst', 'You produce'), 38], [L('Auf dem Weg', 'On the way'), 41], [L('Erkennst du', 'You recognize'), 412], [L('davon im Aufbau', 'of these, still building'), 24], [L('Ruht', 'Resting'), 3], [L('Pausiert', 'Paused'), 2]];
function wordFilterBody() {
  const grp = (t, items, on) => '<div class="tw-grp"><div class="lbl">' + t + '</div><div class="tw-chips">' + items.map((x, i) => '<button class="tw-chip' + (i === on ? ' on' : '') + '" id="wfs-' + t.length + '-' + i + '" data-act="wfchip">' + x[0] + ' <span class="num">' + x[1] + '</span></button>').join('') + '</div></div>';
  return '<div class="stack s16">' + grp(L('Stand', 'Status'), WF_STAND(), 0) +
    grp(L('Art', 'Type'), [[L('Wort', 'Word'), 402], [L('Wendung', 'Phrase'), 61], [L('Wortpartner', 'Collocation'), 28]], -1) +
    grp(L('Herkunft', 'Source'), [[L('Thema', 'Topic'), 312], [L('Eigene Funde', 'My finds'), 97], [L('Lehrer', 'Teacher'), 54], [L('Mission', 'Mission'), 28]], -1) +
    '<button class="row" id="wfs-hard" data-act="wfshard" aria-pressed="false"><span class="ri">' + ic('flag', 'sm') + '</span><span class="rt"><b>' + L('Schwierig', 'Hard') + '</b><span>' + L('zweimal danebengelegen in 30 Tagen · 9', 'missed twice in 30 days · 9') + '</span></span><span class="tw-switch" aria-hidden="true"><i></i></span></button></div>';
}
function h12List(v) {
  const card = {
    list: [L('14 fällig · zählt als Extra', '14 due · counts as extra'), 'h17-default', L('Üben', 'Practice')],
    'list-before': [L('Deine Pflicht ist noch offen. Hier übst du zusätzlich.', 'Your daily plan is still open. This is extra practice.'), 'h17-before-duty', L('Üben', 'Practice')],
    'list-nothing-due': [L('Nichts fällig · schwierige Wörter üben', 'Nothing due · practice hard words'), 'h17-nothing-due', L('Üben', 'Practice')]
  }[v] || null;
  const c = card || [L('14 fällig · zählt als Extra', '14 due · counts as extra'), 'h17-default', L('Üben', 'Practice')];
  const filters = WF_STAND().slice(0, 4);
  return '<div class="scroll">' + phead(L('Wörter', 'Words'), askBtn()) + '<div class="gx stack s16" style="padding-bottom:24px">' +
    '<div class="tw-practice"><div class="tw-pt"><b>' + L('Wörter üben', 'Practice words') + '</b><span>' + c[0] + '</span></div><button class="btn pri" id="w-go" data-go="' + c[1] + '">' + c[2] + '</button></div>' +
    '<label class="field" style="min-height:46px;display:flex;align-items:center;gap:10px;padding:0 14px;color:var(--fg-3)">' + ic('search', 'sm') + '<input id="w-search" placeholder="' + esc(L('Wort suchen', 'Search words')) + '" style="border:0;background:transparent;outline:none;flex:1;min-width:0;font-size:16px;color:var(--fg)" autocomplete="off"></label>' +
    '<div class="tw-chiprow">' + filters.map((f, i) => '<button class="chip" id="wf-' + i + '" style="flex:none;min-height:34px;' + (i === 0 ? 'background:var(--act-soft);color:var(--act-text)' : '') + '">' + f[0] + ' <span class="num" style="opacity:.7">' + f[1] + '</span></button>').join('') +
    '<button class="chip" id="wf-more" data-go="h12-filter" style="flex:none;min-height:34px">' + ic('list', 'xs') + L('Filter', 'Filter') + '</button></div>' +
    '<div id="w-rows">' + wordRows() + '</div><div id="w-found"></div></div></div>' + tabbar('h12');
}
/* Suche filtert sofort; unter den Treffern „Diese N üben“, ohne Treffer der Weg ins Wörterbuch (H21). */
/* E5: Die Wortsuche zeigt auch Treffer in Grammatik und in deinen Fehlern. */
function alsoHits(q, idp) {
  if (q.length < 3) return '';
  const desk = idp === 'd';
  const gram = [['past simple vs. present perfect', 'We sent the revised quote yesterday.', desk ? 'l16-topic' : 'h27-topic'],
    [L('Zeitpräpositionen', 'Time prepositions'), 'for · since · by · until', desk ? 'l4' : 'h6-chapter']].filter(g => (g[0] + ' ' + g[1]).toLowerCase().indexOf(q) >= 0);
  const errs = TM_ERRS().filter(e => (e.w + ' ' + e.r).toLowerCase().indexOf(q) >= 0);
  if (!gram.length && !errs.length) return '';
  const row = (id, lbl, txt, goT) => '<button class="row" id="' + idp + id + '" data-go="' + goT + '"><span class="rt"><b>' + lbl + '</b><span class="en">' + txt + '</span></span><span class="chev">' + ic('chevR', 'sm') + '</span></button>';
  return '<div class="tw-also" style="padding-top:12px">' +
    gram.map((g, i) => row('w-ag-' + i, L('Auch in Grammatik: ', 'Also in grammar: ') + '<span class="en">' + g[0] + '</span>', g[1], g[2])).join('') +
    errs.slice(0, 2).map((e, i) => row('w-ae-' + i, L('Auch in deinen Fehlern', 'Also in your errors') + ' · ' + e.src, esc(e.w) + ' → ' + esc(e.r), desk ? 'l16-errors' : 'h26-list')).join('') + '</div>';
}
function wireWordSearch(idp, practiceGo, emptyGo) {
  idp = idp || '';
  const inp = document.getElementById(idp + 'w-search');
  if (!inp) return;
  inp.addEventListener('input', () => {
    const q = inp.value.trim().toLowerCase();
    let n = 0;
    document.querySelectorAll('#' + idp + 'w-rows .row').forEach(r => { const hit = !q || r.textContent.toLowerCase().indexOf(q) >= 0; r.style.display = hit ? '' : 'none'; if (hit) n++; });
    const f = document.getElementById(idp + 'w-found');
    if (!f) return;
    if (!q) { f.innerHTML = ''; return; }
    f.innerHTML = n
      ? '<button class="btn sec full" id="' + idp + 'w-these" data-go="' + practiceGo + '">' + L('Diese ' + n + ' üben', 'Practice these ' + n) + '</button>'
      : '<div class="tw-empty"><b>' + L('„' + esc(inp.value.trim()) + '“ ist noch nicht in deinen Wörtern.', '“' + esc(inp.value.trim()) + '” isn’t in your words yet.') + '</b><button class="btn sec full" id="' + idp + 'w-dict" data-go="' + emptyGo + '">' + ic('search', 'sm') + L('Im Wörterbuch suchen', 'Look it up') + '</button></div>';
    f.innerHTML += alsoHits(q, idp);
  });
}
reg('h12', {
  code: 'H12', name: 'Reiter Wörter', kind: 'phone',
  variants: [['list', 'Liste mit Üben'], ['list-before', 'Pflicht noch offen'], ['list-nothing-due', 'nichts fällig'], ['detail', 'Wort geöffnet'], ['resting-sheet', 'ruhendes Wort angetippt'], ['filter', 'Filter-Blatt']],
  render(v) {
    if (v === 'detail') {
      return '<header class="phead gx"><button class="iconbtn" id="w-back" data-go="h12-list" aria-label="' + esc(L('Zurück', 'Back')) + '" style="margin-left:-10px;margin-right:0">' + ic('chevL') + '</button>' + askBtn() + '</header>' +
        '<div class="scroll gx stack s24" style="padding-bottom:24px">' + wordDetail() + wordActions() + '</div>' + tabbar('h12');
    }
    if (v === 'resting-sheet') {
      return h12List('list') + sheet('w-rest-sheet', 'flexibility', restingSheetBody(),
        '<div class="stack s8"><button class="btn pri full" id="w-rest-back" data-go="h12-list">' + L('Zurück', 'Back') + '</button><button class="btn ghost full" id="w-rest-open" data-go="h12-list">' + L('Trotzdem öffnen', 'Open anyway') + '</button></div>', { h: '44%', closeAct: 'tolist' });
    }
    if (v === 'filter') {
      return h12List('list') + sheet('w-filter-sheet', L('Filter', 'Filter'), wordFilterBody(),
        '<button class="btn pri full" id="wfs-show" data-go="h12-list">' + L('491 Wörter zeigen', 'Show 491 words') + '</button>', { h: '84%', closeAct: 'tolist' });
    }
    return h12List(v);
  },
  after(v) { if (v.indexOf('list') === 0) wireWordSearch('', 'h18-free', 'h21-search-empty'); },
  acts: {
    tolist() { go('h12-list'); },
    wpause() { S.ui.wpause = !S.ui.wpause; render(); },
    wloop() { S.ui.wloop = !S.ui.wloop; render(); }
  }
});

/* =========================================================
   H13 Reiter Praxis
   ========================================================= */
reg('h13', {
  code: 'H13', name: 'Reiter Praxis', kind: 'phone',
  variants: [['main', 'Übersicht'], ['reader', 'Lesen']],
  render(v) {
    const title = S.tab4 === 'praxis' ? L('Praxis', 'Practice') : L('Sprechen', 'Speaking');
    if (v === 'reader') {
      const para = ['Mid-sized manufacturers have spent the past two years rebuilding their supply chains. Many of them have moved part of their <span class="mk1">procurement</span> to suppliers closer to home, and some have already cut their average <span class="mk2">lead time</span> by a third.',
        'Last spring, a packaging supplier in the region lost two large contracts because it could not deliver on time. Since then, the company has invested in a second warehouse and has hired a team to <span class="mk3">follow up</span> on every open order within 48 hours.'];
      return '<header class="phead gx"><button class="iconbtn" id="r-back" data-go="h13-main" aria-label="' + esc(L('Zurück', 'Back')) + '" style="margin-left:-10px;margin-right:0">' + ic('chevL') + '</button>' + askBtn() + '</header>' +
        '<div class="scroll gx" style="padding-bottom:28px"><style>.mk1{background:color-mix(in oklch,var(--ch-words) 30%,transparent);border-radius:4px}.mk2{background:color-mix(in oklch,var(--ch-words) 18%,transparent);border-radius:4px}.mk3{background:color-mix(in oklch,var(--ch-words) 10%,transparent);border-radius:4px}</style>' +
        '<div class="stack s16" style="max-width:680px"><div class="lbl">' + L('Tagesartikel · 4 Min. · erfundener Text', 'Daily article · 4 min · invented text') + '</div><h2 class="disp en" style="margin:0;font-size:28px;line-height:34px;font-weight:700">Shorter supply chains, faster answers</h2>' +
        para.map(p => '<p class="en" style="margin:0;font-size:18px;line-height:30px;color:var(--fg)">' + p + '</p>').join('') +
        '<p class="p2">' + L('Markiert: Wörter, die du gerade lernst. Je weiter ein Wort ist, desto blasser die Markierung. Noch 3 offen.', 'Marked: words you’re learning. The further along, the paler. 3 still open.') + '</p></div></div>' + tabbar('h13');
    }
    const sec = (t, rows) => '<div class="stack s6"><div style="display:flex;align-items:center;justify-content:space-between"><div class="h2 disp" style="font-size:19px">' + t[0] + '</div><button class="link" id="all-' + t[1] + '"' + (t[2] ? ' data-go="' + t[2] + '"' : ' data-act="noop"') + ' style="font-size:14px">' + L('Alle', 'All') + '</button></div><div>' + rows.map((r, i) => '<button class="row" id="' + t[1] + '-' + i + '" data-go="' + (r[3] || 'h13-main') + '"><span class="ri">' + ic(r[0], 'sm') + '</span><span class="rt"><b>' + r[1] + '</b><span>' + r[2] + '</span></span><span class="chev">' + ic('chevR', 'sm') + '</span></button>').join('') + '</div></div>';
    return '<div class="scroll">' + phead(title, askBtn()) + '<div class="gx stack s24" style="padding-bottom:24px">' +
      '<div class="card stack s8" style="box-shadow:var(--shadow)"><div style="display:flex;align-items:center;gap:8px"><span class="dot s"></span><span class="lbl">' + L('Mission der Woche', 'Mission of the week') + '</span><span class="chip" style="margin-left:auto;min-height:26px">' + ic('cal', 'xs') + L('Freitag in deiner Pflicht', 'Friday in your daily plan') + '</span></div>' +
      '<div class="h2 disp" style="font-size:22px;line-height:28px">' + MISSION_NAME() + '</div>' +
      '<p class="p2">' + L('Ziel: den Preis halten und trotzdem den nächsten Termin sichern. Teilziel: den Preis-Einwand behandeln.', 'Goal: hold the price and still secure the next meeting. Sub-goal: handle the price objection.') + '</p>' +
      '<div class="checklist" style="padding:2px 0 0">' + [L('Nachfragen, wie das Angebot ankam', 'Ask how the quote was received'), L('Einwand Preis behandeln', 'Handle the price objection'), L('nächsten Termin fixieren', 'Set up the next meeting')].map(t => '<div class="ci" style="font-size:14px;min-height:26px"><span class="ck" style="width:16px;height:16px"></span>' + t + '</div>').join('') + '</div></div>' +
      sec([L('Sprechen', 'Speaking'), 'sp', 'h29-list'], [['cal', L('Mein nächster Termin', 'My next meeting'), L('Dienstag Call mit Einkauf · ändern', 'Tuesday call with purchasing · change'), 'termin-filled'], ['speak', L('Freie Mission', 'Optional mission'), L('Rückfrage zum Liefertermin', 'Question about the delivery date'), 'h11-free'], ['spark', L('Hot Seat', 'Hot seat'), L('eine unerwartete Kundenfrage', 'one unexpected client question'), 'h9-antic']]) +
      sec([L('Hören', 'Listening'), 'li', 'h33-list'], [['ear', L('Sprachnachrichten', 'Voicemails'), L('3 neue aus dem Einkauf', '3 new from purchasing'), 'h7-predict'], ['repeat', 'Shadowing', L('kurze Sätze nachsprechen', 'repeat short sentences'), 'h8-guide']]) +
      sec([L('Lesen', 'Reading'), 're', 'h35-archive'], [['book', L('Tagesartikel', 'Daily article'), L('Lieferketten unter Druck · 4 Min.', 'Supply chains under pressure · 4 min'), 'h13-reader'], ['list', L('Kurse', 'Courses'), L('Verhandeln auf Englisch · Lektion 3', 'Negotiating in English · lesson 3'), 'h35-course']]) +
      '<div class="stack s6"><div class="h2 disp" style="font-size:19px">' + L('Lehrerin', 'Teacher') + '</div><button class="row" id="pr-teacher" data-go="h28-paste"><span class="ri">' + ic('pen', 'sm') + '</span><span class="rt"><b>' + L('Korrekturen aus der Stunde', 'Corrections from your lesson') + '</b><span>' + L('einfügen, Lingo sortiert sie ein', 'paste them, Lingo sorts them in') + '</span></span><span class="chev">' + ic('chevR', 'sm') + '</span></button></div>' +
      '</div></div>' + tabbar('h13');
  }
});

/* =========================================================
   H14 Reiter Fortschritt
   ========================================================= */
/* Woche 2 ehrlich: bisher nur die Einstufung als Messung. */
const C1_BASIS = () => L('vorläufig: aus 1 Messung (Einstufung) und 2 von 12 Kann-Beschreibungen · erste echte Schätzung nach Woche 4', 'provisional: from 1 measurement (placement) and 2 of 12 can-do statements · first real estimate after week 4');
function c1Band(thin) {
  const months = ['10/26', '04/27', '10/27', '04/28'];
  const x = m => 8 + m / 18 * 84; // Monate ab Okt 2026, 0..18
  return '<div class="c1band" aria-hidden="true"><svg viewBox="0 0 100 54" preserveAspectRatio="none" style="width:100%;height:54px;overflow:visible">' +
    '<line x1="4" x2="96" y1="22" y2="22" stroke="var(--line-2)" stroke-width="0.6" vector-effect="non-scaling-stroke"/>' +
    (thin ? '' : '<rect x="' + x(12) + '" width="' + (x(15) - x(12)) + '" y="14" height="16" rx="0" fill="var(--fg)" opacity=".16"/><line x1="' + x(12) + '" x2="' + x(15) + '" y1="22" y2="22" stroke="var(--fg)" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linecap="round"/>') +
    '<circle cx="' + x(0) + '" cy="22" r="1" fill="var(--act)"/></svg>' +
    '<div style="position:absolute;left:0;right:0;top:34px;display:flex;justify-content:space-between;font-size:12px;color:var(--fg-3);padding:0 2px" class="num">' + months.map(m => '<span>' + m + '</span>').join('') + '</div>' +
    '<div style="position:absolute;left:calc(' + x(0) + '% - 14px);top:-2px;font-size:11px;font-weight:600;color:var(--act-text)">' + L('heute', 'today') + '</div></div>';
}
function tiles(thin) {
  const trend = (k) => '<span class="tr trend">' + ic(k === 'up' ? 'up' : 'flat', 'xs') + '</span>';
  const w = thin
    ? '<div class="tile" id="tile-w"><div class="th"><span class="dot w"></span>' + L('Bildest du selbst', 'You produce') + '</div><div class="big disp num">0</div><div class="way">' + L('auf dem Weg: 6', 'on the way: 6') + '</div><div class="wbar"><i class="f34" style="left:0;width:4%"></i></div><div class="one">' + L('erkennst du: noch nicht gemessen', 'you recognize: not measured yet') + '</div></div>'
    : '<button class="tile" id="tile-w" data-go="h34-words"><div class="th"><span class="dot w"></span>' + L('Bildest du selbst', 'You produce') + trend('up') + '</div><div class="big disp num">38</div><div class="way num">' + L('auf dem Weg: 41', 'on the way: 41') + '</div>' +
      '<div class="wbar" title="' + esc(L('voll: bildest du selbst · halbtonig: auf dem Weg · Umriss: erkennst du', 'full: you produce · halftone: on the way · outline: you recognize')) + '"><i class="f5" style="width:' + (38 / 491 * 100).toFixed(1) + '%"></i><i class="f34" style="left:' + (38 / 491 * 100).toFixed(1) + '%;width:' + (41 / 491 * 100).toFixed(1) + '%"></i></div><div class="one num">' + L('erkennst du: 412', 'you recognize: 412') + '</div></button>';
  const t = (id, dot, head, big, small, line, tr) => '<button class="tile" id="' + id + '" data-go="' + ({ 'tile-s': 'h14-speech', 'tile-g': 'h34-grammar', 'tile-l': 'h34-listening' }[id]) + '"><div class="th"><span class="dot ' + dot + '"></span>' + head + (thin ? '' : trend(tr)) + '</div><div class="big disp num">' + big + (small ? '<small>' + small + '</small>' : '') + '</div><div class="one">' + line + '</div></button>';
  return '<div class="tiles">' + w +
    t('tile-g', 'g', L('Grammatik', 'Grammar'), thin ? '1' : '1', L('von 8', 'of 8'), thin ? L('Kapitel 1 · Diagnose läuft', 'Chapter 1 · diagnosis running') : L('Kapitel in Arbeit · Thema 1 von 4', 'chapter in progress · topic 1 of 4'), 'flat') +
    t('tile-l', 'l', L('Hören', 'Listening'), thin ? '–' : '71 %', '', thin ? L('noch zu wenig Belege', 'not enough evidence yet') : L('Stufe normal · 1,0×', 'level normal · 1.0×'), 'up') +
    t('tile-s', 's', L('Sprechen', 'Speaking'), thin ? '–' : '92', thin ? '' : L('Wörter/Min.', 'wpm'), thin ? L('ab 3 Sprechaufgaben', 'after 3 speaking tasks') : L('78 % korrekte Sätze', '78 % correct sentences'), 'up') + '</div>';
}
function speechCurve() {
  const pts = [68, 71, 70, 77, 81, 84, 88, 92];
  const X = i => 6 + i * (88 / 7), Y = v => 70 - (v - 60) * 1.7;
  return '<svg viewBox="0 0 100 80" style="width:100%;height:180px" preserveAspectRatio="none" aria-hidden="true">' +
    [0, 1, 2].map(i => '<line x1="0" x2="100" y1="' + (10 + i * 25) + '" y2="' + (10 + i * 25) + '" stroke="var(--line)" vector-effect="non-scaling-stroke"/>').join('') +
    '<polyline fill="none" stroke="var(--fg)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" points="' + pts.map((p, i) => X(i).toFixed(1) + ',' + Y(p).toFixed(1)).join(' ') + '"/>' +
    pts.map((p, i) => '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p).toFixed(1) + '" r="1.1" fill="var(--fg)"/>').join('') +
    '<line x1="' + X(4) + '" x2="' + X(4) + '" y1="4" y2="76" stroke="var(--ch-speak)" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"/></svg>';
}
reg('h14', {
  code: 'H14', name: 'Reiter Fortschritt', kind: 'phone',
  variants: [['main', 'Übersicht'], ['speech', 'Detail Sprechen'], ['thin', 'wenig Belege']],
  render(v) {
    if (v === 'speech') {
      return '<header class="phead gx"><button class="iconbtn" id="s-back" data-go="h14-main" aria-label="' + esc(L('Zurück', 'Back')) + '" style="margin-left:-10px;margin-right:0">' + ic('chevL') + '</button>' + gearBtn() + '</header>' +
        '<div class="scroll gx" style="padding-bottom:24px"><div class="stack s16 springopen"><div class="h2 disp" style="font-size:26px;line-height:32px">' + L('Antworttempo', 'Response pace') + '</div>' +
        '<p class="p2">' + L('Wörter pro Minute bis Senden, nur gesprochene Antworten.', 'Words per minute before you hit Send, spoken answers only.') + '</p><span class="chip" style="align-self:flex-start">' + ic('info', 'xs') + L('seit September, aus der alten App übernommen', 'since September, carried over from the old app') + '</span>' +
        '<div class="card">' + speechCurve() + '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--fg-3)" class="num"><span>' + L('KW 36', 'Wk 36') + '</span><span>' + L('KW 43', 'Wk 43') + '</span></div></div>' +
        '<div class="notice">' + ic('pen', 'sm') + '<span>' + L('Lehrerin am 14.10.: „Spricht flüssiger, Aussprache von <em class="en">th</em> noch unsicher.“', 'Teacher on Oct 14: “More fluent, <em>th</em> still unsure.”') + '</span></div>' +
        '<p class="p2">' + L('Pausen misst die App nicht, weil sie nichts aufnimmt. Die Kurve zeigt nur, was sie wirklich weiß.', 'The app doesn’t measure pauses because it records nothing. The curve only shows what it really knows.') + '</p></div></div>' + tabbar('h14');
    }
    const thin = v === 'thin';
    return '<div class="scroll">' + phead(L('Fortschritt', 'Progress'), gearBtn()) + '<div class="gx stack s24" style="padding-bottom:24px">' +
      '<div class="c1"><p class="s disp">' + (thin ? L('C1-Schätzung: noch zu wenig Belege', 'C1 estimate: not enough evidence yet') : L('C1 voraussichtlich zwischen Oktober 2027 und Januar 2028', 'C1 expected between October 2027 and January 2028')) + '</p>' + c1Band(thin) +
      '<p class="p2" style="font-size:13px">' + (thin ? L('Bisher 1 Messung (Einstufung). Die erste echte Schätzung kommt nach Woche 4.', 'So far 1 measurement (placement). The first real estimate comes after week 4.') : C1_BASIS()) + '</p></div>' +
      tiles(thin) +
      '<div>' + [['flag', L('Deine Fehler', 'Your errors'), L('3 offen · alle aus deinen Übungen und von der Lehrerin', '3 open · all from your exercises and your teacher'), 'h26-list', 'p-errors'],
        ['cal', L('Verlauf', 'History'), L('Wochen, Einstufung, Lehrerin', 'Weeks, placement, teacher'), 'h34-history', 'p-history'],
        ['info', L('So funktioniert’s', 'How it works'), L('Stufen, Tagesplan, was zählt', 'Stages, daily plan, what counts'), 'h37-overview', 'p-howto']].map(r =>
        '<button class="row" id="' + r[4] + '" data-go="' + r[3] + '"><span class="ri">' + ic(r[0], 'sm') + '</span><span class="rt"><b>' + r[1] + '</b><span>' + r[2] + '</span></span><span class="chev">' + ic('chevR', 'sm') + '</span></button>').join('') + '</div>' +
      '</div></div>' + tabbar('h14');
  }
});

/* =========================================================
   H15 Blatt Fragen
   ========================================================= */
reg('h15', {
  code: 'H15', name: 'Blatt „Fragen“', kind: 'phone', borrow: ['h2'],
  variants: [['claude', 'Claude'], ['translate', 'Übersetzen'], ['saved', 'In die Wörter gespeichert']],
  render(v) {
    const saved = v === 'saved';
    if (saved) v = 'translate';
    S.typed = null; S.ui.checked = true;
    const under = gramTask({ checked: true, st: 'wrong' });
    const seg = '<div class="seg2 ts-seg3" role="tablist"><button id="ask-claude" data-go="h15-claude" class="' + (v === 'claude' ? 'on' : '') + '" role="tab">Claude</button><button id="ask-trans" data-go="h15-translate" class="' + (v === 'translate' ? 'on' : '') + '" role="tab">' + L('Übersetzen', 'Translate') + '</button><button id="ask-check" data-go="h36-sentence" role="tab">' + L('Prüfen', 'Check') + '</button></div>';
    let body;
    if (v === 'claude') {
      body = '<div class="stack s16"><span class="chip" style="align-self:flex-start">' + ic('info', 'xs') + L('Aufgabe + deine Antwort sind dabei', 'Task + your answer included') + '</span>' +
        '<div class="bubble me" style="max-width:92%">' + L('Warum nicht <span class="en">have sent</span>? Es ist doch gerade erst passiert.', 'Why not have sent? It only just happened.') + '</div>' +
        '<div class="p" style="line-height:24px">' + L('Weil <em class="en">yesterday</em> im Satz steht. Ein vergangener Zeitpunkt macht die Handlung abgeschlossen, egal wie kurz sie her ist. Ohne Zeitangabe wäre <em class="en">We’ve sent the revised quote</em> richtig. Ist es eben erst passiert: <em class="en">We’ve just sent it</em> (US auch <em class="en">We just sent it</em>).', 'Because yesterday is in the sentence. A past time expression makes the action finished, however recent. Without a time word, We’ve sent the revised quote would be right. If it only just happened: We’ve just sent it (US also We just sent it).') + '</div></div>';
    } else {
      body = '<div class="stack s16"><div class="field" style="min-height:76px">Wir haben die Lieferzeit bereits verkürzt.</div>' +
        '<div class="card stack s8"><p class="p en" style="font-weight:600;font-size:18px">We’ve already reduced the lead time.</p><p class="p2 en">also: We’ve already shortened the lead time. · We’ve already cut the lead time.</p>' +
        '<p class="p2">' + L('Kein Zeitpunkt, Ergebnis zählt: present perfect.', 'No time named, result matters: present perfect.') + '</p></div></div>';
    }
    const foot = v === 'claude' ? '<div style="display:flex;gap:8px"><div class="field" style="min-height:48px;flex:1;padding:12px 14px;color:var(--fg-3)">' + L('Frag Claude …', 'Ask Claude …') + '</div><button class="btn pri" id="ask-send" data-act="sendq" aria-label="' + esc(L('Senden', 'Send')) + '" style="width:52px;padding:0">' + ic('send', 'sm') + '</button></div>'
      : (saved ? '<div class="tw-saved" role="status" id="tr-saved"><span class="tw-savedic">' + ic('check', 'xs') + '</span><span><b class="en">reduce the lead time</b>' + L(' ist in deinen Wörtern · erkennst du', ' is in your words · you recognize') + '</span><button class="link" id="tr-undo" data-go="h15-translate">' + L('Rückgängig', 'Undo') + '</button></div>' : '') +
        '<div style="display:flex;gap:8px">' + (saved ? '' : '<button class="btn sec" id="tr-add" data-go="h15-saved" style="flex:1">' + L('In die Wörter', 'Add to words') + '</button>') + '<button class="btn pri" id="tr-done" data-go="h4-band" style="flex:1">' + L('Fertig', 'Done') + '</button></div>';
    return under + '<div class="scrim" data-go="h4-band"></div><div class="sheet" id="ask-sheet" role="dialog" aria-label="' + esc(L('Fragen', 'Ask')) + '" style="height:78%"><div class="grab"></div><div class="gx" style="padding-bottom:6px">' + seg + '</div><div class="sb gx">' + body + '</div><div class="sf gx">' + foot + '</div></div>';
  }
});

/* =========================================================
   H16 Ausfälle
   ========================================================= */
reg('h16', {
  code: 'H16', name: 'Ausfälle', kind: 'phone', borrow: ['h18'],
  variants: [['noai', 'Claude nicht erreichbar'], ['tts', 'Vorlesen geht nicht'], ['empty', 'leere Liste'], ['nosave', 'Speichern geht gerade nicht']],
  render(v) {
    if (v === 'nosave') {
      S.ui.checked = true; S.ui.ownInput = false;
      const note = '<div class="notice tw-notice tw-nosave" role="status">' + ic('offline', 'sm') + '<span>' + L('<b>Speichern geht gerade nicht.</b> Deine Antworten bleiben auf diesem Gerät und gehen von selbst hoch, sobald es wieder geht. Nichts geht verloren.', '<b>Saving isn’t working right now.</b> Your answers stay on this device and upload on their own once it works again. Nothing is lost.') + '</span></div>';
      return h18('free').replace('<div class="ex-body gx with-band">', '<div class="ex-body gx with-band">' + note);
    }
    if (v === 'noai') {
      const blocks = NORMAL();
      return exTop(blocks, 4, 0.7) + '<div class="ex-body gx">' + blockLine('s', L('Sag es · Rückmeldung', 'Say it · feedback')) +
        '<div class="stagec" style="gap:16px"><div class="notice">' + ic('offline', 'sm') + '<span>' + L('Claude antwortet gerade nicht. Deine Antwort ist gespeichert. Die Rückmeldung kommt, sobald es wieder geht.', 'Claude isn’t responding right now. Your answer is saved. Feedback will follow as soon as it’s back.') + '</span></div>' +
        '<div class="card stack s8"><div class="lbl">' + L('Deine Antwort', 'Your answer') + '</div><p class="p en" style="color:var(--fg-2)">' + esc(SAY_TEXT) + '</p></div>' +
        '<p class="p2">' + L('Der Block zählt trotzdem. Du kannst einfach weitermachen.', 'The block still counts. You can simply continue.') + '</p></div></div>' +
        exFoot(btnSec('retry', L('Erneut versuchen', 'Try again'), 'data-act="retry"') + btnPri('cont', L('Weiter', 'Continue'), 'h9-antic'));
    }
    if (v === 'tts') {
      const blocks = NORMAL();
      return exTop(blocks, 3, 0.1) + '<div class="ex-body gx">' + blockLine('l', L('Hören · Mini-Diktat 1 von 2', 'Listening · mini dictation 1 of 2')) +
        '<div class="stagec" style="gap:16px"><div class="notice">' + ic('speaker', 'sm') + '<span>' + L('Vorlesen geht auf diesem Gerät gerade nicht. Hier ist der Satz zum Lesen. Der Block zählt trotzdem.', 'Read-aloud isn’t working on this device right now. Here is the sentence to read. The block still counts.') + '</span></div>' +
        '<div class="card"><p class="p en" style="font-size:20px;line-height:28px;font-weight:550">We sent the revised quote on March 3.</p></div></div></div>' +
        exFoot(btnPri('cont', L('Weiter', 'Continue'), 'h7-predict'));
    }
    return '<div class="scroll">' + phead(L('Wörter', 'Words'), askBtn()) + '<div class="gx stack s16">' +
      '<div style="display:flex;gap:6px"><span class="chip" style="min-height:34px">' + L('Alle', 'All') + '</span><span class="chip" style="min-height:34px;background:var(--act-soft);color:var(--act-text)">' + L('Auf dem Weg', 'On the way') + ' 0</span></div>' +
      '<div class="stack s8" style="padding:48px 8px;text-align:center;align-items:center"><span style="color:var(--fg-3)">' + ic('words') + '</span><div class="h2 disp">' + L('Noch keine Wörter auf dem Weg', 'No words on the way yet') + '</div><p class="p2" style="max-width:300px">' + L('Ein Wort kommt hierher, sobald du es an zwei Tagen frei weißt.', 'A word lands here once you recall it freely on two days.') + '</p></div></div></div>' + tabbar('h12');
  }
});

/* =========================================================
   Termin-Seite und Wochenfrage
   ========================================================= */
reg('termin', {
  code: 'T', name: 'Termin-Seite', kind: 'phone',
  variants: [['ask', 'Frage'], ['filled', 'diktiert']],
  render(v) {
    const blocks = NORMAL();
    const filled = v === 'filled';
    return exTop(blocks, 4, 0.02) + '<div class="ex-body gx">' + blockLine('s', L('Sag es · erste Sprechaufgabe der Woche', 'Say it · first speaking task of the week')) +
      '<div class="stagec" style="gap:16px"><div class="disp" style="font-size:28px;line-height:34px;font-weight:700;text-wrap:balance">' + L('Steht ein echter Kundentermin an?', 'Is a real client meeting coming up?') + '</div>' +
      '<p class="p" style="color:var(--fg-2)">' + L('In 1–2 Sätzen diktieren. Block 5 und die Mission bauen darauf auf.', 'Dictate it in 1–2 sentences. Block 5 and the mission build on it.') + '</p>' +
      '<div class="field" style="min-height:96px;' + (filled ? '' : 'color:var(--fg-3)') + '">' + (filled ? 'Dienstag Call mit dem Einkauf, sie wollen über den Preis reden.' : L('z. B. Dienstag Call mit Einkauf, Preis-Einwand erwartet', 'e.g. Tuesday call with purchasing, price objection expected')) + '</div>' +
      '<p class="p2" style="display:flex;gap:8px;align-items:flex-start;font-size:13px">' + ic('lock', 'xs') + L('Bitte ohne Namen. Der Text bleibt nur in deiner Datenbank.', 'Please no names. The text stays only in your database.') + '</p></div></div>' +
      exFoot(btnSec('skip', L('Überspringen', 'Skip'), 'data-go="h8-scenario"') + (filled ? btnPri('send', L('Senden', 'Send'), 'h8-scenario') : btnPri('speak', L('Sprechen', 'Speak'), 'termin-filled')));
  }
});
/* Nach der Wochenfrage zum Wochenbericht: vom Laptop (L17) zurück nach L17, sonst H30. */
function wocheBack() { const d = SCREENS[S.from]; return d && d.kind === 'desk' ? 'l17-report' : 'h30-report'; }
reg('woche', {
  code: 'W', name: 'Wochenfrage', kind: 'phone',
  variants: [['ask', 'Frage']],
  render() {
    const blocks = dayBlocks('review');
    const sel = S.ui.conf;
    return exTop(blocks, 4, 0.98) + '<div class="ex-body gx">' + blockLine('s', L('Wochenabschluss', 'Week review')) +
      '<div class="stagec" style="gap:22px"><div class="disp" style="font-size:24px;line-height:31px;font-weight:650;text-wrap:balance">' + L('Wie sicher fühlst du dich im englischen Kundengespräch?', 'How confident do you feel in client conversations in English?') + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">' + [1, 2, 3, 4, 5].map(n => '<button class="choice" id="conf-' + n + '" data-act="conf" data-n="' + n + '" style="flex-direction:column;justify-content:center;gap:2px;min-height:76px;padding:0;' + (sel === n ? 'box-shadow:0 0 0 2px var(--act) inset;background:var(--act-soft)' : '') + '"><span class="disp num" style="font-size:24px;font-weight:650">' + n + '</span></button>').join('') + '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--fg-2);margin-top:-12px"><span>' + L('unsicher', 'unsure') + '</span><span>' + L('sicher', 'confident') + '</span></div>' +
      '<div style="display:flex;justify-content:center"><button class="btn ghost" id="conf-skip" data-go="' + (wocheBack()) + '" style="font-size:14px">' + L('Diesmal nicht', 'Not this time') + '</button></div></div></div>';
  },
  acts: { conf(el) { S.ui.conf = +el.getAttribute('data-n'); render(); setTimeout(() => go(wocheBack()), S.motion === 'off' ? 150 : 420); } }
});
