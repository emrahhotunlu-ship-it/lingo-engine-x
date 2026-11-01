import { addDays, dayKey, daysBetween } from '../shared';
import type { UseErr, UseVerdict } from '../prompts/common';
import type { TransferFrame } from '../prompts/transfer';
import { applyAnswer, type AnswerResult, type PlanCtx } from './planner';
import { hash32 } from './rand';
import type { Lex, LexKind, Outcome } from './types';

// Großpaket A Schritt 5b (plan.md §7 „Anwenden“, Synthese §2.5; Emrahs Antworten 01.11.): Claudes Urteil je Zielwort → Note und Belege.
// Die Note rechnet immer die App, nie Claude:
//  - ok → Good auf Benutzen (nie Easy: kein Zeit-Urteil beim Schreiben) · wrong (falscher Sinn, falsches Wort) → Again, auch auf Verstehen ·
//    odd: Beugung → Hard, Präposition und Kollokation nach M56/M78 je Art, Ton/Register zählt als richtig (außer bei Wendungen: Hard),
//    sonst Hard · thin und nicht benutzt → keine Note · ausgewichen → wie ein Ausweichwort (M41: erstes ohne Note, das zweite gleiche Hard).
//  - Anwenden ersetzt die Wiederholung der gewählten Wörter (Termin in 1–3 Tagen), aber startet keine Wiederkehr in derselben Runde: die
//    Lernschritte bleiben, wie sie waren. Der eigene Satz behält die Wiederkehr nach Fehler (eine Karte, ein Wort).
//  - Belege für Stufe 7 (`ev.o` geschrieben, `ev.s` gesprochen; ladder.ts): nur ein von Claude geprüftes `ok`, nur wenn das Wort beim Schreiben
//    mindestens auf Stufe 5 stand, höchstens einmal je Wort und Tag. Gezählt VOR der Buchung, damit 6 → 7 mit derselben Antwort möglich ist.
//  - „Nur Beleg“ (keine passenden Termine) und „Später prüfen lassen“ (ohne Claude geschrieben, später geprüft): nie Planwirkung, nur Belege.
//  - Ohne Claude geprüft gibt es gar nichts (die Oberfläche zeigt Muster und Selbstvergleich).

/** Stufe, ab der ein eigener Satz als Beleg für Stufe 7 zählt (ladder.ts: „2 eigene, geprüfte Sätze ab Stufe 5“). */
export const EV_MIN_LV = 5;
/** Obergrenze der Beleg-Zähler (mehr braucht keine Regel; hält das Dokument klein). */
export const EV_MAX = 9;

/** Ausgang einer geprüften Verwendung; `null` = keine Note (zu dünn, nicht benutzt). */
export function outcomeOfUse(v: UseVerdict, err: UseErr | null, k: LexKind, evade: boolean): Outcome | null {
  switch (v) {
    case 'ok':
      return 'ok';
    case 'wrong':
      return 'other';
    case 'thin':
      return null;
    case 'unused':
      return evade ? 'evade' : null;
    case 'odd':
      switch (err) {
        case 'form':
          return 'infl';
        case 'prep':
          return 'prep';
        case 'colloc':
          return 'colloc';
        case 'register':
          // Ton daneben, Wort und Sinn sicher: zählt als richtig; bei einer Wendung ist der Ton Teil des Lexems.
          return k === 'ch' ? 'odd' : 'ok';
        default:
          return 'odd';
      }
  }
}

export type UseInput = {
  t: number;
  form: 'transfer' | 'own';
  v: UseVerdict;
  err: UseErr | null;
  /** Fundstelle (bei „ausgewichen“ das Ersatzwort, bei „falsch“ das verwechselte Wort). */
  at: string;
  evade: boolean;
  spoken: boolean;
  /** Stufe des Worts beim Schreiben (bei „später prüfen“ gemerkt; sonst `lex.lv`). */
  lvAt: number;
  /** Ohne Planwirkung: „nur Beleg“ oder „später geprüft“. */
  evidenceOnly: boolean;
  /** Heute schon ein Beleg für dieses Wort gezählt (die Sitzung bzw. die Liste „später prüfen“ weiß es). */
  evDone?: boolean;
};

export type UseResult = AnswerResult & { ev: 'o' | 's' | null };

/** Zählt diese Verwendung als Beleg für Stufe 7? (`s` = auch gesprochen) */
export function evidenceOf(lex0: Lex, u: UseInput): 'o' | 's' | null {
  if (u.v !== 'ok' || u.lvAt < EV_MIN_LV || u.evDone) return null;
  // Im Lernfluss höchstens einmal je Tag: hat das Wort heute schon gebucht, war es heute schon dran (zweiter eigener Satz am Tag zählt nicht).
  if (!u.evidenceOnly && lex0.day === dayKey(u.t)) return null;
  return u.spoken ? 's' : 'o';
}

const noEffect = (lex: Lex, ev: UseResult['ev']): UseResult => ({ lex, grade: null, booked: [], note: 0, track: 0, events: [], speed: null, ev });

/** Urteil je Zielwort anwenden: Belege, dann (mit Planwirkung) die Buchung über den Planer. Rein. */
export function applyUse(lex0: Lex, u: UseInput, ctx: PlanCtx): UseResult {
  const ev = evidenceOf(lex0, u);
  let lex = lex0;
  if (ev) {
    lex = { ...lex0, ev: { f: [...lex0.ev.f], o: Math.max(lex0.ev.o, Math.min(EV_MAX, lex0.ev.o + 1)), s: ev === 's' ? Math.max(lex0.ev.s, Math.min(EV_MAX, lex0.ev.s + 1)) : lex0.ev.s }, sync: Math.max(lex0.sync, u.t) };
  }
  const outcome = u.evidenceOnly ? null : outcomeOfUse(u.v, u.err, lex.k, u.evade);
  if (outcome === null) return noEffect(lex, ev);
  // Verwechslung mit einem anderen Wort → Kontrastkarte (M14); ein falscher Sinn desselben Worts braucht keine.
  const hit = u.at && (outcome === 'evade' || (outcome === 'other' && u.err === 'word')) ? u.at : null;
  const r = applyAnswer(lex, { t: u.t, form: u.form, outcome, hint: 0, ms: 0, fk: 0, sentence: null, speed: null, hit }, ctx);
  // Anwenden: keine Wiederkehr in derselben Runde (mehrere Wörter, ein Text); der Lernstand der Schritte bleibt.
  const out = u.form === 'transfer' ? { ...r.lex, step: lex0.step ? { ...lex0.step } : null } : r.lex;
  return { ...r, lex: out, ev };
}

// ---------- Rahmen und Lage (plan.md §7: Mail, Slack, Call, Präsentation im Wechsel, einmal pro Woche Alltag)

const WORK: readonly TransferFrame[] = ['mail', 'slack', 'call', 'pitch'];
/** Ein Montag: Wochenbeginn und fester Wechsel ohne Zufall. */
const ANCHOR = '2026-01-05';
/** Ab Freitag (Mo = 0) kommt der Alltag, wenn er diese Woche noch nicht dran war. */
const LIFE_FROM_DOW = 4;

/** Wochenbeginn (Montag) eines Lerntags. */
export function weekStartOf(day: string): string {
  const idx = daysBetween(ANCHOR, day);
  return addDays(day, -(((idx % 7) + 7) % 7));
}

/** Rahmen des Tages: fester Wechsel der Arbeits-Textsorten; einmal pro Woche (ab Freitag, falls noch nicht) Alltag. */
export function frameFor(day: string, lastLife: string | null): TransferFrame {
  const idx = daysBetween(ANCHOR, day);
  const dow = ((idx % 7) + 7) % 7;
  if (dow >= LIFE_FROM_DOW && (lastLife === null || lastLife < weekStartOf(day))) return 'life';
  return WORK[((idx % WORK.length) + WORK.length) % WORK.length]!;
}

/** Index der Lage (Texte in i18n) für Rahmen und Tag: fest je Tag, wechselt von Tag zu Tag. */
export function situationFor(frame: TransferFrame, day: string, count: number): number {
  return count > 0 ? hash32(`${frame}:${day}`) % count : 0;
}
