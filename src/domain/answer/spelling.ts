// Britische Schreibweisen und Wörter → amerikanisch (A7.3: britisch gilt immer als richtig,
// die Rückmeldung nennt die US-Form als Hinweis). Bewusst kuratierte Listen statt Raten.

const WORDS: Record<string, string> = {
  programme: 'program', programmes: 'programs', cheque: 'check', cheques: 'checks', grey: 'gray', tyre: 'tire', tyres: 'tires',
  aluminium: 'aluminum', enquiry: 'inquiry', enquiries: 'inquiries', judgement: 'judgment', ageing: 'aging', fulfil: 'fulfill',
  enrol: 'enroll', licence: 'license', defence: 'defense', offence: 'offense', pretence: 'pretense', catalogue: 'catalog',
  dialogue: 'dialog', analogue: 'analog', practise: 'practice', practised: 'practiced', practising: 'practicing',
  manoeuvre: 'maneuver', jewellery: 'jewelry', marvellous: 'marvelous', plough: 'plow', sceptical: 'skeptical',
  // Wörter mit anderer US-Entsprechung (gleiche Bedeutung)
  lorry: 'truck', flat: 'apartment', lift: 'elevator', rubbish: 'trash', autumn: 'fall', petrol: 'gas', queue: 'line',
  film: 'movie', timetable: 'schedule', motorway: 'highway', postcode: 'zip code', 'mobile phone': 'cell phone',
  'city centre': 'downtown', pavement: 'sidewalk', holiday: 'vacation', holidays: 'vacation', cv: 'résumé',
};

const OUR = ['behaviour', 'colour', 'favour', 'flavour', 'honour', 'humour', 'labour', 'neighbour', 'rumour', 'harbour', 'endeavour', 'savour', 'vapour', 'vigour', 'armour', 'odour', 'parlour', 'saviour', 'glamour'];
const RE_WORDS = ['centre', 'metre', 'litre', 'theatre', 'fibre', 'calibre', 'sombre', 'spectre', 'lustre', 'meagre'];
const LL = ['travel', 'cancel', 'label', 'model', 'level', 'fuel', 'signal', 'counsel', 'total', 'channel', 'equal', 'dial', 'quarrel'];
const ISE_KEEP = new Set(['advertise', 'advise', 'arise', 'comprise', 'compromise', 'despise', 'devise', 'disguise', 'enterprise', 'exercise', 'expertise', 'franchise', 'improvise', 'merchandise', 'otherwise', 'premise', 'promise', 'raise', 'revise', 'rise', 'supervise', 'surprise', 'televise', 'wise', 'praise', 'cruise', 'noise', 'precise', 'concise', 'paradise', 'treatise', 'excise', 'chastise', 'incise', 'demise', 'poise', 'guise', 'bruise', 'anise', 'reprise', 'surmise', 'apprise']);

function oneWord(w: string): string {
  const direct = WORDS[w];
  if (direct) return direct;
  for (const b of OUR) {
    if (w.startsWith(b)) return b.slice(0, -2) + 'r' + w.slice(b.length);
  }
  for (const b of RE_WORDS) {
    if (w === b || w === `${b}s`) return b.slice(0, -2) + 'er' + w.slice(b.length);
  }
  for (const b of LL) {
    const m = new RegExp(`^${b}l(ed|ing|er|ers|or|ors)$`).exec(w);
    if (m) return b + (m[1] ?? '');
  }
  const ise = /^(.*[a-z])is(e|es|ed|ing|ation|ations|er|ers)$/.exec(w);
  if (ise && !ISE_KEEP.has(`${ise[1] ?? ''}ise`)) return `${ise[1] ?? ''}iz${ise[2] ?? ''}`;
  const yse = /^(.*)ys(e|es|ed|ing)$/.exec(w);
  if (yse && /(anal|paral|catal|electrol|dial)$/.test(yse[1] ?? '')) return `${yse[1] ?? ''}yz${yse[2] ?? ''}`;
  return w;
}

/** US-Form eines (normalisierten) Worts oder einer Wendung. */
export function toUS(s: string): string {
  const whole = WORDS[s];
  if (whole) return whole;
  return s
    .split(' ')
    .map((w) => oneWord(w))
    .join(' ');
}
