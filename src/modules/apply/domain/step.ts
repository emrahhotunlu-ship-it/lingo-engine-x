import { BRIDGE_N, BRIDGE_SHORT_N } from '../shared';

// Tagesweg Schritt 3 „Anwenden“: was beim Start läuft. Rein.
// Großpaket P „Politur“, P4 (Entscheidung E2 vom 13.11.2026): Pflicht sind täglich ZWEI Brücken-Sätze (ein Wort aus der Wörter-App + ein
// Grammatik-Muster je Satz). Mail beantworten, Mail schreiben und Zusammenfassen sind freiwillig („Frei üben“).
// - Die früher eingefrorene Disziplin (`u.ap`: combo/reply/write/summary) wird weiter gelesen, steuert Schritt 3 aber nicht mehr: auch ein
//   älterer Plan von heute mit `ap: 'reply'` startet die Brücken-Sätze (alte Pläne bleiben lesbar, nichts wird umgeschrieben).
// - Kurzer Tag: ein Satz (der Tag ist bewusst kurz; der Zähler `apc` zählt kurze Tage wie bisher nicht).
// - Sehr kleines Anwenden-Budget: trotzdem zwei Sätze (die Minuten nennt `domain/apply/bridgeTime.ts` ehrlich).
// - Ohne Claude: Satzbau wie bisher (ohne KI erfüllbar). Fehlen passende Wörter oder Muster, bietet der Bildschirm den Satzbau an.

export type StepPlan = { to: 'bridge'; n: number } | { to: 'order' };

export function resolveStep(i: { ap: unknown; short: boolean; ai: boolean }): StepPlan {
  if (!i.ai) return { to: 'order' };
  return { to: 'bridge', n: i.short ? BRIDGE_SHORT_N : BRIDGE_N };
}
