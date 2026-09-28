import type { InboxMail } from '../../content/nb/schemas';

// Posteingang (Lehrer L2, Plan N104): eine Kundenmail mit verstecktem Einwand. Schritt 1 lesen,
// Schritt 2 „Was will der Kunde eigentlich?“ (ein Satz, Deutsch erlaubt), Schritt 3 die Antwort.
// Mit KI prüft `inbox-check@1` Anliegen, Ton und ≤ 3 Korrekturen; ohne KI vergleicht Emrah selbst
// mit dem verdeckten Anliegen, den Pflichtpunkten und der Musterantwort.

export type InboxStep = 'read' | 'gist' | 'reply' | 'done';
/** Teil der Einheit: nur lesen (Block 2 am Mittwoch), nur antworten (Block 3) oder alles. */
export type InboxPart = 'read' | 'reply' | 'full';

export const INBOX_GIST_MAX = 300;
export const INBOX_REPLY_MAX = 1500;

export function firstStep(part: InboxPart): InboxStep {
  return part === 'reply' ? 'reply' : 'read';
}

/** Nächster Schritt nach „Weiter“; `done` beendet die Übung. */
export function nextStep(step: InboxStep, part: InboxPart): InboxStep {
  if (step === 'read') return 'gist';
  if (step === 'gist') return part === 'read' ? 'done' : 'reply';
  return 'done';
}

/** Nummer des Schritts für den Balken (1 von 3 …). */
export function stepNo(step: InboxStep): number {
  return step === 'read' ? 1 : step === 'gist' ? 2 : 3;
}

/** Mail nach Kennung, sonst zum Thema, sonst die erste. */
export function pickMail(list: readonly InboxMail[], theme: string | null, id?: string | null): InboxMail | null {
  if (id) {
    const hit = list.find((m) => m.id === id);
    if (hit) return hit;
  }
  return (theme ? list.find((m) => m.theme === theme) : null) ?? list[0] ?? null;
}

export const wordsOf = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;
