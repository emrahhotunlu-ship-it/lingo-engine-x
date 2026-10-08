import { flags } from '../../app/flags';
import { askJson } from '../../ai/gate';
import { selectAiAvailable } from '../../ai/scope';
import { isAiFailure } from '../../ai/types';
import { getWriter } from '../../data';
import { useLive } from '../../data/live';
import { validateDoc } from '../../data/validate';
import { normalize } from '../../domain/answer/normalize';
import { poolNorm } from '../../domain/drills/orderPool';
import { jsonEqual } from '../../domain/equal';
import { storedExamples } from '../../domain/srs/examples';
import { contrastOf } from '../../domain/srs/exercise';
import type { TrainCard } from '../../domain/srs/types';
import { acceptWordCtx, CONTRAST_MIN_STAGE, cfxPatch, isWeak, knownKeys, markBad, needsWordCtx, readCfx, readWx, wxPatch, type Cfx, type WordCtxWord, type Wx } from '../../domain/tutor/acceptWordCtx';
import { tutorCtx } from '../../domain/tutor/ctx';
import { useCapabilities } from '../../platform/capabilities';
import { logError, logWarn } from '../../platform/diagnostics';
import { WORD_CTX_MAX_AVOID, WORD_CTX_MAX_WORDS, wordCtx } from '../../prompts/wordCtx';

// Wörter-Tutor (Lernplattform 3.0 P52, KI-Tutor T3): am Ende einer Wörter-Runde fragt die App im Hintergrund EINMAL `word-ctx@1` für die schwachen
// Wörter der Runde (≤ 6), die noch keine 2 frischen Claude-Sätze haben. Nur mit bestätigter KI-Zustimmung und im gemeinsamen Hintergrund-Budget
// (`budget: { bgPerDay: 1 }`, KI-Tor); ohne `sample` kein Aufruf; nie im Aufholmodus. Jeder Satz wird mit `acceptWordCtx` geprüft und nur ergänzend in
// `vocab/<id>.wx[]` / `.cfx[]` gespeichert (`writer.transform`, nur bei Änderung, Rohdokument bleibt, `S`/`D`/`due`/`stage` unberührt).
// Verwechslungen merkt sich die Runde im Speicher: getippte Antwort = (normalisiert) das Wort einer anderen eigenen Karte. Falsche Freunde aus dem
// Fallen-Index zählen hier (noch) nicht als Verwechslung.

const PV = `${wordCtx.id}@${wordCtx.version}`;

/** Verwechslungen dieser Seite: Kartenschlüssel → Schlüssel der verwechselten Karte (die neueste zählt). */
const confusions = new Map<string, string>();
let inflight = false;

/** Getippte falsche Antwort: ist sie das Wort einer anderen eigenen Vokabel? Dann merken. */
export function noteConfusion(card: TrainCard, given: string, pool: readonly TrainCard[]): void {
  if (card.kind !== 'vocab') return;
  const g = normalize(given);
  if (!g || g === normalize(card.word) || g === normalize(card.lemma)) return;
  const other = pool.find((c) => c.kind === 'vocab' && c.key !== card.key && (normalize(c.word) === g || normalize(c.lemma) === g));
  if (other) confusions.set(card.key, other.key);
}

/** Verwechselte Karte dieser Karte (nur Test und Rundenende). */
export const confusionOf = (key: string): string | undefined => confusions.get(key);

/** Kontrast in dieser Runde erlaubt? Beide Karten mindestens Stufe 2 (ki-tutor.md Z. 80), ein brauchbarer Kontrast-Satz vorhanden. */
export function contrastReady(card: TrainCard, pool: readonly TrainCard[]): boolean {
  if (!flags.tutor.words || card.kind !== 'vocab' || card.stage < CONTRAST_MIN_STAGE) return false;
  const c = contrastOf(card);
  if (!c) return false;
  const w = normalize(c.cfx.w);
  const other = pool.find((p) => p.key !== card.key && (normalize(p.word) === w || normalize(p.lemma) === w));
  return !!other && other.stage >= CONTRAST_MIN_STAGE;
}

/** Die Wörter der Anfrage: schwache Vokabeln der Runde mit Bedarf (≤ 6), mit `other` nur, wenn beide Karten Stufe ≥ 2 haben. */
export function wordCtxCandidates(answered: readonly string[], cards: ReadonlyMap<string, TrainCard>, pool: readonly TrainCard[], nowMs: number): { words: WordCtxWord[]; avoid: string[] } {
  const words: WordCtxWord[] = [];
  const avoid: string[] = [];
  for (const key of answered) {
    if (words.length >= WORD_CTX_MAX_WORDS) break;
    const c = cards.get(key);
    if (!c || c.kind !== 'vocab' || !c.inDb || c.hidden || !isWeak(c.doc, nowMs) || !needsWordCtx(c.doc, nowMs)) continue;
    const otherKey = confusions.get(key);
    const o = otherKey ? (cards.get(otherKey) ?? pool.find((p) => p.key === otherKey)) : undefined;
    const hasCfx = !!o && readCfx(c.doc, true).some((x) => normalize(x.w) === normalize(o.word));
    const other = o && !hasCfx && c.stage >= CONTRAST_MIN_STAGE && o.stage >= CONTRAST_MIN_STAGE ? { en: o.word, de: o.de ?? '' } : null;
    words.push({
      id: c.id,
      en: c.word,
      pos: c.pos ?? '',
      de: c.de ?? '',
      ex: c.context?.sentence ?? (typeof c.doc.ex === 'string' ? c.doc.ex : ''),
      other,
    });
    for (const x of [...readWx(c.doc), ...storedExamples(c.doc)]) if (avoid.length < WORD_CTX_MAX_AVOID) avoid.push(x.en);
  }
  return { words, avoid };
}

export type SaveWordCtxResult = 'saved' | 'unchanged' | 'unavailable' | 'blocked' | 'failed';

/** Ergänzend speichern: neue `wx` hinten an (≤ 4), `cfx` (≤ 2). Nie ein neues Dokument, nie in ein ungültiges, nur bei Änderung. */
export async function saveWordCtx(path: string, wx: readonly Wx[], cfx: Cfx | null): Promise<SaveWordCtxResult> {
  const writer = getWriter();
  if (!writer) return 'unavailable';
  let result: SaveWordCtxResult = 'unchanged';
  try {
    await writer.transform(path, (cur) => {
      if (!cur) {
        result = 'blocked';
        return null;
      }
      if (!validateDoc(path, cur).ok) {
        logWarn(
          'tutor:word-ctx',
          {
            code: 'invalid_document',
            message: 'Karte ungültig – neue Sätze nicht gespeichert',
          },
          path,
        );
        result = 'blocked';
        return null;
      }
      // Auf dem frischen Stand erneut gegen Dubletten prüfen (zweiter Tab, ältere Runde).
      const keys = knownKeys(cur, '');
      const freshWx = wx.filter((x) => !keys.has(poolNorm(x.en)));
      const update: Record<string, unknown> = {};
      const nextWx = wxPatch(cur.wx, freshWx);
      if (nextWx && !jsonEqual(nextWx, cur.wx)) update.wx = nextWx;
      const sameCfx = cfx && readCfx(cur, true).some((x) => normalize(x.w) === normalize(cfx.w));
      const nextCfx = sameCfx ? null : cfxPatch(cur.cfx, cfx);
      if (nextCfx && !jsonEqual(nextCfx, cur.cfx)) update.cfx = nextCfx;
      if (!Object.keys(update).length) return null;
      result = 'saved';
      return { update };
    });
    return result;
  } catch (err) {
    logError('tutor:word-ctx', err, path);
    return 'failed';
  }
}

/** „Melden“ an einem Claude-Satz: `bad: 1` am Eintrag (nichts gelöscht); der Satz wird nie mehr gezeigt. */
export async function reportWordCtx(path: string, kind: 'wx' | 'cfx', en: string): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  let wrote = false;
  try {
    await writer.transform(path, (cur) => {
      if (!cur || !validateDoc(path, cur).ok) return null;
      const next = markBad(cur[kind], en);
      if (!next) return null;
      wrote = true;
      return { update: { [kind]: next } };
    });
  } catch (err) {
    logError('tutor:word-ctx-report', err, path);
    return false;
  }
  return wrote;
}

/**
 * Rundenende: höchstens EIN Hintergrund-Aufruf (das KI-Tor prüft Zustimmung und Tagesdeckel). Nie im Aufholmodus, nie ohne KI, nie parallel.
 * Fehler, fehlende Fähigkeit und Drosselung bleiben still.
 */
export function requestWordCtx(i: { answered: readonly string[]; cards: ReadonlyMap<string, TrainCard>; pool: readonly TrainCard[]; catchUp: boolean; nowMs?: number }): void {
  if (!flags.tutor.words || i.catchUp || inflight) return;
  if (!selectAiAvailable(useCapabilities.getState())) return;
  const nowMs = i.nowMs ?? Date.now();
  const { words, avoid } = wordCtxCandidates(i.answered, i.cards, i.pool, nowMs);
  if (!words.length) return;
  const ctx = tutorCtx(useLive.getState().docs['app/profile'] ?? null);
  const byId = new Map(words.map((w) => [w.id, w]));
  const cardOf = new Map<string, TrainCard>();
  for (const key of i.answered) {
    const c = i.cards.get(key);
    if (c && c.kind === 'vocab' && byId.has(c.id)) cardOf.set(c.id, c);
  }
  inflight = true;
  const ctl = new AbortController();
  askJson({
    template: wordCtx,
    vars: { words, ctx, avoid },
    signal: ctl.signal,
    priority: 'background',
  })
    .then(async (r) => {
      let kept = 0;
      let dropped = 0;
      for (const raw of r.data.items) {
        const id = raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).id === 'string' ? ((raw as Record<string, unknown>).id as string).trim() : '';
        const word = byId.get(id);
        const card = cardOf.get(id);
        if (!word || !card) {
          dropped++;
          continue;
        }
        const ok = acceptWordCtx(raw, word, knownKeys(card.doc, word.ex), nowMs, PV);
        dropped += ok.rejected.length;
        if (!ok.wx.length && !ok.cfx) continue;
        kept += ok.wx.length + (ok.cfx ? 1 : 0);
        await saveWordCtx(card.path, ok.wx, ok.cfx);
      }
      if (dropped > 0)
        logWarn(
          'tutor:word-ctx',
          {
            code: 'rejected',
            message: `${dropped} Sätze verworfen, ${kept} übernommen`,
          },
          'Prüfung',
        );
    })
    .catch((err: unknown) => {
      if (isAiFailure(err) && (err.kind === 'cancelled' || err.kind === 'unavailable' || err.kind === 'busy')) return;
      logWarn('tutor:word-ctx', err, 'Anfrage');
    })
    .finally(() => {
      inflight = false;
    });
}

/** Nur für Tests. */
export function resetWordCtx(): void {
  confusions.clear();
  inflight = false;
}
