import { alignWords, bridgeNeedsFix, outId, repairNorm } from '../shared';
import type { BridgeOut, BridgeTarget, NewRepair, OutItem, PatVerdict } from '../shared';

// Ergebnis eines Brücken-Satzes (P4): Zeichen je Element, Gesamturteil und die Speicherformen. Rein.
//  - Zwei getrennte Zeichen (Wort, Muster): ✓ richtig · ✕ Fehler · – zählt nicht bzw. nicht sicher geprüft. Farbe nie allein, immer mit Wort.
//  - Gesamturteil der Karte: richtig nur, wenn beide richtig sind und kein weiterer Fehler da ist; falsch, sobald ein Element falsch ist.
//  - `out/<Monat>` (Art `bridge`): Satz, Urteile, Muster, Schreibzeit; `theme` = Wort-Kennung (für die 14-Tage-Sperre).
//  - Fehlersatz (`app/repair`): nur bei einem belegten Fehler mit anderer, richtiger Fassung; mit Muster (wenn das Muster falsch war), Situation und den
//    korrigierten Stellen (`fix`, Teilstücke der richtigen Fassung für die lokale Prüfung).
//  - Rückfluss an Wörter-App und Grammatik ist abschaltbar: `app/profile.acfg.rf = 0` (Notbremse in der Datenbank, gilt auf allen Geräten).

type Doc = Readonly<Record<string, unknown>>;

export type Mark = 'ok' | 'bad' | 'open';

export const wordMark = (v: BridgeOut['word']['v']): Mark => (v === 'ok' ? 'ok' : v === 'odd' || v === 'wrong' ? 'bad' : 'open');
export const patMark = (v: PatVerdict): Mark => (v === 'ok' ? 'ok' : v === 'wrong' ? 'bad' : 'open');

export type BridgeVerdict = 'ok' | 'near' | 'wrong';

/** Gesamturteil: beide richtig und kein weiterer Fehler → richtig; ein Element falsch → falsch; sonst (zählt nicht, vermieden, unsicher, Zusatzfehler) → fast. */
export function bridgeVerdict(o: Pick<BridgeOut, 'word' | 'pat' | 'extra'>): BridgeVerdict {
  const w = wordMark(o.word.v);
  const p = patMark(o.pat.v);
  if (w === 'bad' || p === 'bad') return 'wrong';
  return w === 'ok' && p === 'ok' && !o.extra ? 'ok' : 'near';
}

/** Gibt es eine bessere Fassung zum Vergleichen? Nur bei einem Fehler, mit einer Fassung, die sich vom eigenen Satz unterscheidet. */
export function hasFix(o: BridgeOut, sentence: string): boolean {
  const fixed = o.fixed.trim();
  return bridgeNeedsFix(o) && !!fixed && repairNorm(fixed) !== repairNorm(sentence);
}

export type BridgeRun = {
  day: string;
  /** Zeitpunkt der Prüfung (ms): Kennung des Ergebnisses und Idempotenz-Schlüssel des Rückflusses. */
  now: number;
  target: BridgeTarget;
  sentence: string;
  out: BridgeOut;
  /** Schreibzeit bis zum Prüfen in ms. */
  ms: number;
};

/** Eintrag für `out/<Monat>`: idempotent über die Kennung (Art + Zeit der Prüfung). */
export function bridgeOutItem(r: BridgeRun): OutItem {
  const o = r.out;
  const fb: Record<string, unknown> = { w: o.word.v, p: o.pat.v, pat: r.target.pat, wd: r.target.word.word, lv: r.target.word.lv, s: r.target.slot };
  if (o.word.err) fb.we = o.word.err;
  if (o.fixed.trim()) fb.fixed = o.fixed.trim();
  if (o.keep.trim()) fb.keep = o.keep.trim();
  if (o.extra) fb.x = [o.extra.from, o.extra.to];
  return { id: outId('bridge', r.now), k: 'bridge', d: r.day, t: r.now, theme: r.target.word.key, ok: bridgeVerdict(o) === 'ok', text: r.sentence.trim(), fb, ms: r.ms };
}

const edge = (s: string): string => s.replace(/^[\s.,;:!?"“”„'‘’()]+|[\s.,;:!?"“”„'‘’()]+$/g, '');

/** Die korrigierten Stellen: zusammenhängende ersetzte oder ergänzte Wörter der richtigen Fassung (höchstens 6). */
export function fixSpans(given: string, fixed: string): string[] {
  const out: string[] = [];
  let run: string[] = [];
  const flush = (): void => {
    const s = edge(run.join(' '));
    if (s && !out.includes(s)) out.push(s);
    run = [];
  };
  for (const op of alignWords(given, fixed)) {
    // `del` = ein Wort der richtigen Fassung fehlt im eigenen Satz, `sub`/`typo` = ersetzt; `ins` (überzähliges eigenes Wort) hat keine Stelle in der Lösung.
    if ((op.op === 'sub' || op.op === 'del' || op.op === 'typo') && op.expected) run.push(op.expected);
    else if (op.op !== 'ins') flush();
  }
  flush();
  return out.slice(0, 6);
}

/** Fehlersatz zu einem Brücken-Satz oder `null`. `ctx` = Situation der Aufgabe (oder das Muster) in der Oberflächensprache. */
export function bridgeRepair(r: BridgeRun, ctx: string | null): NewRepair | null {
  if (!hasFix(r.out, r.sentence)) return null;
  const o = r.out;
  const patWrong = o.pat.v === 'wrong';
  const why = (wordMark(o.word.v) === 'bad' ? o.word.why : '') || (patWrong ? o.pat.why : '') || o.extra?.why || o.word.why || o.pat.why || null;
  const fix = fixSpans(r.sentence.trim(), o.fixed.trim());
  return { wrong: r.sentence.trim(), right: o.fixed.trim(), why, src: 'write', ctx: ctx?.trim() ? ctx.trim() : null, fix: fix.length ? fix : null, pat: patWrong ? r.target.pat : null };
}

/** Ist der Rückfluss eingeschaltet? Standard an; `app/profile.acfg.rf = 0` schaltet ihn aus (Ergebnis und Fehlersatz bleiben). */
export function flowbackOn(profile: Doc | null | undefined): boolean {
  const c = profile?.acfg;
  return !(c && typeof c === 'object' && !Array.isArray(c) && (c as Doc).rf === 0);
}

/** Soll das Wort-Urteil an die Wörter-App gehen? Nicht, wenn das Wort gar nicht vorkam (kein Versuch, kein Ersatzwort). */
export const reportsWord = (o: BridgeOut['word']): boolean => o.v !== 'unused' || !!o.at.trim();
