import { themeTextFor } from '../../../content/nb/load';
import { themeById } from '../../../content/nb/themes';
import { flattenFeed } from '../../../domain/discover/feedItems';
import { stepState, stepsFor } from '../../../domain/discover/steps';
import { articleQuestions, LEGACY_ARTICLES } from '../../../domain/input/items';
import { shuffleOptions } from '../../../domain/input/questions';
import type { ArticleItem, Domain, FeedItem, Question } from '../../../domain/input/types';
import { noticeRows, shadowSentences, themeArticle, themeQuestions, type InputBlockPlan, type NoticeRow } from '../../../domain/input/unitInput';
import { wordCount } from '../../../domain/text/textStats';
import type { ThemeId } from '../../../domain/week/types';
import { useLive } from '../../../data/live';
import { useFeed } from '../../discover/feedStore';
import { dbArticles, dbListening, readAll } from '../derive';
import { useInputLibrary } from '../library';

// Quelle von Block 2 (Neubau N53, Prüfung M7): synchron aus den geladenen Daten gewählt und als
// `ref` in die Route geschrieben – nach dem Neuladen steht derselbe Text da. Formen von `ref`:
// `theme:x-t01` · `lpool:<id>` · `articles:<id>` · `legacy:<id>` · `feed:<feedId>|<itemId>`.

type Doc = Readonly<Record<string, unknown>>;
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

export type BlockSource = {
  ref: string;
  title: string;
  text: string;
  level: string;
  domain: Domain;
  /** Kernfrage und Frage „zwischen den Zeilen“ (höchstens 2). */
  questions: Question[];
  notice: NoticeRow[];
  shadow: string[];
  /** Herkunft gespeicherter Karten (`theme:t01` bei Themen-Texten, sonst die Quelle). */
  cardRef: string;
  /** Für den Abschluss: Kennung und Quelle der Lese- bzw. Hör-Einheit. */
  item: ArticleItem;
};

/** Mindestlänge eines Feed-Auszugs als Block-2-Text. */
const FEED_MIN_WORDS = 60;

function themeSource(themeId: ThemeId, lang: 'de' | 'en'): BlockSource | null {
  const theme = themeById(themeId);
  const tt = themeTextFor(themeId);
  if (!theme || !tt) return null;
  const item = themeArticle(tt, theme, lang);
  return {
    ref: `theme:${tt.id}`,
    title: tt.title,
    text: tt.text,
    level: item.level,
    domain: item.domain,
    questions: themeQuestions(tt, lang),
    notice: noticeRows(tt.notice, theme.phrases, lang),
    shadow: [...tt.shadow],
    cardRef: item.ref,
    item,
  };
}

/** Block-2-Fragen eines erzeugten Hörtexts (`lpool/*` mit `unit`) im Themen-Text-Format. */
function unitQuestions(id: string, unit: Doc, lang: 'de' | 'en'): Question[] {
  const one = (raw: unknown, key: string, type: Question['type']): Question | null => {
    const q = obj(raw);
    const options = Array.isArray(q.options) ? q.options.filter((o): o is string => typeof o === 'string') : [];
    const answer = typeof q.answer === 'number' ? q.answer : -1;
    const text = str(q[`q_${lang}`]) || str(q.q_en);
    if (!text || options.length < 3 || answer < 0 || answer >= options.length) return null;
    return { key: `${id}#${key}`, q: text, qLang: str(q[`q_${lang}`]) ? lang : 'en', options, answer, type, explain: { de: str(q.why_de), en: str(q.why_en) }, quote: str(q.quote) };
  };
  return [one(unit.core, 'core', 'gist'), one(unit.between, 'between', 'inference')].filter((q): q is Question => q !== null);
}

function articleSource(a: ArticleItem, prefix: 'articles' | 'legacy' | 'lpool', lang: 'de' | 'en', pool: readonly ArticleItem[], unit?: Doc): BlockSource {
  const qs = unit ? unitQuestions(a.id, unit, lang) : [];
  const questions = qs.length ? qs : articleQuestions(a, pool).slice(0, 2);
  const noticeList = unit && Array.isArray(unit.notice) ? unit.notice.filter((x): x is string => typeof x === 'string') : [];
  const notice: NoticeRow[] = noticeList.length
    ? noticeList.map((en) => ({ en }))
    : a.glossary.slice(0, 3).map((g) => ({ en: g.w, ...(g.de ? { de: g.de } : {}), ...(lang === 'en' && g.def ? { note: g.def } : {}) }));
  const given = unit && Array.isArray(unit.shadow) ? unit.shadow.filter((x): x is string => typeof x === 'string') : [];
  return {
    ref: `${prefix}:${a.id}`,
    title: a.title,
    text: a.text,
    level: a.level,
    domain: a.domain,
    questions,
    notice,
    shadow: shadowSentences(a.text, given),
    cardRef: a.ref,
    item: a,
  };
}

function feedSource(f: FeedItem, lang: 'de' | 'en'): BlockSource | null {
  const text = f.excerpt ?? '';
  if (wordCount(text) < FEED_MIN_WORDS) return null;
  const ref = `feed/${f.feedId}#${f.itemId}`;
  const item: ArticleItem = {
    ref,
    id: `${f.feedId}|${f.itemId}`,
    level: (['B1', 'B1+', 'B2', 'B2+', 'C1', 'C1+'] as const).find((l) => l === f.level) ?? 'B2+',
    domain: f.domain,
    title: f.title,
    topic: f.topic,
    text,
    keypoints: [],
    glossary: f.chunks.map((c) => ({ w: c.en, ...(c.de ? { de: c.de } : {}) })),
    questions: f.questions,
    origin: 'db',
  };
  return {
    ref: `feed:${f.feedId}|${f.itemId}`,
    title: f.title,
    text,
    level: item.level,
    domain: f.domain,
    questions: f.questions.slice(0, 2),
    notice: f.chunks.slice(0, 3).map((c) => ({ en: c.en, ...(c.de ? { de: c.de } : {}), ...(lang === 'en' && c.note_en ? { note: c.note_en } : {}) })),
    shadow: shadowSentences(text),
    cardRef: ref,
    item,
  };
}

/**
 * Quelle aus `ref` (Route); `null` = (noch) nicht verfügbar. Die Antwortoptionen sind fest gemischt (Quelle +
 * Frage als Startwert): Die richtige Antwort stand sonst immer vorn (Emrah 02.10.2026), bleibt aber nach dem
 * Neuzeichnen und auf jedem Gerät an derselben Stelle.
 */
export function sourceFromRef(ref: string, lang: 'de' | 'en'): BlockSource | null {
  const s = buildSource(ref, lang);
  return s ? { ...s, questions: s.questions.map((q) => shuffleOptions(q, s.ref)) } : null;
}

function buildSource(ref: string, lang: 'de' | 'en'): BlockSource | null {
  const [kind, rest = ''] = ref.split(/:(.*)/s, 2) as [string, string?];
  if (kind === 'theme') {
    const theme = /^x-(t\d{2})$/.exec(rest)?.[1];
    return theme ? themeSource(theme as ThemeId, lang) : null;
  }
  const lib = useInputLibrary.getState().docs;
  if (kind === 'lpool') {
    const doc = lib.lpool.get(rest);
    const l = doc ? dbListening(new Map([[rest, doc]]))[0] : undefined;
    if (!doc || !l) return null;
    const a: ArticleItem = { ref: l.ref, id: l.id, level: l.level, domain: l.domain, title: l.title, topic: l.topic, text: l.text, keypoints: [], glossary: l.vocab, questions: l.questions, origin: l.origin };
    return articleSource(a, 'lpool', lang, [], obj(doc.unit));
  }
  if (kind === 'articles' || kind === 'legacy') {
    const pool = dbArticles(lib.articles);
    const a = kind === 'articles' ? pool.find((x) => x.id === rest) : LEGACY_ARTICLES.find((x) => x.id === rest);
    return a ? articleSource(a, kind, lang, pool) : null;
  }
  if (kind === 'feed') {
    const [feedId, itemId] = rest.split('|');
    const f = flattenFeed(useFeed.getState().docs, lang).find((x) => x.feedId === feedId && x.itemId === itemId);
    return f ? feedSource(f, lang) : null;
  }
  return null;
}

/** Heute erzeugter Hörtext für Block 2 (`lpool/*` mit `unit.day` und `unit.src`). */
export function unitListenFor(day: string, src: 'theme-listen' | 'dialog'): string | null {
  for (const [id, doc] of useInputLibrary.getState().docs.lpool) {
    const u = obj(doc.unit);
    if (u.day === day && u.src === src) return id;
  }
  return null;
}

export type ChosenSource = { ref: string; kind: 'read' | 'listen'; summary: boolean };

/**
 * Wählt die Quelle synchron (im Klick). Fehlt die geplante Quelle, gilt der Rückfall wie „ohne KI“
 * (Prüfung M4d): Hörtext zum Thema → Themen-Text vorgelesen + Zusammenfassung; Dialog → Feed.
 */
export function chooseSource(plan: InputBlockPlan, day: string, themeId: ThemeId, lang: 'de' | 'en', tts: boolean): ChosenSource | null {
  const theme = (): ChosenSource | null => {
    const tt = themeTextFor(themeId);
    return tt ? { ref: `theme:${tt.id}`, kind: plan.kind, summary: plan.summary } : null;
  };
  const fromFeed = (life: boolean): ChosenSource | null => {
    const read = readAll(useInputLibrary.getState().docs.reading);
    const disc = useLive.getState().docs['app/profile']?.disc;
    const items = flattenFeed(useFeed.getState().docs, lang)
      .filter((f) => f.kind !== 'watch' && (!life || f.domain === 'life'))
      .filter((f) => !read.has(`${f.feedId}|${f.itemId}`) && !stepState(disc, f.itemId, stepsFor(f.kind, f.questions.length > 0)).complete)
      .filter((f) => feedSource(f, lang) !== null);
    const f = items[0];
    if (f) return { ref: `feed:${f.feedId}|${f.itemId}`, kind: plan.kind, summary: false };
    // Sonst ein ungelesener Text aus der Bibliothek (gespeichert vor Startbestand).
    const lib = useInputLibrary.getState().docs;
    const pool = dbArticles(lib.articles).filter((a) => !read.has(a.id) && (!life || a.domain === 'life'));
    const a = pool.sort((x, y) => (x.id < y.id ? 1 : -1))[0];
    if (a) return { ref: `articles:${a.id}`, kind: plan.kind, summary: false };
    const legacy = LEGACY_ARTICLES.find((x) => !read.has(x.id) && (!life || x.domain === 'life'));
    return legacy ? { ref: `legacy:${legacy.id}`, kind: plan.kind, summary: false } : null;
  };

  switch (plan.src) {
    case 'theme-listen':
    case 'dialog': {
      const id = unitListenFor(day, plan.src);
      if (id && tts) return { ref: `lpool:${id}`, kind: 'listen', summary: false };
      if (plan.src === 'dialog') return fromFeed(false) ?? theme();
      const t = theme();
      return t ? { ...t, summary: true } : null;
    }
    case 'feed':
      return fromFeed(false) ?? theme();
    case 'feed-life':
      return fromFeed(true) ?? fromFeed(false) ?? theme();
    default:
      return theme();
  }
}
