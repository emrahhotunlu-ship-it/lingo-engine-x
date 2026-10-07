import irregular from '../../content/irregular.json';

// Normalisierung für „Umformen“ (kwt, Cambridge Teil 4). Eigene Funktion statt `normText`/`legacyNorm`, weil deren Auflösung von
// 'd und 's für KWT falsch ist (docs/umbau/c1-aufgaben.md §3.4):
// - 'd + 3. Form = had (I'd checked), 'd + Grundform = would (I'd check); 'd better = had better,
// - 's + been/got = has, sonst nach Pronomen/Frage = is, nach Nomen = Besitz (supplier's = 1 Wort),
// - n't, 'll, 've, 're, 'm: wie ausgeschrieben (didn't = 2 Wörter),
// - can't/cannot = ein Wort (Gedächtnis: Cambridge zählt can't als ein Wort; vor dem Bau gegen die Cambridge-Regel prüfen, docs/umbau/stand.md).
// Groß-/Kleinschreibung und Satzzeichen zählen nicht.

type IrregularFile = { verbs: Record<string, { pp?: string[] }> };
let participles: Set<string> | null = null;
function ppSet(): Set<string> {
  if (participles) return participles;
  const out = new Set<string>(['been']);
  for (const v of Object.values((irregular as unknown as IrregularFile).verbs)) for (const p of v.pp ?? []) out.add(p.toLowerCase());
  participles = out;
  return out;
}

/** Wörter auf -ed, die kein Partizip sind (I'd need, I'd feed …). */
const NOT_PP = new Set(['need', 'feed', 'speed', 'bleed', 'breed', 'proceed', 'succeed', 'exceed', 'indeed', 'seed', 'weed', 'heed', 'deed', 'creed', 'shed', 'bed', 'red', 'wed']);
const isParticiple = (w: string): boolean => (/ed$/.test(w) && w.length > 3 && !NOT_PP.has(w)) || ppSet().has(w);

const PRONOUN_S = new Set(['it', 'he', 'she', 'that', 'there', 'who', 'what', 'here', 'where', 'how', 'when', 'why']);

/** Wörter der Antwort nach der KWT-Normalisierung (Kurzformen ausgeschrieben, `can't` = 1, Besitz-'s hängt am Nomen). */
export function kwtWords(raw: string): string[] {
  const clean = raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/…|\.\.\./g, ' ')
    .replace(/[“”„"()[\]{}]/g, ' ')
    .replace(/[.,!?;:]+(?=\s|$)/g, ' ')
    .replace(/[–—]/g, ' ');
  const toks = clean.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i] as string;
    const next = (toks[i + 1] ?? '').replace(/'.*$/, '');
    if (w === "can't" || w === 'cannot') out.push('cannot');
    else if (w === "won't") out.push('will', 'not');
    else if (w === "shan't") out.push('shall', 'not');
    else if (/n't$/.test(w)) out.push(w.slice(0, -3), 'not');
    else if (/'ll$/.test(w)) out.push(w.slice(0, -3), 'will');
    else if (/'ve$/.test(w)) out.push(w.slice(0, -3), 'have');
    else if (/'re$/.test(w)) out.push(w.slice(0, -3), 'are');
    else if (/'m$/.test(w)) out.push(w.slice(0, -2), 'am');
    else if (/'d$/.test(w)) out.push(w.slice(0, -2), next === 'better' || isParticiple(next) ? 'had' : 'would');
    else if (w === "let's") out.push('let', 'us');
    else if (/'s$/.test(w)) {
      const stem = w.slice(0, -2);
      if (PRONOUN_S.has(stem) || next === 'been' || next === 'got') out.push(stem, next === 'been' || next === 'got' ? 'has' : 'is');
      else out.push(w);
    } else out.push(w);
  }
  // Ein frei stehendes 'd, 's, 'll … (I 'd checked) hinterlässt ein leeres Wort.
  return out.filter(Boolean);
}

/** Steht das Schlüsselwort unverändert in den Wörtern? Ein Bindestrich-Wort (two-day) enthält es als Teil, wenn der Teil genau dem Schlüsselwort entspricht. */
export const hasKey = (toks: readonly string[], key: string): boolean => {
  const k = key.toLowerCase();
  return toks.some((t) => t === k || t.split('-').includes(k));
};

/** Normalform als Text (Wörter mit einem Leerzeichen). */
export const kwtText = (raw: string): string => kwtWords(raw).join(' ');

/** Wortzahl nach Cambridge-Zählung. */
export const kwtCount = (raw: string): number => kwtWords(raw).length;
