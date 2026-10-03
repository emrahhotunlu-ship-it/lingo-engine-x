import { askJson } from '../../ai/gate';
import { isAiFailure } from '../../ai/types';
import { ORDER_TOPICS, acceptGenerated, poolNorm, poolSentenceKeys, type PoolEntry } from '../../domain/drills/orderPool';
import { orderGen } from '../../prompts/orderGen';
import { logWarn } from '../../platform/diagnostics';
import { local } from '../../platform/storage';

// Vorrat neuer Satzbau-Sätze von Claude (Emrah 02.10.2026: „nicht immer dieselben Sätze“).
// - Der Rundenstart bleibt synchron: er nimmt höchstens die Hälfte der Runde aus diesem Vorrat, den Rest aus dem
//   festen Pool. Ist der Vorrat leer, gilt der feste Pool wie bisher.
// - Der Vorrat wird im Hintergrund aufgefüllt, ausgelöst durch eine Handlung (Runde starten, Runde beenden), nie durch
//   einen Timer und nie in einer Schleife (A6.2/A6.3). Eine Anfrage, danach mindestens 20 Minuten Ruhe, auch nach einem
//   Fehler. Fehler, fehlende Fähigkeit und Drosselung bleiben still: dann gilt der feste Pool.
// - Jeder Satz wird vor dem Speichern und beim Lesen mit `acceptGenerated` geprüft (dieselben Regeln wie der feste Pool).
// - Nur `localStorage` (Bequemlichkeit, ersetzbar, kein Lernfortschritt): keine Datenbank, nichts zu migrieren.

const KEY_STOCK = 'lx:orderGen:v1';
const KEY_SEEN = 'lx:orderSeen:v1';
const KEY_WRONG = 'lx:orderWrong:v1';

export const STOCK_MAX = 24;
/** Ab so viel Vorrat wird nicht nachgefragt (eine Runde hat 6, davon höchstens die Hälfte aus dem Vorrat). */
export const STOCK_LOW = 8;
export const STOCK_MIN_ACCEPT = 3;
export const SEEN_MAX = 40;
export const COOLDOWN_MS = 20 * 60_000;
export const ROUND_REQUEST = 6;

type Stored = { items: unknown[]; at: number };

const toRaw = (e: PoolEntry): Record<string, unknown> => ({
  topic: e.topic,
  en: e.en,
  de: e.de,
  chunks: [...e.chunks],
  ...(e.alt.length ? { alt: [...e.alt] } : {}),
  ...(e.single ? { single: e.single } : {}),
  why: [e.why.de, e.why.en],
  ...(e.bad ? { bad: e.bad } : {}),
});

const list = (key: string): string[] => {
  const v = local.getJson<unknown>(key);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
};

/** Zuletzt gesehene Sätze (Normalform), neueste zuletzt. */
export const seenSentences = (): string[] => list(KEY_SEEN);

/** Merkt Sätze als gesehen (Ringpuffer). */
export function noteSeen(sentences: readonly string[]): void {
  const next = [...seenSentences().filter((s) => !sentences.map(poolNorm).includes(s)), ...sentences.map(poolNorm)].slice(-SEEN_MAX);
  local.set(KEY_SEEN, JSON.stringify(next));
}

/** Themen, in denen zuletzt ein Satz falsch war (neueste zuerst, höchstens 7). */
export const wrongTopics = (): string[] => list(KEY_WRONG).filter((t) => (ORDER_TOPICS as readonly string[]).includes(t));

/** Ergebnis eines Satzes: falsch merkt das Thema für die nächste Runde, richtig (nicht „fast“) nimmt es wieder heraus. */
export function noteResult(topic: string | null, verdict: 'correct' | 'near' | 'wrong'): void {
  if (!topic || verdict === 'near') return;
  const rest = wrongTopics().filter((t) => t !== topic);
  local.set(KEY_WRONG, JSON.stringify(verdict === 'wrong' ? [topic, ...rest].slice(0, ORDER_TOPICS.length) : rest));
}

function readStored(): Stored {
  const v = local.getJson<Partial<Stored>>(KEY_STOCK);
  return { items: Array.isArray(v?.items) ? v.items : [], at: typeof v?.at === 'number' ? v.at : 0 };
}

/** Geprüfter Vorrat (jeder Eintrag wird beim Lesen erneut geprüft: Altlast, Manipulation). */
export function readStock(): PoolEntry[] {
  const known = poolSentenceKeys();
  const out: PoolEntry[] = [];
  for (const raw of readStored().items) {
    const e = acceptGenerated(raw, known);
    if (!e) continue;
    out.push(e);
    known.add(poolNorm(e.en));
    for (const a of e.alt) known.add(poolNorm(a));
  }
  return out.slice(0, STOCK_MAX);
}

function writeStock(items: readonly PoolEntry[], at: number): void {
  const stored: Stored = { items: items.slice(0, STOCK_MAX).map(toRaw), at };
  local.set(KEY_STOCK, JSON.stringify(stored));
}

/** Nimmt bis zu `max` Sätze aus dem Vorrat (sie verlassen ihn). Schwerpunkt-Themen zuerst. */
export function takeStock(max: number, prefer: readonly string[] = []): PoolEntry[] {
  if (max < 1) return [];
  const stock = readStock();
  if (!stock.length) return [];
  const ordered = [...stock.filter((e) => prefer.includes(e.topic)), ...stock.filter((e) => !prefer.includes(e.topic))];
  const taken = ordered.slice(0, max);
  const rest = stock.filter((e) => !taken.includes(e));
  writeStock(rest, readStored().at);
  return taken;
}

let inflight = false;

/** Themen für die Anfrage: zuletzt falsche zuerst, dann alle übrigen. */
const topicsFor = (): string[] => {
  const wrong = wrongTopics();
  return [...wrong, ...ORDER_TOPICS.filter((t) => !wrong.includes(t))];
};

/**
 * Füllt den Vorrat im Hintergrund auf. Nur, wenn er knapp ist, keine Anfrage läuft und die letzte nicht in den letzten
 * 20 Minuten war. Genau EIN Aufruf, kein Neuversuch. `words` sind aktuelle Wörter aus Emrahs Wortschatz (Kontext).
 */
export function prefetchOrder(words: readonly string[] = [], now: number = Date.now()): void {
  if (inflight) return;
  const stored = readStored();
  if (readStock().length >= STOCK_LOW) return;
  if (stored.at > 0 && now - stored.at < COOLDOWN_MS) return;
  inflight = true;
  // Zeitstempel sofort: auch ein Fehler oder Abbruch löst nicht gleich die nächste Anfrage aus.
  writeStock(readStock(), now);
  const ctl = new AbortController();
  askJson({ template: orderGen, vars: { topics: topicsFor(), words, avoid: seenSentences().slice(-6).reverse(), n: ROUND_REQUEST }, signal: ctl.signal, priority: 'background' })
    .then((r) => {
      const known = poolSentenceKeys();
      for (const s of seenSentences()) known.add(s);
      const have = readStock();
      for (const e of have) known.add(poolNorm(e.en));
      const fresh: PoolEntry[] = [];
      for (const raw of r.data.items) {
        const e = acceptGenerated(raw, known);
        if (!e) continue;
        fresh.push(e);
        known.add(poolNorm(e.en));
        for (const a of e.alt) known.add(poolNorm(a));
      }
      if (fresh.length < STOCK_MIN_ACCEPT) {
        logWarn('drills:order-gen', { code: 'too_few', message: `${fresh.length} von ${r.data.items.length} Sätzen bestanden die Prüfung` }, 'verworfen');
        return;
      }
      writeStock([...have, ...fresh].slice(-STOCK_MAX), now);
    })
    .catch((err: unknown) => {
      if (isAiFailure(err) && (err.kind === 'cancelled' || err.kind === 'unavailable' || err.kind === 'busy')) return;
      logWarn('drills:order-gen', err, 'Anfrage');
    })
    .finally(() => {
      inflight = false;
    });
}

/** Nur für Tests. */
export function resetOrderGen(): void {
  inflight = false;
  local.remove(KEY_STOCK);
  local.remove(KEY_SEEN);
  local.remove(KEY_WRONG);
}
