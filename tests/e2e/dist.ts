import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname } from 'node:path';
import type { Route } from '@playwright/test';

// Liefert dist/ für die E2E-Tests unter der Test-Adresse (fixtures.ts `ORIGIN`). Ein Mechanismus für beide Bauweisen:
//  - Einzeldatei (Rückfall `npm run build:single`): nur `/` -> dist/index.html.
//  - Mehr-Datei (Standard `npm run build`, erkannt am Inhalt von dist/): zusätzlich flache Pfade (`/index-<hash>.js`, `/content-*.txt` …) aus dist/.
// Ein eigener Server ist nicht nötig: `route.fulfill` ersetzt ihn und lässt die Zählung fremder Anfragen (fixtures `external`) intakt.
// Alles, was nicht in dist/ liegt, bleibt „extern“ und wird abgebrochen.

const DIST = new URL('../../dist/', import.meta.url);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
};

export const HTML = readFileSync(new URL('index.html', DIST), 'utf8');
/** Mehr-Datei-Build (Standard seit Stufe 1 P0): dist/ enthält außer index.html weitere Dateien (dist/.vite/ = Bau-Metadaten, zählt nicht). */
export const MULTI = process.env.LX_BUILD === 'multi' || readdirSync(DIST).some((f) => f !== 'index.html' && f !== '.vite');

/** Beantwortet die Anfrage aus dist/ und gibt `true` zurück; sonst `false` (Aufrufer behandelt sie als extern). */
export async function serveDist(route: Route, origin: string): Promise<boolean> {
  const url = new URL(route.request().url());
  if (url.origin !== origin) return false;
  if (url.pathname === '/') {
    await route.fulfill({ status: 200, contentType: TYPES['.html'], body: HTML });
    return true;
  }
  if (!MULTI) return false;
  const name = url.pathname.slice(1);
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return false;
  const file = new URL(name, DIST);
  if (!existsSync(file)) return false;
  await route.fulfill({ status: 200, contentType: TYPES[extname(name)] ?? 'application/octet-stream', body: readFileSync(file) });
  return true;
}
