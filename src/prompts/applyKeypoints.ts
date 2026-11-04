import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { ARTICLE_MAX, TITLE_MAX } from './applySummary';
import { block, clip, header } from './common';
import { cut } from './tolerant';
import type { PromptTemplate } from './types';

// apply-keypoints@1 (F3 Anwenden, Nachtrag learning-scientist Muss 2): die 3 bis 4 Kernpunkte eines Artikels, EINMAL je Artikel festgelegt und gespeichert
// (`out/<Monat>`, Art `sumkp`). Jede spätere Prüfung einer Zusammenfassung nimmt dieselben Punkte (gleicher Maßstab). Stufe `quick`, 24 h zwischengespeichert,
// nur auf Antippen („Prüfen“ der ersten Zusammenfassung), nie automatisch wiederholt außer dem einen Neuversuch bei Schemaverletzung (A6.3).

export type KeypointsVars = { title: string; article: string };
export type ApplyKeypoints = { points: string[] };

export const KEYPOINT_MAX_CHARS = 160;

const ID = 'apply-keypoints';
const VERSION = 1;

const point = z
  .string()
  .trim()
  .transform((s) => cut(s.replace(/\s+/g, ' '), KEYPOINT_MAX_CHARS))
  .pipe(z.string().min(12))
  .refine((s) => !isWrongLang(s, 'en'), { message: 'must be written in English' });

export const keypointsSchema = (): z.ZodType<ApplyKeypoints> =>
  z.object({
    points: z.preprocess((v) => (Array.isArray(v) ? v.slice(0, 4) : v), z.array(point).min(3).max(4)),
  });

export const applyKeypoints: PromptTemplate<KeypointsVars, ApplyKeypoints> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'List the key points of this news article that a good three-sentence summary must contain.',
      `Article: ${clip(v.title, TITLE_MAX)}`,
      ['<<<ARTICLE', block(v.article, ARTICLE_MAX), 'ARTICLE>>>'].join('\n'),
      'Reply with only one JSON object in exactly this shape:',
      '{"points":["…","…","…"]}',
      'Rules:',
      '- 3 or 4 points, most important first, each one short plain sentence in American English (at most 25 words).',
      '- Only facts the article states; no opinion, no background knowledge, no details that are not essential.',
      '- Never use the straight double quote character inside text values.',
    ].join('\n');
  },
  schema: () => keypointsSchema(),
};
