import { create } from 'zustand';
import { getWriter } from '../../data';
import { readDoc } from '../../data/reads';
import { ACT_MAX_PARTS, actPath, entriesOf, normalizeEntry, planAct, type ActEntry } from '../../domain/activation/actDoc';
import { monthOf } from '../../domain/monthDoc';
import type { OwnSentence } from '../../domain/srs/actTask';
import { getDb } from '../../platform/capabilities';
import { logError, logWarn } from '../../platform/diagnostics';

// Sammelakte der Aktivierungen (`act/<Monat>`, Wörter aktivieren, Stufe 2): Lesen in den Zwischenspeicher der Ansicht (die letzten drei Monate samt Fortsetzungen)
// und Schreiben eines Eintrags – immer über `writer.transform`, idempotent, mit Größenwächter (`domain/activation/actDoc.ts`). Nichts davon läuft im Render.

type ActState = { entries: ActEntry[]; loaded: string | null };
export const useActs = create<ActState>(() => ({ entries: [], loaded: null }));

/** Die drei Monate bis einschließlich dem des Lerntags: '2026-10-14' → ['2026-10', '2026-09', '2026-08']. */
export function recentMonths(day: string, n = 3): string[] {
  const [y, m] = monthOf(day).split('-').map(Number) as [number, number];
  return Array.from({ length: n }, (_, i) => {
    const idx = y * 12 + (m - 1) - i;
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
  });
}

const merge = (a: readonly ActEntry[], b: readonly ActEntry[]): ActEntry[] => {
  const byId = new Map<string, ActEntry>();
  for (const e of [...a, ...b]) byId.set(e.id, e);
  return [...byId.values()].sort((x, y) => x.t - y.t);
};

/** Liest die letzten drei Monate (mit Fortsetzungen). Fehler werden gemeldet; der Zwischenspeicher bleibt dann, wie er war. */
export async function loadActs(day: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const months = recentMonths(day);
  const found: ActEntry[] = [];
  try {
    for (const m of months) {
      for (let part = 0; part < ACT_MAX_PARTS; part++) {
        const path = actPath(`${m}-01`, part);
        const r = await readDoc(db, path);
        if (r.status !== 'valid') break;
        found.push(...entriesOf(path, r.doc));
        if (r.doc.nx !== 1) break;
      }
    }
    // Was in dieser Sitzung schon geschrieben wurde, bleibt auch dann sichtbar, wenn das Lesen es noch nicht sah.
    useActs.setState((s) => ({ entries: merge(found, s.entries.filter((e) => months.includes(monthOf(e.d)))), loaded: day }));
  } catch (err) {
    logWarn('data:act', err, 'act lesen');
  }
}

/** Frühere eigene Sätze einer Karte, die als Beispiel wiederverwendet werden dürfen (von Claude geprüft, richtig, natürlich), neuester zuerst. */
export function reusableSentencesOf(cardKey: string, entries: readonly ActEntry[] = useActs.getState().entries): OwnSentence[] {
  return entries
    .filter((e) => e.c === cardKey && e.r === 1 && e.v === 'c' && e.k === 1 && e.s.trim())
    .sort((a, b) => b.t - a.t)
    .map((e) => ({ id: e.id, text: e.s, day: e.d, code: e.a, reusable: true }));
}

/** ALLE früheren eigenen Sätze einer Karte (auch nicht geprüfte oder falsche), für die Neuheitsprüfung: wer sich selbst wiederholt, übt nichts Neues. */
export function ownTextsOf(cardKey: string, entries: readonly ActEntry[] = useActs.getState().entries): string[] {
  return entries.filter((e) => e.c === cardKey && e.s.trim()).map((e) => e.s);
}

/**
 * Einen Eintrag schreiben. Versucht das Hauptdokument, bei „voll“ die Fortsetzungen der Reihe nach. Idempotent: steht die Kennung schon im
 * Dokument, wird nichts geschrieben. `true` = geschrieben oder schon vorhanden; `false` = nicht gespeichert (gemeldet, nichts verloren außer diesem Eintrag).
 */
export async function saveActEntry(entry: ActEntry): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  const e = normalizeEntry(entry);
  try {
    for (let part = 0; part < ACT_MAX_PARTS; part++) {
      const path = actPath(e.d, part);
      let state = 'invalid' as ReturnType<typeof planAct>['state'];
      const attempt = async (): Promise<void> => {
        await writer.transform(path, (cur) => {
          const plan = planAct(path, cur, e);
          state = plan.state;
          return plan.op;
        });
      };
      await attempt();
      // Fehlte das Dokument, steht jetzt das Gerüst; der Eintrag folgt als Ergänzung (kein `set` mit Inhalt, den ein zweites Gerät überschreiben könnte).
      if (state === 'created') await attempt();
      if (state === 'created') {
        logError('data:act', new Error('Sammelakte nach dem Anlegen nicht lesbar'), path);
        return false;
      }
      if (state === 'invalid') {
        logError('data:act', new Error('Sammelakte hat unerwarteten Aufbau – nicht angefasst'), path);
        return false;
      }
      if (state === 'written' || state === 'exists') {
        useActs.setState((s) => ({ entries: merge(s.entries, [e]) }));
        return true;
      }
    }
    logError('data:act', new Error('alle Fortsetzungen voll'), e.d);
    return false;
  } catch (err) {
    logError('data:act', err, e.id);
    return false;
  }
}
