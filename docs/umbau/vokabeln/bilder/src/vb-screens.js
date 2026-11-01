/* Lingo Wörter · Bild-Entwürfe VB (Satz 1: Lernkarte, Band, Abschluss; Satz 2: Detail, Dashboard, Anwenden).
   Baut auf den Bausteinen der Vorschau WBft3EEx7jYYv4QHdepuNm v2 auf (app.js, screens*.js, desk.js; nur gelesen).
   Alles erfunden, keine echten Daten. Nur Deutsch. Kein App-Code: reine Bild-Vorlage für Emrah. */

const VB = {};
VB.blocks = () => dayBlocks('normal');
/* Kopf einer Wörter-Karte: Balken, Blockzeile, Aufgabe mit „Wozu?“ */
VB.head = (frac, line, task) => exTop(VB.blocks(), 1, frac) + '<div class="ex-body gx' + (VB._band ? ' with-band' : '') + '">' +
  blockLine('w', line) + instr(task);
VB.tone = id => '<span class="vb-tone"><button class="iconbtn" id="' + id + '-n" aria-label="Anhören">' + ic('speaker', 'sm') + '</button><button class="vb-slow" id="' + id + '-s" aria-label="Langsam anhören">0,7×</button></span>';
VB.tipBtns = () => exFoot(btnSec('hint', 'Tipp') + btnSec('idk', 'Weiß ich nicht') + btnPri('check', 'Prüfen'), true) + drawnKbd({ go: 'go' });
/* Buchstaben-Vergleich: ok = grün, del = zu viel/falsch (rot, durchgestrichen), ins = fehlt (gelb, unterstrichen) */
VB.diff = parts => '<span class="vb-diff en">' + parts.map(p => p[0] === '=' ? '<span>' + p[1] + '</span>' : p[0] === '+' ? '<ins>' + p[1] + '</ins>' : '<del>' + p[1] + '</del>').join('') + '</span>';
VB.meta = (partners, back) => '<div class="vb-meta">' +
  (partners ? '<div class="vb-mrow"><span class="lbl">Wortpartner</span><span class="en">' + partners + '</span></div>' : '') +
  '<div class="vb-mrow"><span class="lbl">Kommt wieder</span><span>' + back + '</span></div></div>';
/* Ein Band: st = ok | near | bad | idk; o: verdict, cmp, why, partners, back, extra(Knöpfe), override */
VB.band = (st, o) => {
  const cls = { ok: 's-ok', near: 's-near', bad: 's-bad', idk: 's-idk' }[st];
  const icn = { ok: 'check', near: 'near', bad: 'cross', idk: 'ring' }[st];
  return '<div class="band vb-band gx ' + cls + '" id="band" role="status">' +
    '<div class="vb-vrow"><div class="verdict"><span class="vi">' + ic(icn, 'xs') + '</span>' + o.verdict + '</div>' + VB.tone('band-tone') + '</div>' +
    (o.cmp ? '<div class="cmp">' + o.cmp + '</div>' : '') +
    '<p class="whyl"><span class="vb-why">Warum</span> ' + o.why + '</p>' +
    (o.override || VB.meta(o.partners, o.back)) +
    '<div class="bandbtns">' + (o.extra || '') + '</div>' +
    '<button class="btn pri full" id="band-next">' + (o.next || 'Weiter') + '</button></div>';
};
VB.moreBtn = '<button class="btn sec sm" id="band-more">Mehr</button>';
VB.alsoBtn = '<button class="btn sec sm" id="band-also">War das auch richtig?</button>';
VB.knewBtn = '<button class="btn sec sm" id="band-knew">Das wusste ich eigentlich</button>';

/* Satz der Lernkarte: procurement */
VB.procSent = gap => '<div class="sent en">Our ' + gap + ' team needs the signed quote by Friday.</div>';

function vbPhone(v) {
  VB._band = /^(band|near|wrong|knew|colloc|pattern-band)/.test(v);
  /* ---------- B10 Einführung mit kurzem Versuch ---------- */
  if (v === 'intro-try') {
    return VB.head(0.1, 'Wörter · <b>Neues Wort</b> · 1 von 3', 'Neues Wort. Versuch es kurz selbst, dann deckst du auf.') +
      '<div class="stagec"><div class="sent en">Let’s ' + gapHtml('', { caret: true, input: true }) + ' the contract for another two years.</div>' +
      '<div class="hintline">Gesucht: verlängern (einen Vertrag)</div>' +
      '<p class="vb-quiet">' + ic('info', 'xs') + '<span>Raten schadet nicht. Auch ein falscher Versuch hilft dir, die Lösung zu behalten.</span></p></div></div>' +
      exFoot(btnSec('known', 'Kenne ich schon') + btnPri('reveal', 'Aufdecken'), true) + drawnKbd({ go: 'go' });
  }
  if (v === 'intro-reveal') {
    return VB.head(0.15, 'Wörter · <b>Neues Wort</b> · 1 von 3', 'Neues Wort. Hör es dir an und lies den Satz.') +
      '<div class="stack s16" style="padding-top:22px">' +
      '<div class="sent en">Let’s <span class="gap st-ok"><span class="lts">renew</span></span> the contract for another two years.</div>' +
      '<div class="vb-try">Dein Versuch: <s class="en">extend</s> · passt auch, aber bei Verträgen und Abos sagt man meist <b class="en">renew</b>.</div>' +
      '<div class="card stack s8"><div style="display:flex;align-items:center;gap:10px"><div class="disp en" style="font-size:28px;line-height:34px;font-weight:700">renew</div>' + VB.tone('intro-tone') + '</div>' +
      '<div class="p2 en">/rɪˈnuː/ · Verb</div><div class="disp" style="font-size:20px;line-height:26px;font-weight:600">verlängern, erneuern</div>' +
      '<div class="hr"></div><div class="lbl">Wortpartner</div><div class="p en">renew a contract · renew a subscription · renew a license</div></div>' +
      '</div></div>' + exFoot(btnPri('intro-next', 'Weiter'));
  }
  if (v === 'intro-known') {
    return VB.head(0.12, 'Wörter · <b>Neues Wort</b> · Kurze Probe', 'Du kennst es schon? Dann schreib es hier ohne Hilfe.') +
      '<div class="stagec"><div class="prompt disp">einen Vertrag verlängern</div><div class="hintline">2 Wörter</div>' +
      '<div style="padding-top:8px">' + gapHtml('renew a', { big: true, caret: true, input: true }) + '</div>' +
      '<p class="vb-quiet">' + ic('info', 'xs') + '<span>Richtig: Das Wort kommt nicht ins Lernen. In 7 Tagen kommt eine einzige Kontrolle. Falsch: Wir lernen es ganz normal.</span></p></div></div>' +
      exFoot(btnSec('probe-back', 'Zurück') + btnPri('probe-check', 'Prüfen'), true) + drawnKbd({ go: 'go' });
  }
  /* ---------- Lernkarte Lücke ---------- */
  if (v === 'card') {
    return VB.head(0.42, 'Wörter · Wiederholen', 'Setz das fehlende Wort ein.') +
      '<div class="stagec">' + VB.procSent(gapHtml('procu', { caret: true, input: true })) +
      '<div class="vb-hrow"><div class="hintline">Gesucht: Einkauf (die Abteilung)</div>' + VB.tone('card-tone') + '</div></div></div>' + VB.tipBtns();
  }
  if (v === 'card-tip') {
    return VB.head(0.42, 'Wörter · Wiederholen', 'Setz das fehlende Wort ein.') +
      '<div class="stagec">' + VB.procSent(gapHtml('p', { caret: true, input: true })) +
      '<div class="hintline">Gesucht: Einkauf (die Abteilung)</div>' +
      '<div class="vb-tipline">' + ic('bulb', 'xs') + '<span>Tipp: beginnt mit <b class="en">p</b> · 1 Wort · 11 Buchstaben</span></div></div></div>' + VB.tipBtns();
  }
  /* ---------- B3 Band ---------- */
  if (v === 'band-ok') {
    return VB.head(0.48, 'Wörter · Wiederholen', 'Setz das fehlende Wort ein.') +
      '<div class="stagec">' + VB.procSent('<span class="gap st-ok"><span class="lts">procurement</span></span>') + '<div class="hintline">Gesucht: Einkauf (die Abteilung)</div></div></div>' +
      VB.band('ok', {
        verdict: 'Richtig', cmp: '<span class="you">Du:</span> <b class="en">procurement</b>',
        why: '<span class="en">procurement</span> ist der Einkauf einer Firma, als Abteilung und als Ablauf. <span class="en">purchase</span> ist ein einzelner Kauf.',
        partners: 'procurement team · procurement process', back: 'Sa, 21.11. · in einem neuen Satz', extra: VB.moreBtn
      });
  }
  if (v === 'band-near') {
    return VB.head(0.48, 'Wörter · Wiederholen', 'Setz das fehlende Wort ein.') +
      '<div class="stagec">' + VB.procSent('<span class="gap st-near"><span class="lts">procurment</span></span>') + '<div class="hintline">Gesucht: Einkauf (die Abteilung)</div></div></div>' +
      VB.band('near', {
        verdict: 'Fast richtig', cmp: '<span class="you">Du:</span> ' + VB.diff([['=', 'procur'], ['+', 'e'], ['=', 'ment']]),
        why: 'Ein Buchstabe fehlt: <span class="en">procure</span> + <span class="en">-ment</span>. Das <span class="en">e</span> bleibt stehen.',
        partners: 'procurement team · procurement process', back: 'Fr, 6.11. · etwas früher, weil es knapp war', extra: VB.moreBtn + VB.alsoBtn
      });
  }
  if (v === 'band-wrong') {
    return VB.head(0.48, 'Wörter · Wiederholen', 'Setz das fehlende Wort ein.') +
      '<div class="stagec">' + VB.procSent('<span class="gap st-bad"><span class="lts">purchase</span></span>') + '<div class="hintline">Gesucht: Einkauf (die Abteilung)</div></div></div>' +
      VB.band('bad', {
        verdict: 'Noch nicht', cmp: '<span class="you">Du:</span> <s class="en">purchase</s> <span class="you">→ Richtig:</span> <b class="en">procurement</b>',
        why: '<span class="en">purchase</span> ist ein einzelner Kauf. Die Abteilung und der ganze Ablauf heißen <span class="en">procurement</span>.',
        partners: 'procurement team · procurement process', back: 'gleich noch einmal in einem neuen Satz · dann morgen', extra: VB.moreBtn + VB.knewBtn
      });
  }
  /* ---------- B4 Das wusste ich eigentlich ---------- */
  if (v === 'knew') {
    return VB.head(0.48, 'Wörter · Wiederholen', 'Setz das fehlende Wort ein.') +
      '<div class="stagec">' + VB.procSent('<span class="gap st-bad"><span class="lts">purchase</span></span>') + '<div class="hintline">Gesucht: Einkauf (die Abteilung)</div></div></div>' +
      VB.band('bad', {
        verdict: 'Noch nicht', cmp: '<span class="you">Du:</span> <s class="en">purchase</s> <span class="you">→ Richtig:</span> <b class="en">procurement</b>',
        why: '<span class="en">purchase</span> ist ein einzelner Kauf. Die Abteilung und der ganze Ablauf heißen <span class="en">procurement</span>.',
        override: '<div class="vb-knew">' + ic('check', 'xs') + '<span><b>Gut, dann zeig es gleich.</b> <span class="en">procurement</span> kommt nach 3 Karten noch einmal in einem neuen Satz. Nur diese Antwort zählt.</span><button class="link" id="knew-undo">Rückgängig</button></div>',
        extra: VB.moreBtn
      });
  }
  /* ---------- B5 Kollokation: Wort richtig, Partner falsch ---------- */
  if (v === 'colloc-band') {
    return VB.head(0.55, 'Wörter · Wortpartner', 'Schreib die ganze Wendung.') +
      '<div class="stagec"><div class="sent en">Tomorrow I’ll <span class="gap st-bad vb-gap2"><span class="lts"><s>hold</s> a presentation</span></span> on the new workflow.</div>' +
      '<div class="hintline">Gesucht: eine Präsentation halten</div></div></div>' +
      VB.band('bad', {
        verdict: 'Partner falsch', cmp: '<span class="you">Wort richtig, Partner falsch:</span> ' + VB.diff([['-', 'hold'], ['=', ' → give a presentation']]),
        why: 'Eine Präsentation <i>hält</i> man auf Deutsch, auf Englisch <i>gibt</i> man sie: <span class="en">give</span> oder <span class="en">deliver a presentation</span>.',
        partners: '<s class="vb-no">hold</s> · give · deliver a presentation', back: 'morgen, mit einer Kontrastkarte <span class="en">hold / give</span>', extra: VB.moreBtn + VB.alsoBtn
      });
  }
  /* ---------- B12 falscher Freund (Kontrastkarte) ---------- */
  if (v === 'false-friend') {
    return VB.head(0.6, 'Wörter · <b>Kontrast</b> · Deutsch-Falle', 'Lies den Unterschied, dann setz das passende Wort ein.') +
      '<div class="stack s16" style="padding-top:18px"><div class="card stack s8">' +
      '<div class="vb-pair"><b class="en">eventually</b><span>= schließlich, am Ende</span></div>' +
      '<div class="vb-pair"><b>eventuell</b><span>= <span class="en">possibly, maybe</span></span></div>' +
      '<p class="p2" style="margin:0">Klingt gleich, heißt etwas anderes. <span class="en">eventually</span> sagt: Es passiert sicher, nur später.</p></div>' +
      '<div class="sent en">We may ' + gapHtml('poss', { caret: true, input: true }) + ' need a second server, but we’re not sure yet.</div>' +
      '<div class="hintline">Gesucht: eventuell</div></div></div>' + VB.tipBtns();
  }
  if (v === 'pair') {
    return '<header class="phead gx"><div class="tw-hl"><button class="iconbtn" aria-label="Zurück" style="margin-left:-10px;margin-right:0">' + ic('chevL') + '</button><h1 class="disp">Wort-Werkstatt</h1></div></header>' +
      '<div class="scroll gx stack s16" style="padding-bottom:24px">' +
      '<p class="p2" style="margin:0">Wörter, die du oft verwechselst. Eins nach dem anderen, damit sie sich nicht gegenseitig stören.</p>' +
      '<div class="card stack s8"><div class="lbl">Verwechslungspaar</div>' +
      '<div class="vb-pair"><b class="en">affect</b><span>beeinflussen</span><span class="vb-tag">lernt gerade</span></div>' +
      '<div class="vb-pair"><b class="en">effect</b><span>die Wirkung</span><span class="vb-tag off">ruht</span></div>' +
      '<div class="hr"></div><p class="p" style="margin:0"><span class="en">effect</span> ruht, bis <span class="en">affect</span> an 2 Tagen frei sitzt. Dann kommen beide abwechselnd.</p>' +
      '<p class="p2" style="margin:0">Merksatz: <span class="en">The new policy <b>affects</b> everyone. The <b>effect</b> is clear.</span></p></div>' +
      '<div class="card stack s8"><div class="lbl">Deutsch-Falle</div>' +
      '<div class="vb-pair"><b class="en">eventually</b><span>≠ eventuell</span><span class="vb-tag">Kontrastkarte</span></div>' +
      '<p class="p2" style="margin:0">Kam 2-mal falsch in 30 Tagen. Die Kontrastkarte kommt in deiner nächsten Wörter-Runde.</p></div>' +
      '<button class="btn pri full" id="ws-go">Paar jetzt üben</button></div>' + tabbar('h12');
  }
  /* ---------- B13 Muster mit Präposition (M78) ---------- */
  if (v === 'pattern') {
    return VB.head(0.66, 'Wörter · Muster', 'Welche Präposition gehört dazu?') +
      '<div class="stagec"><div class="sent en">All departments must comply ' + gapHtml('', { caret: true, input: true }) + ' the new retention policy.</div>' +
      '<div class="hintline">Muster: <span class="en">comply ___ something</span> · befolgen, einhalten</div></div></div>' + VB.tipBtns();
  }
  if (v === 'pattern-band') {
    return VB.head(0.7, 'Wörter · Muster', 'Welche Präposition gehört dazu?') +
      '<div class="stagec"><div class="sent en">All departments must comply <span class="gap st-bad" style="min-width:60px"><span class="lts">to</span></span> the new retention policy.</div>' +
      '<div class="hintline">Muster: <span class="en">comply ___ something</span> · befolgen, einhalten</div></div></div>' +
      VB.band('bad', {
        verdict: 'Noch nicht', cmp: '<span class="you">Du:</span> <s class="en">comply to</s> <span class="you">→ Richtig:</span> <b class="en">comply with</b>',
        why: '<span class="en">comply</span> steht immer mit <span class="en">with</span>: <span class="en">comply with a rule, a policy, a law</span>.',
        partners: 'comply with a policy · comply with regulations', back: 'gleich noch einmal ohne Satz · dann morgen', extra: VB.moreBtn + VB.knewBtn
      });
  }
  /* ---------- N1 „Warum heute?“ im Menü ---------- */
  if (v === 'menu') {
    return VB.head(0.42, 'Wörter · Wiederholen', 'Setz das fehlende Wort ein.') +
      '<div class="stagec">' + VB.procSent(gapHtml('', { caret: true, input: true })) +
      '<div class="hintline">Gesucht: Einkauf (die Abteilung)</div></div></div>' + VB.tipBtns() +
      '<div class="scrim" style="background:transparent"></div><div class="menu vb-menu" id="ex-menu" role="menu">' +
      '<div class="vb-whytoday"><div class="lbl">Warum heute?</div><p>Fällig seit 2 Tagen. Zuletzt richtig am 20.10., seitdem sinkt die Chance, dass du es noch weißt.</p><span>Spur Benutzen · Stufe 4 von 7</span></div><hr>' +
      '<button role="menuitem">' + ic('claude', 'sm') + 'Claude fragen</button>' +
      '<button role="menuitem">' + ic('trans', 'sm') + 'Übersetzer</button>' +
      '<button role="menuitem">' + ic('check', 'sm') + 'Zu leicht · kenne ich längst</button>' +
      '<hr><button role="menuitem">' + ic('flag', 'sm') + 'Aufgabe war unfair</button></div>';
  }
  return '';
}
reg('vb', {
  code: 'VB', name: 'Wörter-Karte (Entwurf)', kind: 'phone',
  variants: [['intro-try', 'B10 Versuch'], ['intro-reveal', 'B10 aufgedeckt'], ['intro-known', 'B10 Kenne ich schon'], ['card', 'Lernkarte'], ['card-tip', 'Lernkarte mit Tipp'],
    ['band-ok', 'Band richtig'], ['band-near', 'Band fast'], ['band-wrong', 'Band falsch'], ['knew', 'B4'], ['colloc-band', 'B5'], ['false-friend', 'B12 falscher Freund'], ['pair', 'B12 Paar'],
    ['pattern', 'B13'], ['pattern-band', 'B13 Band'], ['menu', 'N1']],
  render: vbPhone
});

/* ---------- B8 Start und Abschluss, B11 Wiederkehr ---------- */
function vbStart(v) {
  const back = v === 'return';
  const head = '<header class="phead gx"><div class="tw-hl"><button class="iconbtn" aria-label="Zurück" style="margin-left:-10px;margin-right:0">' + ic('chevL') + '</button><h1 class="disp">Wörter</h1></div><span class="tw-badge">Pflicht</span></header>';
  const card = back
    ? '<div class="card stack s16 vb-start"><div class="lbl">Willkommen zurück</div><div class="disp" style="font-size:28px;line-height:34px;font-weight:700">Wörter · ca. 15 Min.</div>' +
      '<p class="p" style="margin:0"><b>32 fällig.</b> Heute die 18, bei denen die Chance am niedrigsten ist, dass du sie noch weißt. Der Rest verteilt sich bis Do.</p>' +
      VB.spread() +
      '<p class="p2" style="margin:0">Dazu 2 neue Wörter, wie an jedem Lerntag. Ab Fr wieder dein normaler Plan.</p>' +
      '<button class="btn pri full" id="vb-go">Los: 18 + 2 neue</button></div>'
    : '<div class="card stack s16 vb-start"><div class="lbl">Heute</div><div class="disp" style="font-size:28px;line-height:34px;font-weight:700">Wörter · ca. 14 Min.</div>' +
      '<p class="p" style="margin:0"><b>Warum diese?</b> 11 fällig, die mit der niedrigsten Chance zuerst · 3 neue, eingestreut · am Ende 3 Min. Anwenden.</p>' +
      '<div class="vb-mix"><span style="flex:11" class="d"></span><span style="flex:3" class="n"></span><span style="flex:3" class="a"></span></div>' +
      '<div class="vb-mixl"><span><i class="d"></i>11 fällig</span><span><i class="n"></i>3 neu</span><span><i class="a"></i>Anwenden</span></div>' +
      '<button class="btn pri full" id="vb-go">Los geht’s</button></div>';
  return head + '<div class="scroll gx stack s16" style="padding-bottom:24px">' + card +
    '<p class="vb-quiet">' + ic('lock', 'xs') + '<span>Der Plan steht für heute fest. Er ändert sich nicht, wenn du die App neu öffnest.</span></p></div>' + tabbar('h12');
}
VB.spread = () => {
  const d = [['heute', 18, 1], ['Mi', 7], ['Do', 7]];
  return '<div class="vb-spread">' + d.map(x => '<div class="' + (x[2] ? 'on' : '') + '"><b class="num">' + x[1] + '</b><i style="height:' + (x[1] * 3 + 4) + 'px"></i><span>' + x[0] + '</span></div>').join('') + '</div>';
};
function vbDone() {
  const rows = [
    ['plus', 'Heute gelernt', '<b>3 neue:</b> <span class="en">renew, procurement cycle, leverage</span>'],
    ['up', 'Aufgestiegen', '<b>6 Wörter.</b> <span class="en">budget approval</span> bildest du jetzt selbst.'],
    ['cross', 'Gestolpert', '<b>2:</b> <span class="en">comply with</span> kommt morgen wieder, <span class="en">procurement</span> am Fr, 6.11.'],
    ['cal', 'Morgen', '<b>ca. 12 Min.</b> · 9 fällig, 2 neue']
  ];
  return '<div class="ex-body gx" style="justify-content:center;gap:22px;padding-top:32px">' +
    '<div class="tw-resicon"><span>' + ic('check') + '</span></div>' +
    '<div class="stack s6" style="text-align:center"><div class="disp" style="font-size:28px;line-height:34px;font-weight:700">Wörter erledigt</div><div class="p2">14 Min. · zählt zu deiner Pflicht</div></div>' +
    '<div class="card tw-res" style="padding:6px 18px">' + rows.map(r => '<div class="st vb-dl"><span class="vb-dli">' + ic(r[0], 'sm') + '</span><span class="vb-dlt"><span class="lbl">' + r[1] + '</span><span>' + r[2] + '</span></span></div>').join('') + '</div></div>' +
    exFoot(btnSec('vb-more5', 'Noch 5') + btnPri('vb-done', 'Fertig'));
}
reg('vbs', {
  code: 'VBS', name: 'Wörter-Start/Abschluss (Entwurf)', kind: 'phone',
  variants: [['start', 'B8 Start'], ['done', 'B8 Abschluss'], ['return', 'B11 Wiederkehr']],
  render(v) { return v === 'done' ? vbDone() : vbStart(v); }
});
/* B8: Heute der Vorschau (H1), nur die Zeile „Als Nächstes“ bzw. die Block-Liste mit Zeitangabe. */
reg('vbh', {
  code: 'VBH', name: 'Heute mit Wörter-Zeile (Entwurf)', kind: 'phone',
  variants: [['start', 'Heute (Vorschau H1 + Zeitangabe)'], ['ring', 'Ring angetippt'], ['card', 'Alternative Karte']],
  render(v) {
    if (v !== 'card') {
      S.ui = {};
      /* Wörter-Block mit geschätzter Zeit aus dem Planer (14 statt fest 7 Min.); Ring und Summe rechnen mit. */
      const orig = dayBlocks;
      dayBlocks = kind => orig(kind).map(x => x.n === 'Wörter' ? Object.assign({}, x, { m: 14 }) : x);
      try {
        return SCREENS.h1.render(v === 'ring' ? 'ring' : 'start')
          .replace('Als Nächstes: Gestern-Check · <em>6 Wörter</em>', 'Als Nächstes: Gestern-Check · <em>6 Wörter</em> · danach Wörter · <em>ca. 14 Min.</em>')
          .replace(/(<span class="nm">Wörter<\/span><span class="sm num">)14 Min\./, '$1ca. 14 Min.');
      } finally { dayBlocks = orig; }
    }
    const b = VB.blocks();
    const lines = [['w', 'Gestern-Check', '3 Min.', 'done'], ['w', 'Wörter', 'ca. 14 Min.', 'next', '11 fällig · 3 neu · Anwenden'], ['g', 'Grammatik', '5 Min.'], ['l', 'Hören', '4 Min.'], ['s', 'Sag es', '4 Min.']];
    return '<header class="phead gx"><h1 class="disp">Heute</h1>' + askBtn() + '</header><div class="scroll gx stack s16" style="padding-bottom:24px">' +
      '<div class="card stack s16"><div class="lbl">Als Nächstes</div><div class="disp" style="font-size:26px;line-height:32px;font-weight:700">Wörter · ca. 14 Min.</div>' +
      '<p class="p2" style="margin:0">11 fällig, die gefährdetsten zuerst · 3 neue · am Ende Anwenden</p><button class="btn pri full">Los geht’s</button></div>' +
      '<div class="card" style="padding:4px 18px">' + lines.map(l => '<div class="st ' + (l[3] === 'done' ? 'done' : l[3] === 'next' ? 'run' : 'open') + '" style="min-height:52px"><span class="mk">' + (l[3] === 'done' ? ic('check', 'xs') : '') + '</span><span class="dot ' + l[0] + '"></span><span class="nm" style="display:flex;flex-direction:column"><span>' + l[1] + '</span>' + (l[4] ? '<span class="p2" style="font-size:13px">' + l[4] + '</span>' : '') + '</span><span class="sm num">' + l[2] + '</span></div>').join('') + '</div></div>' + tabbar('h1');
  }
});

/* ---------- Laptop: Lernkarte und Band mit Kontextspalte ---------- */
reg('vbl', {
  code: 'VBL', name: 'Wörter-Karte Laptop (Entwurf)', kind: 'desk', nav: 'heute',
  variants: [['task', 'Aufgabe'], ['band', 'Band fast']],
  render(v) {
    const blocks = VB.blocks();
    const checked = v === 'band';
    let s = dTop(blocks, 1, 0.45) + '<div class="dscroll" style="display:flex;flex-direction:column;padding-top:1em">' +
      blockLine('w', 'Wörter · Wiederholen') + instr('Setz das fehlende Wort ein.', 'd-why') +
      '<div class="stack s16" style="padding:3em 0 1.5em">' + VB.procSent(checked ? '<span class="gap st-near"><span class="lts">procurment</span></span>' : gapHtml('procu', { caret: true, input: true })) +
      '<div class="hintline">Gesucht: Einkauf (die Abteilung)</div></div>';
    if (checked) s += '<div class="dverdict s-near vb-dband" role="status"><div class="vb-vrow"><div class="verdict"><span class="vi">' + ic('near', 'xs') + '</span>Fast richtig</div>' + VB.tone('d-tone') + '</div>' +
      '<div class="cmp"><span class="you">Du:</span> ' + VB.diff([['=', 'procur'], ['+', 'e'], ['=', 'ment']]) + '</div>' +
      '<p class="whyl"><span class="vb-why">Warum</span> Ein Buchstabe fehlt: <span class="en">procure</span> + <span class="en">-ment</span>. Das <span class="en">e</span> bleibt stehen.</p>' +
      '<div class="bandbtns" style="max-width:28em">' + VB.moreBtn + VB.alsoBtn + '</div></div>';
    s += '</div>' + dKeys(checked ? '<button class="btn pri">Weiter' + kb('⏎') + '</button>' : '<button class="btn sec">Tipp' + kb('T') + '</button><button class="btn sec">Weiß ich nicht' + kb('W') + '</button><button class="btn pri">Prüfen' + kb('⏎') + '</button>');
    const wordCard = '<div class="card stack s8"><div style="display:flex;align-items:center;gap:.6em"><b class="en" style="font-size:1.25em">procurement</b>' + VB.tone('c-tone') + '</div><div class="p2 en" style="margin:0">/prəˈkjʊrmənt/ · Nomen · der Einkauf</div>' +
      '<div class="hr"></div><div class="lbl">Wortpartner</div><div class="p en" style="margin:0">procurement team · procurement process</div>' +
      '<div class="lbl">Kommt wieder</div><div class="p" style="margin:0">Fr, 6.11. · etwas früher, weil es knapp war</div>' +
      '<div class="lbl">Stand</div>' + VB.stagebar(4) + '<div class="p2" style="margin:0">Auf dem Weg · Stufe 4 von 7</div></div>';
    return {
      stage: s,
      ctx: (checked ? ctxBlock('Wort', wordCard) : ctxBlock('Wozu?', '<p class="p2" style="margin:0">Du holst das Wort selbst aus dem Gedächtnis. Genau das macht es zu deinem Wort.</p>') +
        ctxBlock('Warum heute?', '<p class="p2" style="margin:0">Fällig seit 2 Tagen. Zuletzt richtig am 20.10.</p>')) +
        ctxBlock('Heute', dayMini(blocks, 1))
    };
  }
});
/* 7-teiliger Stufenbalken in drei Tönen: 1–2 erkennst du, 3–5 auf dem Weg, 6–7 bildest du selbst */
VB.stagebar = n => '<div class="vb-stages" aria-label="Stufe ' + n + ' von 7">' + [1, 2, 3, 4, 5, 6, 7].map(i => '<i class="g' + (i <= 2 ? 1 : i <= 5 ? 2 : 3) + (i <= n ? ' on' : '') + '"></i>').join('') + '</div>';
