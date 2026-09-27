import { TOPICS } from '../content';
import { normCat, topicCat, type RadarCat } from '../grammar/radar';
import type { RadarEvent } from '../learn/types';
import { sentenceSplit } from '../input/textStats';
import type { ErrorCat, TextError } from '../input/types';

// Fehler-Radar `app/radar.events` im Altformat {c, s, t, q, g, a} (Plan §3.8, F10):
// c = Kategorie der alten App (models.js ERR_CATS, wie Phase 2/3: `topicCat`/`normCat`),
// s = Quelle ('w' Schreiben und Anwenden, 'r' Lesezusammenfassung), q = Satz mit der Stelle,
// g = gegeben, a = richtig. Britische Formen kommen nie hinein (usHints sind vorher abgetrennt, F11).
// Geschrieben wird ausschließlich über die eine Sammel-Warteschlange (features/progress/persist.ts,
// `recordRadar` → `mergeRadar`: ohne Doppelte, gekappt).

const TOPIC_IDS: ReadonlySet<string> = new Set(TOPICS.map((t) => t.id));

/** Fehlerart der Korrektur → Kategorie der alten App. Grammatik ohne bekanntes Thema → `wordchoice` (Rückfall wie `normCat`, Prüfbericht H4). */
const CAT_OF: Readonly<Record<ErrorCat, RadarCat>> = {
  grammar: 'wordchoice',
  vocabulary: 'wordchoice',
  collocation: 'wordchoice',
  spelling: 'spelling',
  punctuation: 'spelling',
  register: 'register',
  coherence: 'wordchoice',
  'word-order': 'order',
  other: 'wordchoice',
};

export function radarCat(e: Pick<TextError, 'cat' | 'topic'>): RadarCat {
  if (e.cat === 'grammar' && e.topic && TOPIC_IDS.has(e.topic)) return topicCat(e.topic);
  return CAT_OF[e.cat] ?? normCat(e.cat);
}

const cut = (s: string, n: number) => {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > n ? flat.slice(0, n) : flat;
};

function sentenceAt(text: string, span: [number, number] | null, orig: string): string {
  if (span) {
    const s = sentenceSplit(text).find((x) => x.start <= span[0] && span[0] < x.end);
    if (s) return s.text;
  }
  return orig;
}

export function radarEvents(errors: readonly TextError[], text: string, s: 'w' | 'r', t0: number): RadarEvent[] {
  return errors
    .filter((e) => e.orig.trim() || e.fix.trim())
    .map((e, i) => ({
      c: radarCat(e),
      s,
      t: t0 + i,
      q: cut(sentenceAt(text, e.span, e.orig), 160),
      g: cut(e.orig, 100),
      a: cut(e.fix, 100),
    }));
}
