// Formulierungs-Prüfungen für Erklärtexte (E1a). Rein.
// - `absoluteClaims`: absolute Regeln („immer“, „nie“, „nur“, „always“, „never“, „only“) in Begründungen. Grammatik hat fast immer Ausnahmen;
//   ein Fund ist ein Hinweis zum Nachlesen, keine Sperre.
// - `duSieMix`: ein deutscher Text spricht Emrah zugleich mit „du“ und mit „Sie“ an.

const ABSOLUTE = /\b(immer|nie|niemals|nur|ausschließlich|grundsätzlich|always|never|only)\b/giu;

/** Gefundene absolute Wörter (klein, ohne Doppelte). „nicht nur“/„not only“ (Aufzählung) zählt nicht. */
export function absoluteClaims(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(ABSOLUTE)) {
    const before = text.slice(Math.max(0, m.index - 6), m.index).toLowerCase();
    const w = m[0].toLowerCase();
    if ((w === 'nur' && /nicht\s$/.test(before)) || (w === 'only' && /not\s$/.test(before))) continue;
    out.add(w);
  }
  return [...out];
}

const DU = /\b(du|dich|dir|dein|deine|deinen|deinem|deiner|deines)\b/iu;
// „Sie/Ihnen/Ihr“ nur großgeschrieben und nicht am Satzanfang (dort kann „Sie“ auch „she/they“ sein).
const SIE = /(?<![.!?:„"“]\s{0,2}|^\s{0,2})\b(Sie|Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)\b/u;

/** Spricht der Text Emrah zugleich mit „du“ und „Sie“ an? Englische Zitate (in „…“) zählen nicht. */
export function duSieMix(text: string): boolean {
  const de = text.replace(/[„“"][^„“"]*[“"]/g, ' ');
  return DU.test(de) && SIE.test(de);
}
