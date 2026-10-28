import type { MessageKey } from '../../i18n';
import type { IconName } from '../../ui/Icon';
import type { Route } from '../router/types';

// Reiterleiste als Daten (docs/neubau/architektur.md §2.4, plan.md §1.1) – die EINZIGE Stelle, an
// der Reiter festgelegt werden. Hub-Inhalte hängen an Plätzen, nicht an Reitern: Ein Reiter mehr
// oder weniger ist eine Zeile.
//
// Tab-IDs dürfen nicht mit den inneren Reitern von „Dein Stand“ kollidieren (`judge`, `errors`,
// `path`, `history`), denn beide nutzen die Test-ID `tab-<id>`.

/**
 * Plätze, an die Bereiche ihre Hub-Abschnitte und Einstiege hängen. Außerhalb der Leiste:
 * `profile` (Profil-Blatt) und `stand` (Seite „Dein Stand“, Reiter Statistik).
 */
export type Place = 'today' | 'learn' | 'apply' | 'vocab' | 'read' | 'speak' | 'write' | 'profile' | 'stand';

/** Name eines Reiter-Abzeichens; die Zahl liefert ein Bereich über `badge` in `defineArea`. */
export type BadgeId = 'openDuties';

export type TabDef = {
  readonly id: string;
  readonly label: MessageKey;
  readonly icon: IconName;
  readonly root: Route;
  readonly places: readonly Place[];
  readonly badge?: BadgeId;
};

// Fünf Reiter (Relaunch Stufe 1, P2 S1-SHELL, docs/relaunch/stufe1-plan.md §6.3, Konzept 13.1):
// Heute · Wörter · Grammatik · Praxis · Fortschritt. „Praxis“ ist der frühere Reiter „Anwenden“ (Test-ID `tab-apply` bleibt);
// Lesen (früher eigener Reiter, 13.10.2026) und Sprechen hängen als Seiten darunter (Plätze `read`/`speak` stehen auf Praxis).
// Fortschritt = die Seite „Dein Stand“ (Route `overview`, Emrahs Wunsch vom 01.10.2026). Die Test-IDs `tab-learn`, `learn-hub` und `hub-*` bleiben.
export const TABS = [
  { id: 'today', label: 'nbShTabToday', icon: 'sun', root: { name: 'today' }, places: ['today'], badge: 'openDuties' },
  { id: 'vocab', label: 'nbShTabVocab', icon: 'cards', root: { name: 'vocab' }, places: ['vocab'] },
  { id: 'learn', label: 'nbShTabLearn', icon: 'layers', root: { name: 'learn' }, places: ['learn'] },
  { id: 'apply', label: 'shTabPractice', icon: 'bolt', root: { name: 'apply' }, places: ['apply', 'read', 'speak'] },
  { id: 'progress', label: 'nbShTabProgress', icon: 'chart', root: { name: 'overview' }, places: [] },
] as const satisfies readonly TabDef[];

export type TabId = (typeof TABS)[number]['id'];

/** Startreiter (Kap. 2.1: beim Öffnen ist sofort klar, was heute dran ist). */
export const START_TAB: TabId = 'today';

/**
 * Notbremse für `<Activity>` (§3.3, WP0b): `false` = verborgene Reiter werden abgebaut und nur ihr
 * Bildlauf gemerkt. WP0a baut noch nichts in `<Activity>`.
 */
export const KEEP_ALIVE = false;

export function tabDef(id: TabId): TabDef {
  return TABS.find((t) => t.id === id) ?? TABS[0];
}

/** Plätze eines Reiters (für `<HubSections places=…/>` auf der Reiter-Wurzel). */
export function placesOf(id: TabId): readonly Place[] {
  return tabDef(id).places;
}

/** Reiter, dessen Wurzel dieser Bildschirm ist (sonst `null`). */
export function tabOfRoot(name: string): TabId | null {
  return TABS.find((t) => t.root.name === name)?.id ?? null;
}

/** Reiter, auf dem ein Platz steht (für Einstiege fremder Bereiche). */
export function tabOfPlace(place: Place): TabId | null {
  return TABS.find((t) => (t.places as readonly Place[]).includes(place))?.id ?? null;
}
