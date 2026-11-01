import { addDays, dayKey, dayStartOf, daysBetween } from '../shared';
import { FORM_SPEC } from './grade';
import type { Task } from './session';
import type { Lex } from './types';

// Wörter-Modul V3 (plan.md N1, v3-bau.md §3): „Warum heute?“ je Karte, rein gerechnet. Eine Zeile im Menü „…“ (über „Warum diese
// Aufgabe?“ des Übungsgerüsts): warum die Karte jetzt kommt (fällig seit, Lernschritt, neu, Kontrast nach Fehler, freie Übung), dazu
// „zuletzt frei richtig“ und Stufe mit Spur. Macht sichtbar, dass die Reihenfolge nicht willkürlich ist (Emrahs Klage „willkürlich“).
// Texte stehen in src/i18n/parts/vm.*.ts (`vmRs…`); `date` ist ein Tagesschlüssel, die Oberfläche formatiert ihn.

export type ReasonPart = { key: string; vars: Record<string, string> };
export type Reason = { code: string; parts: ReasonPart[] };

const part = (key: string, vars: Record<string, string> = {}): ReasonPart => ({ key, vars });

/** Hauptgrund aus `task.why` (session.ts) und dem Lexem vor der Antwort. */
function mainOf(task: Task, lex: Lex | null, day: string): ReasonPart {
  switch (task.why) {
    case 'new':
      return part('vmRsNew');
    case 'due': {
      const track = FORM_SPEC[task.form].track;
      const due = lex ? (track === 'u' ? lex.u.due : (lex.b?.due ?? lex.u.due)) : null;
      // Vorgezogen (day.ts verteilt Rückstand und füllt Platz): der Termin liegt noch nach heute.
      if (due !== null && due >= dayStartOf(addDays(day, 1))) return part('vmRsAhead', { date: dayKey(due) });
      const late = due === null ? 0 : Math.max(0, daysBetween(dayKey(due), day));
      return late === 0 ? part('vmRsDueToday') : late === 1 ? part('vmRsDue1') : part('vmRsDueN', { n: String(late) });
    }
    case 'step':
      return part('vmRsStep');
    case 'retry':
      return part('vmRsRetry');
    case 'again':
      return part('vmRsAgain');
    case 'contrast':
      return lex?.ct?.w ? part('vmRsContrastW', { w: lex.ct.w }) : part('vmRsContrast');
    case 'transfer':
    case 'evidence':
      return part('vmRsTransfer');
    case 'week':
      return part('vmRsWeek');
    case 'mistakes':
      return part('vmRsMistakes');
    case 'word':
      return part('vmRsWord');
    default:
      return part('vmRsPractice');
  }
}

export function reasonOf(task: Task, lex: Lex | null, nowMs: number): Reason {
  const day = dayKey(nowMs);
  const parts = [mainOf(task, lex, day)];
  // Nebenwege, die tatsächlich buchen (Woche, Fehler, Dieses Wort bei Fälligem oder Gefährdetem): sagen, dass die Antwort zählt.
  if (task.planned && (task.why === 'week' || task.why === 'mistakes' || task.why === 'word')) parts.push(part('vmRsCounts'));
  if (lex && lex.intro !== null) {
    const last = lex.ev.f[lex.ev.f.length - 1];
    // Ohne gemerkten freien Abruf: nach einem Fehler „seit dem letzten Fehler noch nicht“, sonst schlicht „noch nicht“ (learning-scientist V3 R1).
    const lapsed = (lex.b?.lapses ?? 0) + lex.u.lapses > 0;
    parts.push(last ? part('vmRsLastFree', { date: last }) : part(lapsed ? 'vmRsNeverFree' : 'vmRsNotYetFree'));
    const track = FORM_SPEC[task.form].track;
    parts.push(track ? part('vmRsStage', { lv: String(lex.lv), track: track === 'b' ? 'use' : 'know' }) : part('vmRsStageOnly', { lv: String(lex.lv) }));
  }
  return { code: task.why, parts };
}
