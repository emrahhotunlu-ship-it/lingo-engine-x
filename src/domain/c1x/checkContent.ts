import { checkCnet } from './kinds/cnet';
import { checkErr } from './kinds/err';
import { checkKwt } from './kinds/kwt';
import { checkMcc } from './kinds/mcc';
import { checkOcl } from './kinds/ocl';
import { checkPair } from './kinds/pair';
import { checkPara } from './kinds/para';
import { checkReg } from './kinds/reg';
import { checkWf } from './kinds/wf';
import { wrongLang, type CheckCtx, type Problems } from './kinds/common';
import type { C1Item } from './types';

// Inhaltsprüfung (rein): was zod schlecht ausdrückt. Leere Liste = in Ordnung. Läuft im Unit-Test über ALLE Inhalte (c1xContent.test.ts)
// und, strenger, für Claude-Aufgaben in `accept.ts`.

const SHORT = 140;

export function checkC1Content(item: C1Item, ctx: CheckCtx = {}): Problems {
  const out: Problems = [];
  if (item.area === 'gram') {
    if (!item.topic) out.push('area gram ohne topic');
    else {
      if (ctx.topicKnown && !ctx.topicKnown(item.topic)) out.push(`topic „${item.topic}“ ist keines der 47 Themen`);
      const t = ctx.patternTopic?.(item.pat, item.topic);
      if (t === null) out.push(`pat „${item.pat}“ gibt es im Thema „${item.topic}“ nicht`);
      else if (t !== undefined && t !== item.topic) out.push(`pat „${item.pat}“ gehört zu Thema „${t}“, nicht zu „${item.topic}“`);
    }
  } else if (!item.pat.startsWith('lx.')) out.push('area lex braucht pat „lx.<slug>“');
  if (item.probe && item.pool) out.push('probe und pool zugleich');
  for (const [name, s] of [['why.ok.de', item.why.ok.de], ['why.ok.en', item.why.ok.en]] as const) if (s.length > 180) out.push(`${name} länger als 180 Zeichen`);
  for (const w of [item.why.ok, ...item.why.wrong]) {
    if (wrongLang(w.de, 'de')) out.push(`Begründung auf Deutsch ist nicht deutsch („${w.de.slice(0, 30)}…“)`);
    if (wrongLang(w.en, 'en')) out.push(`Begründung auf Englisch ist nicht englisch („${w.en.slice(0, 30)}…“)`);
  }
  for (const r of item.why.wrong) {
    if (r.de.length > SHORT || r.en.length > SHORT) out.push(`WhyRule länger als ${SHORT} Zeichen („${r.de.slice(0, 30)}…“)`);
    if (r.if === undefined && r.not === undefined && r.opt === undefined && r.tap === undefined && r.pat === undefined) out.push('WhyRule ohne Bedingung (if/not/opt/tap/pat)');
  }
  switch (item.kind) {
    case 'mcc':
      return [...out, ...checkMcc(item)];
    case 'ocl':
      return [...out, ...checkOcl(item)];
    case 'wf':
      return [...out, ...checkWf(item)];
    case 'kwt':
      return [...out, ...checkKwt(item)];
    case 'err':
      return [...out, ...checkErr(item)];
    case 'pair':
      return [...out, ...checkPair(item)];
    case 'cnet':
      return [...out, ...checkCnet(item)];
    case 'reg':
      return [...out, ...checkReg(item)];
    case 'para':
      return [...out, ...checkPara(item)];
  }
}
