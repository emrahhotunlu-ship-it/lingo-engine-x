import { getWriter } from '../../data';
import { validateDoc } from '../../data/validate';
import { channelLogEntry, type ChannelLogEntry } from '../../domain/progress/channelLog';
import type { UnitEnd } from '../../domain/progress/unitPatch';
import { radarEvents, radarPatch } from '../../domain/radar/events';
import {
  articleDoc,
  discPatch,
  genPatch,
  lpoolDoc,
  readingDoc,
  readingSummaryPatch,
  writingDoc,
  writingResDoc,
  type GeneratedArticle,
  type GeneratedListening,
  type ReadingCheckRes,
  type WritingReviewRes,
} from '../../domain/input/records';
import type { ArticleItem, Cefr, ChoiceResult, Domain, Question, TextError, UnitCtx, WritingPrompt } from '../../domain/input/types';
import type { DiscStep } from '../../domain/discover/steps';
import { logError, logWarn } from '../../platform/diagnostics';
import { nextT, recordChannelEntries, recordUnitEnd } from '../vocab/persist';
import { mergeLocal, putLocal } from './library';

// Alle Schreibwege von Phase 4 (Plan §3.1) – ausschließlich über den einen Writer bzw. den
// gemeinsamen Sammel-Schreibweg (persist.ts). Nie `feed/*` oder `daily/*`, nie `delete`,
// nie `set` auf ein bestehendes Dokument. Geschrieben wird nur auf eine Handlung hin.

type Doc = Record<string, unknown>;

export class InputWriteError extends Error {
  constructor(readonly scope: string) {
    super(scope);
    this.name = 'InputWriteError';
  }
}

function writer() {
  const w = getWriter();
  if (!w) throw new InputWriteError('no_db');
  return w;
}

/** Profil-Felder, die keine Zähler sind (`gen`, `disc`): nur bei echter Änderung, frischer Stand. */
async function patchProfile(scope: string, compute: (cur: Doc) => Doc | null): Promise<void> {
  try {
    await writer().transform('app/profile', (cur) => {
      if (!cur || !validateDoc('app/profile', cur).ok) return null;
      const p = compute(cur);
      return p ? { update: p } : null;
    });
  } catch (err) {
    logError(scope, err, 'app/profile');
    throw err;
  }
}

// ---------------------------------------------------------------- erzeugte Inhalte

export async function saveGeneratedArticle(a: GeneratedArticle, i: { level: Cefr; domain: Domain; day: string; src: 'ai' | 'own' }): Promise<string> {
  const t = nextT();
  const doc = articleDoc(a, { t, level: i.level, domain: i.domain, pv: 'reading-text@1', src: i.src });
  const id = `ai${t}`;
  try {
    await writer().createIfMissing(`articles/${id}`, doc);
  } catch (err) {
    logError('read:save', err, `articles/${id}`);
    throw err;
  }
  putLocal('articles', id, doc);
  if (i.src === 'ai') await patchProfile('read:gen', (cur) => genPatch(cur.gen, 'ar', i.day)).catch((err: unknown) => logWarn('read:gen', err));
  return id;
}

/** Eigener Text ohne KI-Aufbereitung (M16): nur Titel und Text, `src:'own'`. */
export async function saveOwnArticle(text: string, title: string, i: { level: Cefr; domain: Domain }): Promise<string> {
  return saveGeneratedArticle({ title, topic: 'own', topic_de: 'Eigener Text', topic_en: 'Your own text', teaser: '', text, keypoints: [], glossary: [], questions: [] }, { ...i, day: '', src: 'own' });
}

/** Aufbereitung eines gespeicherten eigenen Texts ergänzen (Titel, Glossar, Fragen); der Text bleibt. */
export async function enrichOwnArticle(id: string, a: Omit<GeneratedArticle, 'text'>): Promise<void> {
  const patch: Doc = {
    title: a.title,
    topic: a.topic,
    topic_de: a.topic_de,
    topic_en: a.topic_en,
    teaser: a.teaser,
    keypoints: [...a.keypoints],
    glossary: a.glossary.map((g) => ({ ...g })),
    questions: a.questions.map((q) => ({ ...q, options: [...q.options] })),
    pv: 'reading-text@1',
  };
  try {
    await writer().transform(`articles/${id}`, (cur) => (cur ? { update: patch } : null));
  } catch (err) {
    logError('read:enrich', err, `articles/${id}`);
    throw err;
  }
  mergeLocal('articles', id, patch);
}

export async function saveGeneratedListening(l: GeneratedListening, i: { level: Cefr; domain: Domain; day: string }): Promise<string> {
  const t = nextT();
  const doc = lpoolDoc(l, { t, level: i.level, domain: i.domain, pv: 'listening-text@1' });
  const id = `ai${t}`;
  try {
    await writer().createIfMissing(`lpool/${id}`, doc);
  } catch (err) {
    logError('listen:save', err, `lpool/${id}`);
    throw err;
  }
  putLocal('lpool', id, doc);
  await patchProfile('listen:gen', (cur) => genPatch(cur.gen, 'lp', i.day)).catch((err: unknown) => logWarn('listen:gen', err));
  return id;
}

// ---------------------------------------------------------------- Fehler-Radar

export async function addRadar(errors: readonly TextError[], text: string, s: 'w' | 'r'): Promise<void> {
  if (!errors.length) return;
  const t0 = nextT();
  // Die Ereignisse tragen t0 + i: die Zeitstempel danach bleiben eindeutig und steigend.
  for (let i = 1; i < errors.length; i++) nextT();
  const events = radarEvents(errors, text, s, t0);
  let invalid = false;
  try {
    await writer().transform('app/radar', (cur) => {
      const op = radarPatch(cur, events);
      if (!op && cur) invalid = !validateDoc('app/radar', cur).ok;
      return op;
    });
    if (invalid) logWarn('radar:write', { code: 'invalid_document', message: 'Fehler-Radar ungültig – nicht überschrieben' }, 'app/radar');
  } catch (err) {
    logError('radar:write', err, 'app/radar');
  }
}

// ---------------------------------------------------------------- Log-Einträge der Fragen

export function questionEntries(i: {
  day: string;
  type: ChannelLogEntry['type'];
  ref: string;
  questions: readonly Question[];
  results: readonly ChoiceResult[];
  lang: string;
  ctx: UnitCtx;
}): Array<ChannelLogEntry & { day: string }> {
  return i.results.map((r) => {
    const q = i.questions.find((x) => x.key === r.key);
    return {
      ...channelLogEntry({
        t: nextT(),
        ok: r.correct,
        lang: i.lang,
        type: i.type,
        ref: i.ref,
        q: q?.q ?? '',
        given: q?.options[r.chosen] ?? '',
        ans: q ? (q.options[q.answer] ?? '') : '',
        ms: r.ms,
        ctx: i.ctx,
      }),
      day: i.day,
    };
  });
}

// ---------------------------------------------------------------- Lesen

export async function completeReading(i: {
  day: string;
  item: ArticleItem;
  questions: readonly Question[];
  results: readonly ChoiceResult[];
  activeMs: number;
  lang: string;
  ctx: UnitCtx;
}): Promise<string> {
  const t = nextT();
  const id = `r${t}`;
  const ok = i.results.filter((r) => r.correct).length;
  const doc = readingDoc({ t, day: i.day, item: i.item, n: i.results.length, ok, readSec: i.activeMs / 1000 });
  try {
    await writer().createIfMissing(`reading/${id}`, doc);
  } catch (err) {
    logError('read:complete', err, `reading/${id}`);
    throw err;
  }
  putLocal('reading', id, doc);
  recordChannelEntries(questionEntries({ day: i.day, type: 'read', ref: i.item.ref, questions: i.questions, results: i.results, lang: i.lang, ctx: i.ctx }));
  const unit: UnitEnd = { day: i.day, act: 'read', answers: i.results.length, right: ok, oks: i.results.map((r) => r.correct), activeMs: i.activeMs, domain: i.item.domain };
  await recordUnitEnd(unit);
  return id;
}

export async function saveReadingSummary(id: string, summary: string, words: number, res: (ReadingCheckRes & { lang: 'de' | 'en'; pv: string }) | null): Promise<void> {
  const patch = readingSummaryPatch(summary, words, res);
  try {
    await writer().transform(`reading/${id}`, (cur) => (cur ? { update: patch } : null));
  } catch (err) {
    logError('read:summary', err, `reading/${id}`);
    throw err;
  }
  mergeLocal('reading', id, patch);
}

// ---------------------------------------------------------------- Hören

export async function completeListening(i: {
  day: string;
  item: { id: string; ref: string; level: string; domain: Domain };
  questions: readonly Question[];
  results: readonly ChoiceResult[];
  plays: number;
  rate: number;
  help: boolean;
  activeMs: number;
  lang: string;
  ctx: UnitCtx;
}): Promise<boolean> {
  const ok = i.results.filter((r) => r.correct).length;
  recordChannelEntries(questionEntries({ day: i.day, type: 'listen', ref: i.item.ref, questions: i.questions, results: i.results, lang: i.lang, ctx: i.ctx }));
  return recordUnitEnd({
    day: i.day,
    act: 'listen',
    answers: i.results.length,
    right: ok,
    oks: i.results.map((r) => r.correct),
    activeMs: i.activeMs,
    domain: i.item.domain,
    listen: { id: i.item.id, level: i.item.level, n: i.results.length, ok, plays: i.plays, rate: i.rate, help: i.help, t: nextT() },
  });
}

// ---------------------------------------------------------------- Schreiben

/** Aufgabe des Tages anlegen, falls es sie nicht gibt; liefert die gespeicherte (die gewinnt). */
export async function ensureDailyPrompt(day: string, p: Doc): Promise<Doc> {
  let stored: Doc | null = null;
  const doc = { p, t: nextT() };
  try {
    await writer().transform(`wprompt/${day}`, (cur) => {
      if (cur) {
        stored = cur;
        return null;
      }
      return { set: doc };
    });
  } catch (err) {
    logError('write:prompt', err, `wprompt/${day}`);
    throw err;
  }
  const final: Doc = stored ?? doc;
  putLocal('wprompt', day, final);
  return final;
}

/** „Andere Aufgabe" / „Eigenes Thema": nur solange heute noch kein Text abgegeben ist (Aufrufer prüft). */
export async function replaceDailyPrompt(day: string, p: Doc): Promise<void> {
  const patch = { p, t: nextT() };
  try {
    await writer().transform(`wprompt/${day}`, (cur) => (cur ? { update: patch } : { set: patch }));
  } catch (err) {
    logError('write:prompt', err, `wprompt/${day}`);
    throw err;
  }
  putLocal('wprompt', day, patch);
  await patchProfile('write:gen', (cur) => genPatch(cur.gen, 'wp', day)).catch((err: unknown) => logWarn('write:gen', err));
}

export async function submitWriting(i: { day: string; prompt: WritingPrompt; text: string; words: number; lang: 'de' | 'en'; activeMs: number }): Promise<string> {
  const t = nextT();
  const id = `w${t}`;
  const doc = writingDoc({ t, day: i.day, prompt: i.prompt, text: i.text, words: i.words, lang: i.lang });
  try {
    await writer().createIfMissing(`writing/${id}`, doc);
  } catch (err) {
    logError('write:submit', err, `writing/${id}`);
    throw err;
  }
  putLocal('writing', id, doc);
  await recordUnitEnd({ day: i.day, act: 'write', answers: 0, right: 0, activeMs: i.activeMs, domain: i.prompt.domain });
  return id;
}

/** Überarbeitete Fassung speichern (freiwillig, kein weiterer Einheitsabschluss). */
export async function reviseWriting(id: string, text: string, words: number): Promise<number> {
  let rev = 0;
  try {
    await writer().transform(`writing/${id}`, (cur) => {
      if (!cur) return null;
      rev = (typeof cur.rev === 'number' && Number.isFinite(cur.rev) ? cur.rev : 0) + 1;
      return { update: { text, words, rev } };
    });
  } catch (err) {
    logError('write:revise', err, `writing/${id}`);
    throw err;
  }
  mergeLocal('writing', id, { text, words, rev });
  return rev;
}

export async function saveWritingReview(id: string, res: WritingReviewRes, lang: 'de' | 'en', rev: number, text: string): Promise<void> {
  const resDoc = { ...writingResDoc(res, lang, 'writing-review@1'), rev };
  try {
    await writer().transform(`writing/${id}`, (cur) => (cur ? { update: { res: resDoc } } : null));
  } catch (err) {
    logError('write:review', err, `writing/${id}`);
    throw err;
  }
  mergeLocal('writing', id, { res: resDoc });
  await addRadar(res.errors, text, 'w');
}

// ---------------------------------------------------------------- Entdecken

export async function markDiscStep(itemId: string, step: DiscStep, day: string): Promise<void> {
  await patchProfile('discover:step', (cur) => discPatch(cur.disc, itemId, step, day));
}

/** „Anwenden" abgegeben: Schritt setzen und Einheit abschließen (Antworten = Fragen dieser Sitzung). */
export async function completeDiscover(i: { day: string; itemId: string; domain: Domain; activeMs: number; results: readonly ChoiceResult[] }): Promise<void> {
  await markDiscStep(i.itemId, 'use', i.day);
  const right = i.results.filter((r) => r.correct).length;
  await recordUnitEnd({ day: i.day, act: 'discover', answers: i.results.length, right, oks: i.results.map((r) => r.correct), activeMs: i.activeMs, domain: i.domain });
}

export function recordDiscoverAnswers(i: { day: string; ref: string; questions: readonly Question[]; results: readonly ChoiceResult[]; lang: string; ctx: UnitCtx }): void {
  recordChannelEntries(questionEntries({ ...i, type: 'discover' }));
}
