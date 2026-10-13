import { addDays, docGateOf } from '../shared';
import type { DocGate, TransformOp } from '../shared';
import type { ArticleItem } from '../schemas';
import { parseDayDoc } from './docs';
import { jsonBytes } from './size';

// Aufbewahrung (docs/umbau/lesen-plan.md §4.3): NICHTS wird automatisch gelöscht. Hier steht nur Rechnen und Planen;
// kein Schreibzugriff läuft ohne ausdrückliche Zustimmung der Nutzerin oder des Nutzers.

/** Warnung ab so vielen Tagesdokumenten (≈ 8 Monate bei täglichem Lesen). */
export const DAY_DOCS_WARN = 250;
/** Harte Grenze für das Anlegen NEUER Artikel (neue Tagesdokumente). */
export const DAY_DOCS_BLOCK = 400;
/** Texte älter als so viele Tage dürfen (mit Zustimmung) entfernt werden. */
export const TIDY_AFTER_DAYS = 90;

/**
 * Wächter für neue Artikel: `dayDocs` = vorhandene Tagesdokumente `read/d-…`, `total` = Gesamtzahl aller Dokumente der App
 * (0 = unbekannt). `full`, wenn 400 Tagesdokumente erreicht sind oder der Gesamtwächter (4.300) sperrt.
 * Ein weiterer Artikel in einem schon vorhandenen Tagesdokument legt kein Dokument an und ist von `dayDocs` unabhängig.
 */
export function readDocGate(dayDocs: number, total: number): DocGate {
  const own: DocGate = dayDocs >= DAY_DOCS_BLOCK ? 'full' : dayDocs >= DAY_DOCS_WARN ? 'warn' : 'ok';
  const all = docGateOf(total);
  if (own === 'full' || all === 'full') return 'full';
  return own === 'warn' || all === 'warn' ? 'warn' : 'ok';
}

/** Darf ein NEUES Tagesdokument entstehen? (Ein Artikel in einem vorhandenen Tag ist immer erlaubt.) */
export const mayCreateDayDoc = (dayDocs: number, total: number): boolean => readDocGate(dayDocs, total) !== 'full';

export type TidyCandidate = { path: string; day: string; articles: number; bytesBefore: number; bytesAfter: number };
export type TidyPlan = { cutoffDay: string; candidates: TidyCandidate[]; articles: number; bytesSaved: number };

/** Der Teil eines Artikels, der beim Aufräumen bleibt: Titel, Schlüsselwörter und alles außer Text und Fragen. */
export function stripArticleText(item: ArticleItem): ArticleItem {
  const rest: Record<string, unknown> = { ...item };
  delete rest.paras;
  delete rest.check;
  // `paras` ist im Schema Pflicht; ein aufgeräumter Artikel trägt die leere Liste, ist also als „Text entfernt“ erkennbar.
  return { ...(rest as ArticleItem), paras: [] };
}

/** Nur lesend: welche Tagesdokumente kämen in Frage? Berührt nichts. */
export function planTidy(days: ReadonlyArray<{ day: string; doc: Record<string, unknown> | undefined }>, today: string, keepDays = TIDY_AFTER_DAYS): TidyPlan {
  const cutoffDay = addDays(today, -keepDays);
  const candidates: TidyCandidate[] = [];
  for (const { day, doc } of days) {
    if (day >= cutoffDay) continue;
    const parsed = parseDayDoc(doc);
    if (!parsed.ok) continue;
    const withText = parsed.items.filter((i) => i.paras.length > 0);
    if (withText.length === 0) continue;
    const raw = Array.isArray(doc?.items) ? (doc.items as unknown[]) : [];
    const after = raw.map((x) => {
      const r = parseDayDoc({ items: [x] });
      const one = r.ok ? r.items[0] : undefined;
      return one && one.paras.length > 0 ? stripArticleText(one) : x;
    });
    candidates.push({ path: `read/d-${day}`, day, articles: withText.length, bytesBefore: jsonBytes(raw), bytesAfter: jsonBytes(after) });
  }
  return { cutoffDay, candidates, articles: candidates.reduce((a, c) => a + c.articles, 0), bytesSaved: candidates.reduce((a, c) => a + c.bytesBefore - c.bytesAfter, 0) };
}

/**
 * Schreibvorgang zum Aufräumen EINES Tagesdokuments. Gibt ohne `consent: true` immer `null` zurück (nie ohne Zustimmung).
 * Benutzt `update` (db.d.ts: Arrays ersetzen das Feld), nicht `replace`: `writer.transform` erlaubt `replace` nur für Zwischenspeicher.
 * Nur Dokumente älter als die Frist; Titel, Schlüsselwörter, Zusammenfassung und Kennung bleiben, ebenso der Lesezustand (Monatsindex) und alle Karten.
 */
export function tidyDayOp(cur: Record<string, unknown> | undefined, day: string, today: string, opts: { consent: boolean; keepDays?: number }): TransformOp | null {
  if (opts.consent !== true || !cur) return null;
  if (day >= addDays(today, -(opts.keepDays ?? TIDY_AFTER_DAYS))) return null;
  const parsed = parseDayDoc(cur);
  if (!parsed.ok) return null;
  const raw = Array.isArray(cur.items) ? (cur.items as unknown[]) : [];
  let changed = false;
  const next = raw.map((x) => {
    const r = parseDayDoc({ items: [x] });
    const one = r.ok ? r.items[0] : undefined;
    if (!one || one.paras.length === 0) return x; // ausgeblendete oder schon aufgeräumte Einträge unverändert lassen
    changed = true;
    const base: Record<string, unknown> = { ...(x as Record<string, unknown>) };
    delete base.check;
    return { ...base, paras: [] };
  });
  return changed ? { update: { items: next } } : null;
}
