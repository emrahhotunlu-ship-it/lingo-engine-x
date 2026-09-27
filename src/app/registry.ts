import type { ComponentType } from 'react';
import type { ZodType } from 'zod';
import type { MessageKey } from '../i18n';
import type { IconName } from '../ui/Icon';
import type { Resumable } from './resume';
import type { Route, RouteName, RouteOf, ScreenKind } from './router/types';
import type { SheetId } from './sheets';
import type { BadgeId, Place } from './shell/tabs';

// Bereichs-Register (docs/neubau/architektur.md §2.8): Je Bereich genau eine Datei
// `src/areas/<bereich>.tsx` mit Routen, Bildschirmen, Hub-Abschnitten, Einstiegen, Blättern,
// Einstellungs-Abschnitten und Fortsetz-Verträgen. Kein Paket bearbeitet eine fremde Datei.
//
// Dieses Modul importiert zur Laufzeit NICHTS aus den Bereichen (keine Import-Schleife mit
// `nav.ts`): `src/areas/index.ts` meldet die Liste einmal mit `installAreas(AREAS)` an.

/** Fokus-Schnittstelle der verborgenen Eingabe (engine/HiddenInput): im Klick fokussieren. */
export type FocusApi = { focusNow(): void; blur(): void };

/** Eigenschaften jedes Bildschirms: seine eigene Route (mit Parametern). */
export type ScreenProps<N extends RouteName> = { route: RouteOf<N> };

export type ScreenDef<N extends RouteName> = {
  kind: ScreenKind;
  component: ComponentType<ScreenProps<N>>;
  /** Titel (für „‹ Herkunft“ im Kopf, WP0b). */
  title?: MessageKey;
  /** Bildlaufposition merken (Listen, Hubs). */
  keepScroll?: boolean;
  /** zod-Schema der Parameter (ohne `name`); prüft Deep-Links und Fortsetzen. Ohne Schema: keine Parameter. */
  params?: ZodType;
  /**
   * Übungen mit im Klick gebauter Sitzung (§2.3): „Sitzung aktiv? Sonst herstellen, sonst neu
   * starten“. `false` = ruhiger Hinweis und zurück zur Herkunft. Der Player (WP0b) ruft es auf.
   */
  ensure?: (route: RouteOf<N>) => boolean;
  /**
   * `own` (Standard): Der Bildschirm zeichnet seine Titelzeile selbst. `shell`: Der Rahmen zeichnet
   * über der Seite eine Zeile mit Zurück-Pfeil und den Titel-Aktionen (Übergang bis WP0b).
   */
  chrome?: 'own' | 'shell';
};

export type ScreenDefs = { [N in RouteName]?: ScreenDef<N> };

/** Hub-Abschnitt: eigene Komponente auf einem Platz (Reihenfolge `order` aufsteigend). */
export type SectionDef = { id: string; place: Place; order: number; component: ComponentType };

/**
 * Einstieg: eine Zeile auf einem Platz (fremde Hubs eingeschlossen). `id` ist zugleich die Test-ID
 * (z. B. `hub-course`). `start` startet synchron im Klick (iPhone-Tastatur), sonst `route`.
 */
export type EntryDef = {
  id: string;
  place: Place;
  group?: string;
  order: number;
  label: MessageKey;
  sub?: MessageKey;
  icon: IconName;
  route?: Route;
  start?: (api: FocusApi) => void;
};

export type SheetProps = { params?: unknown; onClose: () => void };
export type SheetDef = { id: SheetId; component: ComponentType<SheetProps> };

/** Abschnitt im Einstellungsblatt (z. B. „Wiederholen: Standard-Modus“). */
export type SettingsDef = { id: string; order: number; component: ComponentType };

/** Zahl am Reiter (Hook, wird in fester Reihenfolge je Reiter aufgerufen). */
export type BadgeDef = { id: BadgeId; use: () => number };

export type AreaDef = {
  id: string;
  screens: ScreenDefs;
  sections?: readonly SectionDef[];
  entries?: readonly EntryDef[];
  sheets?: readonly SheetDef[];
  settings?: readonly SettingsDef[];
  // Fortsetz-Verträge: Die Momentaufnahme ist je Übung verschieden (Typ je Vertrag).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resumables?: readonly Resumable<any>[];
  badge?: BadgeDef;
  /** Einmalige Installation beim Start (z. B. `installFlushOnHide`). */
  boot?: () => void;
};

/** Typ-Helfer: prüft die Bereichs-Definition, gibt sie unverändert zurück. */
export function defineArea<A extends AreaDef>(area: A): A {
  return area;
}

type Installed = {
  areas: readonly AreaDef[];
  screens: Map<string, { area: string; def: ScreenDef<RouteName> }>;
};

let installed: Installed = { areas: [], screens: new Map() };

/**
 * Meldet die Bereiche an (einmal, aus `src/areas/index.ts`). Doppelte Bildschirm-Namen sind ein
 * Programmierfehler und werfen sofort (Unit-Test `registry.test.ts`).
 */
export function installAreas(areas: readonly AreaDef[]): void {
  const screens = new Map<string, { area: string; def: ScreenDef<RouteName> }>();
  for (const a of areas) {
    for (const [name, def] of Object.entries(a.screens) as Array<[string, ScreenDef<RouteName> | undefined]>) {
      if (!def) continue;
      const prev = screens.get(name);
      if (prev) throw new Error(`Bildschirm „${name}“ doppelt: ${prev.area} und ${a.id}`);
      screens.set(name, { area: a.id, def });
    }
  }
  installed = { areas, screens };
}

export function installedAreas(): readonly AreaDef[] {
  return installed.areas;
}

export function screenOf<N extends RouteName>(name: N): ScreenDef<N> | null {
  return (installed.screens.get(name)?.def as ScreenDef<N> | undefined) ?? null;
}

/** Bereich, der einen Bildschirm besitzt. */
export function areaOf(name: string): string | null {
  return installed.screens.get(name)?.area ?? null;
}

/** Ebene eines Bildschirms; unbekannte Namen gelten als Seite. */
export function kindOf(name: string): ScreenKind {
  return installed.screens.get(name)?.def.kind ?? 'page';
}

export function keepsScroll(name: string): boolean {
  return installed.screens.get(name)?.def.keepScroll === true;
}

/** Alle registrierten Bildschirm-Namen (Rundgänge in Tests, §5.5). */
export function screenNames(): string[] {
  return [...installed.screens.keys()];
}

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

export function sectionsFor(place: Place): SectionDef[] {
  return installed.areas.flatMap((a) => a.sections ?? []).filter((s) => s.place === place).sort(byOrder);
}

export function entriesFor(place: Place, group?: string): EntryDef[] {
  return installed.areas
    .flatMap((a) => a.entries ?? [])
    .filter((e) => e.place === place && (group === undefined || e.group === group))
    .sort(byOrder);
}

export function sheetOf(id: SheetId): SheetDef | null {
  for (const a of installed.areas) for (const s of a.sheets ?? []) if (s.id === id) return s;
  return null;
}

export function settingsSections(): SettingsDef[] {
  return installed.areas.flatMap((a) => a.settings ?? []).sort(byOrder);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resumables(): Array<Resumable<any>> {
  return installed.areas.flatMap((a) => a.resumables ?? []);
}

export function badgeOf(id: BadgeId): BadgeDef | null {
  for (const a of installed.areas) if (a.badge?.id === id) return a.badge;
  return null;
}

/** Startet die einmaligen Installationen aller Bereiche (aus `useBoot`). */
export function bootAreas(): void {
  for (const a of installed.areas) a.boot?.();
}
