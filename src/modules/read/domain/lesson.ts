import { detectLang, isWrongLang } from '../shared';
import type { Check, KeyWord, Sentence } from '../schemas';
import { acceptArticle, britishSpelling, clichePhrase, gluedProblem, hasInnerSentenceEnd } from './accept';
import { phraseUsed } from './apply';
import { courseDef } from './courses';
import type { CourseId } from './courses';
import { lessonDocId } from './paths';
import { safeUrl } from './routine';
import { countWords, normKey, normalizeDashes } from './text';

// Prüftore für eine Kurslektion der Routine (Paket L8, docs/umbau/lesen-routine-kurse.md). Die Routine schreibt `read/c-<Kurs>-<nn>`
// (ein Dokument je Lektion); die App liest nur und prüft streng. Eine Lektion, die durchfällt, wird ausgeblendet (Protokoll), nie gelöscht
// und nie überschrieben: die Liste zeigt dann „wird vorbereitet“. Rein: nichts hier liest oder schreibt die Datenbank.
//
// Der Text läuft durch dieselben Tore wie die Tagesartikel (`acceptArticle`: Form, Länge, Sprache, 1:1, verklebt, Schlüsselwörter, Fragen,
// Schreibweise). Dazu kommen die Tore der Lektion: Kurs und Nummer stimmen, Ziel-Zeile, 4 bis 5 Wendungen (mindestens 3 mehrteilig),
// genau 3 Prüffragen, Sprachtipp (falsch → richtig → Grund), Anwenden-Aufgabe mit Zielwendungen und Musterlösung, Quellen und Stand.

type Doc = Record<string, unknown>;

/** Wortgrenzen des Lektionstextes (Ziel 350 bis 450; die Grenzen lassen Luft). */
export const LESSON_WORDS = [300, 600] as const;
export const LESSON_PHRASES = [4, 5] as const;
export const LESSON_QUESTIONS = 3;
export const SOURCES_MAX = 6;

export type LessonTip = { wrong: string; right: string; why: string };
export type LessonApply = { situation: string; targets: string[]; model: string[] };
export type LessonSource = { title: string; url: string };

export type Lesson = {
  /** Kennung `c-k1-03` (auch `origin.ref` der Karten). */
  id: string;
  course: CourseId;
  n: number;
  title: string;
  goal: string;
  paras: Sentence[][];
  phrases: KeyWord[];
  check: Check[];
  tip: LessonTip;
  apply: LessonApply;
  sources: LessonSource[];
  asOf: string;
  words: number;
};

export type LessonResult = { ok: true; lesson: Lesson } | { ok: false; reason: string };

const clean = (v: unknown, max: number): string => Array.from(typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '').slice(0, max).join('').trimEnd();
const fail = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });

/** Muss diese Lektion Quellen und Stand tragen? Claude-Code-Kurse immer; sonst, sobald Recht (EU AI Act, DSGVO) oder Zahlen vorkommen. */
export function needsSources(course: CourseId, text: string): boolean {
  if (courseDef(course)?.officialDocs) return true;
  return /\bAI Act\b|\bGDPR\b|\bDSGVO\b|\d\s?%|\b\d+(?:[.,]\d+)?\s?(?:percent|million|billion|trillion)\b|\b(?:million|billion|trillion)\b|[€$£]\s?\d/i.test(text);
}

/** Alle sichtbaren Texte der Lektion in einem String (für Prüfungen über den ganzen Text). */
function allText(paras: readonly Sentence[][], extra: readonly string[]): string {
  return [...paras.flat().flatMap((s) => [s.e, s.d]), ...extra].join(' ');
}

function checkEnglishLine(text: string, label: string, max: number): string | null {
  if (!text) return `${label} is missing`;
  if (Array.from(text).length > max) return `${label} is too long (max ${max} characters)`;
  if (/[\r\n]/.test(text)) return `${label} must not contain line breaks`;
  const glued = gluedProblem(text);
  if (glued) return `${label}: ${glued}`;
  const british = britishSpelling(text);
  if (british) return `${label}: use American spelling, not "${british}"`;
  return null;
}

/**
 * Rohes Dokument einer Lektion prüfen. `expect` = Kurs und Nummer aus dem Pfad: das Dokument muss dazu passen (sonst läge eine
 * Lektion unter fremdem Namen). Liefert die bereinigte Lektion oder den ersten Grund (englisch, kurz, für das Protokoll).
 */
export function acceptLesson(raw: unknown, expect: { course: CourseId; n: number }): LessonResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('not an object');
  const o = raw as Doc;
  const def = courseDef(expect.course);
  if (!def) return fail('unknown course');
  if (expect.n < 1 || expect.n > def.lessons) return fail('lesson number outside the course');
  if (o.by !== 'routine') return fail('by must be "routine"');
  if (o.course !== expect.course) return fail('course does not match the document path');
  if (o.n !== expect.n) return fail('n does not match the document path');

  // Text und Wendungen: dieselben Tore wie die Tagesartikel (nachsichtig: überzählige oder schlechte Wendungen fallen weg, Mindestzahl unten).
  const shaped = { title: o.title, topic: def.topic, kind: 'howto', level: 'c1', asOf: o.asOf, summary: undefined, paras: o.paras, keyWords: o.phrases, check: o.check };
  const res = acceptArticle(shaped, { lenient: true, topic: def.topic, words: LESSON_WORDS });
  if (!res.ok) return fail(res.issues.map((i) => `${i.gate}: ${i.message}`).slice(0, 3).join('; '));
  const a = res.article;
  const phrases = a.keyWords;
  if (phrases.length < LESSON_PHRASES[0] || phrases.length > LESSON_PHRASES[1]) return fail(`needs ${LESSON_PHRASES[0]} to ${LESSON_PHRASES[1]} valid key phrases, got ${phrases.length}`);
  const multi = phrases.filter((p) => p.w.split(' ').length >= 2).length;
  if (multi < 3) return fail('at least 3 key phrases must be multi-word collocations');
  const check = a.check ?? [];
  if (check.length !== LESSON_QUESTIONS) return fail(`needs exactly ${LESSON_QUESTIONS} valid check questions`);

  // Ziel-Zeile (Deutsch)
  const goal = clean(normalizeDashes(typeof o.lessonGoal === 'string' ? o.lessonGoal : ''), 240);
  if (Array.from(goal).length < 20) return fail('lessonGoal is missing or too short (German, 20 to 240 characters)');
  if (isWrongLang(goal, 'de') || detectLang(goal) === 'en') return fail('lessonGoal must be German');
  if (gluedProblem(goal)) return fail('lessonGoal contains markup or glued text');

  // Sprachtipp: falsch → richtig → Grund
  const tipRaw = (o.tip && typeof o.tip === 'object' ? o.tip : {}) as Doc;
  const wrong = clean(tipRaw.wrong, 160);
  const right = clean(tipRaw.right, 160);
  const why = clean(normalizeDashes(typeof tipRaw.why === 'string' ? tipRaw.why : ''), 320);
  const wrongProblem = checkEnglishLine(wrong, 'tip.wrong', 160);
  // Der falsche Satz darf britisch oder fehlerhaft sein, aber nicht verklebt.
  if (!wrong || gluedProblem(wrong)) return fail(wrongProblem ?? 'tip.wrong is missing');
  const rightProblem = checkEnglishLine(right, 'tip.right', 160);
  if (rightProblem) return fail(rightProblem);
  if (normKey(wrong) === normKey(right)) return fail('tip.wrong and tip.right must differ');
  if (isWrongLang(right, 'en') || detectLang(right) === 'de') return fail('tip.right must be English');
  if (Array.from(why).length < 20 || isWrongLang(why, 'de') || detectLang(why) === 'en') return fail('tip.why must be German (20 to 320 characters)');

  // Anwenden: Lage (Deutsch), Zielwendungen aus den Schlüsselwendungen, Musterlösung (Englisch)
  const ap = (o.apply && typeof o.apply === 'object' ? o.apply : {}) as Doc;
  const situation = clean(normalizeDashes(typeof ap.situation === 'string' ? ap.situation : ''), 300);
  if (Array.from(situation).length < 20 || isWrongLang(situation, 'de') || detectLang(situation) === 'en') return fail('apply.situation must be German (20 to 300 characters)');
  if (gluedProblem(situation)) return fail('apply.situation contains markup or glued text');
  const rawTargets = Array.isArray(ap.targets) ? ap.targets : [];
  if (rawTargets.length < 2 || rawTargets.length > 4 || !rawTargets.every((t) => typeof t === 'string')) return fail('apply.targets needs 2 to 4 phrases');
  const targets: string[] = [];
  for (const t of rawTargets) {
    const hit = phrases.find((p) => normKey(p.w) === normKey(t));
    if (!hit) return fail(`apply target "${clean(t, 40)}" is not one of the key phrases`);
    if (!targets.includes(hit.w)) targets.push(hit.w);
  }
  if (targets.length < 2) return fail('apply.targets needs at least 2 different phrases');
  const rawModel = Array.isArray(ap.model) ? ap.model : [];
  if (rawModel.length < 2 || rawModel.length > 6 || !rawModel.every((m) => typeof m === 'string')) return fail('apply.model needs 2 to 6 sentences');
  const model: string[] = [];
  for (const m of rawModel) {
    const s = normalizeDashes(clean(m, 280));
    const p = checkEnglishLine(s, 'apply.model sentence', 280);
    if (p) return fail(p);
    if (countWords(s) < 3 || countWords(s) > 45) return fail('each apply.model sentence needs 3 to 45 words');
    if (hasInnerSentenceEnd(s)) return fail('each apply.model entry must be exactly one sentence');
    if (isWrongLang(s, 'en') || detectLang(s) === 'de') return fail('apply.model must be English');
    model.push(s);
  }
  const modelText = model.join(' ');
  for (const t of targets) if (!phraseUsed(modelText, t)) return fail(`apply.model does not use the target phrase "${t}"`);

  // Quellen und Stand
  const rawSources = Array.isArray(o.sources) ? o.sources : [];
  if (rawSources.length > SOURCES_MAX) return fail(`at most ${SOURCES_MAX} sources`);
  const sources: LessonSource[] = [];
  for (const s of rawSources) {
    const so = (s && typeof s === 'object' ? s : {}) as Doc;
    const title = clean(so.title, 120);
    const url = safeUrl(so.url);
    if (!title || !url) return fail('every source needs a title and an https url');
    sources.push({ title, url });
  }
  const asOfRaw = typeof o.asOf === 'string' ? o.asOf.trim() : '';
  const asOfOk = /^\d{4}-(0[1-9]|1[0-2])$/.test(asOfRaw);
  const text = allText(a.paras, [goal, tip(wrong, right), modelText]);
  if (needsSources(expect.course, text)) {
    if (sources.length === 0) return fail('sources are required: this lesson is about Claude Code, law or figures, so it needs at least one source');
    if (!asOfOk) return fail('asOf (YYYY-MM) is required together with sources');
    if (def.officialDocs && !sources.some((s) => isOfficialHost(s.url))) return fail('Claude Code lessons need at least one source from the official Anthropic documentation');
  } else if (asOfRaw && !asOfOk) return fail('asOf must be YYYY-MM');

  const clichePhraseHit = clichePhrase(text);
  if (clichePhraseHit) return fail(`avoid the filler phrase "${clichePhraseHit}"`);

  const words = a.paras.reduce((acc, p) => acc + p.reduce((b, s) => b + countWords(s.e), 0), 0);
  return {
    ok: true,
    lesson: {
      id: lessonDocId(expect.course, expect.n),
      course: expect.course,
      n: expect.n,
      title: a.title,
      goal,
      paras: a.paras,
      phrases,
      check,
      tip: { wrong, right, why },
      apply: { situation, targets, model },
      sources,
      asOf: asOfOk ? asOfRaw : '',
      words,
    },
  };
}

const tip = (wrong: string, right: string): string => `${wrong} ${right}`;

/** Hosts der offiziellen Anthropic-Dokumentation und -Seiten. */
export function isOfficialHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ['anthropic.com', 'claude.com', 'claude.ai'].some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}
