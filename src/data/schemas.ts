import { z } from 'zod';

// zod-Schemas für jeden Dokumentpfad der bestehenden Datenbank (Kap. 9, Regel 6).
// Grundlage: docs/datenstruktur.json (Anhang B) und docs/altapp-analyse.md.
//
// Regeln:
// - Jedes Objekt ist `looseObject`: unbekannte Felder bleiben beim Lesen erhalten.
// - Felder sind optional und dürfen `null` sein: echte Altdaten sind lückenhaft, und ein
//   zu strenges Schema würde gültige Dokumente als kaputt melden. Geprüft wird der Typ,
//   sobald ein Wert da ist.
// - Pflicht ist nur, was ein Dokument erst sinnvoll macht (z. B. `word` einer Vokabel).

const str = z.string().nullish();
const num = z.number().nullish();
const bool = z.boolean().nullish();
const strArr = z.array(z.string()).nullish();
const numMap = z.record(z.string(), z.number().nullish()).nullish();
const looseArr = z.array(z.looseObject({})).nullish();
/** Beliebiger Wert oder fehlend. Achtung zod 4: `z.unknown()` allein macht das Feld zur Pflicht. */
const loose = z.unknown().optional();

// ---------------------------------------------------------------- app/*

export const assessDataSchema = z.looseObject({
  level: str,
  cefr: str,
  levelWhy: str,
  trend: str,
  trendWhy: str,
  today: str,
  c1gap: strArr,
  // `ev`: Beleg-Kennungen (neu ab Phase 6, Plan E3); die alte App schreibt sie nicht.
  strengths: z.array(z.looseObject({ title: str, why: str, ev: strArr })).nullish(),
  blockers: z.array(z.looseObject({ title: str, why: str, fix: str, action: str, ev: strArr })).nullish(),
  dims: z.array(z.looseObject({ id: str, level: str, confidence: str, why: str })).nullish(),
  // `channels`: Kanäle des Tagesplans, auf die der Fokus wirkt (Phase 6, Plan §4.6).
  focus: z.looseObject({ title: str, why: str, action: str, days: num, channels: strArr }).nullish(),
});

/** Die alte App schreibt eine Hülle `{d, t, lang, answers, writings, data}`, Anhang B zeigt den Inhalt flach. */
export const assessSchema = assessDataSchema.extend({
  d: str,
  t: num,
  lang: str,
  // Typ in Anhang B und in der Analyse nicht belegt – tolerant lesen.
  answers: loose,
  writings: loose,
  data: assessDataSchema.nullish(),
  // Neu ab Phase 6 (Plan §4.1), alles tolerant: Version, Vorlage, antwortende Stufe, Belegzählung,
  // Verlauf (≤ 60) und die Tagessperre des automatischen Laufs `run {d, t, by}`.
  v: num,
  pv: str,
  tier: str,
  basis: z.looseObject({}).nullish(),
  hist: looseArr,
  run: z.looseObject({ d: str, t: num, by: str }).nullish(),
});

/** Neu ab Phase 6 (Plan §6.2): Wochenberichte `{items: [{w, lang, t, pv, facts, text}]}`, höchstens 26. */
export const weeklySchema = z.looseObject({
  items: z.array(z.looseObject({ w: str, lang: str, t: num, pv: str, facts: loose, text: z.looseObject({}).nullish() })).nullish(),
});

/** Neu ab Phase 7 (Plan §12.3): ausgelagerte Kalenderjahre des Profils `archive/profile-<JJJJ>`. */
export const archiveSchema = z.looseObject({
  v: num,
  year: num,
  from: str,
  t: num,
  days: numMap,
  xpDays: numMap,
  minutes: numMap,
  act: z.record(z.string(), z.record(z.string(), z.number().nullish()).nullish()).nullish(),
  pflicht: z.record(z.string(), z.unknown()).nullish(),
});

export const profileSchema = z.looseObject({
  name: str,
  created: str,
  ctx: str,
  ctxChecked: bool,
  lang: str,
  voice: str,
  rate: num,
  goal: num,
  /** Neu ab Phase 6 (Plan E11): Tagesziel in Minuten (10/15/20/25/30/40, Standard 25). `goal` (XP) bleibt. */
  goalMin: num,
  /** Neu ab Phase 6 (Plan E12): Töne an/aus, Standard aus (Kap. 4.7). */
  sound: bool,
  newPerDay: num,
  xp: num,
  answers: num,
  vAnswers: num,
  gAnswers: num,
  autoNext: bool,
  seen15: bool,
  tour11: bool,
  days: numMap,
  xpDays: numMap,
  minutes: numMap,
  act: z.record(z.string(), z.record(z.string(), z.number().nullish()).nullish()).nullish(),
  canDo: z.record(z.string(), z.unknown()).nullish(),
  disc: z.record(z.string(), z.looseObject({ prep: str, take: str, check: str, use: str }).nullish()).nullish(),
  ema: z.record(z.string(), z.number().nullish()).nullish(),
  n: z.record(z.string(), z.number().nullish()).nullish(),
  mix: z.looseObject({ work: num, life: num }).nullish(),
  gen: z.looseObject({ lp: str, wp: str, ar: str }).nullish(),
  theme: z.looseObject({ m: str, p: str }).nullish(),
  plan: z
    .looseObject({
      d: str,
      ids: strArr,
      why: z.array(z.array(z.unknown())).nullish(),
      // Neu ab Phase 1 (Plan dieser App, Daten-Entwurf §3.4)
      v: num,
      duty: strArr,
      goal: z.looseObject({ review: num, due: num, new: num, ahead: num, ch: num }).nullish(),
      lesson: str,
      at: num,
    })
    .nullish(),
  /** Neu: Folgenummer des letzten Sammel-Schreibvorgangs je Tab (gegen Doppelzählung); `null` = gekappt (Phase 2 D7). */
  lxSeq: numMap,
  // `lx`: Tagesbild dieser App (Phase 6, Plan §7.4), Definition in domain/progress/history.ts.
  history: z
    .array(z.looseObject({ d: str, o: num, vo: num, gr: num, co: num, re: num, li: num, wr: num, fl: num, vs: num, lx: num }))
    .nullish(),
  feed: z.array(z.looseObject({ act: str, t: num, d: z.looseObject({}).nullish() })).nullish(),
  listen: looseArr,
  /**
   * Sprint-Ergebnisse `{t, score, ok, n, avgMs, combo}` (alte App; Phase 2 hängt dieselbe Form an, ≤ 60).
   * Bewusst tolerant gelesen: ein einzelner fremder Eintrag darf nie das ganze Profil ungültig machen.
   */
  sprints: looseArr,
  vtests: looseArr,
  checks: loose,
  /** Neu ab Phase 1: Lerntag → Pflicht erledigt (wahr/1). */
  pflicht: z.record(z.string(), z.unknown()).nullish(),
});

export const courseSchema = z.looseObject({
  done: z
    .record(
      z.string(),
      // `last`: letzte Wiederholung einer schon erledigten Lektion (Phase 2 §4.7), der erste Abschluss bleibt stehen.
      z.looseObject({ d: str, n: num, ok: num, t: num, last: z.looseObject({ d: str, n: num, ok: num, t: num }).nullish() }).nullish(),
    )
    .nullish(),
  res: z.record(z.string(), z.unknown()).nullish(),
});

export const radarSchema = z.looseObject({
  events: z.array(z.looseObject({ a: str, c: str, g: str, q: str, s: str, t: num })).nullish(),
});

const exerciseItem = z.looseObject({
  type: str,
  topic: str,
  prompt: str,
  answer: str,
  accepted: z.array(z.unknown()).nullish(),
  options: z.array(z.unknown()).nullish(),
  hint_de: str,
  explanation_de: str,
  explanation_en: str,
  src: str,
  /** Neu (Phase 2): Herkunft einer Pool-Aufgabe, z. B. `daily/2026-09-27`. */
  ref: str,
  /** Neu ab Phase 5: feste Kennung einer Aufgabe aus dem Preply-Import (`pi<ms>-t<i>`). */
  id: str,
});

export const poolSchema = z.looseObject({
  items: z.array(exerciseItem).nullish(),
  t: num,
  /** Neu (Phase 2 §4.10): verarbeitete Tagesaufträge `daily/<k>` → Hash, Zeit, Wörter, Aufgaben, offen, ungültig. */
  lxDaily: z.record(z.string(), z.looseObject({ h: num, t: num, w: num, g: num, open: num, bad: num }).nullish()).nullish(),
});

export const chatSchema = z.looseObject({
  // Neu ab Phase 5 (§5.2): je Nachricht t, lang, ctx, stopped; `since` = Beginn des laufenden Gesprächs.
  msgs: z.array(z.looseObject({ role: str, content: str, t: num, lang: str, ctx: str, stopped: bool })).nullish(),
  since: num,
});

export const lookupSchema = z.looseObject({
  items: z
    .record(
      z.string(),
      // Neu, nur ergänzend (Plan §3.10): note_en, ipa, ex, pv, t.
      z.looseObject({ lemma: str, pos: str, de: str, def: str, note_de: str, level: str, note_en: str, ipa: str, ex: str, pv: str, t: num }).nullish(),
    )
    .nullish(),
});

/** Neu (Kap. 9, Regel 3): Versionsvermerk der Umstellung. */
export const schemaDocSchema = z.looseObject({
  version: z.number(),
  cutover: z.string(),
  migratedAt: z.number(),
  app: str,
  /** Ab diesem Lerntag gilt die Pflicht-Regel der Serie (setzt Phase 1). */
  pflichtSince: str,
  counts: z.record(z.string(), z.number()).nullish(),
});

// ---------------------------------------------------------------- Sammlungen

/** Neu: FSRS-Werte je Karte, zusätzlich zu den alten Feldern (Kap. 9, Regel 2 und 5). */
export const fsrsSchema = z.looseObject({
  v: z.number(),
  due: z.number(),
  stability: z.number(),
  difficulty: z.number(),
  state: z.number(),
  reps: z.number(),
  lapses: z.number(),
  last: z.number().nullable(),
  scheduledDays: z.number(),
  learningSteps: z.number(),
  src: str,
});

const schedulingFields = {
  S: num,
  D: num,
  due: num,
  last: num,
  reps: num,
  lapses: num,
  state: str,
  stage: num,
  hist: z.array(z.looseObject({ g: num, m: str, t: num })).nullish(),
  modes: z.record(z.string(), z.looseObject({ c: num, w: num }).nullish()).nullish(),
  intro: str,
  hidden: bool,
  fsrs: fsrsSchema.nullish(),
  /** Neu: Trefferbilanz je Übungsart der neuen App. */
  xs: z.record(z.string(), z.looseObject({ c: num, w: num }).nullish()).nullish(),
};

export const vocabSchema = z.looseObject({
  word: z.string().min(1),
  id: str,
  de: str,
  def: str,
  ex: str,
  pos: str,
  level: str,
  src: str,
  lesson: str,
  added: str,
  order: num,
  pa: num,
  ac: num,
  co: num,
  col: z.array(z.unknown()).nullish(),
  /** Neu: Herkunft einer per Wort-Antippen gespeicherten Karte (Plan §3.4). */
  origin: z.looseObject({ v: num, kind: str, ref: str, title: str, t: num }).nullish(),
  /** Neu: von Claude ergänzte Beispielsätze `[{en, t}]` (nur Englisch, ≤ 3), tolerant gelesen; nur ergänzt, nie ersetzt. */
  xEx: z.array(z.unknown()).nullish(),
  /** Neu (Phase 2, M3): Merkhilfe von Claude für hartnäckige Wörter `{text, lang, t}`, einmal erzeugt. */
  mnemo: z.looseObject({ text: str, lang: str, t: num }).nullish(),
  ...schedulingFields,
});

export const chunkSchema = z.looseObject({
  en: z.string().min(1),
  id: str,
  de: str,
  kind: str,
  register: str,
  why: str,
  level: str,
  created: z.union([z.string(), z.number()]).nullish(),
  src: z.union([z.string(), z.looseObject({})]).nullish(),
  also: z.array(z.unknown()).nullish(),
  /** Neu ab Phase 3 (Plan §3.1): Erklärung, Sprache von `why`, Herkunft, gesehen. */
  def: str,
  whyLang: str,
  origin: z.looseObject({ v: num, kind: str, ref: str, title: str, t: num }).nullish(),
  seen: loose,
  ...schedulingFields,
});

export const grammarSchema = z.looseObject({
  id: str,
  p: num,
  anchor: num,
  anchorD: str,
  n: num,
  c: num,
  due: num,
  last: num,
  recent: z.array(z.number()).nullish(),
  seen: strArr,
  seenText: strArr,
  hist: z.array(z.looseObject({ d: str, p: num })).nullish(),
  errors: z
    .array(
      z.looseObject({
        q: str,
        given: str,
        ans: str,
        t: num,
        box: num,
        due: num,
        done: bool,
        last: num,
        /** Neu (Phase 2): Quelle der Aufgabe und FSRS-Schatten (steuert nichts, D1). */
        src: str,
        fsrs: loose,
      }),
    )
    .nullish(),
});

export const lessonSchema = z.looseObject({
  v: num,
  t: num,
  words: z.array(z.looseObject({ en: str, de: str, def: str, ex: str, pos: str })).nullish(),
  dialogue: z.looseObject({ title: str, lines: z.array(z.looseObject({ sp: str, en: str, de: str })).nullish() }).nullish(),
  questions: z
    .array(
      z.looseObject({
        q: str,
        answer: str,
        options: z.array(z.unknown()).nullish(),
        // Sprache der Frage (fehlt bei alten Lektionen = de) und die andere Fassung.
        lang: str,
        q_alt: str,
        answer_alt: str,
        options_alt: z.array(z.unknown()).nullish(),
      }),
    )
    .nullish(),
  tasks: z.array(exerciseItem.extend({ hint: str, expl: str, expl_en: str })).nullish(),
  output: z.looseObject({ de: str, en: str, mustUse: strArr }).nullish(),
  /** Neu (Phase 2): Herkunft des Inhalts (`pv`, Sprache, Nachbesserung). */
  lx: loose,
});

export const logSchema = z.looseObject({
  date: str,
  // `given`/`ans` sind je nach Übungsart Text oder Liste (z. B. Satzbau) – tolerant lesen.
  entries: z
    .array(
      z.looseObject({
        t: num,
        ok: bool,
        k: str,
        id: str,
        m: str,
        given: loose,
        ans: loose,
        g: num,
        ms: num,
        lang: str,
        type: str,
        q: str,
        ctx: str,
        // Neu bzw. aus der alten App belegt (Phase 2 §4.4).
        topic: str,
        src: str,
        lesson: str,
        // Neu (Phase 2, M4): Einspruch „Ich lag richtig".
        override: bool,
      }),
    )
    .nullish(),
});

/** Vom Claude-Tagesauftrag geschrieben – Format bleibt exakt erhalten, die App liest nur. */
export const dailySchema = z.looseObject({
  grammarItems: z.array(exerciseItem).nullish(),
  newWords: z.array(z.looseObject({ word: str, de: str, def: str, ex: str, level: str, pos: str })).nullish(),
});

export const feedSchema = z.looseObject({
  id: str,
  d: str,
  items: z
    .array(
      z.looseObject({
        id: str,
        kind: str,
        title: str,
        level: str,
        mins: num,
        url: str,
        source: str,
        gist: str,
        excerpt: str,
        excerptBy: str,
        topic_de: str,
        topic_en: str,
        why_de: str,
        why_en: str,
        task_de: str,
        task_en: str,
        taskChunks: strArr,
        // Ergänzt ab Phase 4 (Plan §3.9), nur lesen: Kategorie, englischer Titel, Hörhilfe.
        cat: str,
        title_en: str,
        guide_de: strArr,
        guide_en: strArr,
        chunks: z.array(z.looseObject({ en: str, de: str, note_de: str, note_en: str })).nullish(),
        questions: z
          .array(
            z.looseObject({
              a: num,
              q_de: str,
              q_en: str,
              opts_de: z.array(z.unknown()).nullish(),
              opts_en: z.array(z.unknown()).nullish(),
              why_de: str,
              why_en: str,
            }),
          )
          .nullish(),
      }),
    )
    .nullish(),
});

export const writingSchema = z.looseObject({
  id: str,
  lesson: str,
  date: str,
  text: str,
  words: num,
  t: num,
  // Ergänzt ab Phase 4 (Plan §3.7/§3.9), tolerant: Altfelder der Schreibaufgabe und neue Felder.
  promptId: str,
  title: str,
  task: str,
  genre: str,
  rev: num,
  lang: str,
  domain: str,
  res: z
    .looseObject({
      cefr: str,
      scores: z.record(z.string(), z.number().nullish()).nullish(),
      errors: looseArr,
      /** Neu (Phase 2 §4.9): Urteil zum Can-Do-Ziel und Vorlage. */
      cando: str,
      summary: loose,
      strengths: loose,
      improved: loose,
      upgrades: loose,
      phrases: loose,
      next: loose,
      usHints: looseArr,
      lang: str,
      pv: str,
    })
    .nullish(),
});

/** Szenen der alten App plus Ergänzungen ab Phase 3 (Plan §3.1); alles tolerant. */
export const sceneSchema = z.looseObject({
  id: str,
  title: str,
  title_de: str,
  situation: str,
  situation_de: str,
  goal: str,
  goal_de: str,
  persona: z.looseObject({ name: str, role: str, org: str, traits: str }).nullish(),
  stake: str,
  objection: str,
  opening: str,
  useful: z.array(z.looseObject({ en: str, de: str })).nullish(),
  level: str,
  ts: num,
  done: loose,
  band: loose,
  runs: num,
  lastRun: num,
  src: str,
  pv: str,
  /** Neu: Fokus einer KI-Szene (Grammatikthema-ID, Wörter). */
  gram: str,
  words: strArr,
});
export const preplySchema = z.looseObject({
  t: num,
  kind: str,
  title: str,
  done: bool,
  applied: bool,
  // Altfelder und neue Felder ab Phase 5 (§5.9), alle tolerant: Strings oder Altformen.
  lang: str,
  pv: str,
  minutes: num,
  doneT: num,
  appliedT: num,
  heldDay: str,
  heldMin: num,
  corrections: looseArr,
  words: looseArr,
  items: looseArr,
  watch: looseArr,
  tasks: z.array(z.unknown()).nullish(),
  homework: z.array(z.unknown()).nullish(),
  warmup: z.array(z.unknown()).nullish(),
  talk: z.array(z.unknown()).nullish(),
  say: z.array(z.unknown()).nullish(),
  hwDone: z.record(z.string(), z.string().nullish()).nullish(),
  sel: z.looseObject({}).nullish(),
  res: z.looseObject({}).nullish(),
  ctx: z.looseObject({}).nullish(),
});
// Lesen, Hören, Schreibaufgaben: Altformat plus additive Felder ab Phase 4 (Plan §3.3–3.6, §3.9).
export const articleSchema = z.looseObject({
  id: str,
  level: str,
  title: str,
  text: str,
  topic: str,
  topic_de: str,
  topic_en: str,
  teaser: str,
  keypoints: strArr,
  glossary: looseArr,
  questions: looseArr,
  domain: str,
  src: str,
  t: num,
  pv: str,
});
export const readingSchema = z.looseObject({
  t: num,
  date: str,
  articleId: str,
  title: str,
  level: str,
  summary: str,
  words: num,
  readSec: num,
  res: z
    .looseObject({ score: loose, covered: loose, misunderstood: loose, language: loose, feedback: loose, model_summary: loose, lang: str, pv: str })
    .nullish(),
  quiz: z.looseObject({ n: num, ok: num }).nullish(),
  domain: str,
  ref: str,
});
export const lpoolSchema = z.looseObject({
  level: str,
  title: str,
  text: str,
  questions: looseArr,
  topic_de: str,
  topic_en: str,
  genre: str,
  vocab: looseArr,
  domain: str,
  src: str,
  t: num,
  pv: str,
});
export const wpromptSchema = z.looseObject({
  p: z
    .looseObject({
      id: str,
      title_de: str,
      title_en: str,
      genre: str,
      level: str,
      task_en: str,
      task_de: str,
      words: z.array(z.number()).nullish(),
      focus_de: str,
      focus_en: str,
      useful: strArr,
      src: str,
      domain: str,
    })
    .nullish(),
  t: num,
});

/** Neu ab Phase 3: Gesprächsläufe eines Monats (`talk/<JJJJ-MM>`, Plan §3.4). */
export const talkSchema = z.looseObject({
  v: num,
  month: str,
  runs: z
    .array(
      z.looseObject({
        id: z.string(),
        t: num,
        day: str,
        scene: str,
        title: str,
        turns: num,
        ms: num,
        goal: str,
        clean: num,
        errs: z.record(z.string(), z.number().nullish()).nullish(),
        taken: strArr,
        lines: looseArr,
        report: z.looseObject({}).nullish(),
        lang: str,
        tier: str,
      }),
    )
    .nullish(),
});

/** Neu ab Phase 3: Business-Einheiten eines Monats (`biz/<JJJJ-MM>`, Plan §3.5). */
export const bizSchema = z.looseObject({
  v: num,
  month: str,
  items: z.array(z.looseObject({ id: z.string(), t: num, day: str, kind: str })).nullish(),
});

export type Profile = z.infer<typeof profileSchema>;
export type Course = z.infer<typeof courseSchema>;
export type Assess = z.infer<typeof assessSchema>;
export type Weekly = z.infer<typeof weeklySchema>;
export type AssessData = z.infer<typeof assessDataSchema>;
export type Vocab = z.infer<typeof vocabSchema>;
export type Chunk = z.infer<typeof chunkSchema>;
export type Grammar = z.infer<typeof grammarSchema>;
export type SchemaDoc = z.infer<typeof schemaDocSchema>;
export type FsrsStored = z.infer<typeof fsrsSchema>;
