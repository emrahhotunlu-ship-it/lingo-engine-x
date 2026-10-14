import { EXTEND_KINDS, MAIL_GOALS, REWRITE_KINDS, ACT_EVENTS, ACT_MAILS, ACT_ROLES, ACT_TYPES, eventById, mailById, roleById, toneOptions, typeById, type PoolKind, type PoolTone } from '../../content/activation/pools';
import { sceneLeaks } from '../../content/activation/scenes';
import { hash32, mulberry32 } from '../random';
import { allowsContinuous, CODE_MAX, DAILY_SHARE, FORMS, MIN_DIFFERENT, parseBrief, TENSES, WORDINGS, type TenseId, type ToneId } from './brief';
import { leastRecent } from './variety';

// Vorgaben der Aktivierungs-Aufgaben A2–A5 (Wörter aktivieren, Stufe 2; docs/umbau/aktivierung.md „Variation erzwingen“). Rein und deterministisch:
// gleiche Karte, gleicher Tag, gleicher Verlauf, gleiche Vorgabe (kein Würfeln beim Neuzeichnen). Je Merkmal gilt „am längsten nicht benutzt“, das zuletzt
// benutzte kommt nie, solange es eine Wahl gibt. Dadurch unterscheiden sich zwei Aktivierungen derselben Karte in mindestens `MIN_DIFFERENT` Merkmalen
// und dasselbe Muster kommt nie zweimal hintereinander (Test).
//
// Merkmale: Lage (`event`: Lage-Kennung oder Mail), Gegenüber (`role`), Textsorte (`type`), Ton, Zeitform, Besonderheit (`shape`: Satzform, Umschreibart,
// Erweiterungsart oder Antwortziel – je nach Art). Nicht benutzte Merkmale einer Art stehen als `-`.
// Code im Verlaufseintrag (`hist[].a`): „fmt.event.role.type.tone.tense.shape“, höchstens 39 Zeichen. Produce-Codes (4 Teile, `brief.ts`) bleiben lesbar.

/** Schritt im Fahrplan: A1 gestützt, A2 neue Lage, A3 umformen, A4 ohne gezeigtes Wort, A5 Kernwörter. */
export type ActStep = 1 | 2 | 3 | 4 | 5;
/** Aufgabenformate: sc Mini-Szene · tw Ton wechseln · rw Umschreiben · ex Satz erweitern · im Deutscher Impuls · lg Lage ohne Wort · kb Kombi-Satz · ml Kundenmail. */
export type ActFmt = 'sc' | 'tw' | 'rw' | 'ex' | 'im' | 'lg' | 'kb' | 'ml';
export const ACT_FMTS: readonly ActFmt[] = ['sc', 'tw', 'rw', 'ex', 'im', 'lg', 'kb', 'ml'];

/** Welche Formate zu welchem Schritt gehören (A1 ist „Eigener Satz“, `produce`). */
export const STEP_FMTS: Readonly<Record<2 | 3 | 4 | 5, readonly ActFmt[]>> = { 2: ['sc'], 3: ['tw', 'rw', 'ex'], 4: ['im', 'lg'], 5: ['ml', 'kb'] };
export const stepOfFmt = (f: ActFmt): 2 | 3 | 4 | 5 => (f === 'sc' ? 2 : f === 'tw' || f === 'rw' || f === 'ex' ? 3 : f === 'im' || f === 'lg' ? 4 : 5);

/** Das Zielwort wird bei diesen Formaten nicht gezeigt (A4): der Abruf kommt aus der Bedeutung. */
export const HIDES_TARGET: ReadonlySet<ActFmt> = new Set<ActFmt>(['im', 'lg']);
/** Diese Formate arbeiten an einem vorhandenen Satz (Quelle: früherer eigener Satz oder Beispielsatz). */
export const NEEDS_SOURCE: ReadonlySet<ActFmt> = new Set<ActFmt>(['tw', 'rw', 'ex']);
/** Diese Formate verlangen mehrere Zielwörter. */
export const MULTI_TARGET: ReadonlySet<ActFmt> = new Set<ActFmt>(['kb', 'ml']);

export type ActBrief = { fmt: ActFmt; event: string; role: string; type: string; tone: ToneId; tense: TenseId; shape: string; wording: number; code: string };
/** Die sechs Merkmale, in denen sich zwei Aktivierungen unterscheiden. */
export type ActVector = { event: string; role: string; type: string; tone: string; tense: string; shape: string };

const NONE = '-';
const FEATURES: readonly (keyof ActVector)[] = ['event', 'role', 'type', 'tone', 'tense', 'shape'];

export const actCode = (b: Pick<ActBrief, 'fmt' | 'event' | 'role' | 'type' | 'tone' | 'tense' | 'shape'>): string => [b.fmt, b.event, b.role, b.type, b.tone, b.tense, b.shape].join('.');

const SHAPES: Readonly<Record<ActFmt, readonly string[]>> = {
  sc: FORMS,
  tw: [NONE],
  rw: REWRITE_KINDS,
  ex: EXTEND_KINDS,
  im: ['s', 'q', 'n'],
  lg: ['s', 'q', 'n'],
  kb: [NONE],
  ml: MAIL_GOALS,
};

/** Code → Vorgabe (ohne Wortlaut), `null` bei fremdem oder zu langem Text. */
export function parseActCode(code: unknown): Omit<ActBrief, 'wording'> | null {
  if (typeof code !== 'string' || code.length >= CODE_MAX) return null;
  const parts = code.split('.');
  if (parts.length !== 7) return null;
  const [fmt, event, role, type, tone, tense, shape] = parts as [string, string, string, string, string, string, string];
  if (!ACT_FMTS.includes(fmt as ActFmt)) return null;
  const f = fmt as ActFmt;
  const okEvent = f === 'ml' ? !!mailById(event) : f === 'im' ? event === NONE : !!eventById(event);
  if (!okEvent) return null;
  if (!(role === NONE ? f === 'ml' : !!roleById(role))) return null;
  if (!(NEEDS_SOURCE.has(f) ? !!typeById(type) : type === NONE)) return null;
  if (!['c', 'n', 'f', NONE].includes(tone) || ![...TENSES, NONE].includes(tense)) return null;
  if (!SHAPES[f].includes(shape)) return null;
  return { fmt: f, event, role, type, tone: tone as ToneId, tense: tense as TenseId, shape, code };
}

/** Merkmale eines Codes (Aktivierungs-Code oder Code von „Eigener Satz“); `null` bei fremdem Text. */
export function vectorOf(code: unknown): ActVector | null {
  const a = parseActCode(code);
  if (a) return { event: a.event, role: a.role, type: a.type, tone: a.tone, tense: a.tense, shape: a.shape };
  const p = parseBrief(code);
  return p ? { event: p.scene, role: NONE, type: NONE, tone: p.tone, tense: p.tense, shape: p.form } : null;
}

/** In wie vielen der sechs Merkmale unterscheiden sich zwei Aktivierungen? */
export function actDifferences(a: ActVector, b: ActVector): number {
  return FEATURES.reduce((n, f) => n + (a[f] !== b[f] ? 1 : 0), 0);
}

/** Art der Aktivierung hinter einem Code: Format oder `pr` („Eigener Satz“). */
export function fmtOfCode(code: unknown): ActFmt | 'pr' | null {
  const a = parseActCode(code);
  if (a) return a.fmt;
  return parseBrief(code) ? 'pr' : null;
}

/** Codes der bisherigen Aktivierungen dieser Karte (`hist[].a`), ältester zuerst, nur gültige (beide Arten). */
export function activationCodesOf(doc: Readonly<Record<string, unknown>>): string[] {
  const raw = Array.isArray(doc.hist) ? (doc.hist as unknown[]) : [];
  return raw
    .filter((h): h is Record<string, unknown> => !!h && typeof h === 'object' && typeof (h as Record<string, unknown>).t === 'number')
    .sort((a, b) => (a.t as number) - (b.t as number))
    .flatMap((h) => (vectorOf(h.a) ? [h.a as string] : []));
}

/** Leckt der Text eines Pool-Eintrags eines der Zielwörter? (Nur für die Formate, die das Wort nicht zeigen, zwingend; sonst Vorliebe.) */
const leaks = (text: { de: string; en: string }, lemmas: readonly string[]): boolean => lemmas.some((l) => !!l && sceneLeaks(text, l));

export type PickCtx = {
  /** Zielwörter (Grundformen) der Aufgabe; die erste gehört zur Karte. */
  lemmas: readonly string[];
  /** Wortart der Hauptkarte (Verlaufsform nur, wo sie passt). */
  card?: { lemma?: string; pos?: string | null };
  /** Ton der Quelle (nur Ton wechseln): der neue Ton ist ein anderer. */
  sourceTone?: ToneId | null;
};

/**
 * Vorgabe für diese Karte und dieses Format an diesem Tag. `used` = bisherige Codes der Karte (`activationCodesOf`), der neueste zuletzt.
 * Das Wort in der Anweisung wechselt über `wording` (drei Wortlaute).
 */
export function pickActBrief(fmt: ActFmt, key: string, day: string, used: readonly string[], ctx: PickCtx): ActBrief {
  const past = used.flatMap((c) => {
    const v = vectorOf(c);
    return v ? [v] : [];
  });
  const last = past.at(-1) ?? null;
  const vals = (f: keyof ActVector): string[] => past.map((p) => p[f]).filter((v) => v !== NONE);
  let best: ActBrief | null = null;
  // Zur Sicherheit bis zu vier Versuche, falls ein kleiner Pool zwei Merkmale gleich lässt; der erste, der `MIN_DIFFERENT` erreicht, gilt.
  for (let salt = 0; salt < 4; salt++) {
    const rng = mulberry32(hash32(`${key}|${day}|${fmt}|${used.length}|${used.at(-1) ?? ''}|${salt}`));
    const roll = () => Math.floor(rng() * 1000);
    const kind: PoolKind = fmt === 'sc' || fmt === 'im' || fmt === 'lg' ? (rng() < DAILY_SHARE ? 'daily' : 'job') : 'job';
    // Lage bzw. Mail
    let event: string = NONE;
    let eventTones: readonly PoolTone[] = ['c', 'n', 'f'];
    if (fmt === 'ml') {
      const fit = ACT_MAILS.filter((m) => !leaks({ de: '', en: m.en }, ctx.lemmas));
      const m = leastRecent(fit.length ? fit : ACT_MAILS, (x) => x.id, vals('event'), roll()) ?? ACT_MAILS[0]!;
      event = m.id;
      eventTones = m.tones;
    } else if (fmt !== 'im') {
      const ofKind = ACT_EVENTS.filter((e) => e.kind === kind);
      const fit = ofKind.filter((e) => !leaks(e, ctx.lemmas));
      const e = leastRecent(fit.length ? fit : ofKind, (x) => x.id, vals('event'), roll()) ?? ofKind[0]!;
      event = e.id;
      eventTones = e.tones;
    }
    // Gegenüber
    let role: string = NONE;
    let roleTones: readonly PoolTone[] = ['c', 'n', 'f'];
    if (fmt !== 'ml') {
      const roles = ACT_ROLES.filter((r) => r.kind === kind);
      const r = leastRecent(roles, (x) => x.id, vals('role'), roll()) ?? roles[0]!;
      role = r.id;
      roleTones = r.tones;
    }
    // Textsorte (nur beim Umformen)
    let type: string = NONE;
    let typeTones: readonly PoolTone[] = ['c', 'n', 'f'];
    if (NEEDS_SOURCE.has(fmt)) {
      const t = leastRecent(ACT_TYPES, (x) => x.id, vals('type'), roll()) ?? ACT_TYPES[0]!;
      type = t.id;
      typeTones = t.tones;
    }
    // Ton: nur dort, wo er verlangt wird (beim Umschreiben und Erweitern bleibt der Ton der Quelle)
    let tone: ToneId = NONE;
    if (fmt !== 'rw' && fmt !== 'ex') {
      let opts = toneOptions(eventTones, roleTones, typeTones);
      if (fmt === 'tw' && ctx.sourceTone && ctx.sourceTone !== NONE && opts.some((o) => o !== ctx.sourceTone)) opts = opts.filter((o) => o !== ctx.sourceTone);
      tone = leastRecent(opts, (x) => x, vals('tone'), roll()) as ToneId;
    }
    // Besonderheit
    const shapes = SHAPES[fmt];
    const shape = shapes.length > 1 ? (leastRecent(shapes, (x) => x, vals('shape'), roll()) as string) : (shapes[0] as string);
    // Zeitform: nicht beim Umformen; beim Wenn-Satz bestimmt die Bedingung die Zeitform
    let tense: TenseId = NONE;
    if (!NEEDS_SOURCE.has(fmt) && !(fmt === 'sc' && shape === 'i')) {
      const tenses = allowsContinuous(ctx.card ?? {}) ? TENSES : TENSES.filter((x) => x !== 'co');
      tense = leastRecent(tenses, (x) => x, vals('tense'), roll()) as TenseId;
    }
    const wording = (past.length + hash32(key)) % WORDINGS;
    const brief: ActBrief = { fmt, event, role, type, tone, tense, shape, wording, code: actCode({ fmt, event, role, type, tone, tense, shape }) };
    if (!best) best = brief;
    const vec = vectorOf(brief.code);
    if (!last || !vec || (actDifferences(vec, last) >= MIN_DIFFERENT && brief.code !== used.at(-1))) return brief;
  }
  return best as ActBrief;
}
