/* Lingo Vorschau · Paket B „Rund um den Tag“: H24–H32 (Handy).
   Eigene Hilfen mit Präfix tm. Desk-Hilfen (ctxBlock, dKeys …) nur innerhalb von Render-Funktionen benutzen. */

/* ---------- Gemeinsamer Zustand, bleibt über Bildschirmwechsel ---------- */
const TMS = {
  sw: { sounds: true, haptics: true, effects: true, anki: false },
  voice: 'us1', speed: 'normal', round: '10', auto: false,
  mem: [0, 1, 2, 3], undo: null
};

/* ---------- Kleine Bausteine ---------- */
function tmHead(backGo, right, id) {
  return '<header class="phead gx"><button class="iconbtn" id="' + (id || 'tm-back') + '" data-go="' + backGo + '" aria-label="' + esc(L('Zurück', 'Back')) + '" style="margin-left:-10px;margin-right:0">' + ic('chevL') + '</button>' + (right || '') + '</header>';
}
function tmSub(backGo, tab, inner, right) {
  return tmHead(backGo, right) + '<div class="scroll gx" style="padding-bottom:28px"><div class="stack s24 springopen">' + inner + '</div></div>' + tabbar(tab);
}
function tmTitle(t, sub, en) {
  return '<div class="stack s6"><h1 class="tm-title disp' + (en ? ' en' : '') + '">' + t + '</h1>' + (sub ? '<p class="tm-sub">' + sub + '</p>' : '') + '</div>';
}
/* o: {id, k, sub, v, fix, sw, nav, attr, tall} */
function tmRow(o) {
  const tag = o.attr ? 'button' : 'div';
  let right = '';
  if (o.sw != null) right = '<span class="tm-sw' + (o.sw ? ' on' : '') + '" aria-hidden="true"></span>';
  else if (o.fix) right = '<span class="tm-fix">' + o.fix + '</span>';
  else if (o.v != null) right = '<span class="tm-v">' + o.v + '</span>';
  return '<' + tag + ' class="tm-row' + (o.tall ? ' tm-tall' : '') + '" id="' + o.id + '"' + (o.attr || '') + (o.sw != null ? ' role="switch" aria-checked="' + (o.sw ? 'true' : 'false') + '"' : '') + '>' +
    '<span class="tm-k"><span>' + o.k + '</span>' + (o.sub ? '<small>' + o.sub + '</small>' : '') + '</span>' + right +
    (o.nav ? '<span class="chev">' + ic('chevR', 'sm') + '</span>' : '') + '</' + tag + '>';
}
function tmGroup(title, rows, id) {
  return '<section class="tm-group"' + (id ? ' id="' + id + '"' : '') + '><div class="lbl">' + title + '</div><div class="tm-list">' + rows.join('') + '</div></section>';
}
/* Ziel einer Zeile: am Handy ein Bildschirm, am Laptop eine Gruppe in L15 */
function tmTo(desk, phoneGo, grp) { return desk ? ' data-act="tmgrp" data-g="' + grp + '"' : ' data-go="' + phoneGo + '"'; }
function tmSeg(id, opts, cur, act) {
  return '<div class="tm-seg" role="group" id="' + id + '">' + opts.map(o => '<button id="' + id + '-' + o[0] + '" data-act="' + act + '" data-v="' + o[0] + '" class="' + (cur === o[0] ? 'on' : '') + '"' + (cur === o[0] ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>' + o[1] + (o[2] ? '<small>' + o[2] + '</small>' : '') + '</button>').join('') + '</div>';
}
function tmTop(closeGo, frac, label) {
  return '<div class="ex-top gx"><button class="iconbtn" id="ex-close" data-go="' + closeGo + '" aria-label="' + esc(L('Schließen', 'Close')) + '">' + ic('close') + '</button>' +
    '<div class="bar" role="progressbar" aria-label="' + esc(label || L('Fortschritt der Runde', 'Round progress')) + '"><i style="flex:1"><b style="width:' + Math.round(frac * 100) + '%"></b></i></div>' +
    '<button class="iconbtn" id="ex-more" data-act="menu" aria-label="' + esc(L('Mehr Möglichkeiten', 'More options')) + '">' + ic('more') + '</button></div>';
}
function tmVerdict(color, icon, text) {
  return '<div class="verdict" style="color:' + color + '"><span class="vi" style="background:color-mix(in oklch, ' + color + ' 20%, transparent)">' + ic(icon, 'xs') + '</span>' + text + '</div>';
}
function tmCk(on) { return '<span class="ck' + (on ? ' y' : '') + '">' + (on ? ic('check', 'xs') : '') + '</span>'; }
function tmBA(rows) {
  return '<div class="tm-ba">' + rows.map((r, i) => '<span>' + r[0] + '</span><span class="tm-track"><b class="' + (i === rows.length - 1 ? 'now' : '') + '" style="width:' + r[1] + '%"></b></span><span class="tm-n num">' + r[2] + '</span>').join('') + '</div>';
}
function tmLights(rows) {
  return '<div>' + rows.map(r => '<div class="tm-light"><i class="' + r[0] + '" aria-hidden="true"></i><span>' + r[1] + (r[2] ? '<small>' + r[2] + '</small>' : '') + '</span><span class="tm-lv num">' + r[3] + '</span></div>').join('') + '</div>';
}
const tmWhyAct = () => { S.ui.menu = false; S.ui.sheet = 'why'; render(); };
function tmCopy(sel) {
  const t = $(sel);
  try { navigator.clipboard.writeText(t ? t.innerText : '').catch(() => {}); } catch (e) { /* Zwischenablage nicht verfügbar: Text bleibt markierbar */ }
  S.ui.copied = true; render();
}

/* =========================================================
   H24 Einstellungen
   ========================================================= */
function tmGrpLearn(p, desk) {
  return tmGroup(L('Lernen', 'Learning'), [
    tmRow({ id: p + 's-new', tall: true, k: L('Neue Wörter am Tag', 'New words per day'), fix: L('fest', 'fixed'), sub: L('Meist 3–4, höchstens 5. Pflicht und Trainer zählen zusammen, in der Woche höchstens 20 (mit Nachholen 25). So bleibt jedes neue Wort stark genug.', 'Usually 3–4, at most 5. Daily plan and trainer count together, at most 20 a week (25 with catch-up). That keeps every new word strong enough.') }),
    tmRow({ id: p + 's-brake', tall: true, k: L('Bremse', 'Brake'), fix: L('automatisch', 'automatic'), sub: L('Sinkt der Abruf am Folgetag unter 70 %, kommen nur noch 2 neue am Tag, bis es wieder sitzt.', 'If next-day recall drops below 70 %, only 2 new words a day come until things hold again.') }),
    tmRow({ id: p + 's-len', tall: true, k: L('Tagesdauer', 'Daily length'), fix: L('fest', 'fixed'), sub: L('Etwa 28 Minuten in 6 Blöcken. Ein fester Rahmen ist leichter durchzuhalten als ein Regler.', 'About 28 minutes in 6 blocks. A fixed frame is easier to keep up than a slider.') }),
    tmRow({ id: p + 's-time', k: L('Lernzeit und Erinnerung', 'Study time and reminder'), v: L('7:30 · Claude-Tagesauftrag', '7:30 · Claude daily task'), attr: ' data-act="noop"' }),
    tmRow({ id: p + 's-rest', k: L('Ruhetag', 'Rest day'), v: L('Sonntag', 'Sunday'), attr: ' data-act="noop"' }),
    tmRow({ id: p + 's-away', k: L('Urlaub', 'Vacation'), sub: L('Vorher ankündigen, dann pausiert die Serie ohne Bruch.', 'Announce it ahead, then your streak pauses without breaking.'), v: L('ankündigen', 'announce'), attr: ' data-act="noop"' }),
    tmRow({ id: p + 's-goal', k: L('Ziel', 'Goal'), v: L('C1 im Beruf', 'C1 at work'), attr: ' data-act="noop"' })
  ], p + 'g-learn');
}
function tmGrpWords(p) {
  const rounds = [['10', '10', L('Standard', 'default')], ['20', '20'], ['30', '30'], ['all', L('bis leer', 'until empty'), L('max. 60', 'max 60')]];
  return tmGroup(L('Wörter', 'Words'), [
    tmRow({ id: p + 's-art', tall: true, k: L('Abfrageart', 'Practice type'), v: 'Normal', sub: L('Anki, Nur Hören, Nur Sprechen und Tempo wählst du beim Start einer Runde.', 'Anki, listening only, speaking only and speed you pick when you start a round.') }),
    tmRow({ id: p + 's-dir', tall: true, k: L('Richtung', 'Direction'), v: L('Deutsch → Englisch', 'German → English'), sub: L('Nur diese Richtung hebt deine Stufen. Englisch → Deutsch zählt für „erkennst du“.', 'Only this direction raises your stages. English → German counts for “you recognize”.') }),
    '<div class="tm-row tm-tall" id="' + p + 's-round" style="flex-direction:column;align-items:stretch;gap:10px"><span class="tm-k"><span>' + L('Wörter je Runde im Trainer', 'Words per trainer round') + '</span><small>' + L('„Bis leer“ endet spätestens nach 60 Wörtern.', '“Until empty” stops after 60 words at most.') + '</small></span>' + tmSeg(p + 'round', rounds, TMS.round, 'tmround') + '</div>',
    tmRow({ id: p + 's-anki', tall: true, k: L('Anki-Modus', 'Anki mode'), sw: TMS.sw.anki, attr: ' data-act="tmsw" data-k="anki"', sub: L('Aufdecken und selbst einschätzen. Hebt nie eine Stufe.', 'Reveal and rate yourself. Never raises a stage.') })
  ], p + 'g-words');
}
function tmGrpVoice(p, desk) {
  return tmGroup(L('Stimme und Ton', 'Voice and sound'), [
    tmRow({ id: p + 's-voice', k: L('Stimme', 'Voice'), v: tmVoiceName(), nav: true, attr: tmTo(desk, 'h24-voice', 'voice') }),
    tmRow({ id: p + 's-speed', k: L('Sprechtempo', 'Speaking speed'), v: tmSpeedName(), nav: true, attr: tmTo(desk, 'h24-voice', 'voice') }),
    tmRow({ id: p + 's-sounds', k: L('Klänge', 'Sounds'), sw: TMS.sw.sounds, attr: ' data-act="tmsw" data-k="sounds"' }),
    tmRow({ id: p + 's-haptics', k: L('Haptik', 'Haptics'), sw: TMS.sw.haptics, attr: ' data-act="tmsw" data-k="haptics"' }),
    tmRow({ id: p + 's-effects', k: L('Effekte', 'Effects'), sw: TMS.sw.effects, attr: ' data-act="tmsw" data-k="effects"' })
  ], p + 'g-voice');
}
function tmGrpContext(p, desk) {
  return tmGroup(L('Mein Kontext', 'My context'), [
    tmRow({ id: p + 's-job', k: L('Mein Beruf', 'My job'), v: L('Vertrieb, Industriegüter', 'Sales, industrial goods'), nav: true, attr: tmTo(desk, 'h24-context', 'context') }),
    tmRow({ id: p + 's-free', k: L('Mein Arbeitskontext', 'My work context'), v: L('3 Sätze', '3 sentences'), nav: true, attr: tmTo(desk, 'h24-context', 'context') }),
    tmRow({ id: p + 's-mem', k: L('Claude merkt sich', 'Claude remembers'), v: TMS.mem.length + ' ' + L('Einträge', 'items'), nav: true, attr: tmTo(desk, 'h24-context', 'context') })
  ], p + 'g-context');
}
function tmGrpLook(p) {
  const modeCur = TMS.auto ? 'auto' : S.mode;
  return tmGroup(L('Aussehen', 'Appearance'), [
    '<div class="tm-row tm-tall" id="' + p + 's-lang" style="flex-direction:column;align-items:stretch;gap:10px"><span class="tm-k"><span>' + L('Sprache der App', 'App language') + '</span></span>' + tmSeg(p + 'lang', [['de', 'Deutsch'], ['en', 'English']], S.lang, 'tmlang') + '</div>',
    '<div class="tm-row tm-tall" id="' + p + 's-mode" style="flex-direction:column;align-items:stretch;gap:10px"><span class="tm-k"><span>' + L('Darstellung', 'Display') + '</span></span>' + tmSeg(p + 'mode', [['light', L('Hell', 'Light')], ['muted', L('Gedämpft', 'Muted')], ['dark', L('Dunkel', 'Dark')], ['auto', L('Auto', 'Auto')]], modeCur, 'tmmode') + '</div>',
    tmRow({ id: p + 's-color', k: L('Farbe', 'Color'), v: 'Iris' }),
    tmRow({ id: p + 's-font', k: L('Schriftgröße', 'Text size'), v: L('wie am iPhone eingestellt', 'follows your iPhone') })
  ], p + 'g-look');
}
function tmGrpData(p, desk) {
  return tmGroup(L('Daten', 'Data'), [
    tmRow({ id: p + 's-backup', k: L('Sicherung herunterladen', 'Download backup'), nav: true, attr: tmTo(desk, 'h24-data', 'data') }),
    tmRow({ id: p + 's-anki-exp', k: L('Anki-Export', 'Anki export'), nav: true, attr: tmTo(desk, 'h24-data', 'data') }),
    tmRow({ id: p + 's-src', k: L('Quellen und Lizenzen', 'Sources and licenses'), nav: true, attr: tmTo(desk, 'h24-data', 'data') }),
    tmRow({ id: p + 's-diag', k: L('Diagnose', 'Diagnostics'), v: L('Knopf nach 1,8 s', 'button after 1.8 s'), nav: true, attr: tmTo(desk, 'h24-diagnosis', 'diag') }),
    tmRow({ id: p + 's-new-app', k: L('Was ist neu nach dem Umstieg', 'What’s new after the switch'), nav: true, attr: ' data-go="h25-welcome"' })
  ], p + 'g-data');
}
const TM_VOICES = () => [
  ['us1', 'Samantha', L('US-Englisch · Standard', 'US English · default')],
  ['us2', 'Alex', L('US-Englisch', 'US English')],
  ['uk', 'Daniel', L('Britisches Englisch', 'British English')],
  ['au', 'Karen', L('Australisches Englisch', 'Australian English')]
];
function tmVoiceName() { const v = TM_VOICES().find(x => x[0] === TMS.voice); return v[1] + ' · ' + ({ us1: 'US', us2: 'US', uk: 'UK', au: 'AU' }[v[0]]); }
function tmSpeedName() { return { slow: L('langsam 0,85×', 'slow 0.85×'), normal: L('normal 1,0×', 'normal 1.0×'), fast: L('schnell 1,1×', 'fast 1.1×') }[TMS.speed]; }
function tmVoiceBody(p) {
  const playing = S.ui.play !== false;
  return '<div class="card stack s16" style="box-shadow:var(--shadow)"><div class="lbl">' + L('Probe', 'Sample') + ' · ' + tmVoiceName() + '</div>' +
    '<p class="p en" style="font-size:19px;line-height:27px;font-weight:550">We sent the revised quote on Monday.</p>' +
    '<div style="display:flex;align-items:center;gap:14px"><button class="iconbtn" id="' + p + 'v-play" data-act="tmplay" aria-label="' + esc(playing ? L('Pause', 'Pause') : L('Probe abspielen', 'Play sample')) + '" style="margin:0;background:var(--surface-2);border-radius:50%;color:var(--fg)">' + ic(playing ? 'pause' : 'play', 'sm') + '</button>' +
    '<div style="flex:1;min-width:0;overflow:hidden">' + waveBars(30, playing ? 13 : 0) + '</div></div></div>' +
    '<section class="tm-group"><div class="lbl">' + L('Stimme', 'Voice') + '</div><div class="tm-list">' +
    TM_VOICES().map(v => '<button class="tm-row" id="' + p + 'voice-' + v[0] + '" data-act="tmvoice" data-v="' + v[0] + '" role="radio" aria-checked="' + (TMS.voice === v[0] ? 'true' : 'false') + '"><span class="tm-radio' + (TMS.voice === v[0] ? ' on' : '') + '"></span><span class="tm-k"><span>' + v[1] + '</span><small>' + v[2] + '</small></span></button>').join('') + '</div>' +
    '<p class="p2" style="font-size:13px;line-height:18px;padding:2px 2px 0">' + L('Nur Stimmen, die auf deinem Gerät sauber klingen. Klingt eine abgehackt, nimm die nächste.', 'Only voices that sound clean on your device. If one sounds choppy, pick the next.') + '</p></section>' +
    '<section class="tm-group"><div class="lbl">' + L('Sprechtempo', 'Speaking speed') + '</div>' + tmSeg(p + 'speed', [['slow', '0,85×', L('langsam', 'slow')], ['normal', '1,0×', L('normal', 'normal')], ['fast', '1,1×', L('schnell', 'fast')]].map(x => S.lang === 'en' ? [x[0], x[1].replace(',', '.'), x[2]] : x), TMS.speed, 'tmspeed') + '</section>' +
    tmGroup(L('Ton', 'Sound'), [
      tmRow({ id: p + 'v-sounds', k: L('Klänge', 'Sounds'), sub: L('leiser Ton bei richtig und am Ende des Tages', 'a soft tone when correct and at the end of the day'), sw: TMS.sw.sounds, attr: ' data-act="tmsw" data-k="sounds"', tall: true }),
      tmRow({ id: p + 'v-haptics', k: L('Haptik', 'Haptics'), sub: L('kurzes Tippen beim Prüfen', 'a short tap when you check'), sw: TMS.sw.haptics, attr: ' data-act="tmsw" data-k="haptics"', tall: true }),
      tmRow({ id: p + 'v-effects', k: L('Effekte', 'Effects'), sub: L('Ring, Häkchen und Abschlussmomente. Ohne Konfetti.', 'Ring, checkmarks and end-of-day moments. No confetti.'), sw: TMS.sw.effects, attr: ' data-act="tmsw" data-k="effects"', tall: true }),
      tmRow({ id: p + 'v-moment', k: L('Moment ansehen', 'Preview a moment'), nav: true, attr: ' data-go="h10-day"' })
    ]);
}
const TM_MEM = () => [
  [L('Dienstag Call mit dem Einkauf, Preis-Einwand erwartet', 'Tuesday call with purchasing, price objection expected'), L('aus „Mein nächster Termin“ · gilt bis Dienstag', 'from “My next meeting” · until Tuesday')],
  [L('Verwechselt oft past simple und present perfect', 'Often mixes up past simple and present perfect'), L('aus deinen Fehlern', 'from your errors')],
  [L('Mag kurze Erklärungen mit einem Beispiel aus dem Vertrieb', 'Likes short explanations with a sales example'), L('aus dem Gespräch am 21.10.', 'from the chat on Oct 21')],
  [L('Schreibt Mails lieber kurz und direkt', 'Prefers short, direct emails'), L('aus der Wochen-Mail', 'from the weekly email')]
];
function tmContextBody(p) {
  const mem = TM_MEM();
  return tmGroup(L('Mein Beruf', 'My job'), [
    tmRow({ id: p + 'c-branch', k: L('Branche', 'Industry'), v: L('Industriegüter', 'Industrial goods') }),
    tmRow({ id: p + 'c-role', k: L('Rolle', 'Role'), v: L('Key Account Manager', 'Key account manager') }),
    tmRow({ id: p + 'c-clients', k: L('Gegenüber', 'Counterparts'), v: L('Einkauf und Technik, europaweit', 'Purchasing and engineering, across Europe') }),
    '<div class="tm-row tm-tall" id="' + p + 'c-sit" style="flex-direction:column;align-items:stretch;gap:10px"><span class="tm-k"><span>' + L('Situationen', 'Situations') + '</span></span><div style="display:flex;flex-wrap:wrap;gap:6px">' +
    [L('Angebote nachfassen', 'Following up on quotes'), L('Preisgespräche', 'Price talks'), L('Projektstatus', 'Project status'), L('Lieferzeiten', 'Lead times'), L('Messen', 'Trade fairs')].map(t => '<span class="chip">' + t + '</span>').join('') + '</div></div>'
  ], p + 'c-job') +
    '<section class="tm-group"><div class="lbl">' + L('Mein Arbeitskontext', 'My work context') + '</div>' +
    '<textarea class="field" id="' + p + 'c-text" rows="4" style="min-height:112px">' + esc(L('Ich verkaufe an Einkaufsabteilungen in ganz Europa. Viele Kunden sprechen selbst kein Englisch als Muttersprache. Am meisten brauche ich Telefon und kurze Mails.', 'I sell to purchasing departments across Europe. Many clients aren’t native English speakers themselves. I mostly need the phone and short emails.')) + '</textarea>' +
    '<p class="p2" style="font-size:13px;line-height:18px;display:flex;gap:8px;align-items:flex-start;padding:2px 2px 0">' + ic('lock', 'xs') + L('Bitte ohne Namen. Claude schneidet damit Sätze und Rollenspiele auf deinen Job zu.', 'Please no names. Claude uses this to fit sentences and role-plays to your job.') + '</p></section>' +
    '<section class="tm-group"><div style="display:flex;align-items:center;justify-content:space-between"><div class="lbl">' + L('Claude merkt sich', 'Claude remembers') + '</div>' +
    (TMS.mem.length ? '<button class="link" id="' + p + 'mem-all" data-act="tmmemall" style="font-size:14px;min-height:32px">' + L('Alles löschen', 'Delete all') + '</button>' : '') + '</div>' +
    (TMS.undo ? '<div class="notice fadein" id="' + p + 'mem-undo-n" style="align-items:center;padding:8px 8px 8px 16px">' + ic('check', 'sm') + '<span style="flex:1">' + L('Gelöscht', 'Deleted') + '</span><button class="btn ghost" id="' + p + 'mem-undo" data-act="tmundo" style="min-height:36px">' + L('Rückgängig', 'Undo') + '</button></div>' : '') +
    '<div class="tm-list">' + (TMS.mem.length ? TMS.mem.map(i => '<div class="tm-row tm-tall" id="' + p + 'mem-' + i + '"><span class="tm-k"><span>' + mem[i][0] + '</span><small>' + mem[i][1] + '</small></span><button class="iconbtn" id="' + p + 'mem-del-' + i + '" data-act="tmmemdel" data-i="' + i + '" aria-label="' + esc(L('Löschen', 'Delete')) + '" style="margin:-8px -10px 0 0">' + ic('close', 'sm') + '</button></div>').join('')
      : '<div class="tm-row" id="' + p + 'mem-empty"><span class="tm-k"><span style="color:var(--fg-2)">' + L('Claude merkt sich gerade nichts.', 'Claude isn’t remembering anything right now.') + '</span></span></div>') + '</div>' +
    '<p class="p2" style="font-size:13px;line-height:18px;padding:2px 2px 0">' + L('Claude merkt sich nur, was hier steht. Löschen wirkt sofort.', 'Claude only remembers what is listed here. Deleting takes effect right away.') + '</p></section>';
}
function tmDataBody(p, desk) {
  const dl = S.ui.dl;
  return '<div class="card stack s8"><div class="h2 disp" style="font-size:18px">' + L('Sicherung herunterladen', 'Download backup') + '</div>' +
    '<p class="p2">' + L('Alles in einer Datei: Wörter mit Sätzen und Stufen, Fehler, Verlauf, Serie und Einstellungen. Zuletzt am 20.10.', 'Everything in one file: words with sentences and stages, errors, history, streak and settings. Last done Oct 20.') + '</p>' +
    (dl ? '<div class="notice fadein" id="' + p + 'dl-ok">' + ic('check', 'sm') + '<span class="num">lingo-sicherung-2026-10-29.json · 1,4 MB</span></div>'
      : '<button class="btn sec" id="' + p + 'dl" data-act="tmdl" style="align-self:flex-start">' + L('Herunterladen', 'Download') + '</button>') + '</div>' +
    '<div class="card stack s8"><div class="h2 disp" style="font-size:18px">' + L('Anki-Export', 'Anki export') + '</div>' +
    '<p class="p2">' + L('491 Wörter als Textdatei für Anki, mit Ursprungssatz. Stufen und Termine bleiben in Lingo.', '491 words as a text file for Anki, with source sentence. Stages and schedules stay in Lingo.') + '</p>' +
    '<button class="btn sec" id="' + p + 'anki" data-act="noop" style="align-self:flex-start">' + L('Exportieren', 'Export') + '</button></div>' +
    tmGroup(L('Mehr', 'More'), [
      tmRow({ id: p + 'd-src', tall: true, k: L('Quellen und Lizenzen', 'Sources and licenses'), sub: L('Schrift Inter (SIL Open Font License). Wörterbuch und Lautschrift mit ihren Quellen, sobald Stufe 1 live ist.', 'Inter typeface (SIL Open Font License). Dictionary and phonetics with their sources once stage 1 is live.') }),
      tmRow({ id: p + 'd-diag', k: L('Diagnose', 'Diagnostics'), v: L('Knopf nach 1,8 s', 'button after 1.8 s'), nav: true, attr: tmTo(desk, 'h24-diagnosis', 'diag') })
    ]);
}
function tmDiagBody(p) {
  const kv = [
    [L('Version', 'Version'), '2.0 · 29.10.2026'],
    [L('Start', 'Start'), '<span style="color:var(--ok)">' + L('Knopf nach 1,8 s', 'button after 1.8 s') + '</span>'],
    [L('Gerüst sichtbar', 'Skeleton visible'), L('nach 0,6 s', 'after 0.6 s')],
    [L('Dokumente', 'Documents'), L('1.284 von 5.000', '1,284 of 5,000')],
    [L('Prognose Dokumente', 'Document forecast'), L('etwa 1.900 bis C1', 'about 1,900 until C1')],
    [L('Beispielsätze', 'Example sentences'), L('2.140 · davon 1.860 geprüft', '2,140 · 1,860 reviewed')],
    [L('Datenbank', 'Database'), L('verbunden', 'connected')],
    ['Claude', L('bereit · zuletzt 09:12', 'ready · last 9:12')]
  ];
  const log = [
    ['09:14', L('Vorlesen: Stimme Samantha nicht geladen, Alex genommen', 'Read-aloud: voice Samantha not loaded, used Alex')],
    ['09:15', L('Claude: zu viele Anfragen (rate_limited). Rückmeldung später geholt, nicht wiederholt.', 'Claude: too many requests (rate_limited). Feedback fetched later, not retried.')]
  ];
  return '<div class="notice">' + ic('info', 'sm') + '<span>' + L('Wenn etwas hakt: ein Foto von dieser Seite in claude.ai schicken.', 'If something goes wrong: send a photo of this page in claude.ai.') + '</span></div>' +
    '<div class="card" style="padding:4px 16px"><div class="tm-kv" id="' + p + 'diag-kv">' + kv.map(r => '<span class="tm-kl">' + r[0] + '</span><span class="tm-kr num">' + r[1] + '</span>').join('') + '</div></div>' +
    '<p class="p2" style="font-size:13px;line-height:18px;margin-top:-12px;padding:0 2px">' + L('Ziel beim Start: Gerüst unter 1 s, Knopf unter 2 s.', 'Start target: skeleton under 1 s, button under 2 s.') + '</p>' +
    '<section class="tm-group"><div class="lbl">' + L('Fehlerprotokoll · heute 2', 'Error log · 2 today') + '</div><div class="card tm-log">' + log.map(l => '<div><span class="num">' + l[0] + '</span>' + l[1] + '</div>').join('') + '</div></section>' +
    '<button class="btn sec" id="' + p + 'diag-copy" data-act="tmcopydiag" style="align-self:flex-start">' + (S.ui.copied ? ic('check', 'sm') + L('Kopiert', 'Copied') : L('Bericht kopieren', 'Copy report')) + '</button>';
}
const TM_SET_ACTS = {
  tmsw(el) { const k = el.getAttribute('data-k'); TMS.sw[k] = !TMS.sw[k]; render(); },
  tmround(el) { TMS.round = el.getAttribute('data-v'); render(); },
  tmspeed(el) { TMS.speed = el.getAttribute('data-v'); render(); },
  tmvoice(el) { TMS.voice = el.getAttribute('data-v'); S.ui.play = true; render(); },
  tmplay() { S.ui.play = S.ui.play === false; render(); },
  tmlang(el) { setPref('lang', el.getAttribute('data-v')); },
  tmmode(el) {
    const m = el.getAttribute('data-v');
    TMS.auto = m === 'auto';
    let mode = m;
    if (m === 'auto') { mode = 'dark'; try { if (window.matchMedia('(prefers-color-scheme: light)').matches) mode = 'light'; } catch (e) { /* ohne Medienabfrage bleibt Dunkel */ } }
    setPref('mode', mode);
  },
  tmmemdel(el) { const i = +el.getAttribute('data-i'); TMS.undo = TMS.mem.slice(); TMS.mem = TMS.mem.filter(x => x !== i); render(); },
  tmmemall() { TMS.undo = TMS.mem.slice(); TMS.mem = []; render(); },
  tmundo() { if (TMS.undo) TMS.mem = TMS.undo; TMS.undo = null; render(); },
  tmdl() { S.ui.dl = true; render(); },
  tmcopydiag() { tmCopy('.tm-kv'); }
};
reg('h24', {
  code: 'H24', name: 'Einstellungen', kind: 'phone',
  variants: [['overview', 'Übersicht'], ['voice', 'Stimme gewählt mit Probe'], ['context', 'Mein Kontext'], ['data', 'Daten'], ['diagnosis', 'Diagnose aufgeklappt']],
  render(v) {
    if (v !== 'context') TMS.undo = null;
    if (v === 'voice') return tmSub('h24-overview', 'h14', tmTitle(L('Stimme und Ton', 'Voice and sound')) + tmVoiceBody(''));
    if (v === 'context') return tmSub('h24-overview', 'h14', tmTitle(L('Mein Kontext', 'My context'), L('Davon hängt ab, ob Sätze und Rollenspiele nach deinem Job klingen.', 'This decides whether sentences and role-plays sound like your job.')) + tmContextBody(''));
    if (v === 'data') return tmSub('h24-overview', 'h14', tmTitle(L('Daten', 'Data')) + tmDataBody(''));
    if (v === 'diagnosis') return tmSub('h24-data', 'h14', tmTitle(L('Diagnose', 'Diagnostics')) + tmDiagBody(''));
    return tmSub('h14-main', 'h14', tmTitle(L('Einstellungen', 'Preferences')) +
      tmGrpLearn('') + tmGrpWords('') + tmGrpVoice('') + tmGrpContext('') + tmGrpLook('') + tmGrpData(''));
  },
  acts: TM_SET_ACTS
});

/* =========================================================
   H25 Erster Start nach dem Umstieg
   ========================================================= */
const TM_LOGO = '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:52px;height:52px"><rect x="2" y="2" width="20" height="20" rx="6" fill="var(--act)"/><path d="M8 7v10h8" fill="none" stroke="var(--act-fg)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function tmIntro(i, inner, btns) {
  return '<div class="ex-body gx" style="gap:24px;padding-top:44px"><div class="stack s24 springopen">' + inner + '</div></div><div class="gx" style="flex:none">' + pageDots(3, i) + '</div>' + exFoot(btns);
}
function tmWordBar() {
  const a = (38 / 491 * 100).toFixed(1), b = (41 / 491 * 100).toFixed(1);
  return '<div style="height:10px;border-radius:5px;box-shadow:0 0 0 1px var(--line-2) inset;position:relative;overflow:hidden" aria-hidden="true"><i style="position:absolute;top:0;bottom:0;left:0;width:' + a + '%;background:var(--fg)"></i><i style="position:absolute;top:0;bottom:0;left:' + a + '%;width:' + b + '%;background:var(--fg);opacity:.4"></i></div>';
}
function h25(v) {
  if (v === 'honest') {
    const leg = [['var(--fg)', 1, L('bildest du selbst', 'you produce'), 38], ['var(--fg)', 0.4, L('auf dem Weg', 'on the way'), 41], ['transparent', 1, L('erkennst du', 'you recognize'), 412]];
    return tmIntro(1,
      '<div class="stack s8"><div class="lbl">' + L('Deine Wörter', 'Your words') + '</div><h1 class="tm-title disp">' + L('Dein ehrlicher Startpunkt', 'Your honest starting point') + '</h1></div>' +
      '<div class="card stack s16" style="box-shadow:var(--shadow)"><div style="display:flex;align-items:baseline;gap:10px"><b class="disp num" style="font-size:44px;line-height:48px;font-weight:650">491</b><span class="p2">' + L('Wörter, alle noch da', 'words, all still here') + '</span></div>' + tmWordBar() +
      '<div class="stack s6">' + leg.map(l => '<div style="display:flex;align-items:center;gap:10px;font-size:15px"><i style="width:12px;height:12px;border-radius:3px;background:' + l[0] + ';opacity:' + l[1] + ';box-shadow:0 0 0 1px var(--line-2) inset"></i><span style="color:var(--fg-2)">' + l[2] + '</span><b class="num" style="margin-left:auto;font-weight:650">' + l[3] + '</b></div>').join('') + '</div></div>' +
      '<p class="p" style="font-size:18px;line-height:26px;font-weight:550">' + L('Wir zählen jetzt nur noch, was du selbst bilden kannst. Das ist dein ehrlicher Startpunkt.', 'We now only count what you can produce yourself. That is your honest starting point.') + '</p>' +
      '<p class="p2">' + L('Nichts ist gelöscht: Sätze, Verlauf und Stufen sind übernommen, deine Serie läuft weiter. Wörter, die du nur erkennst, kommen nach und nach zum Selbst-Bilden dran.', 'Nothing is deleted: sentences, history and stages carried over, and your streak continues. Words you only recognize come up for producing step by step.') + '</p>' +
      '<div class="notice">' + ic('bulb', 'sm') + '<span>' + L('Frei abrufen fühlt sich schwerer an als Auswählen. Genau das macht es wirksam.', 'Recalling freely feels harder than choosing. That is exactly what makes it work.') + '</span></div>',
      btnPri('tm-honest-next', L('Weiter', 'Continue'), 'h25-placement-start'));
  }
  if (v === 'placement-start') {
    const s1 = [L('Grammatik · 30 Aufgaben, passen sich an', 'Grammar · 30 tasks, adaptive'), L('Wörter erkennen · 40', 'Recognize words · 40'), L('Wörter selbst bilden · 18, mit Anfangsbuchstabe', 'Produce words · 18, with first letter')];
    const s2 = [L('eine kurze Mail', 'one short email'), L('Sprechen · 3 Fragen und 1 Minute frei', 'Speaking · 3 questions and 1 free minute'), L('Hören · 2 Texte und 6 Sätze', 'Listening · 2 texts and 6 sentences')];
    const sess = (t, items, run) => '<div class="card stack s8"><div style="display:flex;align-items:center;gap:8px"><b style="font-size:16px">' + t[0] + '</b><span class="chip" style="margin-left:auto;min-height:24px">' + t[1] + '</span></div>' +
      items.map(x => '<div class="st ' + (run ? 'run' : 'open') + '" style="min-height:38px;font-size:15px;border:0"><span class="mk" style="width:16px;height:16px"></span><span class="nm">' + x + '</span></div>').join('') + '</div>';
    return tmIntro(2,
      '<div class="stack s8"><div class="lbl">' + L('Woche 0 · Einstufung', 'Week 0 · placement') + '</div><h1 class="tm-title disp">' + L('Erst messen, dann planen', 'Measure first, then plan') + '</h1>' +
      '<p class="tm-sub">' + L('Zwei Sitzungen von etwa 25 Minuten an zwei Tagen. Sie zählen als Pflicht. Es gibt kein Bestehen, nur deinen Ausgangspunkt.', 'Two sessions of about 25 minutes on two days. They count as your daily plan. There is no pass or fail, only your starting point.') + '</p></div>' +
      sess([L('Sitzung 1', 'Session 1'), L('heute · 25 Min.', 'today · 25 min')], s1, true) + sess([L('Sitzung 2', 'Session 2'), L('morgen · 25 Min.', 'tomorrow · 25 min')], s2, false) +
      '<p class="p2">' + L('Danach weißt du, wo du stehst und welche Themen du nur noch bestätigen musst.', 'Afterwards you know where you stand and which topics you only need to confirm.') + '</p>',
      btnSec('tm-pl-later', L('Später', 'Later'), 'data-go="h1-mid"') + btnPri('tm-pl-go', L('Sitzung 1 starten', 'Start session 1'), 'h25-placement-mid'));
  }
  if (v === 'placement-mid') {
    const opts = ['had changed', 'has changed', 'changed', 'was changing'];
    const whyTask = L('Die Einstufung sucht die Grenze deines Könnens. Deshalb passen sich die Aufgaben an: Sie werden schwerer, wenn du richtig liegst, und leichter, wenn nicht. Rückmeldung gibt es am Ende, mit Begründung.', 'The placement looks for the edge of what you can do. That’s why the tasks adapt: harder when you’re right, easier when you’re not. Feedback comes at the end, with reasons.');
    const top = exTop([{ c: 'g', m: 12 }, { c: 'w', m: 8 }, { c: 'w', m: 5 }], 0, 14 / 30).replace('data-go="h1-mid"', 'data-go="h25-placement-start"');
    return top + '<div class="ex-body gx">' + blockLine('g', L('Einstufung · Sitzung 1 · Grammatik 14 von 30', 'Placement · session 1 · grammar 14 of 30')) +
      instr(L('Welche Form passt in die Lücke?', 'Which form fits the gap?'), 'tm-why') +
      '<div class="stagec" style="gap:18px"><div class="sent en">By the time we received the signed order, the price <span class="gap" style="min-width:96px"></span> twice.</div>' +
      '<div class="stack s8">' + opts.map((o, i) => '<button class="choice en' + (S.ui.pick === i ? ' sel' : '') + '" id="tm-pick-' + i + '" data-act="tmpick" data-i="' + i + '"><span class="n num">' + (i + 1) + '</span>' + o + '</button>').join('') + '</div>' +
      '<p class="hintline">' + L('Keine Rückmeldung je Aufgabe. Alles kommt am Ende, mit Begründung.', 'No feedback per task. Everything comes at the end, with reasons.') + '</p></div></div>' +
      exFoot(btnSec('tm-pl-idk', L('Weiß ich nicht', 'Don’t know'), 'data-go="h25-placement-result"') + btnPri('tm-pl-next', L('Weiter', 'Continue'), 'h25-placement-result')) +
      overlays({ whyTask });
  }
  if (v === 'placement-result') {
    const kv = [
      [L('Grammatik', 'Grammar'), L('B2 sicher', 'B2 solid')],
      [L('Wörter, die du selbst bildest', 'Words you produce'), '38'],
      [L('Hören', 'Listening'), L('64 % bei 1,0×', '64 % at 1.0×')],
      [L('Sprechen', 'Speaking'), L('68 Wörter/Min.', '68 wpm')],
      [L('Schreiben', 'Writing'), L('klar, Zeitformen noch unsicher', 'clear, tenses still shaky')]
    ];
    return '<div class="ex-body gx" style="gap:22px;padding-top:40px"><div class="stack s24 springopen">' +
      '<div class="stack s8"><div class="lbl">' + L('Einstufung abgeschlossen', 'Placement complete') + '</div><h1 class="tm-title disp">' + L('Hier fängst du an', 'This is where you start') + '</h1></div>' +
      '<div class="stack s8"><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px" aria-hidden="true"><i style="height:8px;border-radius:4px;background:var(--fg)"></i><i style="height:8px;border-radius:4px;background:var(--surface-3)"></i><i style="height:8px;border-radius:4px;background:var(--surface-3)"></i></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;font-size:12px;color:var(--fg-2);font-weight:600"><span>' + L('B2 sicher', 'B2 solid') + '</span><span style="text-align:center">' + L('C1-Grenze', 'C1 edge') + '</span><span style="text-align:right">C1</span></div></div>' +
      '<div class="card" style="padding:4px 16px"><div class="tm-kv">' + kv.map(r => '<span class="tm-kl">' + r[0] + '</span><span class="tm-kr">' + r[1] + '</span>').join('') + '</div></div>' +
      '<div class="card stack s8"><div class="lbl">' + L('Vorschlag', 'Suggestion') + '</div><p class="p">' + L('Beginnen mit Kapitel 1: <span class="en">past simple vs. present perfect</span>, da lagst du bei 40 %.', 'Start with chapter 1: past simple vs. present perfect, where you scored 40 %.') + '</p>' +
      '<p class="p2">' + L('Wahrscheinlich nur bestätigen: Zeitpräpositionen und Fragen bilden. Dafür genügt jeweils ein kurzer Test.', 'Probably just confirm: time prepositions and forming questions. A short test is enough for each.') + '</p></div>' +
      '<p class="p2" style="font-size:13px">' + L('Eine Schätzung, kein Zeugnis. Der erste Meilenstein in Woche 4 zeigt den Trend.', 'An estimate, not a certificate. The first milestone in week 4 shows the trend.') + '</p></div></div>' +
      exFoot(btnPri('tm-pl-start', L('Zum ersten Tag', 'Go to day one'), 'h1-mid'));
  }
  return tmIntro(0,
    '<div>' + TM_LOGO + '</div><div class="stack s8"><h1 class="tm-title disp">' + L('Lingo ist neu gebaut', 'Lingo has been rebuilt') + '</h1><p class="tm-sub">' + L('Deine Daten sind übernommen. Drei Dinge sind anders:', 'Your data has carried over. Three things are different:') + '</p></div>' +
    '<div>' + [['today', L('Ein Ring, ein Knopf', 'One ring, one button'), L('Beim Öffnen siehst du sofort, was heute dran ist.', 'When you open the app, you see right away what today holds.')],
      ['words', L('Wörter zählen, wenn du sie selbst bildest', 'Words count when you produce them'), L('Erkennen allein heißt noch nicht gelernt.', 'Recognizing alone doesn’t mean learned yet.')],
      ['gram', L('Grammatik als Weg in 8 Kapiteln', 'Grammar as a path of 8 chapters'), L('Jedes Thema mit Erklärung, Übung und Test.', 'Every topic with explanation, practice and a test.')]].map((r, i) =>
      '<div class="row" id="tm-new-' + i + '" style="cursor:default"><span class="ri">' + ic(r[0], 'sm') + '</span><span class="rt"><b>' + r[1] + '</b><span>' + r[2] + '</span></span></div>').join('') + '</div>',
    btnPri('tm-welcome-next', L('Weiter', 'Continue'), 'h25-honest'));
}
reg('h25', {
  code: 'H25', name: 'Erster Start nach dem Umstieg', kind: 'phone',
  variants: [['welcome', 'Willkommen'], ['honest', 'ehrlicher Neustart'], ['placement-start', 'Einstufung Start'], ['placement-mid', 'Einstufung mitten drin'], ['placement-result', 'Einstufung Ergebnis']],
  render: h25,
  acts: { whysheet: tmWhyAct, tmpick(el) { S.ui.pick = +el.getAttribute('data-i'); render(); } }
});

/* =========================================================
   H26 Deine Fehler
   ========================================================= */
const TM_ERRS = () => [
  { id: 'e1', t: 'pspp', w: 'We have won three new customers last month.', r: 'We won three new customers last month.', st: 'open', src: L('Grammatik · Schritt 1, 27.10.', 'Grammar · step 1, Oct 27'), nx: L('wieder dran: morgen', 'next: tomorrow') },
  { id: 'e2', t: 'pspp', w: 'I have sent you the revised quote on Monday.', r: 'I sent you the revised quote on Monday.', st: 'open', src: L('Sag es · 27.10.', 'Say it · Oct 27'), nx: L('wieder dran: Samstag', 'next: Saturday') },
  { id: 'e3', t: 'pspp', w: 'We have met last year.', r: 'We met last year.', st: 'rec', src: L('Hot Seat · 26.10.', 'Hot seat · Oct 26'), nx: L('3. Mal in 30 Tagen', '3rd time in 30 days') },
  { id: 'e4', t: 'pspp', w: 'Have you sent the quote yesterday?', r: 'Did you send the quote yesterday?', st: 'fixed', src: L('Grammatik · 20.10.', 'Grammar · Oct 20'), nx: L('frei richtig an 2 Tagen', 'right and free on 2 days') },
  { id: 'e5', t: 'prep', w: 'We are waiting since two weeks.', r: 'We’ve been waiting for two weeks.', st: 'open', src: L('Lehrerin · 28.10.', 'Teacher · Oct 28'), nx: L('kommt mit Thema 3', 'comes with topic 3') },
  { id: 'e6', t: 'col', w: 'We can make you a discount of 3 percent.', r: 'We can offer you a discount of 3 percent.', st: 'firm', src: L('Lehrerin · 23.9.', 'Teacher · Sep 23'), nx: L('seit 21 Tagen sicher', 'solid for 21 days') }
];
const TM_TOPICS = () => ({ pspp: ['past simple vs. present perfect', true], prep: [L('Zeitpräpositionen', 'Time prepositions'), false], col: [L('Wortpartner', 'Collocations'), false] });
const tmStName = st => ({ open: L('offen', 'open'), rec: L('kehrt wieder', 'recurring'), fixed: L('behoben', 'fixed'), firm: L('gefestigt', 'solid') }[st]);
function tmErrFilters(cur, p) {
  const all = TM_ERRS();
  const n = k => all.filter(e => k === 'all' || (k === 'done' ? (e.st === 'fixed' || e.st === 'firm') : e.st === k)).length;
  const f = [['all', L('Alle', 'All')], ['open', L('Offen', 'Open')], ['rec', L('Kehrt wieder', 'Recurring')], ['done', L('Behoben', 'Fixed')]];
  return '<div class="tm-chips">' + f.map(x => '<button class="chip" id="' + p + 'ef-' + x[0] + '" data-act="tmef" data-v="' + x[0] + '" style="flex:none;min-height:34px;' + (cur === x[0] ? 'background:var(--act-soft);color:var(--act-text)' : '') + '">' + x[1] + ' <span class="num" style="opacity:.7">' + (cur === 'none' && x[0] !== 'all' && x[0] !== 'done' ? 0 : n(x[0])) + '</span></button>').join('') + '</div>';
}
function tmErrList(p, desk, sel) {
  const ef = S.ui.ef || 'all';
  const tp = TM_TOPICS();
  const list = TM_ERRS().filter(e => ef === 'all' || (ef === 'done' ? (e.st === 'fixed' || e.st === 'firm') : e.st === ef));
  const groups = Object.keys(tp).map(k => [k, list.filter(e => e.t === k)]).filter(g => g[1].length);
  return groups.map(g => '<section class="stack s6"><div style="display:flex;align-items:center;gap:8px"><span class="dot g"></span><b class="' + (tp[g[0]][1] ? 'en' : '') + '" style="font-size:15px;font-weight:650">' + tp[g[0]][0] + '</b>' +
    (g[0] === 'pspp' ? '<span class="tm-state rec" style="margin-left:auto">' + L('kehrt wieder', 'recurring') + '</span>' : '') + '</div>' +
    '<div class="card" style="padding:0 16px">' + g[1].map(e => '<button class="tm-err' + (sel === e.id ? ' tm-sel' : '') + '" id="' + p + 'err-' + e.id + '" ' + (desk ? 'data-act="tmerr" data-e="' + e.id + '"' : 'data-go="h26-open"') + '>' +
      '<span class="tm-w en">' + esc(e.w) + '</span><span class="tm-r en">' + esc(e.r) + '</span>' +
      '<span class="tm-m"><span class="tm-state ' + e.st + '">' + tmStName(e.st) + '</span><span>' + e.src + ' · ' + e.nx + '</span></span></button>').join('') + '</div></section>').join('') +
    (groups.length ? '' : '<p class="p2" style="padding:24px 0;text-align:center">' + L('Hier ist gerade nichts.', 'Nothing here right now.') + '</p>');
}
function tmErrDetail(p, id) {
  const e = TM_ERRS().find(x => x.id === (id || 'e1'));
  const tp = TM_TOPICS()[e.t];
  const why = {
    e1: L('<em class="en">last month</em> ist ein vergangener Zeitpunkt. Dann steht past simple, auch wenn das Ergebnis heute noch zählt.', '<em>last month</em> is a finished time. That calls for past simple, even if the result still matters today.'),
    e2: L('<em class="en">on Monday</em> ist ein vergangener Zeitpunkt, also past simple.', '<em>on Monday</em> is a finished time, so past simple.'),
    e3: L('<em class="en">last year</em> ist vorbei, also past simple. Dieser Fehler kam in 30 Tagen zum dritten Mal, deshalb ist das Thema wieder „in Arbeit“.', '<em>last year</em> is over, so past simple. This error came up for the third time in 30 days, so the topic is back “in progress”.'),
    e4: L('Mit <em class="en">yesterday</em> fragst du mit <em class="en">did</em>.', 'With <em>yesterday</em>, ask with <em>did</em>.'),
    e5: L('Ein Zeitraum bis jetzt: <em class="en">for</em> plus Dauer (<em class="en">for two weeks</em>), <em class="en">since</em> nur mit Zeitpunkt (<em class="en">since Monday</em>). Dazu present perfect continuous, nicht present.', 'A period up to now: <em>for</em> plus a length of time (<em>for two weeks</em>), <em>since</em> only with a point in time (<em>since Monday</em>). Use present perfect continuous, not present.'),
    e6: L('Ein Rabatt wird angeboten oder gewährt: <em class="en">offer</em> oder <em class="en">give a discount</em>. „Rabatt machen“ heißt nicht <em class="en">make a discount</em>.', 'You offer or give a discount, not <em>make</em> one.')
  }[e.id];
  const done = e.st === 'fixed' || e.st === 'firm' ? 2 : 0;
  return '<div class="stack s16">' +
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="dot g"></span><span class="lbl ' + (tp[1] ? 'en' : '') + '">' + tp[0] + '</span><span class="tm-state ' + e.st + '" style="margin-left:auto">' + tmStName(e.st) + '</span></div>' +
    '<div class="card stack s8"><div class="contrast en" style="font-size:18px;line-height:26px"><span class="k" style="color:var(--bad)">' + ic('cross', 'xs') + '</span><span class="no">' + esc(e.w) + '</span><span class="k" style="color:var(--ok)">' + ic('check', 'xs') + '</span><span><b>' + esc(e.r) + '</b></span></div></div>' +
    '<div class="stack s6"><div class="lbl">' + L('Warum', 'Why') + '</div><p class="p">' + why + '</p></div>' +
    '<div class="card" style="padding:4px 16px"><div class="tm-kv"><span class="tm-kl">' + L('Herkunft', 'Source') + '</span><span class="tm-kr">' + e.src + '</span>' +
    '<span class="tm-kl">' + L('Stand', 'Status') + '</span><span class="tm-kr">' + done + ' ' + L('von 2 freien Einsätzen', 'of 2 free uses') + '</span>' +
    '<span class="tm-kl">' + L('Nächster Termin', 'Next time') + '</span><span class="tm-kr">' + (e.id === 'e1' ? L('morgen, frei ohne Vorlage', 'tomorrow, free without a template') : e.nx) + '</span></div></div>' +
    '<div class="tm-pips" aria-hidden="true"><i class="' + (done ? 'ok' : '') + '"></i><i class="' + (done ? 'ok' : '') + '"></i></div>' +
    '<p class="p2" style="font-size:13px;line-height:18px">' + L('Behoben heißt: an zwei Tagen frei richtig, einmal davon nach mindestens 7 Tagen. Nach 21 weiteren Tagen gilt er als gefestigt.', 'Fixed means: right and free on two days, one of them at least 7 days later. After another 21 days it counts as solid.') + '</p></div>';
}
reg('h26', {
  code: 'H26', name: 'Deine Fehler', kind: 'phone',
  variants: [['list', 'Liste'], ['open', 'Fehler geöffnet'], ['empty', 'nichts offen']],
  render(v) {
    if (v === 'open') {
      return tmHead('h26-list', askBtn()) + '<div class="scroll gx" style="padding-bottom:28px"><div class="stack s24 springopen">' + tmErrDetail('', 'e1') +
        '<div class="stack s8"><button class="btn pri full" id="tm-err-practice" data-go="h27-free-round">' + L('Jetzt üben (Extra)', 'Practice now (extra)') + '</button>' +
        '<button class="btn ghost" id="tm-err-ask" data-go="h15-claude">' + ic('claude', 'sm') + L('Claude fragen', 'Ask Claude') + '</button></div></div></div>' + tabbar('h6');
    }
    if (v === 'empty') {
      return tmSub('h6-chapter', 'h6', tmTitle(L('Deine Fehler', 'Your errors')) + tmErrFilters('none', '') +
        '<div class="stack s8" style="padding:40px 8px;text-align:center;align-items:center"><span style="width:56px;height:56px;border-radius:50%;display:grid;place-items:center;background:color-mix(in oklch, var(--ok) 18%, transparent);color:var(--ok)">' + ic('check') + '</span>' +
        '<div class="h2 disp">' + L('Gerade ist nichts offen', 'Nothing open right now') + '</div><p class="p2" style="max-width:300px">' + L('Behobene kommen nach 21 Tagen noch einmal, damit sie sitzen. Neue Fehler landen hier von selbst.', 'Fixed ones come back after 21 days so they stick. New errors land here by themselves.') + '</p>' +
        '<button class="link" id="tm-err-done" data-act="tmef" data-v="done" style="margin-top:4px">' + L('Behobene ansehen', 'See fixed ones') + '</button></div>', askBtn());
    }
    return tmSub('h6-chapter', 'h6', tmTitle(L('Deine Fehler', 'Your errors'), L('Aus Übungen, Sprechen, Schreiben, Missionen und von deiner Lehrerin. Behoben ist ein Fehler, wenn du es an zwei Tagen frei richtig machst.', 'From exercises, speaking, writing, missions and your teacher. An error is fixed once you get it right and free on two days.')) +
      tmErrFilters(S.ui.ef || 'all', '') + tmErrList('', false), askBtn());
  },
  acts: { tmef(el) { S.ui.ef = el.getAttribute('data-v'); if (curVariant() === 'empty') { go('h26-list'); setTimeout(() => { S.ui.ef = 'done'; render(); }, 0); return; } render(); } }
});

/* =========================================================
   H27 Grammatik-Thema frei üben
   ========================================================= */
const TM_FREE = {
  right: 'hasn’t signed off on', alts: ["hasn't signed off on", 'has not signed off on'],
  why: () => ({
    ok: L('<em class="en">yet</em> zeigt: bis jetzt noch offen. Kein Zeitpunkt, also present perfect.', '<em>yet</em> shows: still open up to now. No time named, so present perfect.'),
    typo: L('Fast. <em class="en">yet</em> verlangt present perfect: <em class="en">hasn’t signed off on</em>. Achte auf die Schreibweise.', 'Almost. <em>yet</em> calls for present perfect: <em>hasn’t signed off on</em>. Watch the spelling.'),
    wrong: L('Mit <em class="en">yet</em> geht es um „bis jetzt“. Past simple bräuchte einen vergangenen Zeitpunkt, und hier steht keiner.', 'With <em>yet</em> it’s about “up to now”. Past simple would need a finished time, and there isn’t one here.'),
    idk: L('<em class="en">yet</em> zeigt: bis jetzt noch offen. Kein Zeitpunkt, also present perfect.', '<em>yet</em> shows: still open up to now. No time named, so present perfect.')
  })
};
function tmTopicCore(p, desk) {
  return '<div class="card stack s8" style="box-shadow:var(--shadow)"><div class="lbl">' + L('Stand', 'Status') + '</div><div class="p" style="font-weight:600">' + L('in Arbeit · Schritt 3 von 7', 'in progress · step 3 of 7') + '</div>' +
    '<div class="p2">' + L('noch 4 richtige bis frei', '4 more correct until free') + '</div>' +
    '<div class="tm-pips" aria-hidden="true" style="margin-top:6px">' + [1, 1, 0.6, 0, 0, 0, 0].map(f => '<i' + (f === 1 ? ' class="on"' : f ? ' style="background:linear-gradient(90deg, var(--act) ' + f * 100 + '%, var(--surface-3) 0)"' : '') + '></i>').join('') + '</div></div>' +
    '<div class="stack s8"><div class="lbl">' + L('Die Regel in einem Satz', 'The rule in one sentence') + '</div><p class="p" style="font-size:18px;line-height:26px;font-weight:550">' + L('Vergangener Zeitpunkt → past simple. Bis jetzt, ohne Zeitpunkt → present perfect.', 'Finished time → past simple. Up to now, no time named → present perfect.') + '</p>' + gramPattern(false) + '</div>';
}
function tmTopicLinks(p, desk) {
  return '<div>' +
    '<button class="row" id="' + p + 'tp-explain" data-go="' + (desk ? 'l3-band' : 'h5-explain') + '"><span class="ri">' + ic('book', 'sm') + '</span><span class="rt"><b>' + L('Erklärung lesen', 'Read the explanation') + '</b><span>' + L('Abgeschlossen oder bis jetzt? · 2 Min.', 'Finished or up to now? · 2 min') + '</span></span><span class="chev">' + ic('chevR', 'sm') + '</span></button>' +
    '<button class="row" id="' + p + 'tp-lookup" ' + (desk ? 'data-act="tmlookup"' : 'data-go="h27-lookup"') + '><span class="ri">' + ic('search', 'sm') + '</span><span class="rt"><b>' + L('Nachschlagen', 'Look it up') + '</b><span>' + L('Muster, Signalwörter, Deutsch-Falle', 'Pattern, signal words, German trap') + '</span></span><span class="chev">' + ic('chevR', 'sm') + '</span></button>' +
    '<button class="row" id="' + p + 'tp-errors" data-go="' + (desk ? 'l16-errors' : 'h26-list') + '"><span class="ri">' + ic('flag', 'sm') + '</span><span class="rt"><b>' + L('Deine Fehler in diesem Thema', 'Your errors in this topic') + '</b><span>' + L('2 offen · 1 kehrt wieder · 1 behoben', '2 open · 1 recurring · 1 fixed') + '</span></span><span class="chev">' + ic('chevR', 'sm') + '</span></button></div>' +
    '<div class="stack s6"><div class="lbl">' + L('Frühere Themen wiederholen', 'Review earlier topics') + '</div><p class="p2">' + L('Noch keins. Sobald ein Thema bestanden ist, kannst du es hier jederzeit üben.', 'None yet. Once a topic is passed, you can practice it here any time.') + '</p></div>';
}
function tmLookupBody() {
  const sig = [['past simple', 'yesterday · last week · on Monday · two days ago · in 2025 · When …?'], ['present perfect', 'yet · already · so far · ever · since … · for … (up to now)']];
  return '<div class="stack s8"><div class="lbl">' + L('Muster', 'Pattern') + '</div>' + gramPattern(true) + '</div>' +
    '<div class="card stack s8"><div class="lbl">' + L('Deutsch-Falle', 'German trap') + '</div><div class="contrast en">' +
    '<span class="k">DE</span><span style="font-family:var(--font)">Ich habe den Vertrag gestern unterschrieben.</span>' +
    '<span class="k" style="color:var(--ok)">' + ic('check', 'xs') + '</span><span><b>I signed the contract yesterday.</b></span>' +
    '<span class="k" style="color:var(--bad)">' + ic('cross', 'xs') + '</span><span class="no">I have signed the contract yesterday.</span></div>' +
    '<p class="p2">' + L('Im Deutschen sagst du „habe … gemacht“, auch wenn es vorbei ist. Im Englischen entscheidet der Zeitpunkt.', 'In German you say “habe … gemacht” even when it’s over. In English, the time decides.') + '</p></div>' +
    '<div class="card stack s8"><div class="lbl">' + L('Signalwörter', 'Signal words') + '</div>' + sig.map(s => '<div class="stack s6" style="padding:6px 0"><b class="en" style="color:var(--act-text);font-size:15px">' + s[0] + '</b><span class="en p">' + s[1] + '</span></div>').join('') +
    '<p class="p2" style="font-size:13px">' + L('Signalwörter helfen, entscheiden muss die Frage: vorbei oder bis jetzt?', 'Signal words help, but the real question decides: over, or up to now?') + '</p></div>';
}
function h27(v) {
  if (v === 'free-round') {
    const st = S.ui.chk;
    const checked = !!st;
    const shown = checked ? (st === 'idk' ? TM_FREE.right : (S.typed || TM_FREE.right)) : (S.typed || '');
    const whyTask = L('Eine freie Runde zeigt dir, wo du gerade stehst. Sie zählt als Extra: Dein Tagesziel und dein Schritt im Weg bleiben, wie sie sind. Fehler daraus kommen in deine Fehlerliste.', 'A free round shows you where you stand right now. It counts as extra: your daily goal and your step on the path stay as they are. Errors from it go to your error list.');
    let s = tmTop('h27-topic', checked ? 0.4 : 0.35, L('Fortschritt der Extra-Runde', 'Extra round progress')) + '<div class="ex-body gx' + (checked ? ' with-band' : '') + '">' +
      blockLine('g', L('Extra · <em class="en">past simple vs. present perfect</em> · 4 von 10', 'Extra · <em>past simple vs. present perfect</em> · 4 of 10')) +
      instr(L('Setz das Verb in der passenden Zeitform ein.', 'Put the verb in the right tense.'), 'tm-why') +
      '<div class="stagec"><div class="sent en" id="tm-sent">' + words('Finance') + ' ' + gapHtml(shown, { caret: !checked, input: !checked, st: checked ? ({ ok: 'ok', typo: 'near', wrong: 'bad', idk: 'idk' }[st]) : '', id: 'tmgap' }) + ' <span class="w" style="color:var(--fg-3)">(not sign off on)</span> ' + words('the budget yet.') + '</div></div></div>';
    if (checked) {
      const you = esc(S.typed || TM_FREE.right);
      s += band(st, { you: { ok: you, typo: you, wrong: you, idk: '' }, right: TM_FREE.right, why: TM_FREE.why() }, { next: 'h27-result' });
    } else {
      s += exFoot(btnSec('tm-idk', L('Weiß ich nicht', 'Don’t know'), 'data-act="tmidk"') + btnPri('tm-check', L('Prüfen', 'Check'), '', ' data-act="tmcheck"'), true) + drawnKbd({ go: 'go' });
    }
    return s + overlays({ whyTask, checked });
  }
  if (v === 'result') {
    const miss = [['When have you sent it?', 'When did you send it?'], ['We have finished the pilot in June.', 'We finished the pilot in June.']];
    return '<div class="ex-body gx" style="justify-content:center;gap:24px;padding-top:40px"><div class="stack s24 springopen">' +
      '<div class="stack s8" style="text-align:center;align-items:center"><div class="lbl">' + L('Extra-Runde · <span class="en">past simple vs. present perfect</span>', 'Extra round · past simple vs. present perfect') + '</div>' +
      '<div class="disp num" style="font-size:34px;line-height:40px;font-weight:700">' + L('8 von 10 richtig', '8 of 10 correct') + '</div></div>' +
      '<div class="card stack s8"><div class="lbl">' + L('Zwei waren noch nicht richtig', 'Two weren’t right yet') + '</div>' + miss.map(m => '<div class="contrast en" style="padding:6px 0"><span class="k" style="color:var(--bad)">' + ic('cross', 'xs') + '</span><span class="no">' + m[0] + '</span><span class="k" style="color:var(--ok)">' + ic('check', 'xs') + '</span><span><b>' + m[1] + '</b></span></div>').join('') +
      '<p class="p2">' + L('Beide Male ging es um einen vergangenen Zeitpunkt: <em class="en">When …?</em> fragt danach, <em class="en">in June</em> nennt ihn. Sie kommen in deine Fehler und morgen in der Pflicht zuerst dran.', 'Both times it was about a finished time: <em>When …?</em> asks for it, <em>in June</em> names it. They go to your errors and come first in tomorrow’s daily plan.') + '</p></div>' +
      '<p class="p2" style="text-align:center;font-size:13px">' + L('Zählt als Extra. Dein Tagesziel und Schritt 3 von 7 bleiben, wie sie sind.', 'Counts as extra. Your daily goal and step 3 of 7 stay as they are.') + '</p></div></div>' +
      exFoot(btnSec('tm-again', L('Noch eine Runde', 'One more round'), 'data-go="h27-free-round"') + btnPri('tm-done', L('Fertig', 'Done'), 'h27-topic'));
  }
  if (v === 'lookup') return tmSub('h27-topic', 'h6', tmTitle(L('Nachschlagen', 'Look it up'), 'past simple vs. present perfect') + tmLookupBody(), askBtn());
  return tmSub('h6-chapter', 'h6', '<div class="stack s6"><div class="lbl">' + L('Kapitel 1 · Thema 1 von 4', 'Chapter 1 · topic 1 of 4') + '</div><h1 class="tm-title disp en" style="font-size:26px;line-height:32px">past simple vs. present perfect</h1></div>' +
    tmTopicCore('') +
    '<div class="stack s8"><button class="btn pri full" id="tm-tp-practice" data-go="h27-free-round">' + L('Üben (Extra)', 'Practice (extra)') + '</button><p class="p2" style="font-size:13px;text-align:center">' + L('10 Aufgaben, etwa 5 Minuten. Zählt nicht zum Tagesziel.', '10 tasks, about 5 minutes. Doesn’t count toward your daily goal.') + '</p></div>' +
    tmTopicLinks(''), askBtn());
}
function tmFreeAfter(v) {
  if (v !== 'free-round' || S.ui.chk) return;
  wireGap('tmgap', () => act('tmcheck'));
}
reg('h27', {
  code: 'H27', name: 'Grammatik-Thema frei üben', kind: 'phone',
  variants: [['topic', 'Thema geöffnet'], ['free-round', 'freie Runde'], ['result', 'Ergebnis Extra'], ['lookup', 'Nachschlagen']],
  render: h27,
  after: tmFreeAfter,
  acts: {
    whysheet: tmWhyAct,
    tmcheck() { S.ui.chk = judge(S.typed, TM_FREE.right, TM_FREE.alts); render(); },
    tmidk() { S.typed = null; S.ui.chk = 'idk'; render(); },
    more() { go('h27-lookup'); },
    also() { go('h15-claude'); }
  }
});

/* =========================================================
   H28 Lehrer (Preply)
   ========================================================= */
const TM_PASTE = 'Lesson Oct 28\n- I have sent it on Monday → I sent it on Monday\n- we are waiting since two weeks → we’ve been waiting for two weeks\n- on the end of the month → at the end of the month\n- new phrase: pencil in (Could we pencil in Monday at ten?)\n- good: clear structure in your status update!';
const TM_SUGG = () => [
  ['err', 'I have sent it on Monday.', 'I sent it on Monday.', 'past simple vs. present perfect', true],
  ['err', 'We are waiting since two weeks.', 'We’ve been waiting for two weeks.', L('Zeitpräpositionen · kommt mit Thema 3', 'Time prepositions · comes with topic 3'), false],
  ['err', 'on the end of the month', 'at the end of the month', L('Zeitpräpositionen', 'Time prepositions'), false],
  ['word', 'pencil in', L('vorläufig eintragen · „Could we pencil in Monday at ten?“', 'tentatively schedule · “Could we pencil in Monday at ten?”'), L('neues Wort · kommt dran, sobald Platz ist (höchstens 5 neue am Tag)', 'new word · starts once there is room (at most 5 new a day)'), false]
];
function tmTeacherSeg(cur) {
  return '<div class="tm-seg" role="tablist" id="tm-tseg">' + [['paste', L('Einfügen', 'Paste')], ['note', L('Zettel', 'Notes')], ['monthly', L('Monat', 'Monthly')]].map(x =>
    '<button role="tab" id="tm-tseg-' + x[0] + '" data-go="h28-' + x[0] + '" class="' + (cur === x[0] || (cur === 'confirm' && x[0] === 'paste') ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>';
}
const TM_NOTE = 'Week 44 · Following up on a quote\n\nPhrases: quote · lead time · follow up · discount · sign off on\nGrammar: past simple vs. present perfect\n\nMy most frequent errors:\n1. Present perfect with a finished time (“I have sent it on Monday”)\n2. “since” instead of “for” with a length of time (“since two weeks”)\n3. Present perfect in “When …?” questions (“When have you sent it?”)\n\nRole-play for you: You are the head of procurement. Our price is about 10 percent above a competitor’s. Push back on the price, ask about the lead time, and agree to a follow-up call only if I suggest a specific time.';
function h28(v) {
  const head = tmTitle(L('Lehrerin', 'Teacher'), L('Preply · jeden Mittwoch', 'Preply · every Wednesday')) + tmTeacherSeg(v);
  if (v === 'confirm') {
    const off = S.ui.off || {};
    const sug = TM_SUGG();
    const n = sug.filter((x, i) => !off[i]).length;
    return tmSub('h28-paste', 'h6', head +
      '<div class="stack s6"><div class="h2 disp" style="font-size:19px">' + L('4 Vorschläge aus deinem Text', '4 suggestions from your text') + '</div><p class="p2">' + L('Herkunft bei allen: Lehrerin, 28.10. Tippe an, was nicht passt.', 'Source for all: teacher, Oct 28. Tap what doesn’t fit.') + '</p></div>' +
      '<div class="card" style="padding:0 16px">' + sug.map((x, i) => '<button class="tm-err" id="tm-sug-' + i + '" data-act="tmsug" data-i="' + i + '" role="checkbox" aria-checked="' + (off[i] ? 'false' : 'true') + '" style="flex-direction:row;align-items:flex-start;gap:12px;' + (off[i] ? 'opacity:.5' : '') + '">' +
        '<span style="margin-top:2px">' + tmCk(!off[i]) + '</span><span class="stack s6" style="flex:1;min-width:0">' +
        (x[0] === 'err' ? '<span class="tm-w en">' + x[1] + '</span><span class="tm-r en">' + x[2] + '</span>' : '<span class="tm-r en">' + x[1] + '</span><span class="p2" style="font-size:14px">' + x[2] + '</span>') +
        '<span class="tm-m"><span class="tm-state">' + (x[0] === 'err' ? L('Fehlersatz', 'Error sentence') : L('Karte', 'Card')) + '</span><span class="' + (x[4] ? 'en' : '') + '">' + x[3] + '</span></span></span></button>').join('') + '</div>' +
      '<p class="p2" style="font-size:13px;line-height:18px">' + L('Nicht übernommen: „good: clear structure …“ ist Lob, kein Fehler.', 'Not taken over: “good: clear structure …” is praise, not an error.') + '</p>' +
      '<div style="display:flex;gap:8px">' + btnSec('tm-sug-cancel', L('Abbrechen', 'Cancel'), 'data-go="h28-paste" style="flex:1"') + '<button class="btn pri" id="tm-sug-ok" data-go="h26-list" style="flex:1.4"' + (n ? '' : ' disabled') + '>' + (n === 1 ? L('1 übernehmen', 'Add 1') : L(n + ' übernehmen', 'Add ' + n)) + '</button></div>', askBtn());
  }
  if (v === 'note') {
    return tmSub('h6-chapter', 'h6', head +
      '<div class="stack s6"><div class="h2 disp" style="font-size:19px">' + L('Zettel für die Stunde am 4.11.', 'Notes for the lesson on Nov 4') + '</div><p class="p2">' + L('Auf Englisch, damit deine Lehrerin ihn direkt nutzen kann.', 'In English, so your teacher can use it right away.') + '</p></div>' +
      '<div class="card en" id="tm-note" style="white-space:pre-line;font-size:15px;line-height:22px">' + esc(TM_NOTE) + '</div>' +
      '<button class="btn pri full" id="tm-note-copy" data-act="tmcopynote">' + (S.ui.copied ? ic('check', 'sm') + L('Kopiert', 'Copied') : L('Kopieren', 'Copy')) + '</button>', askBtn());
  }
  if (v === 'monthly') {
    const h = S.ui.hear || 'main';
    const can = [[1, L('Projektstand am Telefon berichten', 'Report project status on the phone')], [1, L('Preis-Einwand ruhig beantworten', 'Answer a price objection calmly')], [0, L('Verhandlung mit Bedingungen führen', 'Negotiate with conditions')]];
    return tmSub('h6-chapter', 'h6', head +
      '<div class="stack s6"><div class="h2 disp" style="font-size:19px">' + L('Monatsformular · November', 'Monthly form · November') + '</div><p class="p2">' + L('Füllt ihr in der Stunde am 11.11. zusammen aus. In Worten, ohne Prozente.', 'Fill it in together in the lesson on Nov 11. In words, no percentages.') + '</p></div>' +
      '<div class="notice">' + ic('pen', 'sm') + '<span>' + L('Letztes Mal, 14.10.: „Spricht flüssiger, Aussprache von <em class="en">th</em> noch unsicher.“', 'Last time, Oct 14: “More fluent, <em>th</em> still unsure.”') + '</span></div>' +
      '<section class="tm-group"><div class="lbl">' + L('Hören', 'Listening') + '</div>' + tmSeg('tm-hear', [['all', L('fast alles', 'almost all')], ['main', L('das Wichtigste', 'the main points')], ['rep', L('mit Wiederholung', 'with repeats')]], h, 'tmhear') + '</section>' +
      '<section class="tm-group"><div class="lbl">' + L('Aussprache, in Worten', 'Pronunciation, in words') + '</div><textarea class="field" id="tm-pron" rows="2" style="min-height:72px" placeholder="' + esc(L('z. B. was klarer geworden ist, was noch hakt', 'e.g. what got clearer, what still trips you up')) + '"></textarea></section>' +
      '<section class="tm-group"><div class="lbl">' + L('Flüssigkeit, in Worten', 'Fluency, in words') + '</div><textarea class="field" id="tm-flu" rows="2" style="min-height:72px" placeholder="' + esc(L('z. B. Pausen, Satzanfänge, Tempo', 'e.g. pauses, sentence starts, pace')) + '"></textarea></section>' +
      '<section class="tm-group"><div class="lbl">' + L('Kann-Beschreibungen, die sie bestätigt', 'Can-do statements she confirms') + '</div><div class="card" style="padding:4px 16px"><div class="checklist" style="padding:4px 0">' + can.map((c, i) => '<button class="ci" id="tm-can-' + i + '" data-act="tmcan" data-i="' + i + '" style="text-align:left;width:100%">' + tmCk((S.ui.can || {})[i] != null ? S.ui.can[i] : c[0]) + c[1] + '</button>').join('') + '</div></div></section>' +
      '<button class="btn pri full" id="tm-month-save" data-go="h28-paste">' + L('Speichern', 'Save') + '</button>', askBtn());
  }
  return tmSub('h6-chapter', 'h6', head +
    '<div class="stack s6"><div class="h2 disp" style="font-size:19px">' + L('Korrekturen aus der Stunde einfügen', 'Paste corrections from the lesson') + '</div><p class="p2">' + L('Beliebiger Text geht: Notizen, Chat, Stichpunkte. Claude macht Vorschläge, du bestätigst.', 'Any text works: notes, chat, bullet points. Claude makes suggestions, you confirm.') + '</p></div>' +
    '<textarea class="field en" id="tm-paste" rows="7" style="min-height:188px;font-size:15px;line-height:22px">' + esc(TM_PASTE) + '</textarea>' +
    '<p class="p2" style="font-size:13px;line-height:18px;display:flex;gap:8px;align-items:flex-start;margin-top:-12px">' + ic('lock', 'xs') + L('Ohne Namen. Der Text bleibt in deiner Datenbank.', 'No names. The text stays in your database.') + '</p>' +
    '<button class="btn pri full" id="tm-paste-go" data-go="h28-confirm">' + L('Vorschläge machen', 'Make suggestions') + '</button>', askBtn());
}
reg('h28', {
  code: 'H28', name: 'Lehrer (Preply)', kind: 'phone',
  variants: [['paste', 'Einfügen'], ['confirm', 'Vorschlag bestätigen'], ['note', 'Zettel der Woche'], ['monthly', 'Monatsformular']],
  render: h28,
  acts: {
    tmsug(el) { const i = +el.getAttribute('data-i'); S.ui.off = S.ui.off || {}; S.ui.off[i] = !S.ui.off[i]; render(); },
    tmcopynote() { tmCopy('#tm-note'); },
    tmhear(el) { S.ui.hear = el.getAttribute('data-v'); render(); },
    tmcan(el) { const i = +el.getAttribute('data-i'); S.ui.can = S.ui.can || {}; const base = [1, 1, 0][i]; const cur = S.ui.can[i] != null ? S.ui.can[i] : base; S.ui.can[i] = cur ? 0 : 1; render(); }
  }
});

/* =========================================================
   H29 Sprechen: alle Einträge
   ========================================================= */
const TM_SCENES = () => [
  [1, L('Small Talk auf der Messe', 'Small talk at a trade fair'), 1, 'done'],
  [2, L('Projektstatus intern', 'Internal project status'), 1, 'now'],
  [3, L('Bedarf erfragen', 'Finding out needs'), 2, ''],
  [4, L('Fachklärung IT und Datenschutz', 'IT and data protection questions'), 2, ''],
  [5, L('Präsentieren und Demo', 'Presenting and demo'), 3, ''],
  [6, L('Wert und Rendite', 'Value and ROI'), 3, ''],
  [7, L('Einwand Preis', 'Price objection'), 4, ''],
  [8, L('Verhandeln: Rabatt gegen Laufzeit', 'Negotiating: discount for contract length'), 4, '']
];
const TM_TIME = ['That’s a fair question. Let me think about that for a second.', 'Good point. Can I get back to you on that by Friday?', 'Just to make sure I understand: you mean the total price, not the unit price?'];
function h29(v) {
  if (v === 'objection') {
    const said = S.ui.said;
    const whyTask = L('Ein Einwand ist oft eine Frage nach mehr Information. Wer zuerst nachfragt, statt sich zu verteidigen, behält das Gespräch in der Hand. Die 5 Stufen: 1 Einwand erkennen · 2 nachfragen · 3 mit Nutzen antworten · 4 unter Zeit · 5 im ganzen Gespräch.', 'An objection is often a request for more information. If you ask first instead of defending, you stay in control. The 5 levels: 1 spot the objection · 2 ask back · 3 answer with value · 4 under time · 5 in a full conversation.');
    let s = tmTop('h29-list', said ? 0.5 : 0.42, L('Fortschritt der Runde', 'Round progress')) + '<div class="ex-body gx' + (said ? ' with-band' : '') + '">' +
      blockLine('s', L('Einwand-Training · Stufe 2 von 5 · 3 von 6', 'Objection training · level 2 of 5 · 3 of 6')) +
      instr(L('Antworte mit einer Rückfrage, bevor du etwas verteidigst.', 'Answer with a question before you defend anything.'), 'tm-why') +
      '<div class="stagec" style="gap:16px;justify-content:flex-start;padding-top:20px">' +
      '<div class="tm-pips" aria-label="' + esc(L('Stufe 2 von 5', 'Level 2 of 5')) + '" style="max-width:180px"><i class="on"></i><i class="on"></i><i></i><i></i><i></i></div>' +
      '<div class="persona"><span class="avatar">LK</span><div><b>Laura Keller</b><div class="p2" style="font-size:13px">' + L('Leiterin Einkauf · erfundene Persona', 'Head of Procurement · invented persona') + '</div></div></div>' +
      '<div class="bubble them en" style="font-size:18px;line-height:25px">Honestly, your lead time is just too long for us.</div>' +
      (said ? '' : '<div class="fieldwrap"><div class="field" style="min-height:72px;color:var(--fg-3)">' + L('Deine Rückfrage …', 'Your question …') + '</div></div>' +
        '<p class="hintline">' + L('Stufe 2 ohne Uhr. Ab Stufe 4 läuft die Zeit.', 'Level 2 has no timer. From level 4 the clock runs.') + '</p>') + '</div></div>';
    if (said) {
      const you = 'I understand. What lead time would work for you?';
      s += band('ok', { you: { ok: you }, right: you, why: { ok: L('Du fragst zuerst, was sie brauchen. So erfährst du, worum es wirklich geht, bevor du nachgibst.', 'You ask what they need first. That way you learn what it’s really about before you give anything away.') } }, { next: 'h29-list' });
    } else {
      s += exFoot(btnSec('tm-aloud', L('Laut gesagt', 'Said aloud'), 'data-act="tmsay"') + btnPri('tm-speak', L('Sprechen', 'Speak'), '', ' data-act="tmsay"'));
    }
    return s + overlays({ whyTask, checked: !!said });
  }
  if (v === 'scene') {
    const sel = S.ui.sc != null ? S.ui.sc : 6;
    const sc = TM_SCENES();
    return tmSub('h29-list', 'h13', tmTitle(L('Szene wählen', 'Choose a scene'), L('Die Szene der Woche steht in deiner Pflicht. Hier übst du jede andere frei, als Extra.', 'The scene of the week is in your daily plan. Here you practice any other one freely, as extra.')) +
      '<div class="stack s8">' + sc.map((c, i) => '<button class="choice" id="tm-sc-' + c[0] + '" data-act="tmscene" data-i="' + i + '" style="min-height:62px;' + (sel === i ? 'box-shadow:0 0 0 2px var(--act) inset' : '') + '"><span class="n num">' + c[0] + '</span><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span>' + c[1] + '</span><span style="font-size:13px;color:var(--fg-2);font-weight:500">' + L('Woche ' + c[0] + ' · Kapitel ' + c[2], 'Week ' + c[0] + ' · chapter ' + c[2]) + '</span></span>' +
        (c[3] === 'done' ? '<span class="tm-state fixed">' + L('geübt', 'practiced') + '</span>' : c[3] === 'now' ? '<span class="tm-state">' + L('diese Woche', 'this week') + '</span>' : '') + '</button>').join('') +
      '<p class="p2" style="font-size:13px;text-align:center;padding-top:4px">' + L('8 weitere Szenen ab Kapitel 5', '8 more scenes from chapter 5') + '</p></div>' +
      '<button class="btn pri full" id="tm-sc-go" data-go="h11-prep">' + L('Szene starten', 'Start scene') + ': ' + sc[sel][1] + '</button>', askBtn());
  }
  const open = !!S.ui.time;
  const row = (id, icon, t, sub, attr, chev) => '<button class="row" id="' + id + '" ' + attr + '><span class="ri">' + ic(icon, 'sm') + '</span><span class="rt"><b>' + t + '</b><span>' + sub + '</span></span><span class="chev">' + ic(chev || 'chevR', 'sm') + '</span></button>';
  return tmSub('h13-main', 'h13', tmTitle(L('Sprechen', 'Speaking'), L('Alles hier ist freiwillig und zählt als Extra.', 'Everything here is optional and counts as extra.')) +
    '<section class="stack s6"><div class="h2 disp" style="font-size:19px">' + L('Training', 'Training') + '</div><div>' +
    row('tm-sp-obj', 'speak', L('Einwand-Training', 'Objection training'), L('5 Stufen · du bist bei Stufe 2', '5 levels · you are at level 2'), 'data-go="h29-objection"') +
    row('tm-sp-time', 'clock', L('Zeit gewinnen', 'Buying time'), L('Sätze, die dir ruhig Denkzeit geben', 'Phrases that calmly give you time to think'), 'data-act="tmtime" aria-expanded="' + open + '"', open ? 'chevU' : 'chevD') +
    (open ? '<div class="ex-list en springopen" style="padding:0 0 8px 50px">' + TM_TIME.map(t => '<div><b>' + t + '</b></div>').join('') + '</div>' : '') +
    row('tm-sp-hot', 'spark', L('Hot Seat', 'Hot seat'), L('eine unerwartete Kundenfrage, 5 Sekunden Denkzeit', 'one unexpected client question, 5 seconds to think'), 'data-act="noop"') + '</div></section>' +
    '<section class="stack s6"><div class="h2 disp" style="font-size:19px">' + L('Szenen', 'Scenes') + '</div><div>' +
    row('tm-sp-scene', 'list', L('Szene frei wählen', 'Choose any scene'), L('16 Szenen entlang des Verkaufs', '16 scenes along the sales process'), 'data-go="h29-scene"') + '</div></section>' +
    '<section class="stack s6"><div class="h2 disp" style="font-size:19px">' + L('Für deinen Termin', 'For your meeting') + '</div><div>' +
    row('tm-sp-termin', 'cal', L('Mein nächster Termin', 'My next meeting'), L('Dienstag Call mit Einkauf · ändern', 'Tuesday call with purchasing · change'), 'data-go="termin-filled"') +
    row('tm-sp-mission', 'speak', L('Freie Mission', 'Optional mission'), L('Rückfrage zum Liefertermin', 'Question about the delivery date'), 'data-go="h11-prep"') + '</div></section>', askBtn());
}
reg('h29', {
  code: 'H29', name: 'Sprechen: alle Einträge', kind: 'phone',
  variants: [['list', 'Liste'], ['objection', 'Einwand-Training Stufe 2'], ['scene', 'Szene wählen']],
  render: h29,
  acts: {
    whysheet: tmWhyAct,
    tmsay() { S.ui.said = true; render(); },
    tmtime() { S.ui.time = !S.ui.time; render(); },
    tmscene(el) { S.ui.sc = +el.getAttribute('data-i'); render(); },
    more() { go('h29-list'); },
    also() { go('h15-claude'); }
  }
});

/* =========================================================
   H30 Wochenabschluss
   ========================================================= */
function tmWeekCore(p) {
  return '<div class="card stack s16" style="box-shadow:var(--shadow)"><div class="lbl">' + L('Gemessen', 'Measured') + '</div>' +
    '<p class="p" style="font-size:18px;line-height:26px;font-weight:550"><span class="en">past simple vs. present perfect</span>: ' + L('Montag 4 von 10, heute 7 von 10.', 'Monday 4 of 10, today 7 of 10.') + '</p>' +
    tmBA([[L('Montag', 'Monday'), 40, '4/10'], [L('heute', 'today'), 70, '7/10']]) +
    '<p class="p2">' + L('3 Wörter bildest du jetzt neu selbst. 6 von 6 Lerntagen erledigt.', 'You now produce 3 more words yourself. 6 of 6 study days done.') + '</p></div>' +
    '<section class="stack s6"><div class="lbl">' + L('Drei Werte, die zählen', 'Three numbers that matter') + '</div><div class="card" style="padding:2px 16px">' + tmLights([
      ['g', L('Wörter vom Vortag frei gewusst', 'Words from the day before recalled freely'), L('gut ab 70 %', 'good from 70 %'), '78 %'],
      ['g', L('Erster Versuch richtig', 'Right on the first try'), L('gut zwischen 75 und 90 %: fordernd, aber machbar', 'good between 75 and 90 %: challenging but doable'), '82 %'],
      ['y', L('Wortpartner', 'Collocations'), L('5 von 9 richtig', '5 of 9 correct'), '56 %']]) + '</div></section>' +
    '<div class="notice">' + ic('repeat', 'sm') + '<span>' + L('Wortpartner fielen dir schwer, deshalb kommen nächste Woche mehr davon.', 'Collocations were hard for you, so more of them are coming next week.') + '</span></div>';
}
const TM_ALL = () => [
  ['g', L('Wörter vom Vortag frei gewusst', 'Previous-day words recalled freely'), L('Ziel ab 70 %', 'target 70 %+'), '78 %'],
  ['n', L('Wörter nach 21 Tagen frei gewusst', 'Words recalled freely after 21 days'), L('Ziel ab 85 % · noch zu wenig Belege', 'target 85 %+ · not enough evidence yet'), '–'],
  ['g', L('Frei gebildet zu nur erkannt', 'Produced vs. only recognized'), L('Ziel ab 3 : 1', 'target 3 : 1+'), '3,4 : 1'],
  ['g', L('Erster Versuch richtig', 'Right on the first try'), L('Ziel 75–90 %', 'target 75–90 %'), '82 %'],
  ['g', L('Auswahl statt frei, ab Stufe 2', 'Choice instead of free, from stage 2'), L('Ziel höchstens 20 %', 'target 20 % max'), '14 %'],
  ['g', L('Anteil Wort-Werkstatt', 'Share of word workshop'), L('Ziel unter 5 %', 'target under 5 %'), '3 %'],
  ['g', L('Tage mit gesprochener Antwort', 'Days with a spoken answer'), L('Ziel 5 von 6', 'target 5 of 6'), L('6 von 6', '6 of 6')],
  ['y', L('Wortpartner', 'Collocations'), L('5 von 9 richtig', '5 of 9 correct'), '56 %'],
  ['n', L('Behobene zu neuen Fehlern', 'Fixed vs. new errors'), L('Ziel ab 1,0 · gemessen ab Woche 6', 'target 1.0+ · measured from week 6'), '–'],
  ['n', L('Themen-Test im ersten Versuch', 'Topic test on the first try'), L('noch kein Test', 'no test yet'), '–'],
  ['n', L('Sprechen', 'Speaking'), L('78 % korrekte Sätze', '78 % correct sentences'), L('92 W./Min.', '92 wpm')],
  ['n', L('Hören', 'Listening'), L('Stufe normal · 1,0×', 'level normal · 1.0×'), '71 %'],
  ['n', L('Wochenfrage: sicher im Kundengespräch', 'Week question: confident with clients'), L('letzte Woche 3', 'last week 3'), L('4 von 5', '4 of 5')]
];
function h30(v) {
  const blocks = NORMAL();
  if (v === 'all') {
    return tmSub('h30-report', 'h14', tmTitle(L('Alle Messwerte', 'All measurements'), L('Diese Woche, jeweils mit Ziel. Grün heißt im Ziel, grau heißt noch ohne Ziel oder zu wenig Belege. Kein Wert ist eine Note.', 'This week, each with its target. Green means on target, gray means no target yet or not enough evidence. No value is a grade.')) +
      '<div class="card" style="padding:2px 16px">' + tmLights(TM_ALL()) + '</div>');
  }
  const top = exTop(blocks, 5, v === 'focus' ? 0.99 : 0.96);
  if (v === 'focus') {
    const f = S.ui.focus != null ? S.ui.focus : 0;
    const opts = [[L('Wortpartner', 'Collocations'), L('empfohlen: diese Woche 5 von 9', 'recommended: 5 of 9 this week')], [L('Sprechen unter Zeitdruck', 'Speaking under time pressure'), L('mehr Hot Seat und Flüssigkeit', 'more hot seat and fluency')], [L('Hören schneller', 'Faster listening'), L('Hörtexte öfter bei 1,1×', 'listening more often at 1.1×')], [L('Keine Vorgabe', 'No preference'), L('die App entscheidet nach deinen Werten', 'the app decides from your numbers')]];
    return top + '<div class="ex-body gx">' + blockLine('s', L('Wochenabschluss · Fokus', 'Week review · focus')) +
      '<div class="stagec" style="gap:18px;justify-content:flex-start;padding-top:22px"><div class="disp" style="font-size:24px;line-height:31px;font-weight:650;text-wrap:balance">' + L('Worauf sollen wir nächste Woche mehr achten?', 'What should we focus on more next week?') + '</div>' +
      '<div class="stack s8" role="radiogroup">' + opts.map((o, i) => '<button class="choice" id="tm-focus-' + i + '" data-act="tmfocus" data-i="' + i + '" role="radio" aria-checked="' + (f === i) + '" style="min-height:64px;' + (f === i ? 'box-shadow:0 0 0 2px var(--act) inset' : '') + '"><span class="tm-radio' + (f === i ? ' on' : '') + '"></span><span style="display:flex;flex-direction:column;gap:1px"><span>' + o[0] + '</span><span style="font-size:13px;color:var(--fg-2);font-weight:500">' + o[1] + '</span></span></button>').join('') + '</div>' +
      '<p class="p2">' + L('Der Fokus ändert nur die Auswahl der Übungen. Kapitelweg und Tagesdauer bleiben.', 'The focus only changes which exercises you get. Chapter path and daily length stay the same.') + '</p></div></div>' +
      exFoot(btnPri('tm-focus-done', L('Fertig', 'Done'), 'h1-done'));
  }
  return top + '<div class="ex-body gx">' + blockLine('s', L('Wochenabschluss · KW 44', 'Week review · week 44')) +
    '<div class="stack s16" style="padding:16px 0 20px"><h1 class="tm-title disp" style="font-size:28px;line-height:34px">' + L('Deine Woche', 'Your week') + '</h1>' + tmWeekCore('') +
    '<div><button class="row" id="tm-wk-all" data-go="h30-all"><span class="ri">' + ic('list', 'sm') + '</span><span class="rt"><b>' + L('Alle Messwerte', 'All measurements') + '</b><span>' + L('13 Werte mit Ziel', '13 values with targets') + '</span></span><span class="chev">' + ic('chevR', 'sm') + '</span></button>' +
    '<button class="row" id="tm-wk-q" data-go="woche-ask"><span class="ri">' + ic('speak', 'sm') + '</span><span class="rt"><b>' + L('Wochenfrage', 'Week question') + '</b><span>' + L('Wie sicher fühlst du dich im Kundengespräch?', 'How confident do you feel with clients?') + '</span></span><span class="chev">' + ic('chevR', 'sm') + '</span></button></div></div></div>' +
    exFoot(btnPri('tm-wk-next', L('Weiter: Fokus wählen', 'Continue: choose focus'), 'h30-focus'));
}
reg('h30', {
  code: 'H30', name: 'Wochenabschluss', kind: 'phone',
  variants: [['report', 'Bericht'], ['all', 'alle Messwerte'], ['focus', 'Fokus wählen']],
  render: h30,
  acts: { tmfocus(el) { S.ui.focus = +el.getAttribute('data-i'); render(); } }
});

/* =========================================================
   H31 Test-Ergebnis
   ========================================================= */
function tmCurve() {
  const Y = { c1: 16, edge: 50, b2: 84 };
  const pts = [[14, 80], [86, 66]];
  return '<div class="tm-curve"><div style="position:relative"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
    '<rect x="0" y="0" width="100" height="33" fill="var(--fg)" opacity=".05"/><rect x="0" y="67" width="100" height="33" fill="var(--fg)" opacity=".05"/>' +
    [33, 67].map(y => '<line x1="0" x2="100" y1="' + y + '" y2="' + y + '" stroke="var(--line-2)" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"/>').join('') +
    '<line x1="' + pts[0][0] + '" y1="' + pts[0][1] + '" x2="' + pts[1][0] + '" y2="' + pts[1][1] + '" stroke="var(--fg)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round"/>' +
    '</svg>' + pts.map((p, i) => '<i style="position:absolute;left:' + p[0] + '%;top:' + p[1] + '%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:' + (i ? 'var(--act)' : 'var(--fg)') + ';box-shadow:0 0 0 3px var(--surface)"></i>').join('') + '</div>' +
    '<span class="tm-yl" style="top:' + Y.c1 + '%">C1</span><span class="tm-yl" style="top:' + Y.edge + '%">' + L('C1-Grenze', 'C1 edge') + '</span><span class="tm-yl" style="top:' + Y.b2 + '%">' + L('B2 sicher', 'B2 solid') + '</span>' +
    '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--fg-3);padding:6px 4px 0 0;margin-left:8%"><span>' + L('Einstufung · Woche 0', 'Placement · week 0') + '</span><span>' + L('Woche 4', 'Week 4') + '</span></div></div>';
}
function h31(v) {
  const blocks = NORMAL();
  if (v === 'chapter') {
    const lines = [[ic('gram', 'sm'), L('4 von 4 Themen bestanden', '4 of 4 topics passed')], [ic('check', 'sm'), L('Kapitel-Test: 11 von 12, frei 4 von 4', 'Chapter test: 11 of 12, free 4 of 4')], [ic('pen', 'sm'), L('Projekt-Update per Mail und Statusbericht erledigt', 'Project update email and status report done')]];
    return '<div class="ex-body gx" style="justify-content:center;gap:28px;padding-top:40px">' +
      '<div class="tm-badge"><b class="disp num">1</b></div>' +
      '<div class="stack s6" style="text-align:center"><div class="disp" style="font-size:28px;line-height:34px;font-weight:700">' + L('Kapitel 1 abgeschlossen', 'Chapter 1 complete') + '</div><div class="p2">' + CHAPTERS()[0][1] + '</div></div>' +
      '<div class="card" style="padding:6px 18px">' + lines.map(l => '<div class="st" style="min-height:56px;gap:14px;font-size:16px;line-height:22px"><span style="color:var(--fg-2)">' + l[0] + '</span><span>' + l[1] + '</span></div>').join('') + '</div>' +
      '<p class="p2" style="text-align:center">' + L('Als Nächstes: Kapitel 2 · ', 'Next: chapter 2 · ') + CHAPTERS()[1][1] + '</p></div>' +
      exFoot(btnPri('tm-ch-next', L('Weiter', 'Continue'), 'h6-path'));
  }
  if (v === 'milestone') {
    const kv = [[L('Wörter, die du selbst bildest', 'Words you produce'), '38 → 64'], [L('Hören bei 1,0×', 'Listening at 1.0×'), '64 % → 74 %'], [L('Sprechen', 'Speaking'), L('68 → 95 Wörter/Min.', '68 → 95 wpm')], [L('Kann-Beschreibungen', 'Can-do statements'), L('2 → 5 von 12', '2 → 5 of 12')]];
    return tmHead('h14-main', '', 'tm-ms-back') + '<div class="scroll gx" style="padding-bottom:16px"><div class="stack s24 springopen">' +
      '<div class="stack s8"><div class="lbl">' + L('Meilenstein A · Woche 4', 'Milestone A · week 4') + '</div><h1 class="tm-title disp">' + L('Dein Trend nach 4 Wochen', 'Your trend after 4 weeks') + '</h1></div>' +
      '<div class="card stack s8"><div style="display:flex;align-items:center;justify-content:space-between"><span class="lbl">' + L('Gesamtbild', 'Overall') + '</span><span class="chip" style="min-height:24px">' + L('Trend, nicht geeicht', 'Trend, not calibrated') + '</span></div>' + tmCurve() + '</div>' +
      '<div class="card" style="padding:4px 16px"><div class="tm-kv">' + kv.map(r => '<span class="tm-kl">' + r[0] + '</span><span class="tm-kr num">' + r[1] + '</span>').join('') + '</div></div>' +
      '<p class="p" style="font-weight:550">' + L('C1 voraussichtlich zwischen Oktober 2027 und Januar 2028.', 'C1 expected between October 2027 and January 2028.') + '</p>' +
      '<p class="p2" style="font-size:13px">' + L('Eine Schätzung aus zwei Messungen, kein Zeugnis. Mit jedem Meilenstein wird sie genauer.', 'An estimate from two measurements, not a certificate. It gets more precise with every milestone.') + '</p></div></div>' +
      exFoot(btnPri('tm-ms-next', L('Zum Fortschritt', 'Go to progress'), 'h14-main'));
  }
  const top = exTop(blocks, 2, 1);
  if (v === 'failed') {
    return top + '<div class="ex-body gx">' + blockLine('g', L('Themen-Test · <em class="en">past simple vs. present perfect</em>', 'Topic test · <em>past simple vs. present perfect</em>')) +
      '<div class="stack s16 springopen" style="padding:16px 0 20px">' + tmVerdict('var(--fg-2)', 'ring', L('Noch nicht bestanden', 'Not passed yet')) +
      '<div class="stack s6"><div class="disp num" style="font-size:30px;line-height:36px;font-weight:700">' + L('11 von 15 richtig', '11 of 15 correct') + '</div><p class="p2">' + L('Für bestanden braucht es 12, also 80 %.', 'Passing needs 12, that is 80 %.') + '</p></div>' +
      '<div class="card stack s8"><div class="lbl">' + L('Was fehlt', 'What’s missing') + '</div>' + tmLights([
        ['y', L('Fragen mit <em class="en">When …?</em> und Zeitpunkt', 'Questions with <em>When …?</em> and a time'), L('fragst du noch oft mit <em class="en">have</em>', 'you still often ask with <em>have</em>'), L('2 von 5', '2 of 5')],
        ['y', L('Unter Zeit', 'Under time'), L('4 von 5 nötig', '4 of 5 needed'), L('3 von 5', '3 of 5')]]) + '</div>' +
      '<div class="card stack s8"><div class="lbl">' + L('Was schon sitzt', 'What already holds') + '</div><div class="ci" style="display:flex;align-items:center;gap:10px;font-size:15px">' + tmCk(true) + L('Aussagen mit Zeitpunkt: 6 von 6', 'Statements with a time: 6 of 6') + '</div><div class="ci" style="display:flex;align-items:center;gap:10px;font-size:15px">' + tmCk(true) + L('Frei gebildet: 4 von 5', 'Produced freely: 4 of 5') + '</div></div>' +
      '<div class="notice">' + ic('cal', 'sm') + '<span>' + L('Bis dahin übst du Fragen mit <em class="en">did</em> gezielt in der Pflicht. <b>Nächster Versuch: Freitag, 30.10.</b>', 'Until then you practice questions with <em>did</em> in your daily plan. <b>Next attempt: Friday, Oct 30.</b>') + '</span></div>' +
      '<p class="p2" style="font-size:13px">' + L('Ein Test, den jeder beim ersten Mal besteht, würde nichts messen.', 'A test everyone passes the first time wouldn’t measure anything.') + '</p></div></div>' +
      exFoot(btnSec('tm-t-errors', L('Fehler ansehen', 'See errors'), 'data-go="h26-list"') + btnPri('tm-t-next', L('Weiter', 'Continue'), 'h1-mid'));
  }
  return top + '<div class="ex-body gx">' + blockLine('g', L('Themen-Test · <em class="en">past simple vs. present perfect</em>', 'Topic test · <em>past simple vs. present perfect</em>')) +
    '<div class="stack s16 springopen" style="padding:16px 0 20px">' + tmVerdict('var(--ok)', 'check', L('Bestanden', 'Passed')) +
    '<div class="disp num" style="font-size:30px;line-height:36px;font-weight:700">' + L('13 von 15 richtig', '13 of 15 correct') + '</div>' +
    '<div class="card stack s8"><div class="lbl">' + L('Vorher → nachher', 'Before → after') + '</div>' + tmBA([[L('Einstufung', 'Placement'), 40, '40 %'], [L('Test', 'Test'), 87, '87 %']]) + '</div>' +
    '<div class="card stack s8"><div class="lbl">' + L('Bestanden heißt', 'Passed means') + '</div>' +
    [[L('mindestens 80 % richtig', 'at least 80 % correct'), '87 %'], [L('frei gebildet', 'produced freely'), L('5 von 5', '5 of 5')], [L('unter Zeit', 'under time'), L('4 von 5', '4 of 5')]].map(r => '<div class="ci" style="display:flex;align-items:center;gap:10px;font-size:15px;min-height:30px">' + tmCk(true) + '<span style="flex:1">' + r[0] + '</span><b class="num" style="font-weight:600">' + r[1] + '</b></div>').join('') + '</div>' +
    '<p class="p2">' + L('Das Thema ist jetzt bestätigt. In 21 Tagen kommt ein kurzer Check mit 8 Aufgaben, dann gilt es als gefestigt.', 'The topic is now confirmed. In 21 days a short check with 8 tasks follows, then it counts as solid.') + '</p>' +
    '<div class="notice">' + ic('arrowR', 'sm') + '<span>' + L('Als Nächstes: Thema 2 · <span class="en">present perfect continuous</span>', 'Next: topic 2 · present perfect continuous') + '</span></div></div></div>' +
    exFoot(btnPri('tm-t-next', L('Weiter', 'Continue'), 'h6-path'));
}
reg('h31', {
  code: 'H31', name: 'Test-Ergebnis', kind: 'phone',
  variants: [['passed', 'Themen-Test bestanden'], ['failed', 'nicht bestanden'], ['chapter', 'Kapitel abgeschlossen (Vollbild)'], ['milestone', 'Meilenstein mit Kurve']],
  render: h31
});

/* =========================================================
   H32 Wochen-Mail am Handy
   ========================================================= */
const TM_DRAFT = 'Hi Laura,\nthanks for taking the time to talk on Wednesday. I have checked the numbers with our logistics team yesterday, and we can offer a lead time of eight weeks instead of ten.\nRegarding the price: we have already reduced it by 5 percent in the revised quote.';
function tmWordCount(t) { return (t.match(/[A-Za-z0-9’'-]+/g) || []).length; }
function tmMailChecks(t) {
  const n = tmWordCount(t);
  return '<span id="tm-wc" class="num" style="color:' + (n >= 80 && n <= 150 ? 'var(--ok)' : 'var(--fg-2)') + '">' + L(n + ' Wörter · Ziel 80–150', n + ' words · target 80–150') + '</span>' +
    '<span>' + tmCk(/lead time/i.test(t)) + '<span class="en">lead time</span></span><span>' + tmCk(/discount/i.test(t)) + '<span class="en">discount</span></span>' +
    '<span>' + tmCk(/\b(have|has|’ve|'ve)\s+(already\s+)?\w+ed\b/i.test(t)) + '<span class="en">present perfect</span></span>';
}
function tmMailMarked(cat) {
  const k = ['mark-good', 'mark-reg', 'mark-str', 'mark-lang'][cat];
  const m = (cls, txt) => '<span class="' + cls + (cls === k ? '' : ' tm-off') + '">' + txt + '</span>';
  return '<div class="card tm-mail en"><p>Hi Laura,</p><p>' + m('mark-lang', 'thanks') + ' for taking the time to talk on Wednesday. ' + m('mark-lang', 'I have checked the numbers with our logistics team yesterday') + ', and we can offer a lead time of eight weeks instead of ten.</p>' +
    '<p>' + m('mark-str', 'Regarding the price:') + ' ' + m('mark-good', 'we have already reduced it by 5 percent in the revised quote.') + ' A further discount ' + m('mark-reg', 'is difficult') + ', but we could offer a two-year contract with fixed prices.</p>' +
    '<p>' + m('mark-good', 'Could we have a quick call on Monday to go through the details?') + '</p><p>Best regards,</p></div>';
}
function h32(v) {
  const blocks = NORMAL();
  if (v === 'writing') {
    const t = S.ui.mail != null ? S.ui.mail : TM_DRAFT;
    return exTop(blocks, 4, 0.3) + '<div class="tm-count gx" id="tm-checks" aria-live="polite">' + tmMailChecks(t) + '</div>' +
      '<div class="ex-body gx" style="justify-content:flex-start"><textarea class="field en" id="tm-mail" style="flex:1;min-height:150px;font-size:16px;line-height:24px" aria-label="' + esc(L('Deine Mail', 'Your email')) + '">' + esc(t) + '</textarea></div>' +
      '<div class="ex-foot gx abovekb">' + btnSec('tm-mail-ask', ic('claude', 'sm'), 'data-go="h15-claude" aria-label="' + esc(L('Claude fragen', 'Ask Claude')) + '" style="width:52px;padding:0;flex:none"') + btnPri('tm-mail-send', L('Abgeben', 'Submit'), 'h32-feedback') + '</div>' + drawnKbd({ go: 'return' });
  }
  if (v === 'feedback') {
    const c = S.ui.cat || 0;
    const cats = CATS();
    const strength = c === 0 ? '<div class="stack s6"><div class="lbl">' + L('Das war stark', 'That was strong') + '</div><div class="quote en">„Could we have a quick call on Monday to go through the details?“</div></div>' : '';
    return exTop(blocks, 4, 0.55 + c * 0.08) + '<div class="ex-body gx">' + blockLine('s', L('Schreibtag · Rückmeldung ', 'Writing day · feedback ') + (c + 1) + L(' von 4', ' of 4')) +
      '<div class="stack s16 swap" style="padding:14px 0 16px" id="tm-cat">' +
      '<div class="stack s6"><div style="display:flex;align-items:center;gap:10px"><span style="width:12px;height:12px;border-radius:3px;background:' + cats[c][1] + '"></span><b style="font-size:18px">' + cats[c][2] + '</b></div><p class="p" style="line-height:24px">' + cats[c][3] + '</p></div>' +
      strength + tmMailMarked(c) + '</div></div>' +
      '<div class="gx" style="flex:none">' + pageDots(4, c) + '</div>' +
      exFoot((c > 0 ? btnSec('tm-cat-prev', L('Zurück', 'Back'), 'data-act="tmcat" data-d="-1"') : '') + btnPri('tm-cat-next', c < 3 ? L('Weiter', 'Continue') : L('Überarbeiten', 'Revise'), '', ' data-act="tmcat" data-d="1"'));
  }
  if (v === 'rewrite') {
    const better = [L('Zeitform korrigiert', 'Tense fixed'), L('Großschreibung nach der Anrede', 'Capital after the greeting'), L('Ton weicher', 'Softer tone'), L('Überleitung zum Preis', 'Lead-in to the price')];
    return exTop(blocks, 4, 1) + '<div class="ex-body gx">' + blockLine('s', L('Schreibtag · deine überarbeitete Fassung', 'Writing day · your revised version')) +
      '<div class="stack s16 springopen" style="padding:14px 0 16px">' + tmVerdict('var(--ok)', 'check', L('Bereit zum Abschicken', 'Ready to send')) +
      '<div class="card tm-mail en" id="tm-final"><p>Hi Laura,</p><p><b>Thanks</b> for taking the time to talk on Wednesday. I <b>checked</b> the numbers with our logistics team yesterday, and we can offer a lead time of eight weeks instead of ten.</p><p><b>As for the price,</b> we’ve already reduced it by 5 percent in the revised quote. A further discount <b>would be difficult for us</b>, but we could offer a two-year contract with fixed prices.</p><p>Could we have a quick call on Monday to go through the details?</p><p>Best regards,</p></div>' +
      '<div class="stack s6"><div class="lbl">' + L('Was sich verbessert hat', 'What improved') + '</div><div class="checklist" style="padding:0">' + better.map(b => '<div class="ci">' + tmCk(true) + b + '</div>').join('') + '</div></div>' +
      '<p class="p2">' + L('Zwei Wendungen gehen in deine Wörter: <em class="en">as for the price</em>, <em class="en">would be difficult for us</em>.', 'Two phrases go into your words: <em>as for the price</em>, <em>would be difficult for us</em>.') + '</p></div></div>' +
      exFoot(btnSec('tm-mail-copy', S.ui.copied ? L('Kopiert', 'Copied') : L('Text kopieren', 'Copy text'), 'data-act="tmcopymail"') + btnPri('tm-mail-next', L('Weiter', 'Continue'), 'h10-day'));
  }
  const whyTask = L('Die Mail bringt Wörter, Grammatik und den Ton der Woche in einen echten Text. Rückmeldung gibt es in vier Bereichen, danach überarbeitest du selbst.', 'The email brings the week’s words, grammar and tone into a real text. Feedback comes in four areas, then you revise it yourself.');
  return exTop(blocks, 4, 0.05) + '<div class="ex-body gx">' + blockLine('s', L('Schreibtag · Projekt-Update an den Einkauf', 'Writing day · project update to purchasing')) +
    instr(L('Schreib Laura ein kurzes Projekt-Update.', 'Write Laura a short project update.'), 'tm-why') +
    '<div class="stagec" style="gap:16px;justify-content:flex-start;padding-top:18px">' +
    '<div class="card stack s8"><div class="persona"><span class="avatar">LK</span><div><b>Laura Keller</b><div class="p2" style="font-size:13px">' + L('Leiterin Einkauf · nach eurem Call am Mittwoch', 'Head of Procurement · after your call on Wednesday') + '</div></div></div>' +
    '<p class="p">' + L('Die Lieferzeit geht von 10 auf 8 Wochen. Der Preis ist schon um 5 % gesenkt, mehr geht nicht. Schlag einen kurzen Call am Montag vor.', 'Lead time goes from 10 to 8 weeks. The price is already 5 % lower, no more room. Suggest a short call on Monday.') + '</p></div>' +
    '<div class="stack s8"><div class="lbl">' + L('Darauf kommt es an', 'What counts') + '</div><div class="checklist" style="padding:0">' +
    [L('80–150 Wörter', '80–150 words'), L('2 deiner Wörter: <span class="en">lead time, discount</span>', '2 of your words: lead time, discount'), L('Zielstruktur: <span class="en">past simple vs. present perfect</span>', 'Target: past simple vs. present perfect'), L('Ton: freundlich und klar', 'Tone: friendly and clear')].map(x => '<div class="ci">' + tmCk(false) + x + '</div>').join('') + '</div></div>' +
    '<p class="p2">' + L('Etwa 12 Minuten. Am Laptop wartet derselbe Entwurf.', 'About 12 minutes. The same draft waits on your laptop.') + '</p></div></div>' +
    exFoot(btnSec('tm-mail-later', L('Pause, später weiter', 'Pause, continue later'), 'data-go="h1-mid"') + btnPri('tm-mail-write', L('Schreiben', 'Write'), 'h32-writing')) +
    overlays({ whyTask });
}
reg('h32', {
  code: 'H32', name: 'Wochen-Mail am Handy', kind: 'phone',
  variants: [['task', 'Aufgabe'], ['writing', 'Schreiben'], ['feedback', 'Rückmeldung Seite 1'], ['rewrite', 'umformulierte Fassung']],
  render: h32,
  after(v) {
    if (v !== 'writing') return;
    const f = $('#tm-mail'), c = $('#tm-checks');
    if (!f || !c) return;
    f.addEventListener('input', () => { S.ui.mail = f.value; c.innerHTML = tmMailChecks(f.value); });
  },
  acts: {
    whysheet: tmWhyAct,
    tmcat(el) { const d = +el.getAttribute('data-d'); const c = (S.ui.cat || 0) + d; if (c > 3) { go('h32-rewrite'); return; } S.ui.cat = Math.max(0, c); render(); },
    tmcopymail() { tmCopy('#tm-final'); }
  }
});
