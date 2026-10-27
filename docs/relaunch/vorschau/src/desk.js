/* Lingo Vorschau · Laptop-Bildschirme L1–L10.
   Seitenleiste + Bühne + Kontextspalte, alle Maße in em, Grundschrift am .desk. */

const DESK = {};
DESK.bp = function (w) {
  if (w < 1024) return { cls: 'bp-narrow rail', fs: 16 };
  if (w < 1280) return { cls: 'bp-mid rail', fs: 16 };
  if (w < 1920) return { cls: '', fs: 16 };
  if (w < 2400) return { cls: 'bp-xl', fs: 18 };
  return { cls: 'bp-xl', fs: 20 };
};
DESK.frame = function (def, v, W, H) {
  if (def.full) return def.render(v, { W, H });
  if (W >= 1024) {
    return '<div class="view">' + DESK.shell(def, v, W, H, '') + '</div>';
  }
  const s = (W - 32) / 1440;
  return '<div class="view scrollx"><div class="landhint">' + ic('rotate', 'sm') + '<span>' + L('Laptop-Ansicht, verkleinert auf 1440 × 900. Für mehr Platz das Handy quer halten.', 'Laptop view, scaled from 1440 × 900. Turn the phone sideways for more room.') + '</span></div>' +
    '<div style="width:' + Math.floor(1440 * s) + 'px;height:' + Math.floor(900 * s) + 'px;margin:0 16px 24px;overflow:hidden" class="probeframe">' +
    '<div style="width:1440px;height:900px;transform:scale(' + s.toFixed(4) + ');transform-origin:top left">' + DESK.shell(def, v, 1440, 900, '') + '</div></div></div>';
};
DESK.shell = function (def, v, w, h, idp) {
  const bp = DESK.bp(w);
  const rail = S.ui.rail != null ? S.ui.rail : bp.cls.indexOf('rail') >= 0;
  const cls = bp.cls.replace('rail', '').trim() + (rail ? ' rail' : '');
  const out = def.render(v, { w, h, idp: idp || '' });
  return '<div class="desk ' + cls + '" id="' + (idp || '') + 'desk" style="width:' + w + 'px;height:' + h + 'px;font-size:' + bp.fs + 'px">' +
    DESK.side(def.nav, idp || '', rail) +
    '<div class="dmain"><div class="stage">' + out.stage + '</div>' + (out.ctx ? '<aside class="ctx" aria-label="' + esc(L('Kontext', 'Context')) + '">' + out.ctx + '</aside>' : '') + '</div>' +
    (out.over || '') + '</div>';
};
DESK.side = function (active, idp, rail) {
  const t4 = S.tab4 === 'praxis' ? L('Praxis', 'Practice') : L('Sprechen', 'Speaking');
  const n = (id, icon, label, go, sub) => '<button class="nav' + (sub ? ' sub' : '') + (active === id ? ' on' : '') + '" id="' + idp + 'nav-' + id + '"' + (go ? ' data-go="' + go + '"' : ' data-act="noop"') + (rail ? ' aria-label="' + esc(label) + '" title="' + esc(label) + '"' : '') + (active === id ? ' aria-current="page"' : '') + '>' + (sub ? '' : ic(icon)) + '<span class="lbl2">' + label + '</span></button>';
  const subs = S.tab4 === 'praxis' && !rail ? n('sprechen', '', L('Sprechen', 'Speaking'), 'l6-talk', true) + n('hoeren', '', L('Hören', 'Listening'), '', true) + n('lesen', '', L('Lesen', 'Reading'), '', true) : '';
  return '<nav class="side" aria-label="' + esc(L('Hauptbereiche', 'Main sections')) + '">' +
    '<div class="wm"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="6" fill="var(--act)"/><path d="M8 7v10h8" fill="none" stroke="var(--act-fg)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg><b>Lingo</b></div>' +
    n('heute', 'today', L('Heute', 'Today'), 'l1') + n('woerter', 'words', L('Wörter', 'Words'), 'l5') + n('grammatik', 'gram', L('Grammatik', 'Grammar'), 'l4') +
    n('praxis', S.tab4 === 'praxis' ? 'praxis' : 'speak', t4, 'l6-talk') + subs + n('fortschritt', 'prog', L('Fortschritt', 'Progress'), 'l8') +
    '<div class="sp"></div>' +
    n('claude', 'claude', 'Claude', 'l7') + n('uebersetzer', 'trans', L('Übersetzer', 'Translator'), 'l7-translate') + n('einstellungen', 'gear', L('Einstellungen', 'Preferences'), '') +
    '<button class="nav" id="' + idp + 'nav-rail" data-act="rail" aria-label="' + esc(rail ? L('Seitenleiste ausklappen', 'Expand sidebar') : L('Seitenleiste einklappen', 'Collapse sidebar')) + '">' + ic('sidebar') + '<span class="lbl2">' + L('Einklappen', 'Collapse') + '</span></button></nav>';
};
ACTS.rail = () => { const d = $('.desk'); const isRail = d && d.classList.contains('rail'); S.ui.rail = !isRail; render(); };

function dTop(blocks, cur, frac, o) {
  o = o || {};
  return '<div class="dtop"><button class="iconbtn" id="dx-close" data-go="' + (o.closeTo || 'l1') + '" aria-label="' + esc(L('Schließen', 'Close')) + '">' + ic('close') + '</button>' +
    progBar(blocks, cur, frac, o) + '<button class="iconbtn" id="dx-more" data-act="noop" aria-label="' + esc(L('Mehr Möglichkeiten', 'More options')) + '">' + ic('more') + '</button></div>';
}
const kb = k => ' <span class="num" style="opacity:.62;font-size:.85em;margin-left:.35em">' + k + '</span>';
function dKeys(btns) { return '<div class="keys"><button class="btn ghost" id="dk-help" data-act="khelp" aria-label="' + esc(L('Tastenkürzel', 'Shortcuts')) + '">' + ic('kbd', 'sm') + '</button><span class="grow"></span>' + btns + '</div>'; }
function ctxBlock(title, body) { return '<section class="stack s8"><h3>' + title + '</h3>' + body + '</section>'; }
function dayMini(blocks, cur) {
  return '<div class="card" style="padding:.4em 1em">' + blocks.map((b, i) => {
    const st = i < cur ? 'done' : (i === cur ? 'run' : 'open');
    return '<div class="st ' + st + '" style="min-height:2.6em;font-size:.92em"><span class="mk">' + (st === 'done' ? ic('check', 'xs') : '') + '</span><span class="dot ' + b.c + '"></span><span class="nm">' + b.n + '</span><span class="sm num">' + (st === 'run' ? L('läuft', 'now') : b.m + ' Min.') + '</span></div>';
  }).join('') + '</div>';
}
function helpOverlay() {
  if (!S.ui.help) return '';
  const rows = [['⏎', L('Prüfen, dann Weiter', 'Check, then continue')], ['T', L('Tipp', 'Hint')], ['W', L('Weiß ich nicht', 'Don’t know')], ['1–4', L('Auswahl bei Aufgaben mit Antworten', 'Pick an answer in choice tasks')], ['Esc', L('Eingabefeld verlassen · Fenster schließen', 'Leave the field · close panels')], ['?', L('Diese Hilfe', 'This help')]];
  return '<div class="kbdhelp" data-act="khelp"><div class="card" role="dialog" aria-label="' + esc(L('Tastenkürzel', 'Shortcuts')) + '"><div class="h2 disp">' + L('Tastenkürzel', 'Shortcuts') + '</div>' +
    '<dl>' + rows.map(r => '<dt><span>' + r[0] + '</span></dt><dd>' + r[1] + '</dd>').join('') + '</dl>' +
    '<p class="p2" style="margin:1em 0 0;font-size:.85em">' + L('T und W wirken, wenn der Cursor nicht im Eingabefeld steht. Im Feld prüft ⏎.', 'T and W work when the cursor is not in the field. In the field, ⏎ checks.') + '</p></div></div>';
}
ACTS.khelp = () => { S.ui.help = !S.ui.help; render(); };
function inField() { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); }

/* ---------- L1 Heute ---------- */
function l1Stage(v, idp) {
  const blocks = dayBlocks('normal');
  const done = v === 'done' ? blocks.length : 2, partial = v === 'done' ? 0 : 0.4;
  const total = 28, rem = 16;
  const ring = ringSvg(blocks, done, partial, {}).replace('id="ring"', 'id="' + idp + 'ring"').replace('class="ring', 'style="width:13em;height:13em" class="ring');
  const center = v === 'done' ? '<div class="ringc"><span style="color:var(--act-text)">' + ic('check') + '</span><b class="disp num" style="font-size:2.1em;line-height:1.2">' + total + ' Min.</b></div>'
    : '<div class="ringc"><b class="disp num" style="font-size:3em;line-height:1">' + rem + '</b><span style="font-size:.85em">' + L('Min. übrig', 'min left') + '</span></div>';
  return '<div class="dscroll"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.2em"><h1 class="dh1 disp" style="margin:0">' + L('Heute', 'Today') + '</h1>' +
    '<button class="btn sec" id="' + idp + 'd-ask" data-go="l7" style="min-height:2.6em;font-size:.95em">' + ic('ask', 'sm') + L('Fragen', 'Ask') + '</button></div>' +
    '<div class="daycard" style="flex-direction:row;align-items:center;gap:2.2em;padding:2em 2.2em">' +
    '<div class="ringwrap" style="flex:none">' + ring + center + '</div>' +
    '<div class="stack s16" style="flex:1;min-width:0"><div class="dtopic" style="text-align:left"><div class="t disp" style="font-size:1.6em;line-height:1.2">' + TOPIC() + '</div>' +
    (v === 'done' ? '<div class="sub">' + L('Pflicht geschafft. Morgen geht es mit Schritt 4 von 7 weiter.', 'Daily plan done. Tomorrow continues with step 4 of 7.') + '</div>' : '') + '</div>' +
    (v === 'done' ? '' : '<div class="nextl" style="justify-content:flex-start"><span class="dot g"></span><span>' + L('Als Nächstes: Grammatik · <em>past simple vs. present perfect</em>', 'Next: grammar · <em>past simple vs. present perfect</em>') + '</span></div>' +
      '<div><button class="btn pri" id="' + idp + 'd-go" data-go="l3" style="min-width:12em">' + L('Weiter', 'Continue') + kb('⏎') + '</button></div>') + '</div></div>' +
    weekStrip(v === 'done').replace('<div class="gx"><div class="week"', '<div><div class="week" style="padding:1.6em .2em .4em;max-width:30em"') + '</div>';
}
function l1Ctx(idp) {
  idp = idp || '';
  const days = S.lang === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const plan = [L('Wörter · Grammatik · Hören', 'Words · grammar · listening'), L('erledigt', 'done'), L('erledigt', 'done'), L('heute · Grammatik Schritt 3', 'today · grammar step 3'), L('Mission: Preis-Einwand', 'Mission: price objection'), L('Schreibtag: Projekt-Update', 'Writing day: project update'), L('Ruhetag', 'Rest day')];
  plan[0] = L('erledigt', 'done');
  return ctxBlock(L('Diese Woche', 'This week'), '<div class="card" style="padding:.4em 1em">' + days.map((d, i) => '<div class="st ' + (i < 3 ? 'done' : i === 3 ? 'run' : 'open') + '" style="min-height:2.5em;font-size:.92em"><span class="mk">' + (i < 3 ? ic('check', 'xs') : '') + '</span><span style="width:2.4em;color:var(--fg-2)">' + d + '</span><span class="nm">' + plan[i] + '</span>' + (i === 4 ? '<span style="margin-left:auto;color:var(--fg-2)">' + ic('flag', 'xs') + '</span>' : '') + '</div>').join('') + '</div>') +
    ctxBlock(L('Kapitelstand', 'Chapter status'), '<div class="card stack s6"><div style="font-weight:600">' + L('Kapitel 1 · Zeiten im Projektverlauf', 'Chapter 1 · Tenses in project updates') + '</div><div class="p2">' + L('Thema 1 von 4 · Schritt 3 von 7 · noch 4 richtige bis frei', 'Topic 1 of 4 · step 3 of 7 · 4 more correct until free') + '</div></div>') +
    ctxBlock(L('Dein nächster Termin', 'Your next meeting'), '<button class="row" id="' + idp + 'd-termin" data-go="termin-filled" style="border:0;min-height:3em"><span class="ri">' + ic('cal', 'sm') + '</span><span class="rt"><b>' + L('Dienstag · Call mit dem Einkauf', 'Tuesday · call with purchasing') + '</b><span>' + L('Die Mission am Freitag bereitet dich darauf vor · ändern', 'Friday’s mission prepares you for it · change') + '</span></span></button>') +
    ctxBlock(L('Wenn du mehr willst', 'If you want more'), moreRows(false).replace(/<div class="more-div gx">.*?<\/div>/, '').replace('<div class="gx">', '<div>').replace(/id="more-/g, 'id="' + idp + 'more-'));
}
reg('l1', {
  code: 'L1', name: 'Heute', kind: 'desk', nav: 'heute',
  variants: [['main', 'unterwegs'], ['done', 'erledigt']],
  render(v, o) { return { stage: l1Stage(v, o.idp), ctx: l1Ctx(o.idp) }; },
  keys(e) { if (e.key === 'Enter' && !inField() && curVariant() !== 'done') go('l3'); }
});

/* ---------- L2 Wörter-Übung ---------- */
function l2Stage(v) {
  const blocks = dayBlocks('normal');
  const checked = v === 'checked' || S.ui.checked;
  const WD = wordData('recall');
  const st = checked ? (S.typed != null && S.ui.ownInput ? judge(S.typed, WD.right, WD.alts) : S.demo) : null;
  const shown = checked ? (st === 'idk' ? WORD.right : (S.typed && S.ui.ownInput ? S.typed : WORD.you[st])) : (S.typed || '');
  const you = Object.assign({}, WORD.you, S.typed && S.ui.ownInput ? { [st]: esc(S.typed) } : {});
  let s = dTop(blocks, 1, checked ? 0.6 : 0.45) + '<div class="dscroll" style="display:flex;flex-direction:column;padding-top:1em">' +
    blockLine('w', L('Wörter · ', 'Words · ') + TOPIC()) + instr(L('Wie heißt das auf Englisch?', 'What is this in English?'), 'd-why') +
    '<div class="stack s16" style="padding:3.5em 0 2em;align-items:flex-start"><div class="prompt disp">' + L('die Lieferzeit', 'die Lieferzeit') + '</div><div class="hintline" id="d-hint">' + L('im Einkauf · 2 Wörter', 'in purchasing · 2 words') + '</div>' +
    '<div style="padding-top:.5em">' + gapHtml(shown, { big: true, caret: !checked, input: !checked, st: checked ? ({ ok: 'ok', typo: 'near', wrong: 'bad', idk: 'idk' }[st]) : '' }) + '</div></div>';
  if (checked) {
    s += '<div class="dverdict ' + stCls(st) + '" id="d-verdict" role="status">' + verdictRow(st) + cmpLine(st, you[st], WORD.right) + '<p class="whyl" style="margin:.2em 0 0">' + WD.why[st] + '</p>' +
      '<div class="bandbtns" style="padding-top:.5em;max-width:28em"><button class="btn sec sm" id="d-more" data-act="noop">' + L('Mehr', 'More') + '</button>' + (st === 'wrong' || st === 'typo' ? '<button class="btn sec sm" id="d-also" data-go="l7">' + L('War das auch richtig?', 'Was mine also right?') + '</button>' : '') + '</div></div>';
  }
  s += '</div>';
  s += dKeys(checked ? '<button class="btn pri" id="d-next" data-go="l3">' + L('Weiter', 'Continue') + kb('⏎') + '</button>'
    : '<button class="btn sec" id="d-tip" data-act="tip">' + L('Tipp', 'Hint') + kb('T') + '</button><button class="btn sec" id="d-idk" data-act="idk">' + L('Weiß ich nicht', 'Don’t know') + kb('W') + '</button><button class="btn pri" id="d-check" data-act="check">' + L('Prüfen', 'Check') + kb('⏎') + '</button>');
  return s;
}
reg('l2', {
  code: 'L2', name: 'Wörter-Übung', kind: 'desk', nav: 'heute', demo: true,
  variants: [['task', 'Aufgabe'], ['checked', 'geprüft'], ['help', 'Tastenkürzel-Hilfe']],
  render(v) {
    if (v === 'help' && S.ui.help == null) S.ui.help = true;
    const blocks = dayBlocks('normal');
    return {
      stage: l2Stage(v),
      ctx: ctxBlock(L('Wozu?', 'Why?'), '<p class="p2" style="margin:0">' + L('lead time hast du vorgestern neu gelernt. Heute holst du es frei ab, ohne Auswahl. So wird es dein Wort.', 'You learned lead time two days ago. Today you recall it freely. That is how it becomes yours.') + '</p>') +
        ctxBlock(L('Heute', 'Today'), dayMini(blocks, 1)) +
        ctxBlock('Claude', '<button class="btn sec full" id="d-claude" data-go="l7">' + ic('claude', 'sm') + L('Claude zu dieser Aufgabe fragen', 'Ask Claude about this task') + '</button><p class="p2" style="margin:0;font-size:.85em">' + L('Aufgabe und deine Antwort gehen automatisch mit.', 'The task and your answer are included automatically.') + '</p>'),
      over: helpOverlay()
    };
  },
  after(v) {
    if (v !== 'checked' && !S.ui.checked) {
      wireGap('gap', () => act('check'));
      if (S.typed == null && !S.ui.help) { const t = WORD.you[S.demo]; if (t) autoType('gap', t); }
    }
  },
  keys(e) {
    if (S.ui.help && (e.key === 'Escape' || e.key === '?')) { e.preventDefault(); act('khelp'); return; }
    if (e.key === 'Escape' && inField()) { document.activeElement.blur(); return; }
    if (inField()) return;
    const checked = curVariant() === 'checked' || S.ui.checked;
    if (e.key === 'Enter') { e.preventDefault(); if (checked) go('l3'); else act('check'); }
    else if (!checked && (e.key === 't' || e.key === 'T')) act('tip');
    else if (!checked && (e.key === 'w' || e.key === 'W')) act('idk');
    else if (e.key === '?') act('khelp');
  },
  acts: {
    check() { const inp = $('#gap-in'); if (inp && inp.value && inp.value !== WORD.you[S.demo]) S.ui.ownInput = true; S.ui.checked = true; render(); },
    idk() { S.ui.ownInput = false; S.demo = 'idk'; savePrefs(); S.ui.checked = true; render(); },
    tip() { const h = $('#d-hint'); if (h) h.innerHTML = L('Tipp: beginnt mit <em class="en">l</em>, zwei Wörter', 'Hint: starts with <em>l</em>, two words'); }
  }
});

/* ---------- L3 Grammatik ---------- */
function l3Stage(v, claude) {
  const blocks = dayBlocks('normal');
  const checked = v === 'band';
  const st = checked ? (claude ? 'wrong' : S.demo) : null;
  const shown = checked ? (st === 'idk' ? GRAM.right : GRAM.you[st]) : (S.typed != null ? S.typed : 'have sent');
  let s = dTop(blocks, 2, checked ? 0.3 : 0.2) + '<div class="dscroll" style="display:flex;flex-direction:column;padding-top:1em">' +
    blockLine('g', L('Grammatik · <em>past simple vs. present perfect</em> · Schritt 3 von 7', 'Grammar · <em>past simple vs. present perfect</em> · step 3 of 7')) +
    instr(L('Setz das Verb in der passenden Zeitform ein.', 'Put the verb in the right tense.'), 'd-why') +
    '<div class="stack s16" style="padding:3em 0 1.5em">' + gramPattern(checked && st !== 'wrong') +
    '<div class="sent en">We ' + gapHtml(shown, { caret: !checked, input: !checked, st: checked ? ({ ok: 'ok', typo: 'near', wrong: 'bad', idk: 'idk' }[st]) : '' }) + ' <span style="color:var(--fg-3)">(send)</span> the revised quote yesterday.</div></div>';
  if (!checked) s += '<div class="dverdict s-idk" id="d-hintband" style="flex-direction:row;align-items:center;gap:.7em">' + ic('bulb', 'sm') + '<span style="font-weight:550">' + L('Fast. Welche Zeitform passt zu <em class="en">yesterday</em>?', 'Almost. Which tense goes with <em>yesterday</em>?') + '</span></div>';
  else s += '<div class="dverdict ' + stCls(st) + '" id="d-verdict" role="status">' + verdictRow(st) + cmpLine(st, GRAM.you[st], GRAM.right) + '<p class="whyl" style="margin:.2em 0 0">' + WHY_GRAM() + '</p>' +
    '<div class="bandbtns" style="padding-top:.5em;max-width:28em"><button class="btn sec sm" id="d-more" data-act="noop">' + L('Mehr', 'More') + '</button>' + (st === 'wrong' || st === 'typo' ? '<button class="btn sec sm" id="d-also" data-go="l7">' + L('War das auch richtig?', 'Was mine also right?') + '</button>' : '') + '</div></div>';
  s += '</div>' + dKeys(checked ? '<button class="btn pri" id="d-next" data-go="l1">' + L('Weiter', 'Continue') + kb('⏎') + '</button>' : '<button class="btn pri" id="d-check" data-go="l3-band">' + L('Prüfen', 'Check') + kb('⏎') + '</button>');
  return s;
}
function ruleCard() {
  return ctxBlock(L('Regel', 'Rule'), '<div class="card stack s8"><div style="font-weight:650">' + L('Zeitpunkt genannt → past simple', 'Time named → past simple') + '</div>' +
    '<div class="contrast en" style="font-size:.92em"><span class="k" style="color:var(--ok)">' + ic('check', 'xs') + '</span><span><b>We sent it yesterday.</b></span><span class="k" style="color:var(--bad)">' + ic('cross', 'xs') + '</span><span class="no">We have sent it yesterday.</span></div>' +
    '<div class="p2 en" style="font-size:.88em">yesterday · last week · on Monday · ago</div><div class="hr"></div>' +
    '<div style="font-weight:650">' + L('Bis jetzt, ohne Zeitpunkt → present perfect', 'Up to now, no time → present perfect') + '</div><div class="p2 en" style="font-size:.88em">yet · already · so far · since · for</div>' +
    '<button class="link" id="d-explain" data-go="h5-explain" style="align-self:flex-start;font-size:.92em">' + L('Ganze Erklärung', 'Full explanation') + '</button></div>');
}
reg('l3', {
  code: 'L3', name: 'Grammatik-Übung', kind: 'desk', nav: 'heute', demo: true,
  variants: [['hint', 'Hinweis-Runde'], ['band', 'geprüft (längste Warum-Zeile)']],
  render(v) { return { stage: l3Stage(v), ctx: ruleCard() + ctxBlock(L('Heute', 'Today'), dayMini(dayBlocks('normal'), 2)) }; },
  after(v) { if (v === 'hint') wireGap('gap', () => go('l3-band')); },
  keys(e) { if (inField() && e.key !== 'Enter') return; if (e.key === 'Enter') { e.preventDefault(); go(curVariant() === 'band' ? 'l1' : 'l3-band'); } }
});

/* ---------- L4 Reiter Grammatik ---------- */
reg('l4', {
  code: 'L4', name: 'Reiter Grammatik', kind: 'desk', nav: 'grammatik',
  variants: [['main', 'Weg + Kapitel 1']],
  render() {
    return {
      stage: '<div class="dscroll"><h1 class="dh1 disp">' + L('Grammatik', 'Grammar') + '</h1><div class="stack s16">' + hereCard() +
        '<div><div class="lbl" style="padding:.6em 0 .2em">' + L('Dein Weg zu C1 · 8 Kapitel', 'Your path to C1 · 8 chapters') + '</div>' +
        CHAPTERS().map(c => '<button class="row" id="dch-' + c[0] + '" data-act="noop"><span class="ri num' + (c[3] === 'run' ? ' pulsing' : '') + '" style="' + (c[3] === 'run' ? 'background:var(--act-soft);color:var(--act-text);font-weight:700' : 'font-weight:600') + '">' + c[0] + '</span><span class="rt"><b>' + c[1] + '</b><span>' + c[2] + '</span></span>' + (c[3] === 'run' ? '<span class="chev">' + ic('chevR', 'sm') + '</span>' : '') + '</button>').join('') + '</div></div></div>',
      ctx: chapterDetail().replace(/id="ch-explain"/, 'id="d-ch-explain"')
    };
  }
});

/* ---------- L5 Reiter Wörter ---------- */
/* Kopf mit „Üben ⏎“ und „Hinzufügen“; Kontextspalte zeigt das Wortfenster (main), das ruhende Wort (resting) oder Verwalten (manage). */
function l5Stage(v, idp) {
  const filters = WF_STAND().slice(0, 3).concat([WF_STAND()[4]]);
  const sel = v === 'resting' ? 'flexibility' : 'lead time';
  const rows = wordRows(idp + 'd', 'l5-main', 'l5-resting').replace(new RegExp('(<button class="row[^"]*)(" id="[^"]*" data-go="[^"]*" data-w="' + sel + '")'), '$1 tw-selrow$2');
  return '<div class="dscroll"><div class="tw-dhead"><h1 class="dh1 disp" style="margin:0">' + L('Wörter', 'Words') + '</h1><span class="grow"></span>' +
    '<button class="btn sec" id="' + idp + 'dw-add" data-go="h21-search-empty">' + ic('plus', 'sm') + L('Hinzufügen', 'Add') + '</button>' +
    '<button class="btn pri" id="' + idp + 'dw-practice" data-go="l11-default">' + L('Üben', 'Practice') + kb('⏎') + '</button></div>' +
    '<p class="p2 tw-dsub">' + L('14 fällig · zählt als Extra', '14 due · counts as extra') + '</p><div class="stack s16">' +
    '<label class="field" style="min-height:2.9em;display:flex;align-items:center;gap:.6em;padding:0 1em;color:var(--fg-3)">' + ic('search', 'sm') + '<input id="' + idp + 'dw-search" placeholder="' + esc(L('Wort suchen', 'Search words')) + '" style="border:0;background:transparent;outline:none;flex:1;min-width:0;font-size:1em;color:var(--fg)" autocomplete="off"></label>' +
    '<div style="display:flex;gap:.4em;flex-wrap:wrap">' + filters.map((f, i) => '<button class="chip" id="' + idp + 'dwf-' + i + '" style="' + (i === 0 ? 'background:var(--act-soft);color:var(--act-text)' : '') + '">' + f[0] + ' <span class="num" style="opacity:.7">' + f[1] + '</span></button>').join('') +
    '<button class="chip" id="' + idp + 'dwf-more" data-go="h12-filter">' + ic('list', 'xs') + L('Filter', 'Filter') + '</button></div>' +
    '<div id="' + idp + 'dw-rows">' + rows + '</div><div id="' + idp + 'dw-found"></div></div></div>';
}
function l5Ctx(v, idp) {
  if (v === 'resting') {
    return '<div class="stack s16"><div class="stack s6"><div class="prompt disp en" style="font-size:2em">flexibility</div><div class="p2"><span class="tw-lockic">' + ic('lock', 'xs') + '</span> ' + L('ruht bis 12.11.', 'rests until Nov 12') + '</div></div>' +
      '<div class="card">' + restingSheetBody() + '</div>' +
      '<div class="stack s8"><button class="btn pri full" id="' + idp + 'dr-back" data-go="l5-main">' + L('Zurück', 'Back') + kb('Esc') + '</button><button class="btn ghost full" id="' + idp + 'dr-open" data-go="l5-main">' + L('Trotzdem öffnen', 'Open anyway') + '</button></div></div>';
  }
  if (v === 'manage') {
    return '<div class="stack s16"><div style="display:flex;align-items:center;justify-content:space-between"><div class="prompt disp en" style="font-size:1.7em">lead time</div><span class="stagepill">S3</span></div>' +
      twManageRows(idp + 'd', true) + '<button class="btn sec full" id="' + idp + 'dm-back" data-go="l5-main">' + L('Zurück zum Wort', 'Back to the word') + kb('Esc') + '</button></div>';
  }
  return wordDetail() + wordActions(idp + 'd').replace('data-go="h18-word"', 'data-go="l12-task"').replace('data-go="h23-actions"', 'data-go="l5-manage"').replace('data-go="h15-claude"', 'data-go="l7"');
}
reg('l5', {
  code: 'L5', name: 'Reiter Wörter', kind: 'desk', nav: 'woerter',
  variants: [['main', 'Liste + Wort'], ['resting', 'ruhendes Wort'], ['manage', 'Wort verwalten']],
  render(v, o) { return { stage: l5Stage(v, o.idp || ''), ctx: '<div class="stack s24">' + l5Ctx(v, o.idp || '') + '</div>' }; },
  after() { wireWordSearch('d', 'l12-task', 'h21-search-empty'); },
  keys(e) {
    if (inField()) { if (e.key === 'Escape') document.activeElement.blur(); return; }
    if (e.key === 'Escape' && curVariant() !== 'main') go('l5-main');
    else if (e.key === 'Enter') { e.preventDefault(); go('l11-default'); }
  },
  acts: { wpause() { S.ui.wpause = !S.ui.wpause; render(); } }
});

/* ---------- L6 Mission ---------- */
function missionCtx(states, report) {
  const items = [L('Bedarf erfragen', 'Ask about needs'), L('Einwand Preis behandeln', 'Handle the price objection'), L('nächsten Termin fixieren', 'Fix the next meeting')];
  return ctxBlock(L('Abhakliste', 'Checklist'), '<div class="checklist" style="padding:0">' + items.map((t, i) => '<div class="ci"><span class="ck' + (states[i] ? ' y' : '') + '">' + (states[i] ? ic('check', 'xs') : '') + '</span>' + t + '</div>').join('') + '</div>') +
    ctxBlock(L('Gegenüber', 'Counterpart'), '<div class="persona"><span class="avatar">LK</span><div><b>Laura Keller</b><div class="p2" style="font-size:.85em">' + L('Leiterin Einkauf · erfundene Persona', 'Head of Procurement · invented') + '</div></div></div><p class="p2" style="margin:0">' + L('Ziel: den Preis halten, ohne den nächsten Termin zu verlieren.', 'Goal: hold the price without losing the next meeting.') + '</p>') +
    ctxBlock(L('Zielstruktur und Kernwörter', 'Target structure and key words'), '<div style="display:flex;flex-wrap:wrap;gap:.4em"><span class="chip en">past simple / present perfect</span><span class="chip en">discount</span><span class="chip en">lead time</span><span class="chip en">sign off on</span></div>') +
    (report ? '' : '<p class="p2" style="margin:0;font-size:.85em">' + L('Korrekturen kommen erst im Bericht, nicht während des Gesprächs.', 'Corrections come in the report, not during the conversation.') + '</p>');
}
reg('l6', {
  code: 'L6', name: 'Mission', kind: 'desk', nav: 'heute',
  variants: [['talk', 'Gespräch'], ['report', 'Bericht']],
  render(v) {
    const blocks = dayBlocks('mission');
    if (v === 'report') {
      return {
        stage: dTop(blocks, 4, 0.9) + '<div class="dscroll stack s16" style="padding-top:1em">' + blockLine('s', L('Mission · Bericht', 'Mission · report')) +
          '<div class="verdict" style="color:var(--ok)"><span class="vi" style="background:color-mix(in oklch, var(--ok) 20%, transparent)">' + ic('check', 'xs') + '</span>' + L('Einwand gut behandelt, Termin noch offen', 'Objection handled well, meeting still open') + '</div>' +
          '<div class="stack s8"><div class="lbl">' + L('Das war stark', 'That was strong') + '</div><div class="quote en">„We’ve already reduced the lead time to eight weeks.“</div><p class="p2" style="margin:0">' + L('Ergebnis zuerst, ohne Zeitpunkt: genau richtig im present perfect.', 'Result first, no time given: exactly right in the present perfect.') + '</p></div>' +
          '<div class="stack s8"><div class="lbl">' + L('2 Punkte üben', 'Practise 2 points') + '</div><div class="p">1&nbsp; ' + L('Termin aktiv vorschlagen: <em class="en">Could we pencil in Monday at ten?</em>', 'Suggest the meeting yourself: <em>Could we pencil in Monday at ten?</em>') + '</div><div class="p">2&nbsp; <s class="en" style="color:var(--fg-2)">We have met last year</s> → <b class="en">We met last year</b></div></div>' +
          pageDots(4, 0) + '</div>' + dKeys('<button class="btn pri" id="d-next" data-go="l1-done">' + L('Weiter', 'Continue') + kb('⏎') + '</button>'),
        ctx: missionCtx([1, 1, 0], true)
      };
    }
    const phone = S.ui.phone;
    return {
      stage: dTop(blocks, 4, 0.45) + '<div class="dscroll" style="display:flex;flex-direction:column;gap:.7em;padding-top:1em">' + blockLine('s', L('Mission · Preis-Einwand beim Einkauf', 'Mission · price objection from purchasing')) +
        '<div class="stack s8" style="flex:1;justify-content:flex-end;display:flex;flex-direction:column;gap:.7em">' +
        '<div class="bubble them en">Thanks for calling back. I’ll be honest: your price is still too high for us.</div>' +
        '<div class="bubble me en">I understand. Could you tell me which offer you’re comparing us with?</div>' +
        '<div class="bubble them en">Another supplier quoted about 10 percent less, and they can deliver in six weeks.</div></div>' +
        '<div class="notice" style="font-size:.92em">' + ic('laptop', 'sm') + '<span>' + L('Am Laptop tippst du deine Antworten. Gesprochen wird am Handy.', 'On the laptop you type your answers. Speaking happens on the phone.') + '</span></div>' +
        (phone ? '<div class="notice" style="font-size:.92em">' + ic('phone', 'sm') + '<span>' + L('Öffne Lingo am Handy. Die Mission steht dort an derselben Stelle bereit, hier geht es danach weiter.', 'Open Lingo on your phone. The mission waits at the same point there and continues here afterwards.') + '</span></div>' : '') +
        '<div class="fieldwrap"><textarea class="field en" id="d-answer" rows="3" style="min-height:5.5em" placeholder="' + esc(L('Deine Antwort …', 'Your answer …')) + '"></textarea><div class="timeline"><i style="width:22%"></i></div></div></div>' +
        dKeys('<button class="btn sec" id="d-phone" data-act="phone">' + ic('phone', 'sm') + L('Am Handy sprechen', 'Speak on the phone') + '</button><button class="btn pri" id="d-send" data-go="l6-report">' + L('Senden', 'Send') + kb('⌘⏎') + '</button>'),
      ctx: missionCtx([1, 0, 0])
    };
  },
  acts: { phone() { S.ui.phone = !S.ui.phone; render(); } }
});

/* ---------- L7 Claude in der Kontextspalte ---------- */
reg('l7', {
  code: 'L7', name: 'Claude in der Kontextspalte', kind: 'desk', nav: 'claude',
  variants: [['claude', 'Claude'], ['translate', 'Übersetzer']],
  render(v) {
    const seg = '<div class="seg2" role="tablist"><button id="d-ask-claude" data-go="l7-claude" class="' + (v === 'claude' ? 'on' : '') + '" role="tab">Claude</button><button id="d-ask-trans" data-go="l7-translate" class="' + (v === 'translate' ? 'on' : '') + '" role="tab">' + L('Übersetzen', 'Translate') + '</button></div>';
    const head = '<div style="display:flex;align-items:center;gap:.6em"><div style="flex:1">' + seg + '</div><button class="iconbtn" id="d-ctx-close" data-go="l3-band" aria-label="' + esc(L('Schließen', 'Close')) + '">' + ic('close', 'sm') + '</button></div>';
    let body;
    if (v === 'claude') {
      body = '<span class="chip" style="align-self:flex-start">' + ic('info', 'xs') + L('Aufgabe + deine Antwort sind dabei', 'Task + your answer included') + '</span>' +
        '<div class="bubble me" style="max-width:92%">' + L('Warum nicht <span class="en">have sent</span>? Es ist doch gerade erst passiert.', 'Why not have sent? It only just happened.') + '</div>' +
        '<div class="p" style="line-height:1.55">' + L('Weil <em class="en">yesterday</em> im Satz steht. Ein vergangener Zeitpunkt macht die Handlung abgeschlossen, egal wie kurz sie her ist. Ohne Zeitangabe wäre <em class="en">We’ve sent the revised quote</em> richtig. Ist es eben erst passiert: <em class="en">We’ve just sent it</em> (US auch <em class="en">We just sent it</em>).', 'Because yesterday is in the sentence. A past time expression makes the action finished, however recent. Without a time word, We’ve sent the revised quote would be right. If it only just happened: We’ve just sent it (US also We just sent it).') + '</div>' +
        '<div style="flex:1"></div><div style="display:flex;gap:.5em"><textarea class="field" id="d-claude-in" rows="1" style="min-height:3em;padding:.7em .9em" placeholder="' + esc(L('Frag Claude …', 'Ask Claude …')) + '"></textarea><button class="btn pri" id="d-claude-send" data-act="noop" aria-label="' + esc(L('Senden', 'Send')) + '" style="width:3.2em;padding:0">' + ic('send', 'sm') + '</button></div>';
    } else {
      body = '<textarea class="field" id="d-trans-in" rows="2" style="min-height:4.5em">Wir haben die Lieferzeit bereits verkürzt.</textarea>' +
        '<div class="card stack s8"><p class="p en" style="font-weight:600;font-size:1.1em;margin:0">We’ve already reduced the lead time.</p><p class="p2 en" style="margin:0">also: We’ve already shortened the lead time. · We’ve already cut the lead time.</p><p class="p2" style="margin:0">' + L('Kein Zeitpunkt, Ergebnis zählt: present perfect.', 'No time named, result matters: present perfect.') + '</p></div>' +
        '<button class="btn sec" id="d-tr-add" data-act="noop" style="align-self:flex-start">' + ic('plus', 'sm') + L('In die Wörter', 'Add to words') + '</button>';
    }
    return { stage: l3Stage('band', true), ctx: head + '<div class="stack s16" style="flex:1;display:flex;flex-direction:column">' + body + '</div>' };
  }
});

/* ---------- L8 Fortschritt ---------- */
reg('l8', {
  code: 'L8', name: 'Fortschritt', kind: 'desk', nav: 'fortschritt',
  variants: [['main', 'Übersicht']],
  render() {
    return {
      stage: '<div class="dscroll"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1em"><h1 class="dh1 disp" style="margin:0">' + L('Fortschritt', 'Progress') + '</h1>' + gearBtn() + '</div>' +
        '<div class="stack s24"><div class="c1"><p class="s disp" style="font-size:1.6em;line-height:1.25">' + L('C1 voraussichtlich zwischen Oktober 2027 und Januar 2028', 'C1 expected between October 2027 and January 2028') + '</p>' + c1Band(false) +
        '<p class="p2" style="font-size:.85em;margin:0">' + L('aus 2 Meilensteinen und 5 belegten Kann-Beschreibungen', 'from 2 milestones and 5 proven can-do statements') + '</p></div>' + tiles(false) + '</div></div>',
      ctx: ctxBlock(L('Diese Woche', 'This week'), '<div class="card stack s6"><div class="p">' + L('5 von 6 Pflicht-Tagen erledigt, 1 Ruhetag', '5 of 6 required days done, 1 rest day') + '</div><div class="p2">' + L('3 Wörter neu frei · Thema 1 bei 55 %', '3 words newly free · topic 1 at 55 %') + '</div></div>') +
        ctxBlock(L('Kann-Beschreibungen', 'Can-do statements'), '<div class="checklist" style="padding:0">' + [[1, L('Projektstand am Telefon berichten', 'Report project status on the phone')], [1, L('Preis-Einwand ruhig beantworten', 'Answer a price objection calmly')], [0, L('Verhandlung mit Bedingungen führen', 'Negotiate with conditions')]].map(x => '<div class="ci" style="font-size:.92em"><span class="ck' + (x[0] ? ' y' : '') + '">' + (x[0] ? ic('check', 'xs') : '') + '</span>' + x[1] + '</div>').join('') + '</div>') +
        ctxBlock(L('Lehrerin', 'Teacher'), '<div class="notice" style="font-size:.92em">' + ic('pen', 'sm') + '<span>' + L('14.10.: „Spricht flüssiger, Aussprache von <em class="en">th</em> noch unsicher.“', 'Oct 14: “More fluent, <em>th</em> still unsure.”') + '</span></div>')
    };
  }
});

/* ---------- L9 Schreibtag ---------- */
const CATS = () => [
  ['mark-good', 'var(--ok)', L('Inhalt und Wirkung', 'Content and impact'), L('Preisnachlass als Ergebnis genannt, klarer nächster Schritt. Das wirkt.', 'Discount stated as a result, clear next step. That works.')],
  ['mark-reg', 'var(--ch-gram)', L('Register', 'Register'), L('<em class="en">is difficult</em> klingt hart. Weicher: <em class="en">would be difficult for us</em>.', '<em>is difficult</em> sounds blunt. Softer: <em>would be difficult for us</em>.')],
  ['mark-str', 'var(--ch-listen)', L('Aufbau', 'Structure'), L('Erst Lieferzeit, dann Preis, dann Termin: gute Reihenfolge. <em class="en">Regarding the price:</em> mit Doppelpunkt wirkt wie eine Stichpunktliste. Im Fließtext leitest du so über: <em class="en">As for the price, …</em>', 'Lead time, then price, then meeting: good order. <em>Regarding the price:</em> with a colon reads like a bullet list. In running text, lead in like this: <em>As for the price, …</em>')],
  ['mark-lang', 'var(--bad)', L('Sprache', 'Language'), L('<s class="en">I have checked … yesterday</s> → <b class="en">I checked … yesterday</b>. Vergangener Zeitpunkt, also past simple. Nach <em class="en">Hi Laura,</em> beginnt die nächste Zeile im Englischen groß: <em class="en">Thanks …</em>', '<s>I have checked … yesterday</s> → <b>I checked … yesterday</b>. Past time, so past simple. After <em>Hi Laura,</em> the next line starts with a capital letter: <em>Thanks …</em>')]
];
reg('l9', {
  code: 'L9', name: 'Schreibtag', kind: 'desk', nav: 'heute',
  variants: [['p1', 'Rückmeldung mit Markierungen'], ['end', 'Abschluss']],
  render(v) {
    const blocks = dayBlocks('normal');
    if (v === 'end') {
      return {
        stage: dTop(blocks, 4, 1) + '<div class="dscroll stack s16" style="padding-top:1em">' + blockLine('s', L('Schreibtag · deine überarbeitete Fassung', 'Writing day · your revised version')) +
          '<div class="verdict" style="color:var(--ok)"><span class="vi" style="background:color-mix(in oklch, var(--ok) 20%, transparent)">' + ic('check', 'xs') + '</span>' + L('Bereit zum Abschicken', 'Ready to send') + '</div>' +
          '<div class="card mailtext en"><p>Hi Laura,</p><p><b>Thanks</b> for taking the time to talk on Wednesday. I <b>checked</b> the numbers with our logistics team yesterday, and we can offer a lead time of eight weeks instead of ten.</p><p><b>As for the price,</b> we’ve already reduced it by 5 percent in the revised quote. A further discount <b>would be difficult for us</b>, but we could offer a two-year contract with fixed prices.</p><p>Could we have a quick call on Monday to go through the details?</p><p>Best regards,</p></div>' +
          '<p class="p2" style="margin:0">' + L('Zwei Wendungen gehen in deine Wörter: <em class="en">as for the price</em>, <em class="en">would be difficult for us</em>.', 'Two phrases go into your words: <em>as for the price</em>, <em>would be difficult for us</em>.') + '</p></div>' +
          dKeys('<button class="btn sec" id="d-copy" data-act="copy">' + L('Text kopieren', 'Copy text') + '</button><button class="btn pri" id="d-next" data-go="h10-day">' + L('Weiter', 'Continue') + kb('⏎') + '</button>'),
        ctx: ctxBlock(L('Was sich verbessert hat', 'What improved'), '<div class="checklist" style="padding:0">' + [L('Zeitform korrigiert', 'Tense fixed'), L('Großschreibung nach der Anrede', 'Capital after the greeting'), L('Ton weicher', 'Softer tone'), L('Überleitung zum Preis', 'Lead-in to the price')].map(t => '<div class="ci" style="font-size:.92em"><span class="ck y">' + ic('check', 'xs') + '</span>' + t + '</div>').join('') + '</div>')
      };
    }
    return {
      stage: dTop(blocks, 4, 0.55) + '<div class="dscroll stack s16" style="padding-top:1em">' + blockLine('s', L('Schreibtag · Projekt-Update an den Einkauf', 'Writing day · project update to purchasing')) +
        instr(L('Lies die Markierungen, dann überarbeite die Mail.', 'Read the marks, then revise the email.'), 'd-why') +
        '<div class="card mailtext en"><p>Hi Laura,</p><p><span class="mark-lang">thanks</span> for taking the time to talk on Wednesday. <span class="mark-lang">I have checked the numbers with our logistics team yesterday</span>, and we can offer a lead time of eight weeks instead of ten.</p>' +
        '<p><span class="mark-str">Regarding the price:</span> <span class="mark-good">we have already reduced it by 5 percent in the revised quote.</span> A further discount <span class="mark-reg">is difficult</span>, but we could offer a two-year contract with fixed prices.</p>' +
        '<p><span class="mark-good">Could we have a quick call on Monday to go through the details?</span></p><p>Best regards,</p></div></div>' +
        dKeys('<button class="btn sec" id="d-askmail" data-go="l7">' + ic('claude', 'sm') + L('Claude fragen', 'Ask Claude') + '</button><button class="btn pri" id="d-revise" data-go="l9-end">' + L('Überarbeiten', 'Revise') + kb('⏎') + '</button>'),
      ctx: ctxBlock(L('Rückmeldung in vier Bereichen', 'Feedback in four areas'), '<div>' + CATS().map(c => '<div class="cat"><div class="ct"><span class="sw ' + c[0] + '" style="box-shadow:none;background:' + c[1] + '"></span>' + c[2] + '</div><div class="p2" style="font-size:.92em">' + c[3] + '</div></div>').join('') + '</div>')
    };
  },
  acts: { copy() { const t = $('.mailtext'); try { navigator.clipboard.writeText(t ? t.innerText : '').catch(() => {}); } catch (e) { /* Zwischenablage nicht verfügbar: Text bleibt markierbar */ } } }
});

/* ---------- L10 Breitenproben ---------- */
reg('l10', {
  code: 'L10', name: 'Breitenproben', kind: 'desk', full: true,
  variants: [['all', '768 · 1024 · 2560']],
  render(v, o) {
    const W = o.W;
    const avail = Math.max(280, W - 32);
    const probes = [[768, 1024, 'Tablet hochkant'], [1024, 768, 'Tablet quer / kleiner Laptop'], [2560, 1440, 'großer Bildschirm']];
    const l1 = SCREENS.l1;
    return '<div class="view scrollx" style="padding-bottom:32px">' + '<div class="probe" style="padding-top:16px;font-size:14px;max-width:760px">' + L('Dieselbe Heute-Seite in drei Breiten. Unter jeder Probe: Breite der Bühne und Anteil leerer Rand.', 'The same Today page at three widths. Under each probe: stage width and share of empty margin.') + '</div>' +
      probes.map((p, i) => {
        const s = Math.min(1, avail / p[0]);
        const idp = 'pr' + i + '-';
        return '<div style="padding:16px 16px 0"><div class="probe" style="padding:0 0 8px"><b>' + p[0] + ' × ' + p[1] + '</b> · ' + p[2] + ' · <span id="' + idp + 'info">…</span></div>' +
          '<div class="probeframe" style="width:' + Math.floor(p[0] * s) + 'px;height:' + Math.floor(p[1] * s) + 'px"><div style="width:' + p[0] + 'px;height:' + p[1] + 'px;transform:scale(' + s.toFixed(4) + ');transform-origin:top left">' + DESK.shell(l1, 'main', p[0], p[1], idp) + '</div></div></div>';
      }).join('') + '</div>';
  },
  after() {
    [768, 1024, 2560].forEach((w, i) => {
      const idp = 'pr' + i + '-';
      const d = document.getElementById(idp + 'desk'); const info = document.getElementById(idp + 'info');
      if (!d || !info) return;
      const st = d.querySelector('.stage'), side = d.querySelector('.side'), cx = d.querySelector('.ctx');
      const used = side.offsetWidth + st.offsetWidth + (cx && cx.offsetParent ? cx.offsetWidth : 0);
      info.textContent = L('Bühne ', 'Stage ') + st.offsetWidth + ' px · ' + L('leerer Rand ', 'empty margin ') + Math.max(0, Math.round((w - used) / w * 100)) + ' %' + (d.classList.contains('rail') ? L(' · Leiste als Schiene', ' · sidebar as rail') : '') + (cx && !cx.offsetParent ? L(' · Kontextspalte aus', ' · context column hidden') : '');
    });
  }
});
