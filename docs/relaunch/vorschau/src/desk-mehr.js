/* Lingo Vorschau · Paket B am Laptop: L15–L17. Nutzt die tm-Bausteine aus screens-mehr.js. */

/* ---------- L15 Einstellungen am Laptop ---------- */
const TM_DGROUPS = () => [
  ['learn', 'today', L('Lernen', 'Learning')],
  ['words', 'words', L('Wörter', 'Words')],
  ['voice', 'speaker', L('Stimme und Ton', 'Voice and sound')],
  ['context', 'pen', L('Mein Kontext', 'My context')],
  ['look', 'spark', L('Aussehen', 'Appearance')],
  ['data', 'book', L('Daten', 'Data')],
  ['diag', 'info', L('Diagnose', 'Diagnostics')]
];
function tmDeskGroup(g) {
  if (g === 'words') return tmGrpWords('d');
  if (g === 'voice') return tmVoiceBody('d');
  if (g === 'context') return tmContextBody('d');
  if (g === 'look') return tmGrpLook('d');
  if (g === 'data') return tmDataBody('d', true);
  if (g === 'diag') return tmDiagBody('d');
  return tmGrpLearn('d', true);
}
reg('l15', {
  code: 'L15', name: 'Einstellungen am Laptop', kind: 'desk', nav: 'einstellungen',
  variants: [['overview', 'Übersicht'], ['diagnosis', 'Diagnose']],
  render(v) {
    const g = S.ui.grp || (v === 'diagnosis' ? 'diag' : 'learn');
    const groups = TM_DGROUPS();
    const cur = groups.find(x => x[0] === g);
    const ctx = g === 'diag'
      ? ctxBlock(L('Wozu diese Seite?', 'What is this page for?'), '<p class="p2" style="margin:0">' + L('Wenn etwas hakt, zeigt sie, was die App gerade misst. Ein Foto davon in claude.ai genügt, du musst nichts selbst prüfen.', 'If something goes wrong, it shows what the app is measuring right now. A photo of it in claude.ai is enough, you don’t need to check anything yourself.') + '</p>') +
        ctxBlock(L('Start', 'Start'), '<div class="card stack s6"><div class="p" style="font-weight:600;color:var(--ok)">' + L('Knopf nach 1,8 s', 'Button after 1.8 s') + '</div><div class="p2">' + L('Ziel unter 2 s. Gemessen beim letzten Öffnen am Handy.', 'Target under 2 s. Measured the last time you opened it on your phone.') + '</div></div>')
      : ctxBlock(L('Fest statt Regler', 'Fixed instead of sliders'), '<p class="p2" style="margin:0">' + L('Tagesdauer und neue Wörter sind bewusst fest. Mehr neue Wörter würden die Wiederholungen von morgen verdrängen, und ein fester Rahmen ist leichter durchzuhalten.', 'Daily length and new words are fixed on purpose. More new words would crowd out tomorrow’s reviews, and a fixed frame is easier to keep up.') + '</p>') +
        ctxBlock(L('Gilt überall', 'Applies everywhere'), '<p class="p2" style="margin:0">' + L('Was du hier änderst, gilt am Handy und am Laptop gleich.', 'What you change here applies the same on phone and laptop.') + '</p>') +
        ctxBlock(L('Diagnose', 'Diagnostics'), '<button class="row" id="dctx-diag" data-act="tmgrp" data-g="diag"><span class="ri">' + ic('info', 'sm') + '</span><span class="rt"><b>' + L('Knopf nach 1,8 s', 'Button after 1.8 s') + '</b><span>' + L('alles in Ordnung', 'all good') + '</span></span><span class="chev">' + ic('chevR', 'sm') + '</span></button>');
    return {
      stage: '<div class="dscroll"><h1 class="dh1 disp">' + L('Einstellungen', 'Preferences') + '</h1><div class="tm-split">' +
        '<nav class="tm-gnav" aria-label="' + esc(L('Gruppen', 'Groups')) + '">' + groups.map(x => '<button id="dgrp-' + x[0] + '" data-act="tmgrp" data-g="' + x[0] + '" class="' + (x[0] === g ? 'on' : '') + '"' + (x[0] === g ? ' aria-current="true"' : '') + '>' + ic(x[1], 'sm') + x[2] + '</button>').join('') + '</nav>' +
        '<div class="stack s24 swap" id="dgrp-body">' + (g === 'learn' || g === 'words' || g === 'look' ? '' : '<div class="h2 disp" style="font-size:1.2em">' + cur[2] + '</div>') + tmDeskGroup(g) + '</div></div></div>',
      ctx
    };
  },
  acts: Object.assign({}, TM_SET_ACTS, { tmgrp(el) { S.ui.grp = el.getAttribute('data-g'); S.ui.copied = false; render(); } })
});

/* ---------- L16 Fehler und Grammatik-Thema am Laptop ---------- */
reg('l16', {
  code: 'L16', name: 'Fehler und Grammatik-Thema am Laptop', kind: 'desk', nav: 'grammatik',
  variants: [['errors', 'Deine Fehler'], ['topic', 'Grammatik-Thema']],
  render(v) {
    if (v === 'topic') {
      return {
        stage: '<div class="dscroll"><div class="lbl">' + L('Kapitel 1 · Thema 1 von 4', 'Chapter 1 · topic 1 of 4') + '</div><h1 class="dh1 disp en" style="margin-top:.2em">past simple vs. present perfect</h1><div class="stack s24">' +
          tmTopicCore('d', true) +
          '<div style="display:flex;align-items:center;gap:1em"><button class="btn pri" id="dtp-practice" data-go="l3">' + L('Üben (Extra)', 'Practice (extra)') + kb('↵') + '</button><span class="p2" style="font-size:.9em">' + L('10 Aufgaben, etwa 5 Minuten. Zählt nicht zum Tagesziel.', '10 tasks, about 5 minutes. Doesn’t count toward your daily goal.') + '</span></div>' +
          tmTopicLinks('d', true) + '</div></div>',
        ctx: '<div id="dtp-lookup" class="stack s24' + (S.ui.lk ? ' swap' : '') + '"><h3 style="margin:0">' + L('Nachschlagen', 'Look it up') + '</h3>' + tmLookupBody() + '</div>'
      };
    }
    const sel = S.ui.err || 'e1';
    return {
      stage: '<div class="dscroll"><h1 class="dh1 disp">' + L('Deine Fehler', 'Your errors') + '</h1><div class="stack s16">' +
        '<p class="p2" style="margin:-.6em 0 0">' + L('Aus Übungen, Sprechen, Schreiben, Missionen und von deiner Lehrerin. Behoben ist ein Fehler, wenn du es an zwei Tagen frei richtig machst.', 'From exercises, speaking, writing, missions and your teacher. An error is fixed once you get it right and free on two days.') + '</p>' +
        tmErrFilters(S.ui.ef || 'all', 'd') + tmErrList('d', true, sel) + '</div></div>',
      ctx: '<div class="stack s16 swap" id="derr-detail">' + tmErrDetail('d', sel) +
        '<div style="display:flex;gap:.6em;flex-wrap:wrap"><button class="btn pri" id="derr-practice" data-go="l16-topic">' + L('Jetzt üben (Extra)', 'Practice now (extra)') + '</button><button class="btn ghost" id="derr-ask" data-go="l7">' + ic('claude', 'sm') + L('Claude fragen', 'Ask Claude') + '</button></div></div>'
    };
  },
  keys(e) {
    if (inField()) return;
    if (curVariant() === 'topic' && e.key === 'Enter') { e.preventDefault(); go('l3'); return; }
    if (curVariant() !== 'errors' || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'j' && e.key !== 'k')) return;
    e.preventDefault();
    const ids = TM_ERRS().map(x => x.id);
    const i = ids.indexOf(S.ui.err || 'e1');
    const d = e.key === 'ArrowDown' || e.key === 'j' ? 1 : -1;
    S.ui.err = ids[Math.max(0, Math.min(ids.length - 1, i + d))];
    render();
  },
  acts: {
    tmerr(el) { S.ui.err = el.getAttribute('data-e'); render(); },
    tmef(el) { S.ui.ef = el.getAttribute('data-v'); render(); },
    tmlookup() { S.ui.lk = (S.ui.lk || 0) + 1; render(); const t = $('#dtp-lookup'); if (t) t.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  }
});

/* ---------- L17 Wochenabschluss am Laptop ---------- */
reg('l17', {
  code: 'L17', name: 'Wochenabschluss am Laptop', kind: 'desk', nav: 'heute',
  variants: [['report', 'Bericht']],
  render() {
    const f = S.ui.focus != null ? S.ui.focus : 0;
    const opts = [[L('Wortpartner', 'Collocations'), L('empfohlen', 'recommended')], [L('Sprechen unter Zeitdruck', 'Speaking under time pressure'), ''], [L('Hören schneller', 'Faster listening'), ''], [L('Keine Vorgabe', 'No preference'), '']];
    return {
      stage: dTop(dayBlocks('review'), 4, 0.96) + '<div class="dscroll stack s16" style="padding-top:1em">' + blockLine('s', L('Wochenabschluss · KW 44', 'Week review · week 44')) +
        '<h1 class="dh1 disp" style="margin:.2em 0 0">' + L('Deine Woche', 'Your week') + '</h1>' + tmWeekCore('d') +
        dKeys('<button class="btn pri" id="dwk-done" data-go="l1">' + L('Fertig', 'Done') + kb('↵') + '</button>') + '</div>',
      ctx: ctxBlock(L('Fokus für nächste Woche', 'Focus for next week'), '<div class="stack s6" role="radiogroup">' + opts.map((o, i) => '<button class="choice" id="dfocus-' + i + '" data-act="tmfocus" data-i="' + i + '" role="radio" aria-checked="' + (f === i) + '" style="min-height:3em;font-size:.95em;' + (f === i ? 'box-shadow:0 0 0 2px var(--act) inset' : '') + '"><span class="tm-radio' + (f === i ? ' on' : '') + '"></span><span style="flex:1">' + o[0] + '</span>' + (o[1] ? '<span class="tm-state">' + o[1] + '</span>' : '') + '</button>').join('') + '</div>') +
        ctxBlock(L('Weitere Messwerte', 'More measurements'), '<div class="card" style="padding:.1em 1em">' + tmLights(TM_ALL().filter((r, i) => i !== 0 && i !== 3 && i !== 7)) + '</div>') +
        ctxBlock(L('Wochenfrage', 'Week question'), '<button class="row" id="dwk-q" data-go="woche-ask"><span class="ri">' + ic('speak', 'sm') + '</span><span class="rt"><b>' + L('Wie sicher im Kundengespräch?', 'How confident with clients?') + '</b><span>' + L('letzte Woche 3 von 5', 'last week 3 of 5') + '</span></span><span class="chev">' + ic('chevR', 'sm') + '</span></button>')
    };
  },
  keys(e) { if (e.key === 'Enter' && !inField()) { e.preventDefault(); go('l1'); } },
  acts: { tmfocus(el) { S.ui.focus = +el.getAttribute('data-i'); render(); } }
});
