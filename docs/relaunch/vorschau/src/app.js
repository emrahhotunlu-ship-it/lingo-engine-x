'use strict';
/* Lingo Vorschau · Kern: Zustand, Texte, Symbole, Bausteine, Vorführleiste, Navigation.
   Reines Vanilla-JS, keine Fähigkeiten (kein db, kein sample). Alles erfunden. */

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const LS_KEY = 'lx-vorschau-1';
const reduceQuery = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) { return null; } })();

const S = {
  screen: 'h1', v: '', demo: 'ok', mode: 'dark', motion: reduceQuery && reduceQuery.matches ? 'off' : 'on',
  accent: 'iris', tab4: 'praxis', lang: 'de', toolOpen: null, measure: false,
  ui: {}, typed: null
};
function loadPrefs() {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return;
    const j = JSON.parse(raw);
    ['demo', 'mode', 'motion', 'accent', 'tab4', 'lang'].forEach(k => { if (typeof j[k] === 'string') S[k] = j[k]; });
  } catch (e) { /* Speicher nicht verfügbar: Standardwerte bleiben */ }
}
function savePrefs() {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify({ demo: S.demo, mode: S.mode, motion: S.motion, accent: S.accent, tab4: S.tab4, lang: S.lang }));
  } catch (e) { /* Speicher nicht verfügbar: Schalter gelten nur in diesem Aufruf */ }
}

const L = (de, en) => (S.lang === 'en' && en != null ? en : de);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- Symbole (eigene Linien-Symbole, 24er Raster) ---------- */
const IC = {
  today: '<path d="M12 3.5a8.5 8.5 0 1 1-8.5 8.5"/><path d="M12 3.5A8.5 8.5 0 0 0 3.5 12" opacity=".35"/><circle cx="12" cy="12" r="2.6"/>',
  words: '<rect x="4" y="7" width="12.5" height="13" rx="2.5"/><path d="M8 3.5h9.5A2.5 2.5 0 0 1 20 6v10"/><path d="M7.5 12h5.5M7.5 15.5h3.5"/>',
  gram: '<circle cx="6" cy="5.5" r="2"/><circle cx="18" cy="18.5" r="2"/><path d="M8 5.5h7.5a3.25 3.25 0 0 1 0 6.5h-7a3.25 3.25 0 0 0 0 6.5H16"/>',
  praxis: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V16A2.5 2.5 0 0 1 4 13.5z"/><path d="M8.5 9h7M8.5 12h4"/>',
  speak: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V16A2.5 2.5 0 0 1 4 13.5z"/><path d="M9 8.5v4M12 7v7M15 9v2"/>',
  prog: '<path d="M4 20h16"/><path d="M7 16v-4M12 16V6.5M17 16v-7"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  more: '<circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  near: '<path d="M5 13.5c2.2-3.2 4.3-3.2 7 0s4.8 3.2 7 0"/>',
  cross: '<path d="M7 7l10 10M17 7 7 17"/>',
  ring: '<circle cx="12" cy="12" r="6"/>',
  chevR: '<path d="m9.5 6 6 6-6 6"/>',
  chevL: '<path d="m14.5 6-6 6 6 6"/>',
  chevD: '<path d="m6 9.5 6 6 6-6"/>',
  chevU: '<path d="m6 14.5 6-6 6 6"/>',
  play: '<path d="M8.5 5.8v12.4a.8.8 0 0 0 1.2.7l10-6.2a.8.8 0 0 0 0-1.4l-10-6.2a.8.8 0 0 0-1.2.7z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6.5" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.9" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none"/>',
  speaker: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.6 3.5 5.4 3.5 8.5s-1.1 5.9-3.5 8.5c-2.4-2.6-3.5-5.4-3.5-8.5s1.1-5.9 3.5-8.5z"/>',
  flag: '<path d="M5.5 21V4"/><path d="M5.5 4.5h11.5l-2.2 4 2.2 4H5.5"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>',
  ask: '<path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v8a2.5 2.5 0 0 1-2.5 2.5H12l-4 3v-3h-.5A2.5 2.5 0 0 1 5 14.5z"/><path d="M10.2 8.8a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.4"/><circle cx="12" cy="14.2" r=".7" fill="currentColor" stroke="none"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  up: '<path d="M7 17 17 7M9.5 7H17v7.5"/>',
  flat: '<path d="M5 12h14M15 8l4 4-4 4"/>',
  book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
  ear: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="13.5" width="4" height="6.5" rx="1.5"/><rect x="16.5" y="13.5" width="4" height="6.5" rx="1.5"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trans: '<path d="M4 6h9M8.5 4v2M6 6c.8 3 3 5.5 6 6.5M11 6c-.8 3.5-3.3 6.3-6.5 7.5"/><path d="M13 20l3.5-8 3.5 8M14.2 17.5h4.6"/>',
  claude: '<path d="M12 4.5v15M4.5 12h15M6.7 6.7l10.6 10.6M17.3 6.7 6.7 17.3"/>',
  offline: '<path d="M3.5 3.5l17 17"/><path d="M7.5 9.2A5 5 0 0 0 7 19h10.5M11 6.2A6 6 0 0 1 18 11a4 4 0 0 1 2.6 6"/>',
  refresh: '<path d="M19.5 11a7.5 7.5 0 1 0-2.2 5.3"/><path d="M19.5 5v6h-6"/>',
  laptop: '<rect x="4.5" y="5" width="15" height="10.5" rx="1.5"/><path d="M2.5 18.5h19"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  rotate: '<rect x="3" y="9" width="18" height="10" rx="2"/><path d="M7.5 5h6a4 4 0 0 1 4 4"/><path d="m15.5 7 2 2 2-2"/>',
  bulb: '<path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  kbd: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M10.5 10h.01M14 10h.01M17 10h.01M7.5 14h9"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  send: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  shift: '<path d="M12 4.5 4.5 12H8v7h8v-7h3.5z"/>',
  back: '<path d="M9 6h11v12H9l-6-6z"/><path d="m12 10 4 4M16 10l-4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  repeat: '<path d="M4 12a7 7 0 0 1 12-5l2 2M20 12a7 7 0 0 1-12 5l-2-2"/><path d="M18 4v5h-5M6 20v-5h5"/>',
  spark: '<path d="M12 3.5 13.8 10.2 20.5 12l-6.7 1.8L12 20.5l-1.8-6.7L3.5 12l6.7-1.8z"/>',
  list: '<path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01"/>',
  sidebar: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15"/>',
  wave: '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2"/>'
};
function ic(name, cls) { return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (IC[name] || '') + '</svg>'; }
const STATE_IC = { ok: 'check', typo: 'near', near: 'near', wrong: 'cross', bad: 'cross', idk: 'ring' };

/* ---------- Tagesmodell (erfunden) ---------- */
const TOPIC = () => L('Nachfassen nach dem Angebot', 'Following up on the quote');
function dayBlocks(kind) {
  const n = [
    { c: 'w', n: L('Gestern-Check', 'Yesterday check'), m: 3 },
    { c: 'w', n: L('Wörter', 'Words'), m: 7 },
    { c: 'g', n: L('Grammatik', 'Grammar'), m: 5 },
    { c: 'l', n: L('Hören', 'Listening'), m: 4 },
    { c: 's', n: L('Sag es', 'Say it'), m: 4 },
    { c: 's', n: L('Flüssigkeit', 'Fluency'), m: 5 }
  ];
  if (kind === 'mission') return n.slice(0, 4).concat([{ c: 's', n: L('Mission', 'Mission'), m: 9, mission: true }]);
  if (kind === 'catchup') return [2, 6, 4, 3, 2, 3].map((m, i) => Object.assign({}, n[i], { m }));
  /* Tagestypen nach Konzept 2.3: Schreibtag (Do), Testtag, Wochenabschluss (Sa). Jeweils 28 Min. */
  if (kind === 'writing') return n.slice(0, 4).concat([{ c: 's', n: L('Wochen-Mail', 'Weekly email'), m: 6 }, Object.assign({}, n[5], { m: 3 })]);
  if (kind === 'test') return [n[0], n[1], { c: 'g', n: L('Themen-Test', 'Topic test'), m: 10 }, n[3], Object.assign({}, n[5], { m: 4 })];
  if (kind === 'review') return [3, 5, 3, 7].map((m, i) => Object.assign({}, n[i], { m })).concat([Object.assign({}, n[5], { m: 10 })]);
  return n;
}

/* ---------- Bausteine ---------- */
function ringSvg(blocks, done, partial, opts) {
  opts = opts || {};
  const T = blocks.reduce((a, b) => a + b.m, 0);
  const cx = 100, cy = 100, r = 86, gap = 8;
  let a = -90, out = '';
  const pt = deg => [cx + r * Math.cos(deg * Math.PI / 180), cy + r * Math.sin(deg * Math.PI / 180)];
  blocks.forEach((b, i) => {
    const span = b.m / T * 360;
    const a0 = a + gap / 2, a1 = a + span - gap / 2;
    const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
    const large = a1 - a0 > 180 ? 1 : 0;
    const d = 'M' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2);
    out += '<path class="seg trk" d="' + d + '"/>';
    if (i < done) out += '<path class="seg on" pathLength="100" style="--d:' + (i * 90) + 'ms" d="' + d + '"/>';
    else if (i === done && partial > 0) out += '<path class="seg on" pathLength="100" stroke-dasharray="' + (partial * 100).toFixed(1) + ' 100" style="--d:' + (i * 90) + 'ms" d="' + d + '"/>';
    if (b.mission) {
      const [mx, my] = pt(a + span / 2);
      out += '<g transform="translate(' + (mx - 13).toFixed(1) + ' ' + (my - 13).toFixed(1) + ')"><circle cx="13" cy="13" r="13" fill="var(--surface)"/><circle cx="13" cy="13" r="11.5" fill="none" stroke="' + (i < done ? 'var(--act)' : 'var(--surface-3)') + '" stroke-width="1.5"/>' +
        '<svg x="6" y="6" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--fg)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + IC.flag + '</svg></g>';
    }
    a += span;
  });
  return '<svg class="ring' + (opts.draw ? ' draw' : '') + '" id="ring" viewBox="0 0 200 200" role="button" tabindex="0" aria-label="' + esc(L('Blöcke von heute zeigen', 'Show today’s blocks')) + '">' + out + '</svg>';
}

function progBar(blocks, cur, frac, opts) {
  opts = opts || {};
  return '<div class="bar" role="progressbar" aria-label="' + esc(L('Fortschritt heute', 'Progress today')) + '">' + blocks.map((b, i) => {
    const pulse = opts.pulse === i ? ' pulse' : '';
    if (i < cur) return '<i class="d' + pulse + '" style="flex:' + b.m + '"></i>';
    if (i === cur) return '<i class="' + pulse.trim() + '" style="flex:' + b.m + '"><b style="width:' + Math.round(frac * 100) + '%"></b></i>';
    return '<i style="flex:' + b.m + '"></i>';
  }).join('') + '</div>';
}

function exTop(blocks, cur, frac, opts) {
  opts = opts || {};
  return '<div class="ex-top gx">' +
    '<button class="iconbtn" id="ex-close" data-go="h1-' + (opts.closeTo || 'mid') + '" aria-label="' + esc(L('Schließen', 'Close')) + '">' + ic('close') + '</button>' +
    progBar(blocks, cur, frac, opts) +
    '<button class="iconbtn" id="ex-more" data-act="menu" aria-label="' + esc(L('Mehr Möglichkeiten', 'More options')) + '">' + ic('more') + '</button></div>';
}

function blockLine(dot, text, flash) {
  return '<div class="blockline' + (flash ? ' flash' : '') + '"><span class="dot ' + dot + '"></span><span>' + text + '</span></div>';
}
function instr(text, whyId) {
  return '<div class="instr"><p>' + text + '</p>' + (whyId === false ? '' : '<button class="why" id="' + (whyId || 'why') + '" data-act="whysheet">' + esc(L('Wozu?', 'Why?')) + '</button>') + '</div>';
}

function verdictRow(st) {
  const words = { ok: L('Richtig', 'Correct'), typo: L('Fast', 'Almost'), wrong: L('Noch nicht', 'Not yet'), idk: L('Lösung gezeigt', 'Answer shown') };
  return '<div class="verdict"><span class="vi">' + ic(STATE_IC[st], 'xs') + '</span>' + words[st] + '</div>';
}
const stCls = st => ({ ok: 's-ok', typo: 's-near', wrong: 's-bad', idk: 's-idk' }[st]);

function cmpLine(st, you, right) {
  if (st === 'ok') return '<div class="cmp en"><span class="you">' + L('Du:', 'You:') + '</span> <b>' + you + '</b></div>';
  if (st === 'idk') return '<div class="cmp en"><span class="you">' + L('Richtig:', 'Correct:') + '</span> <b>' + right + '</b></div>';
  return '<div class="cmp en"><span class="you">' + L('Du:', 'You:') + '</span> <s>' + you + '</s> <span class="you">→ ' + L('Richtig:', 'Correct:') + '</span> <b>' + right + '</b></div>';
}

function band(st, d, opts) {
  opts = opts || {};
  return '<div class="band gx ' + stCls(st) + '" id="band" role="status">' +
    verdictRow(st) + cmpLine(st, d.you[st], d.right) +
    '<p class="whyl">' + d.why[st] + '</p>' +
    '<div class="bandbtns"><button class="btn sec sm" id="band-more" data-act="more">' + esc(L('Mehr', 'More')) + '</button>' +
    (st === 'wrong' || st === 'typo' ? '<button class="btn sec sm" id="band-also" data-act="also">' + esc(L('War das auch richtig?', 'Was mine also right?')) + '</button>' : '') + '</div>' +
    '<button class="btn pri full" id="band-next" data-go="' + (opts.next || '') + '">' + (opts.nextLabel || esc(L('Weiter', 'Continue'))) + '</button></div>';
}

function tabbar(active) {
  const t4 = S.tab4 === 'praxis' ? L('Praxis', 'Practice') : L('Sprechen', 'Speaking');
  const tabs = [['h1', 'today', L('Heute', 'Today')], ['h12', 'words', L('Wörter', 'Words')], ['h6', 'gram', L('Grammatik', 'Grammar')], ['h13', S.tab4 === 'praxis' ? 'praxis' : 'speak', t4], ['h14', 'prog', L('Fortschritt', 'Progress')]];
  return '<nav class="tabbar" aria-label="' + esc(L('Hauptbereiche', 'Main sections')) + '">' + tabs.map(t =>
    '<button class="tab' + (t[0] === active ? ' on' : '') + '" id="tab-' + t[0] + '" data-go="' + t[0] + '"' + (t[0] === active ? ' aria-current="page"' : '') + '>' + ic(t[1]) + '<span>' + t[2] + '</span></button>').join('') + '</nav>';
}
function phead(title, right) {
  return '<header class="phead gx"><h1 class="disp">' + title + '</h1>' + (right || '') + '</header>';
}
const askBtn = () => '<button class="iconbtn" id="ask-open" data-go="h15-claude" aria-label="' + esc(L('Fragen', 'Ask')) + '">' + ic('ask') + '</button>';
/* Zahnrad: am Handy H24, am Laptop L15 (je nach Art des offenen Bildschirms). */
const gearBtn = () => '<button class="iconbtn" id="settings-open" data-go="' + (curDef() && curDef().kind === 'desk' ? 'l15-overview' : 'h24-overview') + '" aria-label="' + esc(L('Einstellungen', 'Preferences')) + '">' + ic('gear') + '</button>';

function sheet(id, title, body, foot, opts) {
  opts = opts || {};
  return '<div class="scrim" data-act="' + (opts.closeAct || 'closesheet') + '"></div><div class="sheet" id="' + id + '" role="dialog" aria-label="' + esc(title) + '"' + (opts.h ? ' style="height:' + opts.h + '"' : '') + '>' +
    '<div class="grab"></div><div class="gx"><h2 class="disp">' + title + '</h2></div><div class="sb gx">' + body + '</div>' + (foot ? '<div class="sf gx">' + foot + '</div>' : '') + '</div>';
}

function drawnKbd(opts) {
  opts = opts || {};
  const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const key = c => '<span class="kk">' + c + '</span>';
  return '<div class="kbd" aria-hidden="true">' +
    (opts.sug === false ? '' : '<div class="sug"><span></span><span></span><span></span></div>') +
    '<div class="kr">' + rows[0].split('').map(key).join('') + '</div>' +
    '<div class="kr" style="padding:0 18px">' + rows[1].split('').map(key).join('') + '</div>' +
    '<div class="kr"><span class="kk f">' + ic('shift', 'sm') + '</span>' + rows[2].split('').map(key).join('') + '<span class="kk f">' + ic('back', 'sm') + '</span></div>' +
    '<div class="kr"><span class="kk f">123</span><span class="kk sp">' + (opts.space || 'space') + '</span><span class="kk go">' + (opts.go || 'go') + '</span></div>' +
    '<div class="kb-bot"><span class="globe' + (opts.globe ? ' hl' : '') + '">' + ic('globe') + '</span><span class="mic' + (opts.mic ? ' hl' : '') + '">' + ic('mic') + '</span></div>' +
    '</div>';
}

function gapHtml(text, opts) {
  opts = opts || {};
  const letters = (text || '').split('').map((c, i) => '<span class="lt" style="animation-delay:' + (opts.stagger ? i * 40 : 0) + 'ms">' + (c === ' ' ? '&nbsp;' : esc(c)) + '</span>').join('');
  return '<span class="gap ' + (opts.big ? 'big ' : '') + (opts.st ? 'st-' + opts.st : '') + '" id="' + (opts.id || 'gap') + '"><span class="lts">' + letters + '</span>' + (opts.caret ? '<span class="caret"></span>' : '') +
    (opts.input ? '<input id="' + (opts.id || 'gap') + '-in" aria-label="' + esc(L('Antwort', 'Answer')) + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" value="' + esc(text || '') + '">' : '') + '</span>';
}
function pageDots(n, cur) { let s = '<div class="pagedots" aria-hidden="true">'; for (let i = 0; i < n; i++) s += '<i class="' + (i === cur ? 'on' : '') + '"></i>'; return s + '</div>'; }

/* ---------- Bildschirm-Verzeichnis ---------- */
const SCREENS = {};
const ORDER = [];
function reg(id, def) { SCREENS[id] = def; ORDER.push(id); }

/* ---------- Rendern ---------- */
let autoTimer = null;
function applyRootAttrs() {
  const r = document.documentElement, lx = $('#lx');
  [r, lx].forEach(el => {
    if (!el) return;
    el.setAttribute('data-mode', S.mode);
    el.setAttribute('data-accent', S.accent);
    el.setAttribute('data-motion', S.motion);
  });
  r.setAttribute('lang', S.lang);
}

function parseHash() {
  const h = (location.hash || '').replace(/^#/, '');
  if (!h) return { screen: 'h1', v: '' };
  const i = h.indexOf('-');
  const sid = i < 0 ? h : h.slice(0, i), v = i < 0 ? '' : h.slice(i + 1);
  if (!SCREENS[sid]) return { screen: 'h1', v: '' };
  return { screen: sid, v: SCREENS[sid].variants.some(x => x[0] === v) ? v : '' };
}
function go(target) {
  if (!target) return;
  if (('#' + target) === location.hash) { render(); return; }
  location.hash = target;
}
function curDef() { return SCREENS[S.screen]; }
function curVariant() { const d = curDef(); return S.v || d.variants[0][0]; }

function isPhoneWidth() { return window.innerWidth < 600; }

function render() {
  clearTimeout(autoTimer);
  const p = parseHash();
  const changed = p.screen !== S.screen || p.v !== S.v;
  if (changed) { S.ui = {}; S.typed = null; S.from = S.screen; }
  const kindBefore = curDef() ? curDef().kind : null;
  S.screen = p.screen; S.v = p.v;
  const def = curDef();
  if (S.toolOpen === null || kindBefore !== def.kind) S.toolOpen = window.innerWidth >= 1100 && def.kind === 'phone';
  applyRootAttrs();
  const lx = $('#lx');
  const W = window.innerWidth, H = window.innerHeight;
  const v = curVariant();
  let html = '';
  const toolPad = S.toolOpen && W >= 1100 ? 300 : 0;
  lx.style.paddingLeft = toolPad ? toolPad + 'px' : '';
  if (def.kind === 'phone') {
    const inner = '<div class="scr" id="scr">' + def.render(v) + '</div>';
    if (isPhoneWidth()) html = '<div class="view"><div class="ph" id="ph">' + inner + '</div></div>';
    else {
      const sc = Math.min(1, (H - 40) / 844, (W - toolPad - 40) / 390);
      html = '<div class="view centered"><div class="ph framed" id="ph" style="transform:scale(' + sc.toFixed(4) + ')">' + inner + '</div></div>';
    }
  } else {
    html = DESK.frame(def, v, W - toolPad, H);
  }
  lx.innerHTML = html + toolHtml();
  if (def.after) def.after(v);
  postRender();
}
function rerenderScreen() { render(); }

function postRender() {
  const r = $('#ring');
  if (r) r.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act('ring'); } });
  if (S.measure) showMeasure();
}

/* ---------- Ereignisse ---------- */
const ACTS = {};
function act(name, el) {
  if (ACTS[name]) { ACTS[name](el); return; }
  const def = curDef();
  if (def && def.acts && def.acts[name]) def.acts[name](el);
}
ACTS.noop = () => {};
ACTS.closesheet = () => { S.ui.sheet = null; S.ui.menu = false; render(); };
ACTS.menu = () => { S.ui.menu = !S.ui.menu; render(); };
ACTS.ring = () => { S.ui.ring = !S.ui.ring; render(); };

document.addEventListener('click', e => {
  const t = e.target.closest('[data-go],[data-act],[data-set]');
  if (!t) return;
  if (t.hasAttribute('data-set')) { const [k, val] = t.getAttribute('data-set').split(':'); setPref(k, val); return; }
  if (t.hasAttribute('data-act')) { act(t.getAttribute('data-act'), t); return; }
  const g = t.getAttribute('data-go');
  if (g) go(g);
});
document.addEventListener('keydown', e => {
  const def = curDef();
  if (def && def.keys && !e.metaKey && !e.ctrlKey && !e.altKey) def.keys(e);
});

function setPref(k, val) {
  if (k === 'demo') { S.demo = val; S.typed = null; S.carry = null; S.ui.ownInput = false; }
  else if (k in S) S[k] = val;
  savePrefs();
  render();
}

/* ---------- Vorführleiste ---------- */
function toolHtml() {
  const def = curDef(), v = curVariant();
  const opt = (k, val, label) => '<button id="t-' + k + '-' + val + '" data-set="' + k + ':' + val + '" class="' + (S[k] === val ? 'on' : '') + '">' + label + '</button>';
  const groups = [['phone', 'Handy'], ['desk', 'Laptop']];
  const sel = '<select id="t-screen" aria-label="Bildschirm">' + groups.map(g => '<optgroup label="' + g[1] + '">' + ORDER.filter(id => SCREENS[id].kind === g[0]).map(id => '<option value="' + id + '"' + (id === S.screen ? ' selected' : '') + '>' + SCREENS[id].code + ' · ' + SCREENS[id].name + '</option>').join('') + '</optgroup>').join('') + '</select>';
  const vars = def.variants.length > 1 ? '<div><div class="tl">ZUSTAND</div><div class="opts">' + def.variants.map(x => '<button id="t-v-' + x[0] + '" data-go="' + S.screen + '-' + x[0] + '" class="' + (x[0] === v ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div></div>' : '';
  const open = !!S.toolOpen;
  return '<aside class="tool' + (open ? '' : ' closed') + '" id="tool" aria-label="Vorführleiste"' + (open ? '' : ' aria-hidden="true"') + '>' +
    '<header><b>Vorführleiste</b><span class="tg">VORSCHAU</span><button id="t-close" data-act="tooltoggle" aria-label="Vorführleiste schließen">' + ic('chevL', 'sm') + '</button></header>' +
    '<div class="tb">' +
    '<div><div class="tl">BILDSCHIRM</div>' + sel + '<div class="nav2"><button id="t-prev" data-act="prev">← Zurück</button><button id="t-next" data-act="next">Vor →</button></div></div>' +
    vars +
    (def.demo ? '<div><div class="tl">ANTWORT (für Band und Rückmeldung)</div><div class="opts">' + opt('demo', 'ok', 'richtig') + opt('demo', 'typo', 'Tippfehler') + opt('demo', 'wrong', 'falsch') + opt('demo', 'idk', 'weiß nicht') + '</div></div>' : '') +
    '<div><div class="tl">MODUS</div><div class="opts">' + opt('mode', 'dark', 'Dunkel') + opt('mode', 'muted', 'Gedämpft') + opt('mode', 'light', 'Hell') + '</div></div>' +
    '<div><div class="tl">HANDLUNGSFARBE</div><div class="opts">' + opt('accent', 'iris', 'A · Iris') + opt('accent', 'amber', 'B · Bernstein') + '</div></div>' +
    '<div><div class="tl">REITER 4</div><div class="opts">' + opt('tab4', 'praxis', '„Praxis“') + opt('tab4', 'sprechen', '„Sprechen“') + '</div></div>' +
    '<div><div class="tl">BEWEGUNG · SPRACHE</div><div class="opts">' + opt('motion', 'on', 'Bewegung an') + opt('motion', 'off', 'aus') + opt('lang', 'de', 'DE') + opt('lang', 'en', 'EN') + '</div></div>' +
    '<div class="acts"><button id="t-replay" data-act="replay">Start nachspielen</button><button id="t-measure" data-act="measure">Höhe messen</button></div>' +
    '<p class="note">Klickbare Vorschau ohne Lernkern. Alle Namen, Firmen und Zahlen sind erfunden. Lerninhalte bleiben auf Englisch, DE/EN schaltet die Oberfläche.</p>' +
    '</div></aside>' +
    (open ? '' : '<button class="toolhandle" id="t-open" data-act="tooltoggle" aria-label="Vorführleiste öffnen"><span>VORSCHAU</span></button>');
}
ACTS.tooltoggle = () => { S.toolOpen = !S.toolOpen; render(); };
ACTS.prev = () => { const i = ORDER.indexOf(S.screen); go(ORDER[(i - 1 + ORDER.length) % ORDER.length]); };
ACTS.next = () => { const i = ORDER.indexOf(S.screen); go(ORDER[(i + 1) % ORDER.length]); };
document.addEventListener('change', e => {
  if (e.target && e.target.id === 't-screen') go(e.target.value);
});
ACTS.replay = () => {
  if (isPhoneWidth()) S.toolOpen = false;
  go('h1-skeleton');
  setTimeout(() => { S.drawOnce = true; go('h1-start'); }, 1100);
};

/* Höhe messen */
ACTS.measure = () => { S.measure = true; if (isPhoneWidth()) S.toolOpen = false; render(); };
ACTS.measureclose = () => { S.measure = false; const m = $('#measure'); if (m) m.remove(); };
function showMeasure() {
  let m = $('#measure');
  if (!m) { m = document.createElement('div'); m.id = 'measure'; m.className = 'measure'; m.setAttribute('role', 'dialog'); document.body.appendChild(m); }
  const vv = window.visualViewport;
  m.innerHTML = '<div><div class="mv" id="m-inner">' + window.innerHeight + '</div><div class="ml">innerHeight (px)</div></div>' +
    '<div><div class="mv" id="m-vv">' + (vv ? Math.round(vv.height) : '–') + '</div><div class="ml">visualViewport.height (px)</div></div>' +
    '<div class="ml">Breite ' + window.innerWidth + ' px · Pixeldichte ' + (window.devicePixelRatio || 1) + '<br>Bitte beide großen Zahlen abschreiben oder als Bildschirmfoto schicken.</div>' +
    '<button id="m-close" data-act="measureclose">Schließen</button>';
}
function onResize() {
  if (S.measure) showMeasure();
  const vv = window.visualViewport;
  if (vv) {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kbh', kb + 'px');
    document.documentElement.classList.toggle('realkb', kb > 120);
  }
}
let rT = null;
window.addEventListener('resize', () => { onResize(); clearTimeout(rT); rT = setTimeout(() => { if (!document.activeElement || document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') render(); }, 120); });
if (window.visualViewport) { window.visualViewport.addEventListener('resize', onResize); window.visualViewport.addEventListener('scroll', onResize); }
window.addEventListener('hashchange', render);
if (reduceQuery && reduceQuery.addEventListener) reduceQuery.addEventListener('change', () => { S.motion = reduceQuery.matches ? 'off' : 'on'; render(); });

/* ---------- Lücken-Tippen (Buchstaben-Animation) ---------- */
function editDist(a, b) {
  const m = a.length, n = b.length, d = [];
  for (let i = 0; i <= m; i++) { d[i] = [i]; }
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function judge(typed, right, alts) {
  const t = (typed || '').trim().toLowerCase();
  if (!t) return 'idk';
  if (t === right || (alts || []).indexOf(t) >= 0) return 'ok';
  if (editDist(t, right) <= (right.length > 5 ? 2 : 1)) return 'typo';
  return 'wrong';
}
function wireGap(id, onEnter) {
  const inp = document.getElementById(id + '-in');
  const gap = document.getElementById(id);
  if (!inp || !gap) return;
  const lts = gap.querySelector('.lts');
  let prev = inp.value;
  inp.addEventListener('input', () => {
    clearTimeout(autoTimer);
    const val = inp.value;
    S.typed = val;
    if (val.startsWith(prev) && val.length === prev.length + 1) {
      const s = document.createElement('span'); s.className = 'lt'; s.innerHTML = val.slice(-1) === ' ' ? '&nbsp;' : esc(val.slice(-1)); lts.appendChild(s);
    } else {
      lts.innerHTML = val.split('').map(c => '<span class="lt" style="animation:none">' + (c === ' ' ? '&nbsp;' : esc(c)) + '</span>').join('');
    }
    prev = val;
  });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); onEnter(); } });
  gap.addEventListener('click', () => { clearTimeout(autoTimer); inp.focus(); });
}
function autoType(id, text, after) {
  const gap = document.getElementById(id), inp = document.getElementById(id + '-in');
  if (!gap) return;
  const lts = gap.querySelector('.lts');
  let i = 0;
  const step = () => {
    if (i >= text.length) { if (after) after(); return; }
    const c = text[i++];
    const s = document.createElement('span'); s.className = 'lt'; s.innerHTML = c === ' ' ? '&nbsp;' : esc(c); lts.appendChild(s);
    if (inp) inp.value = text.slice(0, i);
    S.typed = text.slice(0, i);
    autoTimer = setTimeout(step, S.motion === 'off' ? 0 : 110);
  };
  autoTimer = setTimeout(step, S.motion === 'off' ? 0 : 450);
}

function boot() {
  loadPrefs();
  if (!document.getElementById('lx')) { const d = document.createElement('div'); d.id = 'lx'; document.body.appendChild(d); }
  onResize();
  S.drawOnce = true;
  render();
}
