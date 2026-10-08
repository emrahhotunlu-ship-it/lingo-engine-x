import type { ClinicOut, ClinicVars } from '../../prompts/sentenceClinic';
import { CLINIC_CTX_MAX, CLINIC_PURPOSE_MAX, CLINIC_SENTENCE_MAX } from '../../prompts/sentenceClinic';
import { clip } from '../../prompts/common';
import { weekStart, type C1Prod } from '../c1/c1doc';
import type { ProdInput } from '../c1/prod';
import { isoWeek } from '../date';
import { outId, type OutItem } from '../nbdrill/outDoc';
import type { NewRepair } from '../repair/repair';
import { CLINIC_REPAIR_CAP, errorCount, errorEdits, normWs, ownWords, repairsFromEdits } from './edits';
import { patListText } from './patList';

// Satz-Klinik, die reinen Teile (Lernplattform 3.0 P46, KT T4): Eingabe, Ergebnis → Speicherformen (`out/<Monat>`, Fehlersätze, K7-Eintrag) und
// der Wochenvorschlag am Handy. Nichts davon schreibt selbst; geschrieben wird in `features/tutor/clinicSave.ts`.

export const CLINIC_MIN_WORDS = 3;

/** Satz für den Aufruf bereinigen (Leerraum, Länge); `null`, wenn er zu kurz ist. */
export function cleanSentence(raw: string): string | null {
  const s = clip(raw, CLINIC_SENTENCE_MAX);
  return ownWords(s) >= CLINIC_MIN_WORDS ? s : null;
}

/** Variablen der Vorlage. `ctx` ist die Berufsprofil-Zeile (`tutorCtx`). */
export function clinicVars(i: { sentence: string; purpose: string; ctx: string; uiLang: 'de' | 'en' }): ClinicVars {
  return {
    sentence: clip(i.sentence, CLINIC_SENTENCE_MAX),
    purpose: clip(i.purpose, CLINIC_PURPOSE_MAX),
    uiLang: i.uiLang,
    ctx: clip(i.ctx, CLINIC_CTX_MAX),
    pats: patListText(),
  };
}

/** Fehler dieses Satzes für K7: belegte Fehlerstellen; ein Satz, den Claude nicht für richtig hält, zählt mindestens einen (belegte Stellen können weggefallen sein). */
export function clinicErrors(out: ClinicOut): number {
  const n = errorCount(out.edits);
  return out.verdict === 'correct' ? 0 : Math.max(1, n);
}

/** Farbe des Urteils (R5 K5): Gold („fast richtig“) nur, wenn alle Fehler Tipp- oder Zeichensetzungsfehler sind; ein echter Grammatik- oder Wortfehler bekommt die Fehlerfarbe, auch wenn Claude „minor“ sagt. */
export type ClinicTone = 'ok' | 'near' | 'wrong';
const SLIP_KINDS: ReadonlySet<string> = new Set(['spelling', 'punctuation']);
export function clinicTone(out: Pick<ClinicOut, 'verdict' | 'edits'>): ClinicTone {
  if (out.verdict === 'correct') return 'ok';
  if (out.verdict === 'wrong') return 'wrong';
  const errs = errorEdits(out.edits);
  return errs.length > 0 && errs.every((e) => SLIP_KINDS.has(e.kind)) ? 'near' : 'wrong';
}

export type ClinicRun = {
  sentence: string;
  purpose: string;
  out: ClinicOut;
  now: number;
  /** Lerntag (`dayKey`, Wechsel 04:00). */
  day: string;
  pasted: boolean;
  translated: boolean;
  /** Überarbeitung eines Satzes dieser Sitzung (≥ 70 % gleiche Wörter): Ergebnis und Fehlersätze ja, K7-Eintrag nein. */
  revised: boolean;
};

/** Eintrag für `out/<Monat>` (`k: 'clinic'`): Satz, Urteil, Fassungen; kompakt, damit er unter 2 KB bleibt. */
export function clinicOutItem(r: ClinicRun): OutItem {
  const o = r.out;
  return {
    id: clinicId(r.now),
    k: 'clinic',
    d: r.day,
    t: r.now,
    ...(r.purpose ? { theme: r.purpose } : {}),
    ok: o.verdict === 'correct',
    text: r.sentence,
    fb: { verdict: o.verdict, fixed: o.fixed, better: o.better, tone: o.register, e: o.edits.map((e) => [e.from, e.to, e.kind, e.sev]) },
  };
}

/** Höchstens 2 Fehlersätze (`src: 'clinic'`), sichtbar ab dem nächsten Lerntag (`addRepairs` setzt die Fälligkeit auf morgen). */
export function clinicRepairs(r: ClinicRun): NewRepair[] {
  if (r.out.verdict === 'correct') return [];
  return repairsFromEdits(r.sentence, r.out.edits, 'clinic', CLINIC_REPAIR_CAP, r.purpose || null);
}

/** K7-Eintrag (`addProd`); Einfügen und Übersetzer-Nutzung zählen nie (`prodEntry` lehnt sie ab). */
export function clinicProd(r: ClinicRun): ProdInput | null {
  if (r.revised) return null;
  return { d: r.day, s: 'clinic', w: ownWords(r.sentence), e: clinicErrors(r.out), pasted: r.pasted, translated: r.translated, id: clinicId(r.now) };
}

/** Kennung des Satzes (gleich dem `out`-Eintrag und dem K7-Eintrag). */
export const clinicId = (now: number): string => outId('clinic', now);

export type RecentClinic = { sentence: string; fixed: string; better: string };
export const REVISION_OVERLAP = 0.7;

const tokens = (s: string): Set<string> => new Set(normWs(s).toLowerCase().match(/[\p{L}\p{N}]+(?:'[\p{L}]+)?/gu) ?? []);

/**
 * Ist der Satz eine Überarbeitung eines Satzes (oder seiner korrigierten/C1-Fassung) dieser Sitzung? Ja, wenn mindestens 70 % seiner (verschiedenen) Wörter
 * dort vorkommen. Rein. Überarbeitungen zählen nicht noch einmal für K7 (sonst würde Umformulieren die Genauigkeitszahl schönen).
 */
export function isRevision(sentence: string, recent: readonly RecentClinic[]): boolean {
  const mine = tokens(sentence);
  if (mine.size < 3) return false;
  return recent.some((r) =>
    [r.sentence, r.fixed, r.better].some((t) => {
      if (!t.trim()) return false;
      const other = tokens(t);
      let same = 0;
      for (const w of mine) if (other.has(w)) same++;
      return same / mine.size >= REVISION_OVERLAP;
    }),
  );
}

/**
 * Wochenvorschlag am Handy (KT T4): einmal je ISO-Woche, solange diese Woche noch keine Satz-Klinik in `app/c1.prod` steht und der Vorschlag nicht
 * für diese Woche zurückgestellt oder schon bedient wurde (`done` = ISO-Woche der letzten Bedienung/Zurückstellung auf diesem Gerät).
 */
export function clinicOffered(i: { today: string; prod: readonly C1Prod[]; done: string | null }): boolean {
  const week = isoWeek(i.today);
  if (i.done === week) return false;
  const from = weekStart(i.today);
  return !i.prod.some((p) => p.s === 'clinic' && p.d >= from && p.d <= i.today);
}
