import { isAiFailure, logError, logWarn } from './shared';
import type { AiMessageKey, AiPhase, Writer } from './shared';
import { generateArticle } from './domain/generate';
import type { GenerateDeps } from './domain/generate';
import { PER_DAY_MAX } from './domain/docs';
import type { Prefs } from './domain/docs';
import { pickTopic, topicId } from './domain/topics';
import type { TopicHistoryItem } from './domain/topics';
import { recentTitles } from './domain/view';
import type { IndexItem } from './schemas';
import { claimDay, recordSaved, saveArticle } from './store';
import { mayCreateDayDoc } from './domain/retention';
import { isOwn } from './domain/routine';

// Das Holen der Artikel (docs/umbau/lesen-plan.md §3.1, A6 Nr. 2/3). Nur auf Handlung (Tippen), ein Artikel nach dem anderen, nie aus Schleife
// oder Timer im Sinne des Vertrags: die Schleife hier ist die Reihe der vom Nutzer gewollten Artikel und endet beim ersten Fehler.
// Jeder gültige Artikel wird SOFORT gespeichert (Teilergebnisse bleiben); ein Fehler wird nie automatisch wiederholt.

export type RunFailure =
  /** Das Tagesdokument ist gerade auf einem anderen Gerät reserviert. */
  | { type: 'device_busy' }
  /** Der Tag hat keinen Platz mehr (Artikel je Tag, Größe). */
  | { type: 'full' }
  /** Speichern fehlgeschlagen. */
  | { type: 'save' }
  /** Claude hat eine Pause gebraucht (`rate_limited` und Verwandtes): ruhiger Hinweis, kein Neustart. */
  | { type: 'rate' }
  /** Die Antwort war nicht verwendbar (Schemafehler nach dem einen Neuversuch, kaputtes JSON): Knopf „Erneut versuchen“. */
  | { type: 'invalid'; key: AiMessageKey | null }
  /** Alles andere aus dem KI-Tor. */
  | { type: 'ai'; key: AiMessageKey | null };

export type RunEvent = { kind: 'start'; n: number; total: number } | { kind: 'phase'; phase: AiPhase } | { kind: 'saved'; n: number; total: number; id: string };

export type RunInput = {
  writer: Writer;
  /** Heutiger Lerntag. */
  day: string;
  prefs: Prefs;
  /** Index der geladenen Monate (Titelverlauf, Nummerierung). */
  items: readonly IndexItem[];
  /** Wie viele Artikel (von `fetchCount`). */
  count: number;
  signal: AbortSignal;
  /** Kennung dieses Geräts/Tabs für die kurze Sperre. */
  holder: string;
  rand?: () => number;
  now?: number;
  onEvent?: (e: RunEvent) => void;
  /** Nach einem Schemafehler: beim Knopf „Erneut versuchen“ den Zwischenspeicher übergehen. */
  refresh?: boolean;
  deps?: GenerateDeps;
  /** Anzahl vorhandener Tagesdokumente (`read/p.days`) und aller Dokumente der App (0 = unbekannt) für den Kapazitätswächter. */
  dayDocs?: number;
  docTotal?: number;
};

export type RunResult = { saved: number; total: number; stopped: boolean; failure: RunFailure | null };

/** Themenverlauf aus `read/p` (`lastTopics`, neueste zuerst): `custom:<Text>` wird zu einem eigenen Thema. */
export function historyFromPrefs(last: readonly string[]): TopicHistoryItem[] {
  return last.map((id) => (id.startsWith('custom:') ? { topic: 'custom', custom: id.slice('custom:'.length) } : { topic: id }));
}

function failureOf(err: unknown): RunFailure | 'cancelled' {
  if (!isAiFailure(err)) return { type: 'ai', key: 'aiFailed' };
  if (err.kind === 'cancelled') return 'cancelled';
  if (err.kind === 'busy') return { type: 'rate' };
  if (err.kind === 'invalid') return { type: 'invalid', key: err.messageKey };
  return { type: 'ai', key: err.messageKey };
}

/**
 * Holt bis zu `count` Artikel. Ablauf je Artikel: Thema wählen → erzeugen (KI-Tor, mit Stopp) → speichern → Verlauf fortschreiben.
 * Gibt zurück, wie viele gespeichert sind, ob der Nutzer angehalten hat und woran es gescheitert ist.
 */
export async function runFetch(input: RunInput): Promise<RunResult> {
  const { writer, day, prefs, signal, onEvent } = input;
  const total = Math.max(0, Math.min(input.count, PER_DAY_MAX));
  const result: RunResult = { saved: 0, total, stopped: false, failure: null };
  if (total === 0) return { ...result, failure: { type: 'full' } };

  // Kapazitätswächter (Plan §4.3): ein NEUER Tag legt ein neues Dokument an; ein vorhandener Tag ist immer erlaubt.
  const hasToday = input.items.some((e) => e.day === day && isOwn(e));
  if (!hasToday && !mayCreateDayDoc(input.dayDocs ?? 0, input.docTotal ?? 0)) return { ...result, failure: { type: 'full' } };

  const claim = await claimDay(writer, day, input.holder).catch((err: unknown) => {
    logError('read:claim', err, day);
    return null;
  });
  if (!claim) return { ...result, failure: { type: 'save' } };
  if (!claim.acquired) return { ...result, failure: { type: 'device_busy' } };

  const rand = input.rand ?? Math.random;
  let items: IndexItem[] = [...input.items];
  let history = historyFromPrefs(prefs.lastTopics);
  let n = items.filter((e) => e.day === day && isOwn(e)).length;

  for (let i = 1; i <= total; i++) {
    if (signal.aborted) return { ...result, stopped: true };
    // Die Sperre (120 s) vor jedem weiteren Artikel erneuern (gleiche Kennung = Verlängerung), sonst läuft sie bei langen Reihen ab.
    if (i > 1) {
      const again = await claimDay(writer, day, input.holder).catch((err: unknown) => {
        logError('read:claim', err, day);
        return null;
      });
      if (!again) return { ...result, failure: { type: 'save' } };
      if (!again.acquired) return { ...result, failure: { type: 'device_busy' } };
    }
    onEvent?.({ kind: 'start', n: i, total });
    const choice = pickTopic(prefs, history, rand);
    n += 1;
    let generated;
    try {
      generated = await generateArticle(
        {
          topic: choice.topic,
          ...(choice.custom ? { custom: choice.custom } : {}),
          date: day,
          recent: recentTitles(items),
          n,
          signal,
          onPhase: (phase) => onEvent?.({ kind: 'phase', phase }),
          ...(input.refresh && i === 1 ? { refresh: true } : {}),
          ...(input.now !== undefined ? { now: input.now } : {}),
        },
        input.deps,
      );
    } catch (err) {
      const f = failureOf(err);
      if (f === 'cancelled') return { ...result, stopped: true };
      if (f.type === 'ai') logWarn('read:generate', err, day);
      return { ...result, failure: f };
    }
    let outcome;
    try {
      outcome = await saveArticle(writer, day, generated.item, { perDayMax: PER_DAY_MAX });
    } catch {
      // saveArticle hat schon protokolliert.
      return { ...result, failure: { type: 'save' } };
    }
    if (outcome === 'day_full' || outcome === 'doc_too_big' || outcome === 'article_too_big') return { ...result, failure: { type: 'full' } };
    if (outcome === 'invalid_doc') return { ...result, failure: { type: 'save' } };
    // Index im Speicher fortschreiben (für Titelverlauf und Nummerierung des nächsten Artikels).
    items = [...items, { id: generated.item.id, day, title: generated.item.title, topic: generated.item.topic ?? 'custom' }];
    history = [{ topic: choice.topic, ...(choice.custom ? { custom: choice.custom } : {}) }, ...history];
    result.saved += 1;
    try {
      await recordSaved(writer, { day, topicId: topicId(choice.topic, choice.custom), countToday: items.filter((e) => e.day === day && isOwn(e)).length });
    } catch {
      // Der Artikel ist gespeichert; fehlt nur der Verlauf, ist das für den Nutzer folgenlos (protokolliert).
    }
    onEvent?.({ kind: 'saved', n: i, total, id: generated.item.id });
  }
  return result;
}
