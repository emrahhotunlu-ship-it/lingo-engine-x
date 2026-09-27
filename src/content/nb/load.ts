import type { z } from 'zod';
import collocRaw from './collocations.json?raw';
import extrasRaw from './extras.json?raw';
import inboxRaw from './inbox.json?raw';
import objectionsRaw from './objections.json?raw';
import scenesRaw from './scenes.json?raw';
import textsRaw from './texts.json?raw';
import transformsRaw from './transforms.json?raw';
import { logError } from '../../platform/diagnostics';
import {
  buyTimeSchema,
  collocSchema,
  hotSeatSchema,
  inboxSchema,
  numberSchema,
  objectionSchema,
  phrasalSchema,
  registerSchema,
  sceneSchema,
  stressSchema,
  themeTextSchema,
  transformSchema,
  transitionSchema,
  wordFormationSchema,
  type BizScene,
  type BuyTimeItem,
  type Colloc,
  type HotSeatItem,
  type InboxMail,
  type NumberItem,
  type Objection,
  type PhrasalItem,
  type RegisterItem,
  type StressItem,
  type ThemeText,
  type Transform,
  type TransitionItem,
  type WordFormation,
} from './schemas';

// Große P7a-Inhalte: als Text eingebettet und erst beim ersten Gebrauch geparst (Anhang A 5c).
// Jeder Eintrag wird mit zod geprüft; ungültige Einträge fallen weg und landen in der Diagnose.

function parseRaw(name: string, raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (err) {
    logError(`content:nb:${name}`, err, `${name}.json nicht lesbar`);
    return null;
  }
}

function validate<T>(name: string, list: unknown, schema: z.ZodType<T>): T[] {
  const out: T[] = [];
  (Array.isArray(list) ? list : []).forEach((item, i) => {
    const r = schema.safeParse(item);
    if (r.success) out.push(r.data);
    else logError(`content:nb:${name}`, r.error, `Eintrag ${i} ungültig`);
  });
  return out;
}

function lazy<T>(name: string, raw: string, schema: z.ZodType<T>): () => readonly T[] {
  let cache: readonly T[] | null = null;
  return () => (cache ??= validate(name, parseRaw(name, raw), schema));
}

export const themeTexts = lazy<ThemeText>('texts', textsRaw, themeTextSchema);
export const collocations = lazy<Colloc>('collocations', collocRaw, collocSchema);
export const transforms = lazy<Transform>('transforms', transformsRaw, transformSchema);
export const objections = lazy<Objection>('objections', objectionsRaw, objectionSchema);
export const inboxMails = lazy<InboxMail>('inbox', inboxRaw, inboxSchema);
export const bizScenes = lazy<BizScene>('scenes', scenesRaw, sceneSchema);

// Soll-Inhalte (N107–N109) als ein Bündel `extras.json`: einmal parsen, je Art prüfen.
let extrasCache: Readonly<Record<string, unknown>> | null = null;
function extras(): Readonly<Record<string, unknown>> {
  if (!extrasCache) {
    const parsed = parseRaw('extras', extrasRaw);
    extrasCache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  }
  return extrasCache;
}
function part<T>(key: string, schema: z.ZodType<T>): () => readonly T[] {
  let cache: readonly T[] | null = null;
  return () => (cache ??= validate(`extras.${key}`, extras()[key], schema));
}

export const wordFormation = part<WordFormation>('wordFormation', wordFormationSchema);
export const registerLadder = part<RegisterItem>('register', registerSchema);
export const phrasalVerbs = part<PhrasalItem>('phrasalVerbs', phrasalSchema);
export const transitionDrills = part<TransitionItem>('transitions', transitionSchema);
export const hotSeat = part<HotSeatItem>('hotSeat', hotSeatSchema);
export const buyTime = part<BuyTimeItem>('buyTime', buyTimeSchema);
export const stressWords = part<StressItem>('stress', stressSchema);
export const numberDrills = part<NumberItem>('numbers', numberSchema);

/** Themen-Text einer Woche (oder null). */
export const themeTextFor = (theme: string): ThemeText | null => themeTexts().find((t) => t.theme === theme) ?? null;
/** Kundenmail zum Thema (oder null). */
export const inboxFor = (theme: string): InboxMail | null => inboxMails().find((m) => m.theme === theme) ?? null;
/** Business-Szene nach Kennung (oder null). */
export const sceneById = (id: string): BizScene | null => bizScenes().find((s) => s.id === id) ?? null;
/** Einwände zum Thema; zuerst die des Themas, dann die übrigen (für eine Serie von 5). */
export function objectionsFor(theme: string, n = 5): Objection[] {
  const all = objections();
  return [...all.filter((o) => o.theme === theme), ...all.filter((o) => o.theme !== theme)].slice(0, n);
}
