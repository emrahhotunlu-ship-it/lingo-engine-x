import { create } from 'zustand';

// Navigation ohne Router und ohne History-API (im iframe teilt sich der Verlauf mit claude.ai).
// Start ist immer „Heute" (Kap. 2.1). UX-Beratung 27.09. (Nr. 3): Die Navigation merkt sich den
// Herkunftsbildschirm; `back()` führt immer dorthin zurück, woher man kam. Reiter-Startseiten
// haben keinen Zurück-Weg (ein Reiterwechsel beginnt einen neuen Verlauf).

export type SpeakSeg = 'scenes' | 'business' | 'preply';

export type Route =
  | { name: 'today' }
  // Phase 6: Dein Stand mit Reiter (Urteil, Fehler, Weg nach C1, Verlauf) und Wortschatztest.
  | { name: 'overview'; tab?: 'judge' | 'errors' | 'path' | 'history' }
  | { name: 'vtest' }
  // Funktionsabgleich M10: Wochen-Check (Vollbild, freiwillig).
  | { name: 'check' }
  | { name: 'trainer'; round: 'pflicht' | 'extra' }
  // Reiter „Üben" (bisher „Lernen"): Kurs, Wortschatz, Grammatik, Kurzübungen, Lesen/Hören/Schreiben, Entdecken.
  | { name: 'learn' }
  | { name: 'course' }
  | { name: 'lesson'; id: string }
  | { name: 'grammar' }
  | { name: 'grammarSession'; mode: 'duty' | 'xtra' | 'errors' | 'topic'; topic?: string }
  | { name: 'drill'; kind: 'dictate' | 'cloze' | 'order' | 'sprint'; ctx: 'duty' | 'xtra' }
  // Funktionsabgleich M1 (Wortschatz) und M8 (Nachschlagewerk, jetzt „Typische Fallen" in Grammatik).
  | { name: 'vocab' }
  | { name: 'wissen' }
  // Reiter „Sprechen" mit Umschalter Szenen · Business · Preply (UX-Beratung Nr. 7).
  | { name: 'speak'; seg?: SpeakSeg }
  | { name: 'roleplay'; sceneId: string; resume?: boolean; n?: number }
  | { name: 'mail' }
  | { name: 'playbook'; id?: string }
  | { name: 'pitch' }
  // Lernberatung 27.09. (V1/V2): „Sag es“ (Vollbild; Pflichtkanal oder freiwillig aus „Üben")
  | { name: 'say' }
  // Lernberatung 27.09. (V6/V4): Flüssigkeit 90 – 60 – 45 und „Mein nächster Termin“ (Vollbild, freiwillig)
  | { name: 'fluency' }
  | { name: 'meeting'; id?: string }
  // Lernberatung 27.09. (V3): persönliche Deutsch-Fallen (Vollbild, aus „Dein Stand“)
  | { name: 'patterns'; id?: string }
  // Phase 4 – Input und Output (Plan §2.3). `ctx` bestimmt nur `log.ctx`, nie die Zählung.
  | InputRoute;

export type UnitCtx = 'duty' | 'extra';
export type InputRoute =
  | { name: 'read'; ctx: UnitCtx }
  | { name: 'listen'; ctx: UnitCtx }
  | { name: 'write'; ctx: UnitCtx }
  | { name: 'discover' }
  | { name: 'discoverItem'; feedId: string; itemId: string; ctx: UnitCtx }
  | { name: 'history'; kind: 'read' | 'listen' | 'write' | 'discover' };

export type RouteName = Route['name'];

/** Reiter der Navigation (UX-Beratung Nr. 2): Heute · Üben · Sprechen · Stand. */
export type TabName = 'today' | 'learn' | 'speak' | 'overview';

export const TAB_ROOTS: readonly TabName[] = ['today', 'learn', 'speak', 'overview'];

/** Zu welchem Reiter gehört ein Bildschirm? Übungen zählen zu keinem Reiter (Vollbild, Übungsleiste). */
export function tabOf(name: RouteName): TabName | null {
  switch (name) {
    case 'today':
      return 'today';
    case 'overview':
      return 'overview';
    case 'learn':
    case 'course':
    case 'grammar':
    case 'vocab':
    case 'wissen':
    case 'discover':
    case 'history':
      return 'learn';
    case 'speak':
    case 'mail':
    case 'playbook':
    case 'pitch':
      return 'speak';
    default:
      return null;
  }
}

/** Startseite eines Reiters (nie ein Zurück-Pfeil). */
export const isTabRoot = (name: RouteName): boolean => (TAB_ROOTS as readonly string[]).includes(name);

/**
 * Vollbild-Übungen: ohne Reiterleiste, mit der gemeinsamen Übungsleiste. Aus einer Übung in die
 * nächste (z. B. „Weiter: nächster Pflichtschritt") ersetzt den Eintrag – eine beendete Übung
 * ist nie ein Rückweg.
 */
const EXERCISES: ReadonlySet<RouteName> = new Set(['trainer', 'lesson', 'grammarSession', 'drill', 'say', 'roleplay', 'check', 'vtest', 'read', 'listen', 'write', 'discoverItem']);
export const isExercise = (name: RouteName): boolean => EXERCISES.has(name);

/** Listen, deren Bildlaufposition gemerkt wird (M13). */
const SCROLL_KEEP: ReadonlySet<RouteName> = new Set(['learn', 'course', 'grammar', 'vocab', 'wissen', 'speak', 'discover', 'overview']);

const STACK_MAX = 20;

const same = (a: Route, b: Route): boolean => JSON.stringify(a) === JSON.stringify(b);

type NavState = {
  route: Route;
  /** Herkunft: zuletzt besuchte Bildschirme (oben = direkte Herkunft). Nur im Speicher. */
  stack: readonly Route[];
  /** Bildlaufposition je Liste (nur im Speicher, Bequemlichkeit). */
  scroll: Partial<Record<RouteName, number>>;
  go: (route: Route) => void;
  /** Zurück dorthin, woher man kam; ohne Herkunft zur Startseite des Reiters (sonst Heute). */
  back: () => void;
};

function fallbackOf(route: Route): Route {
  const tab = tabOf(route.name);
  return { name: tab && tab !== route.name ? tab : 'today' };
}

function keepScroll(cur: Route, scroll: Partial<Record<RouteName, number>>): Partial<Record<RouteName, number>> {
  const out = { ...scroll };
  if (SCROLL_KEEP.has(cur.name) && typeof window !== 'undefined') out[cur.name] = window.scrollY;
  return out;
}

export const useNav = create<NavState>((set, get) => ({
  route: { name: 'today' },
  stack: [],
  scroll: {},
  go(route) {
    const { route: cur, stack, scroll } = get();
    let next: readonly Route[];
    if (isTabRoot(route.name)) next = [];
    else if (stack.length && same(stack[stack.length - 1] as Route, route)) next = stack.slice(0, -1);
    else if (cur.name === route.name || (isExercise(cur.name) && isExercise(route.name))) next = stack;
    else next = [...stack, cur].slice(-STACK_MAX);
    set({ route, stack: next, scroll: keepScroll(cur, scroll) });
  },
  back() {
    const { route: cur, stack, scroll } = get();
    const prev = stack[stack.length - 1];
    set({ route: prev ?? fallbackOf(cur), stack: prev ? stack.slice(0, -1) : [], scroll: keepScroll(cur, scroll) });
  },
}));

/** Gemerkte Position eines Bildschirms (0, wenn keine Liste oder noch nie besucht). */
export function savedScroll(name: RouteName): number {
  return SCROLL_KEEP.has(name) ? (useNav.getState().scroll[name] ?? 0) : 0;
}

/**
 * Zurück zur Herkunft, nachdem `leave` aufgeräumt hat. Hat `leave` selbst schon navigiert,
 * passiert nichts mehr – so führt kein Schließen-Knopf doppelt zurück.
 */
export function leaveBack(leave?: () => void): void {
  const before = useNav.getState().route;
  leave?.();
  if (useNav.getState().route === before) useNav.getState().back();
}
