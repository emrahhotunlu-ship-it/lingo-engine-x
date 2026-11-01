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
    (o.knew ? '<button class="link vb-knewlink" id="band-knew">Das wusste ich eigentlich</button>' : '') +
    '<button class="btn pri full" id="band-next">' + (o.next || 'Weiter') + '</button></div>';
};
VB.moreBtn = '<button class="btn sec sm" id="band-more">Mehr</button>';
VB.alsoBtn = '<button class="btn sec sm" id="band-also">War das auch richtig?</button>';
VB.knewBtn = '<button class="btn sec sm" id="band-knew">Das wusste ich eigentlich</button>';

/* Satz der Lernkarte: procurement */
VB.procSent = gap => '<div class="sent en">Their ' + gap + ' team wants a revised quote by Friday.</div>';

function vbPhone(v) {
  VB._band = /band|knew/.test(v);
  /* ---------- B10 Einführung mit kurzem Versuch ---------- */
  if (v === 'intro-try') {
    return VB.head(0.1, 'Wörter · <b>Neues Wort</b> · 1 von 3', 'Neues Wort. Versuch es kurz selbst, dann deckst du auf.') +
      '<div class="stagec"><div class="sent en">Their license expires in March, so they need to ' + gapHtml('', { caret: true, input: true }) + ' it.</div>' +
      '<div class="hintline">Gesucht: erneuern (Lizenz, Abo, Vertrag)</div>' +
      '<p class="vb-quiet">' + ic('info', 'xs') + '<span>Raten schadet nicht. Auch ein falscher Versuch hilft dir, die Lösung zu behalten.</span></p></div></div>' +
      exFoot(btnSec('known', 'Kenne ich schon') + btnPri('reveal', 'Aufdecken'), true) + drawnKbd({ go: 'go' });
  }
  if (v === 'intro-reveal') {
    return VB.head(0.15, 'Wörter · <b>Neues Wort</b> · 1 von 3', 'Neues Wort. Hör es dir an und lies den Satz.') +
      '<div class="stack s16" style="padding-top:22px">' +
      '<div class="sent en">Their license expires in March, so they need to <span class="gap"><span class="lts">renew</span></span> it.</div>' +
      '<div class="vb-try">Dein Versuch: <b class="en">extend</b> · auch richtig. <span class="en">extend</span> = Laufendes verlängern, <span class="en">renew</span> = nach Ablauf neu abschließen (Abo, Lizenz).</div>' +
      '<div class="card stack s8"><div style="display:flex;align-items:center;gap:10px"><div class="disp en" style="font-size:28px;line-height:34px;font-weight:700">renew</div>' + VB.tone('intro-tone') + '</div>' +
      '<div class="p2 en">/rɪˈnuː/ · Verb</div><div class="disp" style="font-size:20px;line-height:26px;font-weight:600">verlängern, erneuern</div>' +
      '<div class="hr"></div><div class="lbl">Wortpartner</div><div class="p en">renew a license · renew a subscription · renew a contract</div></div>' +
      '</div></div>' + exFoot(btnPri('intro-next', 'Weiter'));
  }
  if (v === 'intro-known') {
    return VB.head(0.12, 'Wörter · <b>Neues Wort</b> · Kurze Probe', 'Du kennst es schon? Dann schreib es hier ohne Hilfe.') +
      '<div class="stagec"><div class="prompt disp">eine Lizenz erneuern</div><div class="hintline">3 Wörter</div>' +
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
      '<div class="vb-hrow"><div class="hintline">Gesucht: Einkauf (die Abteilung)</div>' + VB.tone('card-tone') + '</div>' +
      '<div class="vb-tipline">' + ic('bulb', 'xs') + '<span>Tipp: beginnt mit <b class="en">p</b> · 1 Wort · zählt als „mit Hilfe“</span></div></div></div>' + VB.tipBtns();
  }
  /* ---------- B3 Band ---------- */
  if (v === 'band-ok') {
    return VB.head(0.48, 'Wörter · Wiederholen', 'Setz das fehlende Wort ein.') +
      '<div class="stagec">' + VB.procSent('<span class="gap st-ok"><span class="lts">procurement</span></span>') + '<div class="hintline">Gesucht: Einkauf (die Abteilung)</div></div></div>' +
      VB.band('ok', {
        verdict: 'Richtig', cmp: '<span class="you">Du:</span> <b class="en">procurement</b>',
        why: 'Nomen: der Einkauf einer Firma, Abteilung und Ablauf. Auch richtig: <span class="en">purchasing</span>. <span class="en">purchase</span> = ein einzelner Kauf.',
        partners: 'procurement team · procurement process', back: 'Sa, 21.11. · in einem neuen Satz', extra: VB.moreBtn
      });
  }
  if (v === 'band-near') {
    return VB.head(0.48, 'Wörter · Wiederholen', 'Setz das fehlende Wort ein.') +
      '<div class="stagec">' + VB.procSent('<span class="gap st-near"><span class="lts">procurment</span></span>') + '<div class="hintline">Gesucht: Einkauf (die Abteilung)</div></div></div>' +
      VB.band('near', {
        verdict: 'Fast richtig', cmp: '<span class="you">Du:</span> ' + VB.diff([['=', 'procur'], ['+', 'e'], ['=', 'ment']]),
        why: 'Nomen aus <span class="en">procure</span> + <span class="en">-ment</span>: Das <span class="en">e</span> bleibt, wie bei <span class="en">manage → management</span>.',
        partners: 'procurement team · procurement process', back: 'Fr, 6.11. · etwas früher, weil es knapp war', extra: VB.moreBtn + VB.alsoBtn
      });
  }
  if (v === 'band-wrong') {
    return VB.head(0.48, 'Wörter · Wiederholen', 'Setz das fehlende Wort ein.') +
      '<div class="stagec">' + VB.procSent('<span class="gap st-bad"><span class="lts">purchase</span></span>') + '<div class="hintline">Gesucht: Einkauf (die Abteilung)</div></div></div>' +
      VB.band('bad', {
        verdict: 'Noch nicht', cmp: '<span class="you">Du:</span> <s class="en">purchase</s> <span class="you">→ Richtig:</span> <b class="en">procurement</b>',
        why: '<span class="en">purchase</span> = ein Kauf oder kaufen. Die Abteilung heißt <span class="en">procurement</span> oder <span class="en">purchasing</span>.',
        partners: 'procurement team · procurement process', back: 'gleich noch einmal in einem neuen Satz · dann morgen', extra: VB.moreBtn + VB.alsoBtn, knew: true
      });
  }
  /* ---------- B4 Das wusste ich eigentlich ---------- */
  if (v === 'knew') {
    return VB.head(0.48, 'Wörter · Wiederholen', 'Setz das fehlende Wort ein.') +
      '<div class="stagec">' + VB.procSent('<span class="gap st-bad"><span class="lts">purchase</span></span>') + '<div class="hintline">Gesucht: Einkauf (die Abteilung)</div></div></div>' +
      VB.band('bad', {
        verdict: 'Noch nicht', cmp: '<span class="you">Du:</span> <s class="en">purchase</s> <span class="you">→ Richtig:</span> <b class="en">procurement</b>',
        why: '<span class="en">purchase</span> = ein Kauf oder kaufen. Die Abteilung heißt <span class="en">procurement</span> oder <span class="en">purchasing</span>.',
        override: '<div class="vb-knew">' + ic('check', 'xs') + '<span><b>Gut, dann zeig es gleich.</b> <span class="en">procurement</span> kommt nach 3 Karten noch einmal in einem neuen Satz. Gewertet wird dann nur dieser neue Versuch.</span><button class="link" id="knew-undo">Rückgängig</button></div>',
        extra: VB.moreBtn + VB.alsoBtn
      });
  }
  /* ---------- B5 Kollokation: Wort richtig, Partner falsch ---------- */
  if (v === 'colloc-band') {
    return VB.head(0.55, 'Wörter · Wortpartner', 'Schreib die ganze Wendung.') +
      '<div class="stagec"><div class="sent en">Tomorrow I’ll <span class="gap vb-gap2"><span class="lts"><s class="vb-bad">hold</s> a presentation</span></span> on the new workflow.</div>' +
      '<div class="hintline">Gesucht: eine Präsentation halten</div></div></div>' +
      VB.band('bad', {
        verdict: 'Partner falsch', cmp: '<span class="you">Du:</span> <s class="en">hold</s> <span class="you">→ Richtig:</span> <b class="en">give</b> <span class="en">a presentation</span>',
        why: 'Auf Deutsch <i>hält</i> man eine Präsentation, auf Englisch <i>gibt</i> man sie: <span class="en">give, deliver</span> oder <span class="en">make a presentation</span>.',
        partners: '', back: 'morgen, mit einer Kontrastkarte <span class="en">hold / give</span>', extra: VB.moreBtn + VB.alsoBtn
      });
  }
  /* ---------- B12 falscher Freund (Kontrastkarte) ---------- */
  if (v === 'false-friend') {
    return VB.head(0.6, 'Wörter · <b>Kontrast</b> · Deutsch-Falle', 'Setz das fehlende Wort ein.') +
      '<div class="stagec"><div class="sent en">After three rounds of talks, they ' + gapHtml('eventua', { caret: true, input: true }) + ' signed the contract.</div>' +
      '<div class="vb-hrow"><div class="hintline">Gesucht: schließlich, am Ende</div>' + VB.tone('ff-tone') + '</div></div></div>' + VB.tipBtns();
  }
  if (v === 'false-friend-band') {
    return VB.head(0.64, 'Wörter · <b>Kontrast</b> · Deutsch-Falle', 'Setz das fehlende Wort ein.') +
      '<div class="stagec"><div class="sent en">After three rounds of talks, they <span class="gap st-ok"><span class="lts">eventually</span></span> signed the contract.</div>' +
      '<div class="hintline">Gesucht: schließlich, am Ende</div></div></div>' +
      VB.band('ok', {
        verdict: 'Richtig', cmp: '<span class="you">Du:</span> <b class="en">eventually</b>',
        why: 'Sieht aus wie „eventuell“, heißt aber: schließlich, nach einiger Zeit. Es passiert sicher, nur später.',
        override: '<div class="vb-meta"><div class="vb-pair"><b class="en">eventually</b><span>= schließlich, am Ende</span></div><div class="vb-pair"><b>eventuell</b><span>= <span class="en">possibly, perhaps</span></span></div></div>',
        extra: VB.moreBtn
      });
  }
  if (v === 'pair') {
    return '<header class="phead gx"><div class="tw-hl"><button class="iconbtn" aria-label="Zurück" style="margin-left:-10px;margin-right:0">' + ic('chevL') + '</button><h1 class="disp">Wort-Werkstatt</h1></div></header>' +
      '<div class="scroll gx stack s16" style="padding-bottom:24px">' +
      '<p class="p2" style="margin:0">Wörter, die du oft verwechselst. Eins nach dem anderen, damit sie sich nicht gegenseitig stören.</p>' +
      '<div class="card stack s8"><div class="lbl">Verwechslungspaar</div>' +
      '<div class="vb-pair"><b class="en">affect</b><span>Verb · beeinflussen</span><span class="vb-tag">lernt gerade</span></div>' +
      '<div class="vb-pair"><b class="en">effect</b><span>Nomen · die Wirkung</span><span class="vb-tag off">ruht</span></div>' +
      '<div class="hr"></div><p class="p" style="margin:0"><span class="en">effect</span> ruht, bis du <span class="en">affect</span> an 2 Tagen ohne Hilfe richtig hast. Dann kommen beide abwechselnd.</p>' +
      '<p class="p2" style="margin:0">Merksatz: <span class="en">The new policy <b>affects</b> everyone. The <b>effect</b> is clear.</span></p></div>' +
      '<div class="card stack s8"><div class="lbl">Deutsch-Falle</div>' +
      '<div class="vb-pair"><b class="en">eventually</b><span>≠ eventuell</span><span class="vb-tag">kommt als Kontrast</span></div>' +
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
        why: 'Verb + <span class="en">with</span>: <span class="en">comply with a policy, a law</span>. Nicht <span class="en">to</span>, auch wenn man auf Deutsch „sich an etwas halten“ denkt.',
        partners: 'comply with a policy · comply with regulations', back: 'gleich noch einmal ohne Satz · dann morgen', extra: VB.moreBtn + VB.alsoBtn, knew: true
      });
  }
  /* ---------- N1 „Warum heute?“ im Menü ---------- */
  if (v === 'menu') {
    return VB.head(0.42, 'Wörter · Wiederholen', 'Setz das fehlende Wort ein.') +
      '<div class="stagec">' + VB.procSent(gapHtml('', { caret: true, input: true })) +
      '<div class="hintline">Gesucht: Einkauf (die Abteilung)</div></div></div>' + VB.tipBtns() +
      '<div class="scrim" style="background:transparent"></div><div class="menu vb-menu" id="ex-menu" role="menu">' +
      '<div class="vb-whytoday"><div class="lbl">Warum heute?</div><p>Fällig seit 2 Tagen. Zuletzt richtig am 20.10., seitdem sinkt die Chance, dass du es noch weißt.</p><span>Selbst schreiben · Stufe 4 von 7</span></div><hr>' +
      '<button role="menuitem">' + ic('claude', 'sm') + 'Claude fragen</button>' +
      '<button role="menuitem">' + ic('trans', 'sm') + 'Übersetzer</button>' +
      '<button role="menuitem">' + ic('up', 'sm') + 'Zu leicht · kenne ich längst</button>' +
      '<hr><button role="menuitem">' + ic('flag', 'sm') + 'Aufgabe war unfair</button></div>';
  }
  return '';
}
reg('vb', {
  code: 'VB', name: 'Wörter-Karte (Entwurf)', kind: 'phone',
  variants: [['intro-try', 'B10 Versuch'], ['intro-reveal', 'B10 aufgedeckt'], ['intro-known', 'B10 Kenne ich schon'], ['card', 'Lernkarte'], ['card-tip', 'Lernkarte mit Tipp'],
    ['band-ok', 'Band richtig'], ['band-near', 'Band fast'], ['band-wrong', 'Band falsch'], ['knew', 'B4'], ['colloc-band', 'B5'], ['false-friend', 'B12 falscher Freund'], ['false-friend-band', 'B12 Band'], ['pair', 'B12 Paar'],
    ['pattern', 'B13'], ['pattern-band', 'B13 Band'], ['menu', 'N1']],
  render: vbPhone
});

/* ---------- B8 Start und Abschluss, B11 Wiederkehr ---------- */
function vbStart(v) {
  const back = v === 'return';
  const head = '<header class="phead gx"><div class="tw-hl"><button class="iconbtn" aria-label="Zurück" style="margin-left:-10px;margin-right:0">' + ic('chevL') + '</button><h1 class="disp">Wörter</h1></div><span class="tw-badge">Pflicht</span></header>';
  const card = back
    ? '<div class="card stack s16 vb-start"><div class="lbl">Willkommen zurück</div><div class="disp" style="font-size:28px;line-height:34px;font-weight:700">Wörter · ca. 15 Min.</div>' +
      '<p class="p" style="margin:0"><b>32 fällig.</b> Heute die 18, die du am ehesten vergisst. Der Rest verteilt sich bis Do.</p>' +
      VB.spread() +
      '<p class="p2" style="margin:0">Dazu 2 neue Wörter, wie an jedem Lerntag. Heute ohne Anwenden. Ab Fr wieder dein normaler Plan.</p>' +
      '<button class="btn pri full" id="vb-go">Los geht’s</button></div>'
    : '<div class="card stack s16 vb-start"><div class="lbl">Heute</div><div class="disp" style="font-size:28px;line-height:34px;font-weight:700">Wörter · ca. 14 Min.</div>' +
      '<p class="p" style="margin:0"><b>Warum diese?</b> 11 fällig, die du am ehesten vergisst, zuerst · 3 neue, eingestreut · am Ende 3 Min. Anwenden.</p>' +
      '<div class="vb-mix"><span style="flex:11" class="d"></span><span style="flex:3" class="n"></span><span style="flex:3" class="a"></span></div>' +
      '<div class="vb-mixl"><span>11 fällig</span><span>3 neu</span><span>Anwenden</span></div>' +
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
    ['plus', 'Heute gelernt', '<b>3 neue:</b> <span class="en">renew, lead time, leverage</span>'],
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
          .replace(/(<span class="nm">Wörter<\/span><span class="sm num">)14 Min\./, (m, a) => v === 'ring' ? m : a + 'ca. 14 Min.');
      } finally { dayBlocks = orig; }
    }
    const b = VB.blocks();
    const lines = [['w', 'Gestern-Check', '3 Min.', 'done'], ['w', 'Wörter', 'ca. 14 Min.', 'next', '11 fällig · 3 neu · Anwenden'], ['g', 'Grammatik', '5 Min.'], ['l', 'Hören', '4 Min.'], ['s', 'Sag es', '4 Min.']];
    return '<header class="phead gx"><h1 class="disp">Heute</h1>' + askBtn() + '</header><div class="scroll gx stack s16" style="padding-bottom:24px">' +
      '<div class="card stack s16"><div class="lbl">Als Nächstes</div><div class="disp" style="font-size:26px;line-height:32px;font-weight:700">Wörter · ca. 14 Min.</div>' +
      '<p class="p2" style="margin:0">11 fällig, die du am ehesten vergisst, zuerst · 3 neue · am Ende Anwenden</p><button class="btn pri full">Los geht’s</button></div>' +
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
      blockLine('w', 'Wörter · Wiederholen') + instr('Setz das fehlende Wort ein.', checked ? 'd-why' : false) +
      '<div class="stack s16" style="padding:3em 0 1.5em">' + VB.procSent(checked ? '<span class="gap st-near"><span class="lts">procurment</span></span>' : gapHtml('procu', { caret: true, input: true })) +
      '<div class="vb-hrow" style="max-width:32em"><div class="hintline">Gesucht: Einkauf (die Abteilung)</div>' + (checked ? '' : VB.tone('dl-tone')) + '</div></div>';
    if (checked) s += '<div class="dverdict s-near vb-dband" role="status"><div class="vb-vrow"><div class="verdict"><span class="vi">' + ic('near', 'xs') + '</span>Fast richtig</div>' + VB.tone('d-tone') + '</div>' +
      '<div class="cmp"><span class="you">Du:</span> ' + VB.diff([['=', 'procur'], ['+', 'e'], ['=', 'ment']]) + '</div>' +
      '<p class="whyl"><span class="vb-why">Warum</span> Nomen aus <span class="en">procure</span> + <span class="en">-ment</span>: Das <span class="en">e</span> bleibt, wie bei <span class="en">manage → management</span>.</p>' +
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

/* =========================================================
   Satz 2 (vor V4): Wort-Detail, Dashboard, Anwenden, eigener Satz, Einstellungen
   ========================================================= */
/* N5 Zeitleiste: ein Feld je Lerntag der letzten 6 Wochen. f = frei richtig, h = mit Hilfe/fast, x = falsch, g = ohne Planwirkung (Übung, Auswahl), leer = kein Kontakt */
VB.TL = '......f.g....f..h..f..x....f..f..g..h....h';
VB.timeline = () => '<div class="vb-tl" role="img" aria-label="Verlauf der letzten 6 Wochen">' + VB.TL.split('').map(c => '<i class="' + (c === '.' ? '' : 't' + c) + '"></i>').join('') + '</div>' +
  '<div class="vb-tlx"><span>23.9.</span><span>heute</span></div>' +
  '<div class="vb-tlleg"><span><i class="tf"></i>frei richtig</span><span><i class="th"></i>mit Hilfe</span><span><i class="tx"></i>falsch</span><span><i class="tg"></i>nur Übung</span></div>';
VB.tracks = () => '<div class="vb-tracks">' +
  '<div class="vb-trk"><span class="vb-trn">Verstehen</span><span class="vb-trs"><b>sicher</b> · nächster Abruf Sa, 21.11.</span></div>' +
  '<div class="vb-trk"><span class="vb-trn">Selbst schreiben</span><span class="vb-trs"><b>auf dem Weg</b> · nächster Abruf Fr, 6.11.</span></div></div>';
VB.stageCard = () => '<div class="card stack s8"><div class="lbl">Stand · Stufe 4 von 7</div>' + VB.stagebar(4) +
  '<div class="vb-stl"><span>erkennst du</span><span>auf dem Weg</span><span>bildest du selbst</span></div>' + VB.tracks() +
  '<p class="p2" style="margin:0">Nächster Schritt: 3 Tage ohne Hilfe, dann fragt die App ohne Satz, nur aus dem Deutschen.</p></div>';
function vbDetail(v) {
  const head = '<header class="phead gx"><button class="iconbtn" aria-label="Zurück" style="margin-left:-10px;margin-right:0">' + ic('chevL') + '</button>' + askBtn() + '</header>';
  const top = '<div class="stack s6"><div style="display:flex;align-items:center;gap:10px"><div class="prompt disp en" style="font-size:36px;line-height:42px">procurement</div>' + VB.tone('d-tone') + '</div><div class="p2 en">/prəˈkjʊrmənt/ · Nomen</div></div>' +
    '<div class="disp" style="font-size:22px;line-height:28px;font-weight:600">der Einkauf (Abteilung und Ablauf)</div>';
  if (v === 'history') {
    const rows = [['Di, 3.11.', 'Lücke tippen', 'h', 'fast richtig: procurment', 'kommt wieder Fr, 6.11.'], ['Do, 29.10.', 'Anwenden (Mail)', 'h', 'Wortpartner knapp', 'zählt, aber kein Aufstieg'], ['Mo, 26.10.', 'Dieses Wort üben', 'g', 'nur Übung', 'keine Wirkung auf den Plan'], ['Fr, 23.10.', 'Hören → tippen', 'f', 'frei richtig', 'Verstehen: nächster Abruf 21.11.'], ['Di, 20.10.', 'Lücke tippen', 'f', 'frei richtig', 'Aufstieg auf Stufe 4'], ['Do, 15.10.', 'Lücke tippen', 'x', 'falsch: purchase', 'kam am selben Tag noch einmal']];
    return head + '<div class="scroll gx stack s16" style="padding-bottom:24px">' + top +
      '<div class="card stack s8"><div class="lbl">Verlauf · 6 Wochen</div>' + VB.timeline() + '</div>' +
      '<div class="card" style="padding:4px 16px">' + rows.map(r => '<div class="st vb-hr"><span class="vb-hd t' + r[2] + '"></span><span class="vb-hrt"><b>' + r[0] + ' · ' + r[1] + '</b><span>' + r[3] + ' · ' + r[4] + '</span></span></div>').join('') + '</div></div>' + tabbar('h12');
  }
  return head + '<div class="scroll gx stack s16" style="padding-bottom:24px">' + top + VB.stageCard() +
    '<div class="card stack s8"><div class="lbl">Verlauf · 6 Wochen</div>' + VB.timeline() + '<button class="link" style="align-self:flex-start">Alle Versuche</button></div>' +
    '<div class="stack s6"><div class="lbl">Ursprungssatz · aus deinem Lesen, Di 22.9.</div><p class="p en" style="font-size:18px;line-height:26px;margin:0">The <b>procurement</b> process can take up to six months in the public sector.</p></div>' +
    '<div class="stack s6"><div class="lbl">Wortpartner</div><p class="p en" style="margin:0">procurement team · procurement process · public procurement</p></div>' +
    '<div class="stack s6"><div class="lbl">Deine Sätze</div><div class="vb-own"><span class="vb-ok">' + ic('check', 'xs') + '</span><p class="en">Their procurement team needs two weeks to approve the order.</p><span class="vb-ownm">geprüft · 29.10. · getippt</span></div>' +
    '<p class="p2" style="margin:0">Für Stufe 7 zählen eigene Sätze erst ab Stufe 5: dann 2 in verschiedenen Zusammenhängen, einer davon gern gesprochen.</p></div>' +
    '<div class="stack s6"><div class="lbl">Auch woanders gesehen</div><p class="p" style="margin:0">im Lesen gesehen (19.10.) · in einer C1-Aufgabe richtig benutzt (27.10.)</p></div>' +
    '<button class="btn pri full">Dieses Wort üben</button></div>' + tabbar('h12');
}
reg('vbd', { code: 'VBD', name: 'Wort-Detail (Entwurf)', kind: 'phone', variants: [['main', 'B2 Detail'], ['history', 'N5 Verlauf']], render: vbDetail });
reg('vbdl', {
  code: 'VBDL', name: 'Wort-Detail Laptop (Entwurf)', kind: 'desk', nav: 'woerter',
  variants: [['main', 'Detail']],
  render() {
    const stage = '<div class="dscroll stack s16" style="padding-top:1.5em">' +
      '<div style="display:flex;align-items:center;gap:.6em"><div class="prompt disp en" style="font-size:2.4em;line-height:1.15">procurement</div>' + VB.tone('dl-tone') + '</div>' +
      '<div class="p2 en" style="margin:0">/prəˈkjʊrmənt/ · Nomen · der Einkauf (Abteilung und Ablauf)</div>' + VB.stageCard() +
      '<div class="card stack s8"><div class="lbl">Verlauf · 6 Wochen</div>' + VB.timeline() + '</div>' +
      '<div class="stack s6"><div class="lbl">Ursprungssatz · aus deinem Lesen, Di 22.9.</div><p class="p en" style="margin:0;font-size:1.1em">The <b>procurement</b> process can take up to six months in the public sector.</p></div></div>';
    const ctx = ctxBlock('Üben', '<button class="btn pri full">Dieses Wort üben</button><p class="p2" style="margin:0;font-size:.85em">Nicht fällig: zählt als Übung, der Plan bleibt.</p>') +
      ctxBlock('Wortpartner', '<p class="p en" style="margin:0">procurement team · procurement process · public procurement</p>') +
      ctxBlock('Deine Sätze', '<div class="vb-own"><span class="vb-ok">' + ic('check', 'xs') + '</span><p class="en">Their procurement team needs two weeks to approve the order.</p><span class="vb-ownm">geprüft · 29.10. · getippt</span></div>') +
      ctxBlock('Auch woanders gesehen', '<p class="p2" style="margin:0">im Lesen (19.10.) · C1-Aufgabe richtig benutzt (27.10.)</p>');
    return { stage, ctx };
  }
});

/* B1 Dashboard: H34 Wörter + Karte „Die nächsten 14 Tage“ + Behaltensrate (N7) */
function vbDash() {
  const days = [['Di', 15, 1], ['Mi', 14], ['Do', 15], ['Fr', 13], ['Sa', 14], ['So', 0, 0, 1], ['Mo', 15], ['Di', 14], ['Mi', 15], ['Do', 14], ['Fr', 13], ['Sa', 15], ['So', 0, 0, 1], ['Mo', 14]];
  const fc = '<div class="card stack s8"><div class="lbl">Die nächsten 14 Tage · Minuten Wörter</div>' +
    '<div class="vb-fc" role="img" aria-label="Lernzeit je Tag, gleichmäßig um 14 Minuten, sonntags Ruhetag">' + days.map(d => '<div class="' + (d[2] ? 'on' : '') + (d[3] ? ' rest' : '') + '"><b class="num">' + (d[3] ? '–' : d[1]) + '</b><i style="height:' + (d[3] ? 3 : d[1] * 4) + 'px"></i><span>' + d[0] + '</span></div>').join('') + '</div>' +
    '<p class="p2" style="margin:0">Gleichmäßig um 14 Min., deine Zielzeit ist 15. Sonntag ist Ruhetag.</p></div>';
  const ret = '<div class="card stack s8"><div class="lbl">Behaltensrate · letzte 30 Tage</div><div class="ts-bign"><b class="disp num">89 %</b><span>Ziel 90 %</span></div>' +
    '<div class="vb-rt"><div><span>gefestigt</span><b class="num">93 %</b></div><div><span>jung</span><b class="num">86 %</b></div></div>' +
    '<p class="p2" style="margin:0">So oft wusstest du ein fälliges Wort beim ersten Versuch. Passt zum Ziel.</p></div>';
  const counts = '<div class="card stack s16"><div class="vb-two"><div><b class="disp num">46</b><span>bildest du selbst</span></div><div><b class="disp num">491</b><span>verstehst du beim Lesen und Hören</span></div></div>' +
    '<div class="ts-leg"><div><span class="ts-sw f5"></span><span>Bildest du selbst <em>S6–S7</em></span><b class="num">46</b></div><div><span class="ts-sw f34"></span><span>Auf dem Weg <em>S3–S5</em></span><b class="num">58</b></div><div><span class="ts-sw out"></span><span>Erkennst du <em>S1–S2</em></span><b class="num">387</b></div><div class="tot"><span></span><span>Alle Wörter</span><b class="num">491</b></div></div></div>';
  return tsPage('h14-main', gearBtn(), tsProgNav('words') + tsTitle('Wörter', 'Gezählt wird nur, was du frei abrufst. Auswählen zählt nicht.') + counts + fc + ret, 'h14');
}
function vbDashAlt() {
  /* N7 mit Hinweis bei mehr als 5 Punkten Abweichung */
  return tsPage('h14-main', gearBtn(), tsProgNav('words') + '<div class="card stack s8"><div class="lbl">Behaltensrate · letzte 30 Tage</div><div class="ts-bign"><b class="disp num">83 %</b><span>Ziel 90 %</span></div>' +
    '<div class="vb-rt"><div><span>gefestigt</span><b class="num">91 %</b></div><div><span>jung</span><b class="num">74 %</b></div></div>' +
    '<div class="notice">' + ic('info', 'sm') + '<span><b>7 Punkte unter dem Ziel.</b> Vor allem junge Wörter rutschen weg. Die App plant sie ab morgen etwas früher; das kostet ca. 2 Min. mehr am Tag.</span></div></div>', 'h14');
}
reg('vbb', { code: 'VBB', name: 'Dashboard Wörter (Entwurf)', kind: 'phone', variants: [['main', 'B1'], ['off', 'N7 Abweichung']], render: v => v === 'off' ? vbDashAlt() : vbDash() });

/* B7 Anwenden (neu H38) */
VB.chips = (st) => '<div class="vb-chips en">' + [['postpone', 0], ['lead time', 1], ['sign off on', 2]].map(c => '<span class="chip' + (st ? ' vb-c' + st[c[1]] : '') + '">' + (st ? ic({ ok: 'check', near: 'near', bad: 'cross' }[st[c[1]]], 'xs') : '') + c[0] + '</span>').join('') + '</div>';
VB.mail = 'Hi Mark, we have to postpone the rollout by one week. The lead time for the new scanners is longer than planned. Could your team sign off the order by Friday?';
function vbApply(v) {
  const top = exTop(VB.blocks(), 1, 0.9) + '<div class="ex-body gx">' + blockLine('w', 'Wörter · <b>Anwenden</b> · ca. 3 Min.') + instr('Schreib 2–3 Sätze und benutze die drei Wörter.');
  const lage = '<div class="card stack s8"><div class="lbl">Mail an einen Kunden · freundlich, klar</div><p class="p" style="margin:0">Sag Mark, dass sich der Rollout um eine Woche verschiebt, warum, und bitte ihn, die Bestellung bis Freitag freizugeben.</p></div>';
  if (v === 'task') {
    return top + '<div class="stack s16" style="padding-top:16px">' + lage + VB.chips() +
      '<div class="field en" style="min-height:150px">' + VB.mail + '<span class="caret" style="display:inline-block;width:2px;height:1em;background:var(--act-text);vertical-align:-2px;margin-left:1px"></span></div></div></div>' +
      exFoot('<button class="btn sec" aria-label="Diktieren">' + ic('mic', 'sm') + '</button>' + btnPri('apply-check', 'Prüfen'), true) + drawnKbd({ go: 'return' });
  }
  if (v === 'feedback') {
    const rows = [['ok', 'postpone', 'richtig benutzt: einen Termin nach hinten schieben.'], ['ok', 'lead time', 'richtig: die Zeit bis zur Lieferung.'], ['near', 'sign off on', 'Wort richtig, Partner fehlt: <b>sign off on</b> the order. Ohne <i>on</i> klingt es unfertig.']];
    return exTop(VB.blocks(), 1, 0.95) + '<div class="ex-body gx">' + blockLine('w', 'Wörter · <b>Anwenden</b> · geprüft von Claude') +
      '<div class="stack s16" style="padding-top:14px">' + VB.chips(['ok', 'ok', 'near']) +
      '<div class="card en" style="font-size:16px;line-height:24px">Hi Mark, we have to <u class="vb-uok">postpone</u> the rollout by one week. The <u class="vb-uok">lead time</u> for the new scanners is longer than planned. Could your team <u class="vb-unear">sign off</u> the order by Friday?</div>' +
      '<div class="card" style="padding:4px 16px">' + rows.map(r => '<div class="st vb-fr"><span class="vb-fi ' + r[0] + '">' + ic({ ok: 'check', near: 'near' }[r[0]], 'xs') + '</span><span class="vb-hrt"><b class="en">' + r[1] + '</b><span>' + r[2] + '</span></span></div>').join('') + '</div>' +
      '<div class="stack s6"><div class="lbl">So ginge es natürlicher</div><p class="p en" style="margin:0">Could your team <b>sign off on</b> the order by Friday?</p></div>' +
      '<p class="vb-quiet">' + ic('cal', 'xs') + '<span>Zählt als Wiederholung: <span class="en">postpone</span> und <span class="en">lead time</span> rücken weiter, <span class="en">sign off on</span> kommt morgen ohne Satz.</span></p></div></div>' +
      exFoot(btnSec('apply-also', 'War das auch richtig?') + btnPri('apply-next', 'Weiter'));
  }
  /* offline: ohne Claude */
  return exTop(VB.blocks(), 1, 0.95) + '<div class="ex-body gx">' + blockLine('w', 'Wörter · <b>Anwenden</b> · ohne Claude') +
    '<div class="stack s16" style="padding-top:14px"><div class="notice">' + ic('offline', 'sm') + '<span><b>Claude ist gerade nicht erreichbar.</b> Vergleich selbst mit dem Muster. Das zählt nicht für den Plan, deine Termine bleiben.</span></div>' +
    '<div class="stack s6"><div class="lbl">Dein Text</div><p class="p en" style="margin:0">' + VB.mail + '</p></div>' +
    '<div class="card stack s8"><div class="lbl">Muster</div><p class="p en" style="margin:0">Hi Mark, we need to <b>postpone</b> the rollout by a week. The <b>lead time</b> for the new scanners is longer than expected. Could your team <b>sign off on</b> the order by Friday?</p></div>' +
    '<p class="p2" style="margin:0">Achte auf die fett gedruckten Wörter: Steht bei dir dasselbe?</p></div></div>' +
    exFoot(btnSec('apply-retry', 'Später prüfen lassen') + btnPri('apply-next', 'Weiter'));
}
reg('vba', { code: 'VBA', name: 'Anwenden (Entwurf)', kind: 'phone', variants: [['task', 'Aufgabe'], ['feedback', 'Rückmeldung'], ['offline', 'ohne Claude']], render: vbApply });

/* B6 eigener Satz, Stufe 6 */
function vbOwn(v) {
  const top = exTop(VB.blocks(), 1, 0.7) + '<div class="ex-body gx">' + blockLine('w', 'Wörter · <b>Eigener Satz</b> · Stufe 6') + instr('Schreib oder sag einen eigenen Satz mit <span class="en">leverage</span>.');
  const lage = '<div class="card stack s8"><div class="lbl">Lage · im Call mit einem Kunden</div><p class="p" style="margin:0">Der Kunde fragt, warum die Umstellung nur drei Monate dauert. Erkläre, was ihr nutzt.</p></div>';
  const txt = 'We can leverage our existing templates, so the migration only takes three months.';
  if (v === 'task') {
    return top + '<div class="stack s16" style="padding-top:16px">' + lage + '<div class="field en" style="min-height:120px">' + txt + '<span class="caret" style="display:inline-block;width:2px;height:1em;background:var(--act-text);vertical-align:-2px;margin-left:1px"></span></div>' +
      '<p class="vb-quiet">' + ic('info', 'xs') + '<span>Nicht zu nah am Beispielsatz und nicht zu allgemein, sonst zählt er nicht.</span></p></div></div>' +
      exFoot('<button class="btn sec" aria-label="Diktieren">' + ic('mic', 'sm') + '</button>' + btnPri('own-check', 'Prüfen'), true) + drawnKbd({ go: 'return' });
  }
  if (v === 'noai') {
    return top + '<div class="stack s16" style="padding-top:16px"><div class="notice">' + ic('offline', 'sm') + '<span><b>Claude ist gerade nicht erreichbar.</b> Vergleich selbst. Zählt nicht für Stufe 7, deine Termine bleiben.</span></div>' +
      '<div class="stack s6"><div class="lbl">Dein Satz</div><p class="p en" style="margin:0">' + txt + '</p></div>' +
      '<div class="card stack s8"><div class="lbl">So benutzt man es</div><p class="p en" style="margin:0"><b>leverage</b> + etwas, das man schon hat: <i>leverage our experience, our data, existing templates</i></p></div></div></div>' +
      exFoot(btnSec('own-later', 'Später prüfen lassen') + btnPri('own-next', 'Weiter'));
  }
  return exTop(VB.blocks(), 1, 0.75) + '<div class="ex-body gx' + '">' + blockLine('w', 'Wörter · <b>Eigener Satz</b> · geprüft von Claude') +
    '<div class="stack s16" style="padding-top:14px"><div class="card en" style="font-size:17px;line-height:25px">We can <u class="vb-uok">leverage</u> our existing templates, so the migration only takes three months.</div>' +
    '<div class="card" style="padding:4px 16px">' +
    [['ok', 'Richtiger Sinn', '<span class="en">leverage</span> = etwas Vorhandenes gezielt nutzen. Passt.'], ['ok', 'Natürlich', 'So sagt man es im Call.'], ['ok', 'Wortpartner', '<span class="en">leverage existing templates</span> ist eine typische Verbindung.']]
      .map(r => '<div class="st vb-fr"><span class="vb-fi ' + r[0] + '">' + ic('check', 'xs') + '</span><span class="vb-hrt"><b>' + r[1] + '</b><span>' + r[2] + '</span></span></div>').join('') + '</div>' +
    '<div class="notice">' + ic('check', 'sm') + '<span><b>1 von 2 eigenen Sätzen für Stufe 7.</b> Der nächste in einem anderen Zusammenhang, gern gesprochen.</span></div></div></div>' +
    exFoot(btnSec('own-also', 'Nochmal selbst schreiben') + btnPri('own-next', 'Weiter'));
}
reg('vbo', { code: 'VBO', name: 'Eigener Satz (Entwurf)', kind: 'phone', variants: [['task', 'Aufgabe'], ['feedback', 'Rückmeldung'], ['noai', 'ohne Claude']], render: vbOwn });

/* B9 Einstellungen Wörter */
function vbSettings() {
  const seg = (vals, on) => '<div class="seg2 vb-seg" style="grid-template-columns:repeat(' + vals.length + ',1fr)">' + vals.map((x, i) => '<button class="' + (i === on ? 'on' : '') + '">' + x + '</button>').join('') + '</div>';
  const sw = (t, sub, on) => '<div class="row" style="min-height:64px"><span class="rt"><b>' + t + '</b><span>' + sub + '</span></span><span class="tw-switch' + (on ? ' on' : '') + '" aria-hidden="true"><i></i></span></div>';
  return '<header class="phead gx"><div class="tw-hl"><button class="iconbtn" aria-label="Zurück" style="margin-left:-10px;margin-right:0">' + ic('chevL') + '</button><h1 class="disp">Wörter</h1></div></header>' +
    '<div class="scroll gx stack s24" style="padding-bottom:24px">' +
    '<div class="stack s8"><div class="lbl">Zielzeit für den Wörter-Block</div>' + seg(['10', '15', '20', '30'], 1) + '<p class="p2" style="margin:0">Minuten am Tag. Die App verteilt Wiederholungen so, dass es jeden Tag ungefähr so viel ist.</p></div>' +
    '<div class="stack s8"><div class="lbl">Neue Wörter pro Lerntag</div>' + seg(['0', '2', '5', '10'], 2) + '<p class="p2" style="margin:0">Mindestens 2 kommen an jedem Lerntag, auch wenn viel fällig ist. Nur bei 0 keine.</p></div>' +
    '<div class="stack s8"><div class="lbl">Wie sicher sollen die Wörter sitzen?</div>' +
    '<div class="vb-safe">' + [['85 %', 'ca. 11 Min.', 0], ['90 %', 'ca. 15 Min.', 1], ['95 %', 'ca. 24 Min.', 0]].map(x => '<button class="' + (x[2] ? 'on' : '') + '"><b class="num">' + x[0] + '</b><span>' + x[1] + '</span></button>').join('') + '</div>' +
    '<p class="p2" style="margin:0">Mehr Sicherheit heißt öfter wiederholen. Die Minuten gelten für deine 491 Wörter.</p></div>' +
    '<div class="card" style="padding:4px 16px">' + sw('Anki-Modus', 'Aufdecken und selbst bewerten · wirkt nur auf Verstehen', false) + sw('Satz vor dem Prüfen anhören', 'Lücke als kurzer Ton', true) + '</div></div>' + tabbar('h12');
}
reg('vbe', { code: 'VBE', name: 'Einstellungen Wörter (Entwurf)', kind: 'phone', variants: [['main', 'B9']], render: vbSettings });
