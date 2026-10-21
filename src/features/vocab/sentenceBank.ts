import { flags } from '../../app/flags';
import { askJson } from '../../ai/gate';
import { selectAiAvailable } from '../../ai/scope';
import { isAiFailure } from '../../ai/types';
import { getWriter } from '../../data';
import { useLive } from '../../data/live';
import { validateDoc } from '../../data/validate';
import { poolNorm } from '../../domain/drills/orderPool';
import { jsonEqual } from '../../domain/equal';
import { hasGapPlaceholder } from '../../domain/srs/context';
import { storedExamples } from '../../domain/srs/examples';
import type { TrainCard } from '../../domain/srs/types';
import { tutorCtx } from '../../domain/tutor/ctx';
import { acceptBankItem, bankKeys, effectiveGate, gateReviewPatch, gateStartPatch, markSbBad, needsBank, readGate, readSb, reviewFault, sbPatch, type ReviewFault, type SbEntry, type SbGate, type SbReview } from '../../domain/tutor/sentenceBank';
import { useCapabilities } from '../../platform/capabilities';
import { logError, logWarn } from '../../platform/diagnostics';
import { WORD_BANK_MAX_CARDS, wordBank, type WordBankCard } from '../../prompts/wordBank';

// Satzbank SB (Engine-Verdrahtung 19.10.2026; Tutor-Engine v3 E6). Am Ende einer Wörter-Runde fragt die App im Hintergrund höchstens EINMAL
// `word-bank@1` für bis zu 8 Karten mit Bedarf (`needsBank`): zuerst die Karten der Runde, dann weitere des Runden-Vorrats (gebündelt statt je Karte).
// Nur mit bestätigter KI-Zustimmung und im Hintergrund-Budget (`budget: { bgPerDay: 3 }`, KI-Tor), nie im Aufholmodus, nie parallel, nie vor dem
// ersten Zeichnen (nur am Rundenende). Jeder Satz geht durch `acceptBankItem` und wird nur ergänzend in `vocab/<id>.sb[]` gespeichert
// (`writer.transform` je Karte, nur bei Änderung, nie ein neues Dokument, ≤ 8 Sätze ≈ 2 KB je Karte → weit unter 256 KiB, keine neuen Dokumente).
// Claude-Sätze sind 4 Wochen ab Erzeugung nur gesammelt (Quarantäne) und erst nach der Freigabe sichtbar (`effectiveGate`); der erste gesammelte Satz
// setzt einmal `app/profile.sbGate.start`.

const PV = `${wordBank.id}@${wordBank.version}`;
const HAVE_MAX = 3;
let inflight = false;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Der wirksame Freigabe-Schalter aus dem Live-Profil (fehlt er: geschlossen). */
export function currentGate(profile: Readonly<Record<string, unknown>> | null | undefined = useLive.getState().docs['app/profile']): SbGate {
  return effectiveGate(readGate(profile?.sbGate));
}

const exOf = (c: TrainCard): string => c.context?.sentence ?? (typeof c.doc.ex === 'string' && !hasGapPlaceholder(c.doc.ex) ? c.doc.ex : '');

/** Karten der Anfrage: Vokabeln (in der Datenbank, nicht ausgeblendet) mit Bedarf; erst die beantworteten, dann der Vorrat; höchstens 8. */
export function bankCandidates(answered: readonly string[], cards: ReadonlyMap<string, TrainCard>, pool: readonly TrainCard[], gate: SbGate, nowMs: number): Array<{ card: TrainCard; req: WordBankCard }> {
  const out: Array<{ card: TrainCard; req: WordBankCard }> = [];
  const seen = new Set<string>();
  const take = (c: TrainCard | undefined): void => {
    if (!c || out.length >= WORD_BANK_MAX_CARDS || seen.has(c.id)) return;
    seen.add(c.id);
    if (c.kind !== 'vocab' || !c.inDb || c.hidden || !needsBank(c.doc, gate, nowMs)) return;
    const ex = exOf(c);
    const have = [...storedExamples(c.doc).map((x) => x.en), ...readSb(c.doc).map((x) => x.en)].filter((s) => s && s !== ex).slice(0, HAVE_MAX);
    out.push({ card: c, req: { id: c.id, en: c.word, pos: c.pos ?? '', de: c.de ?? '', ex, kind: /\b(sb|sth)\b/.test(c.word) ? 'phrase' : 'word', have } });
  };
  for (const key of answered) take(cards.get(key));
  // Nur bündeln, wenn die Runde selbst Bedarf hat: der Vorrat füllt auf, löst aber nie allein eine Anfrage aus.
  if (!out.length) return out;
  for (const c of pool) take(c);
  return out;
}

export type SaveBankResult = 'saved' | 'unchanged' | 'unavailable' | 'blocked' | 'failed';

/** Ergänzend speichern: neue Sätze hinten an (`sbPatch`, ≤ 8). Nie ein neues Dokument, nie in ein ungültiges, nur bei Änderung. */
export async function saveBank(path: string, add: readonly SbEntry[]): Promise<SaveBankResult> {
  const writer = getWriter();
  if (!writer) return 'unavailable';
  let result: SaveBankResult = 'unchanged';
  try {
    await writer.transform(path, (cur) => {
      if (!cur) {
        result = 'blocked';
        return null;
      }
      if (!validateDoc(path, cur).ok) {
        logWarn('tutor:word-bank', { code: 'invalid_document', message: 'Karte ungültig – neue Sätze nicht gespeichert' }, path);
        result = 'blocked';
        return null;
      }
      // Auf dem frischen Stand erneut gegen Dubletten prüfen (zweiter Tab, ältere Runde).
      const keys = bankKeys(cur, typeof cur.ex === 'string' ? cur.ex : '');
      const fresh = add.filter((x) => !keys.has(poolNorm(x.en)));
      const next = sbPatch(cur.sb, fresh);
      if (!next || jsonEqual(next, cur.sb)) return null;
      result = 'saved';
      return { update: { sb: next } };
    });
    return result;
  } catch (err) {
    logError('tutor:word-bank', err, path);
    return 'failed';
  }
}

/** Erster gesammelter Claude-Satz: `app/profile.sbGate.start` einmal setzen (übrige Felder des Schalters bleiben). Nie in ein ungültiges Profil. */
export async function noteGateStart(nowMs: number): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  let wrote = false;
  try {
    await writer.transform('app/profile', (cur) => {
      if (!cur || !validateDoc('app/profile', cur).ok) return null;
      const p = gateStartPatch(readGate(cur.sbGate), nowMs);
      if (!p) return null;
      wrote = true;
      return { update: { sbGate: { ...(isObj(cur.sbGate) ? cur.sbGate : {}), start: p.start } } };
    });
  } catch (err) {
    logError('tutor:word-bank-gate', err, 'app/profile');
    return false;
  }
  return wrote;
}

/** Ergebnis von „Befund eintragen“: freigegeben · eingetragen, Bank bleibt zu · schon so eingetragen · nicht erlaubt (Grund) · Profil unlesbar · Fehler. */
export type GateReviewResult = { r: 'released' | 'closed' | 'same' | 'failed' | 'invalid' } | { r: 'fault'; fault: ReviewFault };

/**
 * Befund der Lehrer-Stichprobe eintragen (Einstellungen › KI-Stichprobe): `releaseGate` setzt `on` nur bei bestandener Schwelle, `checkedAt` und
 * `review` immer. Ein Schreibweg (`writer.transform('app/profile')`), nur bei Änderung, nie in ein fehlendes oder ungültiges Profil und nie über einen
 * Schalter in unbekannter Form (kein Objekt): dann wird nichts geschrieben (data-guard).
 */
export async function saveGateReview(review: SbReview, sampleN: number, nowMs: number): Promise<GateReviewResult> {
  const writer = getWriter();
  if (!writer) return { r: 'failed' };
  let out: GateReviewResult = { r: 'same' };
  try {
    await writer.transform('app/profile', (cur) => {
      if (!cur || !validateDoc('app/profile', cur).ok || (cur.sbGate !== undefined && cur.sbGate !== null && !isObj(cur.sbGate))) {
        out = { r: 'invalid' };
        return null;
      }
      const gate = readGate(cur.sbGate);
      const fault = reviewFault(gate, nowMs, review, sampleN);
      if (fault) {
        out = { r: 'fault', fault };
        return null;
      }
      const next = gateReviewPatch(cur.sbGate, nowMs, review, sampleN);
      if (!next || jsonEqual(next, cur.sbGate)) {
        out = { r: 'same' };
        return null;
      }
      out = { r: next.on === true ? 'released' : 'closed' };
      return { update: { sbGate: next } };
    });
  } catch (err) {
    logError('tutor:word-bank-review', err, 'app/profile');
    return { r: 'failed' };
  }
  return out;
}

/** „Melden“ an einem Satz der Bank: `bad: 1` am Eintrag (nichts gelöscht); der Satz wird nie mehr gezeigt. */
export async function reportSb(path: string, en: string): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  let wrote = false;
  try {
    await writer.transform(path, (cur) => {
      if (!cur || !validateDoc(path, cur).ok) return null;
      const next = markSbBad(cur.sb, en);
      if (!next) return null;
      wrote = true;
      return { update: { sb: next } };
    });
  } catch (err) {
    logError('tutor:word-bank-report', err, path);
    return false;
  }
  return wrote;
}

/**
 * Rundenende: höchstens EIN Hintergrund-Aufruf (das KI-Tor prüft Zustimmung und Tagesdeckel). Nie im Aufholmodus, nie ohne KI, nie parallel.
 * Fehler, fehlende Fähigkeit und Drosselung bleiben still.
 */
export function requestWordBank(i: { answered: readonly string[]; cards: ReadonlyMap<string, TrainCard>; pool: readonly TrainCard[]; catchUp: boolean; nowMs?: number }): void {
  if (!flags.tutor.words || i.catchUp || inflight) return;
  if (!selectAiAvailable(useCapabilities.getState())) return;
  const nowMs = i.nowMs ?? Date.now();
  const profile = useLive.getState().docs['app/profile'];
  const gate = currentGate(profile);
  const picked = bankCandidates(i.answered, i.cards, i.pool, gate, nowMs);
  if (!picked.length) return;
  const byId = new Map(picked.map((p) => [p.card.id, p]));
  inflight = true;
  const ctl = new AbortController();
  askJson({
    template: wordBank,
    vars: { cards: picked.map((p) => p.req), ctx: tutorCtx(profile ?? null) },
    signal: ctl.signal,
    priority: 'background',
  })
    .then(async (r) => {
      let kept = 0;
      let dropped = 0;
      for (const raw of r.data.items) {
        const id = isObj(raw) && typeof raw.id === 'string' ? raw.id.trim() : '';
        const p = byId.get(id);
        if (!p) {
          dropped++;
          continue;
        }
        byId.delete(id);
        const ok = acceptBankItem(raw, { id, en: p.card.word }, bankKeys(p.card.doc, p.req.ex), nowMs, PV);
        dropped += ok.rejected.length;
        if (!ok.sb.length) continue;
        if ((await saveBank(p.card.path, ok.sb)) === 'saved') kept += ok.sb.length;
      }
      if (kept > 0) await noteGateStart(nowMs);
      if (dropped > 0) logWarn('tutor:word-bank', { code: 'rejected', message: `${dropped} Sätze verworfen, ${kept} übernommen` }, 'Prüfung');
    })
    .catch((err: unknown) => {
      if (isAiFailure(err) && (err.kind === 'cancelled' || err.kind === 'unavailable' || err.kind === 'busy')) return;
      logWarn('tutor:word-bank', err, 'Anfrage');
    })
    .finally(() => {
      inflight = false;
    });
}

/** Nur für Tests. */
export function resetWordBank(): void {
  inflight = false;
}
