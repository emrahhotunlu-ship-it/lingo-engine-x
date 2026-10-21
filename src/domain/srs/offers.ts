import { addDays } from '../date';
import { hash32 } from '../random';
import { meaningForTask } from './cards';
import type { Lang, TrainCard } from './types';

// Wort-Lernen 2, Teil 2: zwei freiwillige Angebote (zählen als Extra, nie zur Pflicht, kein Vorwurf). Rein, nichts wird gespeichert.
//  - „Abend-Check“ (≈ 2 Min.): die heute eingeführten Wörter noch einmal, nur freier Abruf (tippen ohne Anfangsbuchstaben).
//  - „Sag es selbst“ (2–3 Min.): 2 Wörter von gestern oder vorgestern in eigenen Sätzen, Claude prüft (mit Berufsprofil).

/** Höchstens so viele Wörter im Abend-Check (≈ 2 Minuten). */
export const EVENING_MAX = 8;
/** Wörter je „Sag es selbst“. */
export const SAY_OWN_WORDS = 2;

const usable = (c: TrainCard, lang: Lang): boolean => !c.hidden && !c.isNew && !!meaningForTask(c, lang);

/** Heute eingeführte Karten (älteste Einführung zuerst, feste Reihenfolge), höchstens `EVENING_MAX`. Leer = kein Angebot. */
export function eveningCheckKeys(cards: readonly TrainCard[], day: string, lang: Lang): string[] {
  return cards
    .filter((c) => c.intro === day && usable(c, lang))
    .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
    .slice(0, EVENING_MAX)
    .map((c) => c.key);
}

/**
 * Zwei Karten von gestern oder vorgestern (eingeführt an einem der beiden Tage). Die Wahl ist ein Hash aus Karte und Tag: beim Neuzeichnen würfelt
 * nichts neu (Kap. 15). Gestern zuerst; weniger als zwei = so viele, wie es gibt.
 */
export function sayOwnPick(cards: readonly TrainCard[], day: string, lang: Lang): TrainCard[] {
  const y = addDays(day, -1);
  const yy = addDays(day, -2);
  const rank = (c: TrainCard): number => hash32(`${c.key}|${day}|say-own`);
  const from = (d: string) => cards.filter((c) => c.intro === d && usable(c, lang)).sort((a, b) => rank(a) - rank(b) || a.key.localeCompare(b.key));
  return [...from(y), ...from(yy)].slice(0, SAY_OWN_WORDS);
}

/** Szene aus dem Berufsprofil für die Mini-Szene von „Sag es selbst“ (≤ 160 Zeichen, englisch); ohne Profil der allgemeine Arbeitsalltag. */
export function sayOwnScene(ctx: { role: string; field: string; sit: readonly string[] } | null, i: number): string {
  const sit = ctx?.sit.length ? ctx.sit[i % ctx.sit.length] : null;
  const who = [ctx?.role, ctx?.field ? `in ${ctx.field}` : ''].filter(Boolean).join(' ');
  const s = sit ? `At work${who ? ` (${who})` : ''}: ${sit}` : who ? `At work as ${who}` : 'At work: a normal day at the office';
  return s.slice(0, 160);
}
