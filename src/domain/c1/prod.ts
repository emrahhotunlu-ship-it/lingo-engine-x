import { addDays, isDayKey } from '../date';
import { patchC1, weekStart, type C1Doc, type C1Prod, type PatchResult } from './c1doc';

// Produktionsmengen für K7 „Genauigkeit in eigener Produktion“ (Lernplattform 3.0 §4.5, P44). Die EINZIGE Stelle, die `app/c1.prod[]` schreibt
// (§10 „Gemeinsame Schreiber“). Quellen sind Wochen-Mail (P47), Satz-Klinik (P46) und Rollenspiel-Analyse (P51); bis dahin gibt es keinen Eintrag
// und K7 zeigt „zu wenig Daten“. Verdichtung (älter als 8 Wochen → Wochensummen) und Kappung (≤ 150) macht `c1Update` beim Schreiben.
//
// Ein Eintrag: `w` = Wörter des EIGENEN Textes (nur Emrahs Wörter, nicht Claudes Korrektur), `e` = Stellen mit `sev: 'error'` als Mittelwert
// aus Claudes zwei Zählungen (halbe Werte möglich). Stil-Verbesserungen zählen nie: Der Aufrufer übergibt nur die Fehlerzahl, `addProd`
// nimmt keine Stilzahl an. Eingefügte Texte (Paste) und Texte mit Übersetzer-Nutzung werden abgelehnt.

export const PROD_SOURCES = ['mail', 'clinic', 'talk'] as const;
export type ProdSource = (typeof PROD_SOURCES)[number];

/** Datenmindestmenge für eine K7-Zahl (§4.5) und das Fenster in Wochen. */
export const PROD_MIN = { words: 600, entries: 6, weeks: 3 } as const;
export const PROD_WINDOW_WEEKS = 8;
/** Plausibilitätsgrenze je Eintrag (ein Text mit mehr Wörtern ist kein Schreibanlass dieser App). */
export const PROD_MAX_WORDS = 3000;

export type ProdInput = {
  d: string;
  s: ProdSource;
  /** Wörter des eigenen Textes. */
  w: number;
  /** Fehler (`sev: 'error'`), Mittelwert aus zwei Zählungen. */
  e: number;
  /** Text ganz oder teilweise eingefügt: zählt nie. */
  pasted?: boolean;
  /** Übersetzer genutzt: zählt nie. */
  translated?: boolean;
};

/** Halbe Fehler sind erlaubt (Mittelwert zweier Zählungen); alles andere wird auf 0,5 gerundet. */
const halves = (n: number): number => Math.round(n * 2) / 2;

/** Eintrag prüfen und normalisieren; `null` = zählt nicht (Paste, Übersetzer, ungültig). Rein. */
export function prodEntry(i: ProdInput): C1Prod | null {
  if (i.pasted === true || i.translated === true) return null;
  if (!isDayKey(i.d) || !(PROD_SOURCES as readonly string[]).includes(i.s)) return null;
  if (!Number.isFinite(i.w) || !Number.isFinite(i.e)) return null;
  const w = Math.round(i.w);
  const e = halves(i.e);
  if (w < 1 || w > PROD_MAX_WORDS || e < 0 || e > w) return null;
  return { d: i.d, s: i.s, w, e };
}

/** Änderung für `patchC1`: Eintrag anhängen (sortiert nach Tag). `null`, wenn er nicht zählt. Rein. */
export function addProdTo(doc: C1Doc, i: ProdInput): C1Doc | null {
  const entry = prodEntry(i);
  if (!entry) return null;
  const prod = [...doc.prod, entry].sort((a, b) => a.d.localeCompare(b.d));
  return { ...doc, prod };
}

/** Eintrag speichern (über `patchC1` → `writer.transform`). Nie geworfen. */
export async function addProd(i: ProdInput, now: number = Date.now()): Promise<PatchResult | 'ignored'> {
  if (!prodEntry(i)) return 'ignored';
  return patchC1((doc) => addProdTo(doc, i), now);
}

export type ProdRate = {
  /** `few` = unter der Mindestmenge (K7 „zu wenig Daten“). */
  state: 'few' | 'ok';
  words: number;
  errors: number;
  entries: number;
  weeks: number;
  /** Fehler je 100 Wörter (eine Nachkommastelle); auch bei `few` gerechnet, aber nie als Urteil gezeigt. */
  rate: number | null;
};

/**
 * Fehler je 100 Wörter der letzten `weeks` Wochen bis einschließlich `day`. Eine verdichtete Wochensumme zählt als EIN Eintrag (vorsichtig:
 * die Mindestzahl an Einträgen wird dadurch eher später erreicht). Rein; mit einem Check-Tag als `day` ergibt sich der Wert dieses Tages.
 */
export function prodRate(prod: readonly C1Prod[], day: string, weeks: number = PROD_WINDOW_WEEKS): ProdRate {
  const from = addDays(day, -weeks * 7 + 1);
  let words = 0;
  let errors = 0;
  let entries = 0;
  const wk = new Set<string>();
  for (const p of prod) {
    if (!isDayKey(p.d) || p.d < from || p.d > day) continue;
    if (!Number.isFinite(p.w) || !Number.isFinite(p.e) || p.w <= 0 || p.e < 0) continue;
    words += p.w;
    errors += p.e;
    entries++;
    wk.add(weekStart(p.d));
  }
  const rate = words > 0 ? Math.round((errors / words) * 1000) / 10 : null;
  const few = words < PROD_MIN.words || entries < PROD_MIN.entries || wk.size < PROD_MIN.weeks;
  return { state: few ? 'few' : 'ok', words, errors: halves(errors), entries, weeks: wk.size, rate };
}
