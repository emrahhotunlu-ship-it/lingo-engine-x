// Protokolleinträge von Lesen, Hören und Entdecken im Tagesprotokoll `log/<tag>` (Plan §3.2, F8):
// Format „Sonstiges" der alten App `{t, ok, lang, type, q, given, ans}` plus `ref` und `ctx`.
// Bewusst OHNE `id` und `k`: sonst würde der Zähler „Wiederholen" (nur `k:'v'`, `ctx:'rev'`)
// sie als Vokabel-Antworten mitzählen.

export type ChannelLogEntry = {
  t: number;
  ok: boolean;
  lang: string;
  /** `nb-*`: neue Übungen (Paket P7, Kollokationen, Einwände, Posteingang …). */
  type: 'read' | 'listen' | 'discover' | `nb-${string}`;
  ref: string;
  q: string;
  given: string;
  ans: string;
  ms: number;
  ctx: 'ch' | 'xtra';
  /** Nie gesetzt (Typ-Hilfe für gemischte Listen mit Vokabel-Einträgen). */
  id?: undefined;
  k?: undefined;
};

const TEXT_MAX = 160;
const clip = (s: string) => {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > TEXT_MAX ? flat.slice(0, TEXT_MAX) : flat;
};

export function channelLogEntry(i: {
  t: number;
  ok: boolean;
  lang: string;
  type: ChannelLogEntry['type'];
  ref: string;
  q: string;
  given: string;
  ans: string;
  ms: number;
  ctx: 'duty' | 'extra';
}): ChannelLogEntry {
  return {
    t: i.t,
    ok: i.ok,
    lang: i.lang,
    type: i.type,
    ref: i.ref.slice(0, 120),
    q: clip(i.q),
    given: clip(i.given),
    ans: clip(i.ans),
    ms: Math.max(0, Math.round(i.ms)),
    ctx: i.ctx === 'duty' ? 'ch' : 'xtra',
  };
}
