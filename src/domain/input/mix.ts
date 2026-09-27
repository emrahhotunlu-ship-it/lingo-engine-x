import type { Domain } from './types';

// Mischung Beruf/Alltag (Plan F4, Kap. 1: zwei Drittel Beruf). `app/profile.mix {work, life}` ist
// das Altfeld; jede abgeschlossene Einheit zählt +1. Der Startbestand wird über eine feste
// Tabelle eingeordnet, Beiträge des Tagesauftrags über ihre Kategorie `cat`.

export const WORK_SHARE = 2 / 3;

type Doc = Readonly<Record<string, unknown>>;
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/** Was als Nächstes dran ist: Beruf, solange sein Anteil unter zwei Dritteln liegt. */
export function domainTarget(mix: unknown): Domain {
  const m = mix && typeof mix === 'object' ? (mix as Doc) : {};
  const work = num(m.work);
  const life = num(m.life);
  if (work + life === 0) return 'work';
  return work / (work + life) < WORK_SHARE ? 'work' : 'life';
}

/** Alle 32 Inhalte des Startbestands (passages.json): Hörtexte l*, Schreibaufgaben w*, Artikel a*. */
export const LEGACY_DOMAIN: Readonly<Record<string, Domain>> = {
  l1: 'life',
  l2: 'life',
  l3: 'life',
  l4: 'work',
  l5: 'work',
  l6: 'work',
  l7: 'work',
  l8: 'work',
  w1: 'work',
  w2: 'work',
  w3: 'work',
  w4: 'work',
  w5: 'work',
  w6: 'work',
  w7: 'work',
  w8: 'work',
  w9: 'work',
  w10: 'work',
  w11: 'life',
  w12: 'life',
  w13: 'life',
  w14: 'life',
  w15: 'work',
  w16: 'life',
  a1: 'work',
  a2: 'work',
  a3: 'work',
  a4: 'life',
  a5: 'life',
  a6: 'life',
  a7: 'life',
  a8: 'work',
};

const WORK_CATS = new Set(['work', 'business', 'econ', 'economy', 'finance', 'markets', 'tech', 'career', 'management', 'sales', 'saas', 'industry']);
const WORK_TOPICS = new Set(['business', 'tech', 'work', 'sales', 'finance', 'career']);

/** Kategorie eines Beitrags → Beruf/Alltag. Unbekannt → Alltag. */
export function feedDomain(cat: unknown): Domain {
  return typeof cat === 'string' && WORK_CATS.has(cat.trim().toLowerCase()) ? 'work' : 'life';
}

/** Domäne eines gespeicherten Inhalts: eigenes Feld `domain`, sonst Themen-Slug, sonst Beruf. */
export function docDomain(doc: Doc): Domain {
  if (doc.domain === 'work' || doc.domain === 'life') return doc.domain;
  if (typeof doc.topic === 'string') return WORK_TOPICS.has(doc.topic.toLowerCase()) ? 'work' : 'life';
  return 'work';
}
