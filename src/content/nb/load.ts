import type { z } from 'zod';
import collocRaw from './collocations.json?raw';
import inboxRaw from './inbox.json?raw';
import objectionsRaw from './objections.json?raw';
import scenesRaw from './scenes.json?raw';
import textsRaw from './texts.json?raw';
import transformsRaw from './transforms.json?raw';
import { logError } from '../../platform/diagnostics';
import {
  collocSchema,
  inboxSchema,
  objectionSchema,
  sceneSchema,
  themeTextSchema,
  transformSchema,
  type BizScene,
  type Colloc,
  type InboxMail,
  type Objection,
  type ThemeText,
  type Transform,
} from './schemas';

// Große P7a-Inhalte: als Text eingebettet und erst beim ersten Gebrauch geparst (Anhang A 5c).
// Jeder Eintrag wird mit zod geprüft; ungültige Einträge fallen weg und landen in der Diagnose.

function lazy<T>(name: string, raw: string, schema: z.ZodType<T>): () => readonly T[] {
  let cache: readonly T[] | null = null;
  return () => {
    if (cache) return cache;
    const out: T[] = [];
    try {
      const parsed: unknown = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [];
      list.forEach((item, i) => {
        const r = schema.safeParse(item);
        if (r.success) out.push(r.data);
        else logError(`content:nb:${name}`, r.error, `Eintrag ${i} ungültig`);
      });
    } catch (err) {
      logError(`content:nb:${name}`, err, `${name}.json nicht lesbar`);
    }
    cache = out;
    return cache;
  };
}

export const themeTexts = lazy<ThemeText>('texts', textsRaw, themeTextSchema);
export const collocations = lazy<Colloc>('collocations', collocRaw, collocSchema);
export const transforms = lazy<Transform>('transforms', transformsRaw, transformSchema);
export const objections = lazy<Objection>('objections', objectionsRaw, objectionSchema);
export const inboxMails = lazy<InboxMail>('inbox', inboxRaw, inboxSchema);
export const bizScenes = lazy<BizScene>('scenes', scenesRaw, sceneSchema);

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
