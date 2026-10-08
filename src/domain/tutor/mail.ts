import { z } from 'zod';
import situationsRaw from '../../content/c1/mail-situations.json?raw';
import { logError } from '../../platform/diagnostics';
import { clip } from '../../prompts/common';
import type { C1Mail, MailVars } from '../../prompts/c1Mail';
import { MAIL_PHRASES_MAX, MAIL_PATTERNS_MAX, MAIL_SITUATION_MAX, MAIL_TEXT_MAX } from '../../prompts/c1Mail';
import { weekStart, type C1Prod } from '../c1/c1doc';
import type { ProdInput } from '../c1/prod';
import { isoWeek } from '../date';
import { patternById } from '../grammar/patterns';
import { outId, type OutItem } from '../nbdrill/outDoc';
import type { NewRepair } from '../repair/repair';
import { hash32 } from '../random';
import { usesChunk } from '../text/chunkMatch';
import { wordCount } from '../text/textStats';
import { errorCount, MAIL_REPAIR_CAP, repairsFromEdits } from './edits';
import { patListText } from './patList';

// Schreibwerkstatt, die reinen Teile (Lernplattform 3.0 P47, KI-Tutor T6): die 12 Situationen, die Auswahl, die lokale Checkliste beim Tippen, die Variablen der
// Vorlage `c1-mail@1`, die Speicherformen (`out/<Monat>` mit `k: 'c1mail'`, Fehlersätze mit `src: 'write'`, K7-Eintrag) und der Wochenvorschlag am Laptop.
// Nichts davon schreibt selbst; geschrieben wird in `features/tutor/mailSave.ts`.

// ---------------------------------------------------------------- Inhalt

const Bi = z.object({ en: z.string().min(20), de: z.string().min(20) });
const PatternRef = z.object({ id: z.string().min(3), re: z.string().min(3), ex: z.string().min(10), no: z.string().min(5) });
const SituationSchema = z.object({
  id: z.string().regex(/^ms\d{2}$/),
  ch: z.number().int().min(1).max(7),
  to: z.string().min(3),
  sit: z.string().min(3),
  brief: Bi,
  patterns: z.array(PatternRef).length(3),
  phrases: z.array(z.string().min(3)).length(4),
});
const FileSchema = z.object({ v: z.literal(1), items: z.array(SituationSchema).min(12) });
export type MailSituation = z.infer<typeof SituationSchema>;

let cache: readonly MailSituation[] | null = null;

/** Die Situationen (leer, wenn die Datei ungültig ist; das wird protokolliert, die Oberfläche zeigt dann keine Schreibwerkstatt). */
export function mailSituations(): readonly MailSituation[] {
  if (cache) return cache;
  try {
    const r = FileSchema.safeParse(JSON.parse(situationsRaw));
    if (!r.success) logError('mail:situations', r.error, 'mail-situations.json');
    cache = r.success ? r.data.items : [];
  } catch (err) {
    logError('mail:situations', err, 'mail-situations.json');
    cache = [];
  }
  return cache;
}

/**
 * Situation für diese Woche: aus dem Kapitel (`chapter` = 1 bis 7), bevorzugt die zu einer Situationsart aus „Mein Arbeitsalltag“ (`sit`), sonst irgendeine des
 * Kapitels; je ISO-Woche eine feste Wahl (`shift` blättert weiter, „Andere Situation“). Ohne Kapitel (kein Programm) aus allen.
 */
export function pickSituation(i: { chapter: number | null; sit: readonly string[]; week: string; shift?: number }): MailSituation | null {
  const all = mailSituations();
  if (!all.length) return null;
  const inCh = i.chapter ? all.filter((s) => s.ch === i.chapter) : [];
  const pool = inCh.length ? inCh : all;
  const wanted = new Set(i.sit.map((s) => s.toLowerCase()));
  const liked = pool.filter((s) => wanted.has(s.sit.toLowerCase()));
  const list = liked.length ? liked : pool;
  const base = hash32(`${i.week}|${i.chapter ?? 0}`) % list.length;
  return list[(base + (i.shift ?? 0) + list.length * 4) % list.length] ?? null;
}

// ---------------------------------------------------------------- Checkliste (lokal, beim Tippen)

function reOf(source: string): RegExp | null {
  try {
    return new RegExp(source, 'i');
  } catch (err) {
    logError('mail:pattern', err, source);
    return null;
  }
}

export type ChecklistItem = { id: string; ok: boolean };

/** Vermutlich benutzte Kapitelmuster (nur Anzeige beim Tippen; das Urteil, ob richtig benutzt, gibt Claude). */
export function seenPatterns(text: string, s: MailSituation): ChecklistItem[] {
  return s.patterns.map((p) => ({ id: p.id, ok: !!reOf(p.re)?.test(text) }));
}

/** Benutzte Wendungen (beugungstolerant wie bei den Karten, `usesChunk`). */
export function seenPhrases(text: string, s: MailSituation): ChecklistItem[] {
  return s.phrases.map((p) => ({ id: p, ok: usesChunk(text, p) }));
}

// ---------------------------------------------------------------- Aufruf

export const MAIL_MIN_WORDS = 40;
export const MAIL_GOAL_WORDS: readonly [number, number] = [120, 180];
export const MAIL_MAX_CHECKS = 3;

export type MailGuard = { words: number; chars: number; tooLong: boolean; tooShort: boolean };

/** Darf der Text abgeschickt werden? Mehr als 1.800 Zeichen nie; unter 40 Wörtern lohnt es nicht (zu wenig für den Genauigkeitswert). */
export function mailGuard(text: string): MailGuard {
  const chars = Array.from(text.trim()).length;
  const words = wordCount(text);
  return { words, chars, tooLong: chars > MAIL_TEXT_MAX, tooShort: words < MAIL_MIN_WORDS };
}

/** Variablen der Vorlage. `ctx` ist die Berufsprofil-Zeile (`tutorCtx`). */
export function mailVars(i: { situation: MailSituation; text: string; ctx: string; uiLang: 'de' | 'en' }): MailVars {
  const patterns = i.situation.patterns.slice(0, MAIL_PATTERNS_MAX).flatMap((p) => {
    const pat = patternById(p.id);
    return pat ? [{ id: pat.id, name: pat.name.en, form: pat.form.en }] : [];
  });
  return {
    situation: clip(`${i.situation.brief.en} (Reader: ${i.situation.to}.)`, MAIL_SITUATION_MAX),
    patterns,
    phrases: i.situation.phrases.slice(0, MAIL_PHRASES_MAX),
    text: i.text.trim(),
    uiLang: i.uiLang,
    ctx: clip(i.ctx, 200),
    pats: patListText(),
  };
}

/**
 * Fehler dieses Textes für K7: Claude zählt zweimal (die belegte Fehlerliste und eine unabhängige Nachzählung `errorCount` in derselben Antwort), der
 * Mittelwert gilt (halbe Werte möglich). Fehlt die Nachzählung oder ist sie unplausibel (mehr als doppelt so hoch + 3), zählt allein die Liste.
 */
export function mailErrors(out: C1Mail): number {
  const listed = errorCount(out.edits);
  const second = out.errorCount;
  if (second === null || second > listed * 2 + 3) return listed;
  return Math.round(((listed + second) / 2) * 2) / 2;
}

export type MailRun = {
  situation: MailSituation;
  text: string;
  out: C1Mail;
  now: number;
  /** Lerntag (`dayKey`, Wechsel 04:00). */
  day: string;
  pasted: boolean;
  /** Kennung des Textes (die erste Prüfung legt sie fest; Überarbeitungen behalten sie). */
  id: string;
  /** Wievielte Prüfung dieses Textes (1 bis 3). Nur die erste zählt für K7 und legt Fehlersätze an. */
  check: number;
};

export const newMailId = (now: number): string => outId('c1mail', now);

/** Eintrag für `out/<Monat>` (`k: 'c1mail'`): der Text (≤ 2 KB) und das Ergebnis, kompakt. Eine Überarbeitung ersetzt denselben Eintrag. */
export function mailOutItem(r: MailRun): OutItem {
  const o = r.out;
  return {
    id: r.id,
    k: 'c1mail',
    d: r.day,
    t: r.now,
    theme: r.situation.id,
    ok: mailErrors(o) === 0,
    text: r.text.trim(),
    fb: { tone: o.tone.fit, gist: o.summary, score: mailErrors(o), e: o.edits.map((e) => [e.from, e.to, e.kind, e.sev]) },
  };
}

/** Höchstens 5 Fehlersätze (`src: 'write'`), nur bei der ersten Prüfung des Textes; fällig ab dem nächsten Lerntag. */
export function mailRepairs(r: MailRun): NewRepair[] {
  if (r.check !== 1) return [];
  return repairsFromEdits(r.text, r.out.edits, 'write', MAIL_REPAIR_CAP, r.situation.sit);
}

/** K7-Eintrag (`addProd`), nur bei der ersten Prüfung (ein Text zählt einmal, sonst würde Überarbeiten die Zahl schönen). Einfügen zählt nie. */
export function mailProd(r: MailRun): ProdInput | null {
  if (r.check !== 1) return null;
  return { d: r.day, s: 'mail', w: wordCount(r.text), e: mailErrors(r.out), pasted: r.pasted };
}

/** Wochenvorschlag am Laptop: einmal je ISO-Woche, solange diese Woche noch keine Wochen-Mail in `app/c1.prod` steht und der Vorschlag nicht erledigt wurde. */
export function mailOffered(i: { today: string; prod: readonly C1Prod[]; done: string | null }): boolean {
  if (i.done === isoWeek(i.today)) return false;
  const from = weekStart(i.today);
  return !i.prod.some((p) => p.s === 'mail' && p.d >= from && p.d <= i.today);
}
