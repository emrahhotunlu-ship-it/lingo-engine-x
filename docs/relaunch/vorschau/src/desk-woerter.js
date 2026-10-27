/* Paket A „Wörter“ am Laptop (Nora-A): L11 Trainer-Start, L12 Trainer-Aufgabe, L13 Anki, L14 Ergebnis.
   Gleiche Inhalte und Regeln wie H17–H20; Tasten ⏎, T, W, Esc, Leertaste, 1–4, Z. */

/* Handy-Ziele auf die Laptop-Gegenstücke abbilden. */
function twDeskGo(t) {
  if (/^h18-gap|^h18-situation/.test(t)) return 'l12-task';
  if (/^h18-/.test(t)) return 'l12-task';
  if (t === 'h19-recognize-front') return 'l13-recognize';
  if (t === 'h19-produce-front') return 'l13-produce';
  if (t === 'h17-new-words') return 'l11-new-words';
  return t;
}
function twDTop(cur, total, o) {
  o = o || {};
  const fill = Math.max(0.04, Math.min(1, (cur - (o.done ? 0 : 0.65)) / total));
  return '<div class="dtop tw-top"><button class="iconbtn" id="dx-close" data-go="' + (o.closeTo || 'l5') + '" aria-label="' + esc(L('Schließen', 'Close')) + '">' + ic('close') + '</button>' +
    '<div class="tw-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + cur + '" aria-label="' + esc(L('Fortschritt der Runde', 'Round progress')) + '"><i style="width:' + Math.round(fill * 100) + '%"></i></div>' +
    '<span class="tw-count num">' + L(cur + ' von ' + total, cur + ' of ' + total) + (o.plus ? ' <em>+' + o.plus + '</em>' : '') + '</span><span class="tw-badge">Extra</span>' +
    '<button class="btn ghost tw-fin" id="dx-finish" data-go="' + (o.finish || 'l14') + '">' + L('Fertig', 'Done') + kb('Esc') + '</button></div>';
}
function twDHelp() {
  if (!S.ui.help) return '';
  const rows = [['⏎', L('Prüfen, dann Weiter', 'Check, then continue')], ['T', L('Tipp', 'Hint')], ['W', L('Weiß ich nicht', 'Don’t know')], ['1–4', L('Auswahl · Anki-Bewertung', 'Choice · Anki rating')], [L('Leer', 'Space'), L('Anki: aufdecken', 'Anki: reveal')], ['Z', L('Anki: rückgängig (5 s)', 'Anki: undo (5 s)')], ['Esc', L('Feld verlassen, dann Runde beenden', 'Leave the field, then end the round')], ['?', L('Diese Hilfe', 'This help')]];
  return '<div class="kbdhelp" data-act="khelp"><div class="card" role="dialog" aria-label="' + esc(L('Tastenkürzel', 'Shortcuts')) + '"><div class="h2 disp">' + L('Tastenkürzel im Trainer', 'Trainer shortcuts') + '</div><dl>' + rows.map(r => '<dt><span>' + r[0] + '</span></dt><dd>' + r[1] + '</dd>').join('') + '</dl></div></div>';
}

/* ---------- L11 Trainer-Start ---------- */
function l11Preview(v) {
  const list = v === 'new-words'
    ? [['upfront', L('offen, ehrlich (vorab)', 'open, honest'), L('neu', 'new')]].concat(TW_ROUND().slice(0, 9).map(w => [w[0], w[1], w[2]]))
    : TW_ROUND().map(w => [w[0], w[1], w[2]]);
  return '<div class="card tw-prev" style="padding:.3em 1em">' + list.map((w, i) => '<div class="tw-pv"><span class="num tw-pn">' + (i + 1) + '</span><b class="en">' + w[0] + '</b><span class="tw-pm">' + w[1] + '</span><span class="stagepill' + (w[2] === 'S5' ? ' s5' : '') + '">' + w[2] + '</span></div>').join('') + '</div>';
}
function l11Counts() {
  return '<div class="stack s8 tw-counts">' +
    '<p class="tw-cl"><span class="tw-ci ok">' + ic('check', 'xs') + '</span><span>' + L('<b>Fällig</b> zählt voll: bis 4 Uhr morgens.', '<b>Due</b> counts fully, until 4 a.m.') + '</span></p>' +
    '<p class="tw-cl"><span class="tw-ci">' + ic('clock', 'xs') + '</span><span>' + L('<b>Noch nicht fällig</b> ist Übung: der nächste Termin wird ab jetzt gerechnet.', '<b>Not due yet</b> is practice: the next review is counted from now.') + '</span></p>' +
    '<p class="tw-cl"><span class="tw-ci bad">' + ic('cross', 'xs') + '</span><span>' + L('<b>Falsch</b> zählt immer: Nochmal, morgen wieder dran.', '<b>Wrong</b> always counts: again, back tomorrow.') + '</span></p></div>';
}
reg('l11', {
  code: 'L11', name: 'Trainer-Start', kind: 'desk', nav: 'woerter',
  variants: [['default', 'Vorschlag'], ['before-duty', 'Pflicht noch offen'], ['new-words', 'neue Wörter (noch 1)']],
  render(v, o) {
    const c = twCfg();
    const idp = (o.idp || '') + 'd';
    const target = v === 'new-words' ? ['', 'l12-task'] : twStartBtn(c, v);
    let hero = twStartHero(v, c, idp);
    hero = hero.replace(/(id="dtw-go" data-go=")([^"]*)("[^>]*>)([\s\S]*?)<\/button>/, (m, a, g, b, lbl) => a + twDeskGo(g) + b + lbl + kb('⏎') + '</button>');
    const pre = v === 'before-duty' ? '<div class="notice tw-notice">' + ic('info', 'sm') + '<span>' + L('<b>Deine Pflicht ist noch offen.</b> Hier übst du zusätzlich. Die Wörter deines Plans bleiben für die Pflicht.', '<b>Your daily plan is still open.</b> This is extra practice. Your plan’s words stay reserved for it.') + '</span></div>' : '';
    const adj = v === 'new-words' ? '' : '<div class="tw-adjd"><div class="lbl" style="padding-bottom:.4em">' + L('Anpassen', 'Adjust') + '</div>' + twAdjust(c, idp).replace('springopen', '') + '</div>';
    return {
      stage: '<div class="dscroll"><div class="tw-dhead"><h1 class="dh1 disp" style="margin:0">' + L('Wörter üben', 'Practice words') + '</h1><span class="tw-badge">Extra</span></div>' +
        '<div class="stack s16 tw-l11">' + pre + hero + adj + twLockLine(v) + '</div></div>',
      ctx: ctxBlock(L('Was zählt?', 'What counts?'), l11Counts()) +
        ctxBlock(v === 'new-words' ? L('Diese Runde', 'This round') : L('Die ersten 10', 'The first 10'), l11Preview(v)) +
        (v === 'new-words' ? '' : '<p class="p2" style="margin:0;font-size:.85em">' + L('Sortiert nach der niedrigsten Chance, dass du sie noch weißt.', 'Sorted by lowest chance you still remember them.') + '</p>'),
      over: twDHelp(),
      target: twDeskGo(target[1])
    };
  },
  keys(e) {
    if (inField()) return;
    if (e.key === 'Enter') { e.preventDefault(); const b = $('#dtw-go'); if (b) go(b.getAttribute('data-go')); }
    else if (e.key === 'Escape') go('l5');
    else if (e.key === '?') act('khelp');
  },
  acts: {
    cfg(el) {
      const c = twCfg(); const k = el.getAttribute('data-k'), val = el.getAttribute('data-v');
      c[k] = val;
      if (k === 'art' && val === 'tempo') c.dir = 'produce';
      if (k === 'was' && val === 'new') { go('l11-new-words'); return; }
      render();
    }
  }
});

/* ---------- L12 Trainer-Aufgabe ---------- */
function l12Round(v) {
  const done = v === 'checked-early' || v === 'contrast'
    ? [['shortlist', 'ok'], ['deadline', 'near'], ['lead time', v === 'contrast' ? 'bad' : 'run'], ['upfront', ''], ['invoice', ''], ['reach out', ''], ['in stock', ''], ['ship', ''], ['on hold', '']]
    : [['budget approval', 'near'], ['revise a quote', 'ok'], ['follow up', 'ok'], ['sign off on', 'run'], ['procurement', ''], ['reduce', ''], ['discount', ''], ['supplier', ''], ['call back', ''], ['deliver on time', '']];
  const mk = { ok: ['ok', 'check'], near: ['near', 'near'], bad: ['bad', 'cross'] };
  return '<div class="card" style="padding:.3em 1em">' + done.map(w => {
    const m = mk[w[1]];
    return '<div class="st ' + (w[1] === 'run' ? 'run' : (m ? 'done' : 'open')) + ' tw-rr" style="min-height:2.35em;font-size:.92em"><span class="mk' + (m ? ' tw-mk-' + m[0] : '') + '">' + (m ? ic(m[1], 'xs') : '') + '</span><span class="nm en">' + w[0] + '</span>' + (w[1] === 'run' ? '<span class="sm">' + L('jetzt', 'now') + '</span>' : '') + '</div>';
  }).join('') + '</div><p class="p2 tw-legend" style="margin:.5em 0 0;font-size:.85em">' + ic('check', 'xs') + L(' richtig · ', ' right · ') + ic('near', 'xs') + L(' nah dran · ', ' close · ') + ic('cross', 'xs') + L(' kommt wieder', ' comes back') + '</p>';
}
function l12Stage(v) {
  if (v === 'contrast') return l12Contrast();
  const t = TW_T()[v === 'checked-early' ? 'gap' : 'recognize'];
  const checked = v === 'checked' || v === 'checked-early' || !!S.ui.checked;
  const st = checked ? twSt(t) : null;
  const shown = twShown(t, st, checked);
  const you = Object.assign({}, t.you, S.typed && S.ui.ownInput ? { [st]: esc(S.typed) } : {});
  const why = Object.assign({}, t.whyl);
  if (st === 'ok' && S.ui.ownInput && t.alsoOk && t.alts.indexOf(twNorm(S.typed)) >= 0) why.ok = t.alsoOk;
  const gst = checked ? TW_GAPST[st] : '';
  let s = twDTop(t.n, t.total || 10, { done: checked }) + '<div class="dscroll" style="display:flex;flex-direction:column;padding-top:1em">' + blockLine('w', t.bl) + instr(t.instr, 'd-why');
  if (t.form === 'sent') {
    s += '<div class="stack s16" style="padding:3.5em 0 2em;align-items:flex-start"><div class="sent en">' + words(t.before) + ' ' + gapHtml(shown, { caret: !checked, input: !checked, st: gst }) + ' ' + words(t.after) + '</div><div class="hintline" id="d-hint">' + t.hint + '</div></div>';
  } else {
    s += '<div class="stack s16" style="padding:3.5em 0 2em;align-items:flex-start"><div style="display:flex;align-items:center;gap:.75em"><div class="prompt disp en">' + t.prompt + '</div><button class="iconbtn" id="d-say" data-act="noop" aria-label="' + esc(L('Anhören', 'Listen')) + '" style="margin:0;background:var(--surface-2)">' + ic('speaker', 'sm') + '</button></div><div class="hintline" id="d-hint">' + t.hint + '</div>' +
      '<div style="padding-top:.5em">' + gapHtml(shown, { big: true, caret: !checked, input: !checked, st: gst }) + '</div></div>';
  }
  if (checked) {
    s += '<div class="dverdict ' + stCls(st) + '" id="d-verdict" role="status">' + verdictRow(st) + cmpLine(st, you[st], t.rightShow) + '<p class="whyl" style="margin:.2em 0 0">' + why[st] + '</p>' + twLageLine(t, st) + '</div>';
  }
  s += '</div>';
  const next = (st === 'wrong' || st === 'idk') && v === 'checked-early' ? 'l12-contrast' : (v === 'checked-early' ? 'l14' : 'l12-task');
  s += dKeys(checked ? '<button class="btn pri" id="d-next" data-go="' + next + '">' + L('Weiter', 'Continue') + kb('⏎') + '</button>'
    : '<button class="btn sec" id="d-tip" data-act="tip">' + L('Tipp', 'Hint') + kb('T') + '</button><button class="btn sec" id="d-idk" data-act="idk">' + L('Weiß ich nicht', 'Don’t know') + kb('W') + '</button><button class="btn pri" id="d-check" data-act="check">' + L('Prüfen', 'Check') + kb('⏎') + '</button>');
  return s;
}
function l12Contrast() {
  const pick = S.ui.pick;
  const checked = !!pick;
  const st = pick === 'lead time' ? 'ok' : 'wrong';
  let s = twDTop(4, 9, { done: checked }) + '<div class="dscroll" style="display:flex;flex-direction:column;padding-top:1em">' + blockLine('w', L('Wörter üben · Kontrast', 'Practice words · contrast')) +
    instr(L('Was passt in die Lücke?', 'What fits the gap?'), 'd-why') +
    '<div class="stack s16" style="padding:2.2em 0 1.5em"><div class="card tw-ctr"><div class="contrast en"><span class="k">A</span><span><b>delivery</b> <span class="tw-de">' + L('die Lieferung selbst', 'the delivery itself') + '</span></span><span class="k">B</span><span><b>lead time</b> <span class="tw-de">' + L('die Dauer bis zur Lieferung', 'the time until delivery') + '</span></span></div></div>' +
    '<div class="sent en">' + words('Our standard') + ' ' + gapHtml(checked ? pick : '', { st: checked ? TW_GAPST[st] : '' }) + ' ' + words('is ten weeks.') + '</div>' +
    (checked ? '' : '<div class="stack s8" style="max-width:24em">' + [['delivery', 1], ['lead time', 2]].map(c => '<button class="choice en" id="d-c' + c[1] + '" data-act="pick" data-v="' + c[0] + '"><span class="n">' + c[1] + '</span>' + c[0] + '</button>').join('') + '</div>') + '</div>';
  if (checked) s += '<div class="dverdict ' + stCls(st) + '" role="status">' + verdictRow(st) + cmpLine(st, pick, 'lead time') + '<p class="whyl" style="margin:.2em 0 0">' + (st === 'ok' ? L('Es geht um die Dauer, also <em class="en">lead time</em>.', 'It is about duration, so <em>lead time</em>.') : L('Zehn Wochen sind eine Dauer: <em class="en">lead time</em>.', 'Ten weeks is a duration: <em>lead time</em>.')) + '</p><p class="tw-lage">' + ic('clock', 'xs') + '<span>' + L('Auswahl nach dem Fehler ist Rettung: Übung, keine Wirkung auf die Stufe.', 'A choice after a mistake is a rescue: practice, no effect on the stage.') + '</span></p></div>';
  s += '</div>' + dKeys(checked ? '<button class="btn pri" id="d-next" data-go="l14">' + L('Zum Ergebnis', 'See result') + kb('⏎') + '</button>' : '<span class="p2" style="font-size:.9em">' + L('Taste 1 oder 2', 'Press 1 or 2') + '</span>');
  return s;
}
function l12Ctx(v) {
  const t = v === 'contrast' ? TW_T().gap : TW_T()[v === 'checked-early' ? 'gap' : 'recognize'];
  const checked = v === 'checked' || v === 'checked-early' || !!S.ui.checked || (v === 'contrast' && !!S.ui.pick);
  const st = checked ? (v === 'contrast' ? (S.ui.pick === 'lead time' ? 'ok' : 'wrong') : twSt(t)) : null;
  const m = t.more || {};
  const lage = t.lage === 'early' || v === 'contrast'
    ? L('<b>Noch nicht fällig.</b> Schwierig-Runde: Übung, der nächste Termin wird ab jetzt gerechnet. Falsch zählt trotzdem.', '<b>Not due yet.</b> Hard-words round: practice, the next review is counted from now. Wrong still counts.')
    : L('<b>Fällig.</b> Zählt für deinen Plan, Erkennen zählt für „Erkennst du“.', '<b>Due.</b> Counts for your plan; recognition counts toward “you recognize”.');
  const merke = checked
    ? '<p class="p2" style="margin:0">' + (v === 'contrast' ? L('<em class="en">delivery</em> ist die Lieferung, <em class="en">lead time</em> die Dauer bis dahin.', '<em>delivery</em> is the delivery, <em>lead time</em> the time until it.') : t.whyl[st]) + '</p>'
    : '<p class="p2" style="margin:0;color:var(--fg-3)">' + L('Erscheint nach dem Prüfen.', 'Appears after you check.') + '</p>';
  const mehr = checked
    ? '<div class="stack s6"><p class="p2" style="margin:0">' + m.meaning + '</p>' + (m.partners ? '<p class="p2 en" style="margin:0">' + m.partners + '</p>' : '') + (m.trap ? '<p class="p2" style="margin:0">' + m.trap + '</p>' : '') + '</div>'
    : '<p class="p2" style="margin:0;color:var(--fg-3)">' + L('Bedeutung, Wortpartner und typische Falle nach dem Prüfen.', 'Meaning, collocations and common trap after you check.') + '</p>';
  return ctxBlock(L('Warum', 'Why'), '<p class="p2" style="margin:0">' + t.why + '</p>') +
    ctxBlock(L('Merke', 'Remember'), merke) +
    ctxBlock(L('Mehr', 'More'), mehr) +
    ctxBlock(L('Diese Runde', 'This round'), l12Round(v)) +
    ctxBlock(L('Lage', 'Status'), '<p class="p2" style="margin:0">' + lage + '</p>');
}
reg('l12', {
  code: 'L12', name: 'Trainer-Aufgabe', kind: 'desk', nav: 'woerter', demo: true,
  variants: [['task', 'Aufgabe'], ['checked', 'geprüft'], ['checked-early', 'geprüft, nicht fällig'], ['contrast', 'Kontrastkarte']],
  render(v) { return { stage: l12Stage(v), ctx: l12Ctx(v), over: twDHelp() }; },
  after(v) {
    if (v !== 'task' || S.ui.checked) return;
    wireGap('gap', () => act('check'));
    if (S.typed == null && !S.ui.help) { const x = TW_T().recognize.you[S.demo]; if (x) autoType('gap', x); }
  },
  keys(e) {
    const v = curVariant();
    if (S.ui.help && (e.key === 'Escape' || e.key === '?')) { e.preventDefault(); act('khelp'); return; }
    if (e.key === 'Escape') { if (inField()) document.activeElement.blur(); else go('l14'); return; }
    if (inField()) return;
    if (v === 'contrast') {
      if (!S.ui.pick && (e.key === '1' || e.key === '2')) { S.ui.pick = e.key === '1' ? 'delivery' : 'lead time'; render(); }
      else if (S.ui.pick && e.key === 'Enter') { e.preventDefault(); go('l14'); }
      return;
    }
    const checked = v !== 'task' || S.ui.checked;
    if (e.key === 'Enter') { e.preventDefault(); if (checked) { const b = $('#d-next'); if (b) go(b.getAttribute('data-go')); } else act('check'); }
    else if (!checked && (e.key === 't' || e.key === 'T')) act('tip');
    else if (!checked && (e.key === 'w' || e.key === 'W')) act('idk');
    else if (e.key === '?') act('khelp');
  },
  acts: {
    check() { const t = TW_T().recognize; const inp = $('#gap-in'); if (inp && inp.value && inp.value !== t.you[S.demo]) { S.ui.ownInput = true; S.typed = inp.value; } S.ui.checked = true; render(); },
    idk() { S.ui.ownInput = false; S.demo = 'idk'; S.ui.checked = true; render(); },
    tip() { const h = $('#d-hint'); const t = TW_T()[curVariant() === 'checked-early' ? 'gap' : 'recognize']; if (h) h.innerHTML = t.tip; },
    pick(el) { S.ui.pick = el.getAttribute('data-v'); render(); },
    whysheet() {}
  }
});

/* ---------- L13 Anki ---------- */
function l13Stage(v) {
  const rec = v === 'recognize';
  const back = !!S.ui.rev;
  const undo = S.ui.undo;
  let s = twDTop(3, 10, { done: back }) + '<div class="dscroll" style="display:flex;flex-direction:column;padding-top:1em">' +
    '<div style="display:flex;align-items:center;gap:1em;justify-content:space-between"><div>' + blockLine('w', rec ? L('Anki · Erkennen · zählt nur für „Erkennst du“', 'Anki · recognize · counts only toward “you recognize”') : L('Anki · Bilden · plant nichts', 'Anki · produce · schedules nothing')) + '</div>' +
    '<div class="seg2" role="tablist" style="width:16em;flex:none"><button id="d-seg-rec" data-go="l13-recognize" role="tab" class="' + (rec ? 'on' : '') + '">' + L('Erkennen', 'Recognize') + '</button><button id="d-seg-prod" data-go="l13-produce" role="tab" class="' + (rec ? '' : 'on') + '">' + L('Bilden', 'Produce') + '</button></div></div>' +
    '<div class="stagec" style="padding:2em 0"><div class="tw-card' + (back ? ' flipped' : '') + '" style="max-width:34em;margin:0 auto;width:100%">';
  if (rec) {
    s += '<div style="display:flex;align-items:center;gap:.75em;justify-content:center"><div class="prompt disp en">discount</div><button class="iconbtn" id="d-say" data-act="noop" aria-label="' + esc(L('Anhören', 'Listen')) + '" style="margin:0;background:var(--surface-2)">' + ic('speaker', 'sm') + '</button></div>' +
      '<p class="tw-cardsent en">A further discount would be difficult for us, but we could offer a two-year contract with fixed prices.</p>' +
      (back ? '<div class="tw-cardline"></div><div class="tw-back"><div class="disp tw-mean">' + L('der Rabatt', 'der Rabatt') + '</div><div class="p2"><span class="en">' + L('Nomen', 'noun') + '</span> · <span class="en">offer · give · a further discount</span></div></div>' : '');
  } else {
    s += '<div class="prompt disp" style="text-align:center">' + L('die Frist', 'die Frist') + '</div><div class="hintline" style="text-align:center">' + L('bis wann etwas fertig sein muss', 'by when something must be done') + '</div>' +
      (back ? '<div class="tw-cardline"></div><div class="tw-back"><div class="disp tw-mean en">deadline</div><div class="p2 en">meet · miss · extend a deadline</div></div>' : '');
  }
  s += '</div></div>';
  if (undo) s += '<div class="tw-undo tw-undo-d" role="status"><span>' + L('<em class="en">discount</em> · ' + undo + ' · Rückgängig mit Z', '<em>discount</em> · ' + undo + ' · undo with Z') + '</span><button class="link" id="d-undo" data-act="undo">' + L('Rückgängig', 'Undo') + kb('Z') + '</button><i></i></div>';
  s += '</div>';
  let keys;
  if (!back) keys = '<button class="btn pri" id="d-reveal" data-act="reveal">' + L('Aufdecken', 'Reveal') + kb(L('Leer', 'Space')) + '</button>';
  else if (rec) keys = [['again', L('Nochmal', 'Again'), L('1 T', '1 d')], ['hard', L('Schwer', 'Hard'), L('3 T', '3 d')], ['good', L('Gut', 'Good'), L('9 T', '9 d')], ['easy', L('Leicht', 'Easy'), L('21 T', '21 d')]]
    .map((x, i) => '<button class="btn sec tw-drb" id="d-r-' + x[0] + '" data-act="rate" data-v="' + i + '"><span>' + x[1] + '</span><span class="tw-iv num">' + x[2] + '</span>' + kb(String(i + 1)) + '</button>').join('');
  else keys = '<button class="btn sec" id="d-no" data-act="rate" data-v="0">' + L('Wusste ich nicht', 'Didn’t know') + kb('1') + '</button><button class="btn sec" id="d-yes" data-act="rate" data-v="1">' + L('Wusste ich', 'Knew it') + kb('2') + '</button>';
  return s + dKeys(keys);
}
const TW_RATE = () => [L('Nochmal · morgen', 'Again · tomorrow'), L('Schwer · in 3 Tagen', 'Hard · in 3 days'), L('Gut · in 9 Tagen', 'Good · in 9 days'), L('Leicht · in 21 Tagen, Kontrolle beim nächsten Termin', 'Easy · in 21 days, checked at the next due date')];
reg('l13', {
  code: 'L13', name: 'Anki', kind: 'desk', nav: 'woerter',
  variants: [['recognize', 'Erkennen'], ['produce', 'Bilden']],
  render(v) {
    const rec = v === 'recognize';
    return {
      stage: l13Stage(v),
      ctx: ctxBlock(L('Was das plant', 'What this schedules'), '<p class="p2" style="margin:0">' + (rec
        ? L('Erkennen plant nur, wann du das Wort wieder <b>erkennen</b> sollst. Die Abstände stehen an den Knöpfen. Stufen steigen hier nie: dafür braucht es eine Antwort, die die App prüft.', 'Recognize only schedules when you should <b>recognize</b> the word again. Intervals are on the buttons. Stages never go up here; that takes an answer the app checks.')
        : L('Bilden plant nichts. Zählen tut das freie Tippen. Fällige Wörter übst du im Modus Normal, dort zählen sie.', 'Produce schedules nothing. Free typing is what counts. Practice due words in Normal mode, that is where they count.')) + '</p>') +
        ctxBlock(L('Ehrlich bleiben', 'Staying honest'), '<p class="p2" style="margin:0">' + (rec
          ? L('Nach „Leicht“ fragt die App beim nächsten Termin selbst nach, nie vorher.', 'After “easy”, the app checks for itself at the next due date, never earlier.')
          : L('Aufdecken unter 0,8 Sekunden zählt nicht als Versuch. Erst denken, dann Leertaste.', 'Revealing in under 0.8 seconds doesn’t count as a try. Think first, then Space.')) + '</p>') +
        ctxBlock(L('Tasten', 'Keys'), '<p class="p2" style="margin:0">' + (rec ? L('Leertaste deckt auf · 1–4 bewertet · Z macht 5 Sekunden lang rückgängig', 'Space reveals · 1–4 rates · Z undoes for 5 seconds') : L('Leertaste deckt auf · 1 Wusste ich nicht · 2 Wusste ich · Z macht rückgängig', 'Space reveals · 1 didn’t know · 2 knew it · Z undoes')) + '</p>'),
      over: twDHelp()
    };
  },
  keys(e) {
    const rec = curVariant() === 'recognize';
    if (S.ui.help && (e.key === 'Escape' || e.key === '?')) { e.preventDefault(); act('khelp'); return; }
    if (e.key === 'Escape') { go('l14'); return; }
    if (e.key === ' ' && !S.ui.rev) { e.preventDefault(); act('reveal'); return; }
    if ((e.key === 'z' || e.key === 'Z') && S.ui.undo) { act('undo'); return; }
    const n = parseInt(e.key, 10);
    if (S.ui.rev && n >= 1 && n <= (rec ? 4 : 2)) { const el = document.createElement('i'); el.setAttribute('data-v', String(n - 1)); act('rate', el); }
    else if (e.key === '?') act('khelp');
  },
  acts: {
    reveal() { S.ui.rev = true; S.ui.undo = null; render(); },
    rate(el) {
      const i = +el.getAttribute('data-v');
      const rec = curVariant() === 'recognize';
      S.ui.rev = false;
      S.ui.undo = rec ? TW_RATE()[i] : (i ? L('Wusste ich', 'Knew it') : L('Wusste ich nicht', 'Didn’t know'));
      render();
      clearTimeout(window.twUndoT);
      window.twUndoT = setTimeout(() => { if (S.ui.undo) { S.ui.undo = null; render(); } }, 5000);
    },
    undo() { clearTimeout(window.twUndoT); S.ui.undo = null; S.ui.rev = true; render(); }
  }
});

/* ---------- L14 Ergebnis ---------- */
const TW_NEXT = () => [
  ['budget approval', L('morgen, 30.10.', 'tomorrow, Oct 30'), 'near'], ['discount', L('morgen, 30.10.', 'tomorrow, Oct 30'), 'bad'], ['call back', L('Sa 31.10.', 'Sat Oct 31'), 'ok'],
  ['follow up', L('So 1.11.', 'Sun Nov 1'), 'ok'], ['revise a quote', L('Mo 2.11.', 'Mon Nov 2'), 'ok'], ['supplier', L('Di 3.11.', 'Tue Nov 3'), 'ok'], ['deliver on time', L('Mi 4.11.', 'Wed Nov 4'), 'ok'],
  ['reduce', L('Sa 14.11.', 'Sat Nov 14'), 'ok'], ['sign off on', L('Mi 18.11.', 'Wed Nov 18'), 'ok'], ['procurement', L('Sa 21.11.', 'Sat Nov 21'), 'ok']
];
reg('l14', {
  code: 'L14', name: 'Trainer-Ergebnis', kind: 'desk', nav: 'woerter',
  variants: [['normal', 'normal']],
  render() {
    const mk = { ok: ['ok', 'check'], near: ['near', 'near'], bad: ['bad', 'cross'] };
    return {
      stage: '<div class="dscroll" style="display:flex;flex-direction:column;justify-content:center;gap:1.6em;max-width:32em;margin:0 auto;width:100%">' +
        '<div class="tw-resicon"><span>' + ic('check') + '</span></div>' +
        '<div class="stack s6" style="text-align:center"><div class="disp" style="font-size:2em;line-height:1.2;font-weight:700">' + L('Runde fertig', 'Round done') + '</div><div class="p2"><span class="tw-badge">Extra</span> ' + L('zählt nicht zur Pflicht und nicht zur Serie', 'doesn’t count toward your plan or streak') + '</div></div>' +
        twResultCard('normal').replace('style="padding:6px 18px"', 'style="padding:.4em 1.2em"').replace(/min-height:56px;gap:14px;font-size:16px;line-height:22px/g, 'min-height:3.4em;gap:.9em;font-size:1em;line-height:1.4') + '</div>' +
        dKeys('<button class="btn sec" id="d-more4" data-go="l12-task">' + L('Noch 4', '4 more') + '</button><button class="btn pri" id="d-done" data-go="l5">' + L('Fertig', 'Done') + kb('⏎') + '</button>'),
      ctx: ctxBlock(L('Wann jedes Wort wiederkommt', 'When each word comes back'), '<div class="card" style="padding:.3em 1em">' + TW_NEXT().map(w => '<div class="st done tw-rr" style="min-height:2.4em;font-size:.92em"><span class="mk tw-mk-' + mk[w[2]][0] + '">' + ic(mk[w[2]][1], 'xs') + '</span><span class="nm en">' + w[0] + '</span><span class="sm num">' + w[1] + '</span></div>').join('') + '</div>') +
        '<p class="p2" style="margin:0;font-size:.85em">' + L('Falsch heißt: morgen wieder. Richtig heißt: Abstand wächst.', 'Wrong means: back tomorrow. Right means: the gap grows.') + '</p>',
      over: helpOverlay()
    };
  },
  keys(e) { if (e.key === 'Enter') { e.preventDefault(); go('l5'); } else if (e.key === '?') act('khelp'); }
});
