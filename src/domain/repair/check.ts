import { toUS } from '../answer/spelling';
import { repairNorm, type RepairItem } from './repair';

// Lokale Prüfung eines neu formulierten Reparatur-Satzes (Lernberatung 27.09., V2). Rein.
// Richtig, wenn der Satz nach `repairNorm` der besseren Fassung gleicht oder höchstens 1–2
// kleine Abweichungen (Wörter) hat UND jede korrigierte Stelle stimmt. Britische Formen zählen
// als richtig (A7.3). Sagt die lokale Prüfung nein, darf die KI nachsehen (repair-check@1).

/** Eindeutige Kurzformen ausschreiben („we've“ = „we have“); 's und 'd bleiben (mehrdeutig). */
const expand = (n: string): string =>
  n
    .replace(/\bcan't\b/g, 'cannot')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/n't\b/g, ' not')
    .replace(/'ve\b/g, ' have')
    .replace(/'re\b/g, ' are')
    .replace(/'ll\b/g, ' will')
    .replace(/\bi'm\b/g, 'i am')
    .replace(/\bcan not\b/g, 'cannot');

const NUM: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12', fifteen: '15', twenty: '20', fifty: '50' };
const PARTICIPLE = /^(?:\w+ed|been|got|gotten|had|gone|done|made|seen|taken|given|known|written|sent|chosen|spoken|broken|told|left|met|paid|heard|found|thought|bought|brought|sold|spent|lost|built)$/;
/** Grundformen auf -ed: nach „'d“ steht „would“ („we'd need“), nie „had“. */
const BASE_ED = new Set(['need', 'proceed', 'succeed', 'exceed', 'feed', 'speed', 'bleed', 'breed', 'seed', 'bed', 'red']);
const ADVERBS = '(?:already|never|just|also|not|ever|still|probably|really)';
/** Hauptwörter auf -ing: „the meeting's pricing“ ist kein „is“. */
const ING_NOUNS = '(?:meeting|morning|evening|thing|pricing|marketing|building|bring|spring|during|training|ceiling|string|king|ring|wing|sing)';

/**
 * Schreibweisen angleichen, bevor Wörter verglichen werden (Gegenlesung FK): p.m./pm/PM, 10 %/10 percent/ten percent/10 per cent, Akzente (café = cafe),
 * „'s“ vor einer -ing-Form = „is“ („the customer's calling“, nicht „let's“ und nicht vor Hauptwörtern wie „meeting“), „'d“ vor einem Partizip = „had“
 * (Adverbien wie „never“ werden übersprungen; „you'd better“ = „had better“), sonst „would“ („we'd already have“, „we'd need“).
 */
function prepare(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\bper\s+cent\b/gi, 'percent')
    .replace(/(\d)\s*%/g, '$1 percent')
    .replace(/(\d)\s*([ap])\.?\s?m\b\.?/gi, '$1 $2m')
    .replace(new RegExp(`(?<!\\blet)(?<=\\w)['’]s(?=\\s+(?!${ING_NOUNS}\\b)\\w+ing\\b)`, 'gi'), ' is')
    .replace(new RegExp(`(?<=\\w)['’]d((?:\\s+${ADVERBS})*)(\\s+\\w+)?`, 'gi'), (_m, advs: string | undefined, rest: string | undefined) => {
      const next = rest?.trim().toLowerCase() ?? '';
      const had = next === 'better' || (PARTICIPLE.test(next) && !BASE_ED.has(next));
      return ` ${had ? 'had' : 'would'}${advs ?? ''}${rest ?? ''}`;
    });
}

const words = (s: string): string[] => {
  const n = expand(repairNorm(prepare(s)));
  return n ? n.split(' ').map((w) => toUS(NUM[w] ?? w)) : [];
};

/** Abstand in Wörtern (Einfügen, Löschen, Ersetzen). */
export function wordDistance(a: readonly string[], b: readonly string[]): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length]!;
}

/** Wörter der besseren Fassung, die im falschen Satz fehlen: die korrigierte Stelle. */
function changedWords(wrong: readonly string[], right: readonly string[]): string[] {
  const pool = new Map<string, number>();
  for (const w of wrong) pool.set(w, (pool.get(w) ?? 0) + 1);
  const out: string[] = [];
  for (const w of right) {
    const n = pool.get(w) ?? 0;
    if (n > 0) pool.set(w, n - 1);
    else out.push(w);
  }
  return out;
}

const containsSeq = (hay: readonly string[], needle: readonly string[]): boolean => {
  if (!needle.length) return true;
  for (let i = 0; i + needle.length <= hay.length; i++) if (needle.every((w, k) => hay[i + k] === w)) return true;
  return false;
};

export type LocalVerdict = 'exact' | 'close' | 'no';

/** Unverändert (Rückmeldung 19.10.2026): Die Antwort ist nach der Vereinheitlichung der falsche Satz selbst. Nie bestanden, nie „Fast richtig“. */
export function isUnchanged(given: string, wrong: string): boolean {
  const g = words(given);
  return g.length > 0 && g.join(' ') === words(wrong).join(' ');
}

export function checkRepairLocal(given: string, item: Pick<RepairItem, 'wrong' | 'right' | 'fix'>): LocalVerdict {
  const g = words(given);
  const r = words(item.right);
  const w = words(item.wrong);
  if (!g.length) return 'no';
  if (g.join(' ') === r.join(' ')) return 'exact';
  if (g.join(' ') === w.join(' ')) return 'no';
  const dist = wordDistance(g, r);
  const allowed = r.length >= 6 ? 2 : 1;
  if (dist > allowed) return 'no';
  // Näher an der alten als an der besseren Fassung: der Fehler steckt noch drin.
  if (wordDistance(g, w) <= dist) return 'no';
  // Die korrigierte Stelle muss stimmen.
  const fix = Array.isArray(item.fix) ? item.fix.filter((f): f is string => typeof f === 'string') : [];
  if (fix.length) return fix.every((f) => containsSeq(g, words(f))) ? 'close' : 'no';
  const changed = changedWords(w, r);
  return changed.every((c) => g.includes(c)) ? 'close' : 'no';
}
