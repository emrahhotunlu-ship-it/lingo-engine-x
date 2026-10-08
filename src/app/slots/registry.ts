import type { ReactNode } from 'react';
import { logWarn } from '../../platform/diagnostics';

// Erweiterungspunkte (Lernplattform 3.0 P11): Hubs ändern sich nicht mehr, wenn ein Paket etwas einhängt. Jede Hub-Datei hat je Stelle EINE Zeile
// `<Slot name="…" />`; ein Paket meldet seine Komponente in einer eigenen Datei `*.slot.tsx` an (`registerSlot`), die `registerAll.ts` per
// Glob lädt. Ein leerer Slot rendert nichts (keine Höhe, keine Layoutsprünge).

/** Alle Stellen, die es gibt (Hub-Datei in der Klammer). */
export const SLOT_NAMES = [
  'today.done', // features/today/TodayScreen: Abschlusskarte
  'today.extra', // features/today/TodayScreen: unter „Extra“
  'progress.head', // features/progress/ProgressScreen: unter der Kopfkarte
  'progress.words', // … Reiter Wörter
  'progress.grammar', // … Reiter Grammatik
  'progress.review', // … Reiter Rückblick
  'grammar.head', // features/learn/LearnHub: unter dem Titel (Eigenschaft `next`: die Weiter-Karte des Reiters)
  'grammar.foot', // features/learn/LearnHub: unter der Fehlersätze-Zeile
  'apply.tiles', // features/apply/ApplyHub: Kacheln
  'vocab.hub', // features/vocab/hub/VocabHub: unter dem Wortziel
  'settings.sections', // features/settings/SettingsSheet: weitere Abschnitte
  'exercise.menu', // ui/exercise/ExerciseMenu: Menüeinträge (je `<li>`)
  'explain.after', // ui/exercise/Explanation: unter der Erklär-Karte
  'session.end', // ui/SessionEnd: Rundenende
] as const;

export type SlotName = (typeof SLOT_NAMES)[number];
export type SlotProps = Readonly<Record<string, unknown>>;

export type SlotRegistration = {
  slot: SlotName;
  /** Kleinere Zahl zuerst; bei gleicher Zahl gilt die Reihenfolge der Anmeldung. */
  order: number;
  /** Rendert nichts, wenn `false` (z. B. ein Funktionsschalter aus `app/flags.ts`). Wird bei jedem Zeichnen ausgewertet. */
  enabled?: () => boolean;
  render: (props: SlotProps) => ReactNode;
};

type Entry = SlotRegistration & { seq: number };
const entries = new Map<SlotName, Entry[]>();
let seq = 0;

/** Meldet eine Komponente an. Ein unbekannter Slot-Name wird protokolliert und ignoriert. */
export function registerSlot(reg: SlotRegistration): void {
  if (!(SLOT_NAMES as readonly string[]).includes(reg.slot)) {
    logWarn('slots:register', { message: `Unbekannter Slot "${String(reg.slot)}".` });
    return;
  }
  const list = entries.get(reg.slot) ?? [];
  list.push({ ...reg, seq: seq++ });
  list.sort((a, b) => a.order - b.order || a.seq - b.seq);
  entries.set(reg.slot, list);
}

/** Die angemeldeten Einträge eines Slots in Reihenfolge, die eingeschalteten zuerst gefiltert. */
export function slotEntries(name: SlotName): SlotRegistration[] {
  return (entries.get(name) ?? []).filter((e) => e.enabled?.() ?? true);
}

/** Nur für Tests. */
export function clearSlots(): void {
  entries.clear();
  seq = 0;
}
