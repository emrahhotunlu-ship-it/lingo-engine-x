import { checkFind, checkGrammar, checkKwt, checkMeaning, closeVariant, fitAskable } from '../grammar/check';
import { legacyNorm } from '../grammar/key';
import type { FindAlt, GrammarCheck, GrammarTask } from '../learn/types';
import type { GrammarFitOut } from '../../prompts/grammarFit';
import { diagnoseAnswer, sameClass, sharesContent, type Diagnosis } from './diagnose';
import { WRONG_CAUSES, type Verdict } from './tutorTypes';

// Urteil der Tutor-Engine (docs/umbau/tutor-engine-v3.md §4.1, Invariante „kein falsches falsch“). Rein, ohne KI, deterministisch.
// Hülle um `checkGrammar` / `checkFind` / `checkKwt` / `checkMeaning`: deren Verhalten bleibt unverändert, `judge` ordnet nur ein.
//
// 1. „Auch richtig“ zuerst: Lösung bzw. `accepted` → britische Form → `altFamilies` → `task.alt` (alles in `checkGrammar`) → `fitAlt` → `errAlt`.
// 2. Dann `diagnoseAnswer`. `wrong` nur bei bekannter falscher Form / Signalwort-Konflikt (`dx.known`) oder Ursache form|auxform|order|span
//    (dazu die festen Prüfungen: Auswahl, Bedeutungspaar, fehlendes Schlüsselwort, Wortzahl, leere Antwort).
// 3. Sonst `unsure` (gebucht wie `near`) – außer die Antwort ist unplausibel (weder eng verwandt mit einer Lösung, `closeVariant`, noch mit
//    gemeinsamem Inhaltswort): dann `wrong`, damit Raten nie als richtig gebucht wird. Claude darf beides hochstufen.
// 4. Claude stuft nur hoch (`fits && certain`), nie herunter.

export type FitAltEntry = { a: string; t: number; by: 'ai' | 'me'; pv: string };
/** `grammar/<topic>.fitAlt`: `{[taskKey]: {[hash]: FitAltEntry}}` (Tutor-Engine v3 §3.2). */
export type FitAltIndex = Readonly<Record<string, Readonly<Record<string, FitAltEntry>>>>;

export type Judgement = {
  v: Verdict;
  kind: GrammarCheck['kind'];
  by: 'local' | 'ai' | 'me';
  /** Trifft die Antwort das Zielmuster der Aufgabe? `null` = unbekannt. */
  fitsGoal: boolean | null;
  book: 'full' | 'half' | 'none';
  askAi: 'auto' | 'button' | 'no';
  /** Die zugrunde liegende Prüfung (unverändert). Ergänzung gegenüber §6.2. */
  check: GrammarCheck;
  /** Diagnose, falls gerechnet (nur bei lokal abgelehnter Antwort). Ergänzung gegenüber §6.2. */
  dx: Diagnosis | null;
  /** Eigene Begründung einer anderen gültigen Korrektur (`errAlt`). Ergänzung gegenüber §6.2. */
  altWhy?: { de: string; en: string };
};

export type JudgeCtx = {
  fitAlt: FitAltIndex;
  dx?: Diagnosis;
  /** Claudes Urteil (grammar-fit@2); ältere Formen mit `why` als Text werden toleriert. */
  ai?: (Pick<GrammarFitOut, 'fits' | 'certain'> & { fitsGoal?: boolean; why?: unknown }) | null;
  aiState: { confirmed: boolean; available: boolean; budgetLeft: number };
  /** Fehler finden: angetippter Bereich (für `errAlt` an einer anderen Stelle). */
  tapped?: readonly [number, number] | null;
  /** Zweitversuch „Zielform schreiben“ nach `alt_ok` mit `fitsGoal:false`: zählt höchstens halb (Buchungstabelle §4.1). */
  targetRetry?: boolean;
  /** Lernermodell (nur für die Diagnose: offene Annahmen). */
  model?: { hyps: readonly { from: string; to: string; state: string }[] } | null;
};

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** `fitAlt` eines Grammatik-Dokuments, tolerant gelesen (unbekannte oder kaputte Einträge fallen still heraus, es wird nichts geschrieben). */
export function readFitAlt(doc: Readonly<Record<string, unknown>> | null | undefined): FitAltIndex {
  const root = obj(doc?.fitAlt);
  if (!root) return {};
  const out: Record<string, Record<string, FitAltEntry>> = {};
  for (const [task, rawMap] of Object.entries(root)) {
    const m = obj(rawMap);
    if (!m) continue;
    for (const [h, rawE] of Object.entries(m)) {
      const e = obj(rawE);
      if (!e || typeof e.a !== 'string' || (e.by !== 'ai' && e.by !== 'me')) continue;
      (out[task] ??= {})[h] = { a: e.a, t: typeof e.t === 'number' ? e.t : 0, by: e.by, pv: typeof e.pv === 'string' ? e.pv : '' };
    }
  }
  return out;
}

/** Schlüssel einer Antwort in `fitAlt`: FNV-1a (32 Bit, Basis 36) über die normalisierte Antwort. Stabil über Geräte. */
export function fitAltHash(given: string): string {
  const s = legacyNorm(given);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

const overlaps = (a: readonly [number, number], b: readonly [number, number]): boolean => a[0] <= b[1] && a[1] >= b[0];

/** Trifft der Ersatz eine andere gültige Korrektur (`errAlt`)? Mit angetipptem Bereich nur die dort liegende. */
function errAltHit(task: GrammarTask, given: string, tapped: readonly [number, number] | null | undefined): FindAlt | null {
  const x = task.x?.kind === 'find' ? task.x : null;
  if (!x?.errAlt?.length) return null;
  const cands = tapped ? x.errAlt.filter((a) => overlaps(a.err, tapped)) : x.errAlt;
  for (const a of cands) {
    const c = checkGrammar({ ...task, type: 'gap', answer: a.answer, accepted: [...a.accepted], alt: [] }, given);
    if (c.verdict === 'correct') return a;
  }
  return null;
}

/**
 * Britisches „have got“ statt amerikanisch „have gotten“ (CLAUDE.md A7: britische Formen gelten als richtig). `toUS` kennt nur Schreibweisen;
 * `checkGrammar` hält „got“ sonst für einen Formfehler. Die US-Form wird als Hinweis mitgegeben.
 */
function ukGot(task: GrammarTask, given: string): string | null {
  const g = legacyNorm(given);
  if (!/\bgot\b/.test(g)) return null;
  for (const t of [task.answer, ...task.accepted]) if (/\bgotten\b/.test(legacyNorm(t)) && legacyNorm(t).replace(/\bgotten\b/g, 'got') === g) return t;
  return null;
}

/** Die unveränderte Prüfung je Aufgabenart (plus britisches „got“). */
function baseCheck(task: GrammarTask, given: string, tapped: readonly [number, number] | null | undefined): GrammarCheck {
  const c = rawCheck(task, given, tapped);
  if (c.verdict !== 'wrong' || c.kind === 'key' || c.kind === 'words' || task.type === 'mc' || task.type === 'meaning') return c;
  const us = ukGot(task, given);
  return us ? { ...c, verdict: 'correct', kind: 'uk', us, needsJudge: false } : c;
}

function rawCheck(task: GrammarTask, given: string, tapped: readonly [number, number] | null | undefined): GrammarCheck {
  if (task.type === 'kwt') return checkKwt(task, given);
  if (task.type === 'meaning') return checkMeaning(task, given.trim() as 'a' | 'b' | 'both');
  if (task.type === 'find') {
    const x = task.x?.kind === 'find' ? task.x : null;
    // Angetippt wurde nur eine andere gültige Stelle: der Ersatz wird dort geprüft (siehe `errAltHit`), nicht an der Hauptstelle.
    if (tapped && x?.err && !overlaps(x.err, tapped) && x.errAlt?.some((a) => overlaps(a.err, tapped))) return { verdict: 'wrong', ops: [], needsJudge: false };
    return checkFind(task, { replacement: given });
  }
  return checkGrammar(task, given);
}

/**
 * Urteil über eine Antwort. `given` ist der Antwortteil (Lücke, Ersatz der Fehlerstelle, ganzer Satz; bei `meaning` 'a' | 'b' | 'both').
 * Die Buchung folgt der Tabelle in §4.1; `unsure` wird wie `near` voll gebucht.
 */
export function judge(task: GrammarTask, given: string, ctx: JudgeCtx): Judgement {
  const check = baseCheck(task, given, ctx.tapped);
  const retry = ctx.targetRetry === true;
  const base = { check, dx: null as Diagnosis | null, by: 'local' as const, askAi: 'no' as const };

  if (check.verdict === 'correct') {
    if (check.kind === 'other') return { ...base, v: 'alt_ok', kind: check.kind, fitsGoal: false, book: 'none' };
    if (check.kind === 'alt') return { ...base, v: 'alt_ok', kind: check.kind, fitsGoal: true, book: retry ? 'half' : 'full' };
    return { ...base, v: 'correct', kind: check.kind, fitsGoal: true, book: retry ? 'half' : 'full' };
  }
  if (check.verdict === 'near') return { ...base, v: 'near', kind: check.kind, fitsGoal: true, book: retry ? 'half' : 'full' };

  const raw = given.trim();
  const fixed = task.type === 'mc' || task.type === 'meaning';
  if (!raw || fixed) return { ...base, v: 'wrong', kind: check.kind, fitsGoal: false, book: retry ? 'half' : 'full' };

  // „Auch richtig“ aus früheren Urteilen (Emrahs Einspruch bzw. Claudes Ja) und andere gültige Korrektur der Fehlersuche.
  const fa = ctx.fitAlt[task.key]?.[fitAltHash(raw)];
  if (fa?.by === 'me') return { ...base, v: 'correct', kind: check.kind, by: 'me', fitsGoal: true, book: retry ? 'half' : 'full' };
  if (fa?.by === 'ai') return { ...base, v: 'alt_ok', kind: 'other', by: 'ai', fitsGoal: null, book: 'none' };
  const ea = task.type === 'find' ? errAltHit(task, raw, ctx.tapped) : null;
  if (ea) return { ...base, v: 'correct', kind: 'alt', fitsGoal: true, book: retry ? 'half' : 'full', altWhy: { de: ea.why.de, en: ea.why.en } };

  const dx = ctx.dx ?? diagnoseAnswer(task, raw, ctx.model ?? null);
  const hardKind = check.kind === 'key' || check.kind === 'words' || check.kind === 'form';
  // Plausibel: nah an einer Lösung, gemeinsames Inhaltswort oder (nur Funktionswörter) dieselbe Wortklasse → „unsicher“ statt „falsch“.
  const plausible = closeVariant(task, raw) || sharesContent(task, raw) || sameClass(task, raw);
  const wrong = dx.known || WRONG_CAUSES.has(dx.cause) || hardKind || !plausible;
  const v: Verdict = wrong ? 'wrong' : 'unsure';

  const { available, confirmed, budgetLeft } = ctx.aiState;
  let askAi: Judgement['askAi'] = 'no';
  if (available) {
    if (v === 'unsure') askAi = confirmed && budgetLeft > 0 ? 'auto' : 'button';
    else if (!dx.known && !hardKind && !['typo', 'form', 'auxform', 'order', 'span'].includes(dx.cause) && (fitAskable(task, check, raw) || check.needsJudge)) askAi = 'button';
  }

  const ai = ctx.ai;
  if (ai && ai.fits && ai.certain && (v === 'unsure' || askAi !== 'no')) {
    return { check, dx, v: 'alt_ok', kind: 'other', by: 'ai', fitsGoal: ai.fitsGoal ?? null, book: 'none', askAi: 'no' };
  }
  return { check, dx, v, kind: check.kind, by: 'local', fitsGoal: v === 'unsure' ? null : false, book: retry ? 'half' : 'full', askAi };
}
