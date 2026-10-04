import type { ZodType } from 'zod';
import type { Route } from './types';

// Deep-Links (docs/neubau/architektur.md §2.3): Jede Route ist JSON und lässt sich als Text
// schreiben – `trainer?round=extra&mode=flip&deck=job`. Dieselbe Form nutzen Fortsetzen,
// `progress/actionRoute.ts`, Vorschläge von Claude und Tests (`#go=<route>`, nur beim Start
// gelesen, nie geschrieben – kein History-Eintrag im iframe).
//
// Reine Funktionen: Welche Bildschirme es gibt und welche Parameter sie haben, reicht der Aufrufer
// herein (`lookup`, im Rahmen aus dem Register) – so gibt es keine Import-Schleife.

/** Bildschirm-Auskunft für `parseRoute`: `null` = unbekannter Bildschirm. */
export type ScreenLookup = (name: string) => { params?: ZodType } | null;

const NAME = /^[A-Za-z][A-Za-z0-9]*$/;
const LITERAL = /^(true|false|null|-?\d+(\.\d+)?)$/;

/** Route → Text. Zeichenketten roh, alles andere als JSON; `undefined` fällt weg. */
export function routeToString(route: Route): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(route)) {
    if (k === 'name' || v === undefined) continue;
    const raw = typeof v === 'string' ? v : JSON.stringify(v);
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(raw)}`);
  }
  return parts.length ? `${route.name}?${parts.join('&')}` : route.name;
}

function decode(s: string): string | null {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return null;
  }
}

/**
 * Text → Route, geprüft mit dem zod-Schema des Bildschirms. Unbekannte Bildschirme, fremde
 * Parameter oder ungültige Werte ergeben `null` (nie eine halbe Route).
 */
export function parseRoute(text: string, lookup: ScreenLookup): Route | null {
  const t = text.trim().replace(/^#?go=/, '');
  const q = t.indexOf('?');
  const name = decode(q < 0 ? t : t.slice(0, q));
  if (!name || !NAME.test(name)) return null;
  const screen = lookup(name);
  if (!screen) return null;
  const raw: Record<string, string> = {};
  if (q >= 0 && q < t.length - 1) {
    for (const pair of t.slice(q + 1).split('&')) {
      if (!pair) continue;
      const i = pair.indexOf('=');
      const k = decode(i < 0 ? pair : pair.slice(0, i));
      const v = decode(i < 0 ? '' : pair.slice(i + 1));
      if (!k || v === null || k === 'name') return null;
      raw[k] = v;
    }
  }
  if (!screen.params) return Object.keys(raw).length ? null : ({ name } as Route);
  // Erst die rohen Zeichenketten prüfen (IDs wie „123“ bleiben Text), dann Literale als JSON.
  const first = screen.params.safeParse(raw);
  if (first.success) return { ...(first.data as object), name } as Route;
  const typed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) typed[k] = LITERAL.test(v) ? (JSON.parse(v) as unknown) : v;
  const second = screen.params.safeParse(typed);
  return second.success ? ({ ...(second.data as object), name } as Route) : null;
}

/** Liest `#go=<route>` aus einem Adress-Anker (einmal beim Start). */
export function routeFromHash(hash: string, lookup: ScreenLookup): Route | null {
  const m = /(?:^#|&)go=(.+)$/.exec(hash);
  if (!m?.[1]) return null;
  const inner = decode(m[1]);
  return inner ? parseRoute(inner, lookup) : null;
}
