import { askJson } from '../shared';
import type { AiPhase } from '../shared';
import { readArticle } from '../prompt';
import type { ReadArticleVars } from '../prompt';
import type { ArticleItem } from '../schemas';
import { articleId } from './paths';

// Erzeugen EINES Artikels (docs/umbau/lesen-plan.md §3.1) über das bestehende KI-Tor `askJson`. Keine Oberfläche.
// Fehlerverhalten (A6 Nr. 3, unverändert im Tor): Nur ein Schemaverstoß bei lesbarem JSON löst genau EINEN zweiten Versuch mit
// angehängter Fehlerbeschreibung aus. `invalid_json`, `rate_limited`, `refused`, `empty_completion` werden nie automatisch wiederholt;
// der `AiFailure` geht unverändert an den Aufrufer (Fehlerkarte, Knopf „Erneut versuchen“ mit `refresh`). Teiltext wird nie als Artikel gezeigt.
// Aufrufen nur auf eine Handlung hin (Tippen), nie aus Schleife oder Timer (contract/sample.d.ts).

export type GenerateInput = ReadArticleVars & {
  /** Laufende Nummer des Artikels an diesem Tag (1, 2, 3 …); geht in die Kennung ein. */
  n: number;
  signal: AbortSignal;
  onPhase?: (phase: AiPhase) => void;
  /** Nur beim Knopf „Erneut versuchen“ nach ungültiger Antwort. */
  refresh?: boolean;
  /** Zeitpunkt in ms (Standard: jetzt). */
  now?: number;
};

export type Generated = { item: ArticleItem; retried: boolean };

/** Der Teil der Abhängigkeiten, den Tests austauschen können. */
export type GenerateDeps = { ask: typeof askJson };

/**
 * Ein Artikel von Claude. Löst mit dem gespeicherten Aufbau (noch nicht geschrieben) auf oder lehnt mit dem `AiFailure` des Tors ab.
 * Gespeichert wird erst danach über `saveArticle` (store.ts).
 */
export async function generateArticle(input: GenerateInput, deps: GenerateDeps = { ask: askJson }): Promise<Generated> {
  const vars: ReadArticleVars = { topic: input.topic, custom: input.custom, angle: input.angle, date: input.date, recent: input.recent };
  const res = await deps.ask({ template: readArticle, vars, signal: input.signal, priority: 'user', onPhase: input.onPhase, refresh: input.refresh });
  const a = res.data;
  const item: ArticleItem = {
    id: articleId(input.date, input.n, a.topic === 'custom' ? `custom:${input.custom ?? ''}` : a.topic, a.title),
    t: input.now ?? Date.now(),
    topic: a.topic,
    ...(a.topic === 'custom' && input.custom ? { custom: input.custom } : {}),
    kind: a.kind,
    level: a.level,
    title: a.title,
    summary: a.summary,
    asOf: a.asOf,
    paras: a.paras,
    keyWords: a.keyWords,
    ...(a.check ? { check: a.check } : {}),
    model: res.tierApplied,
    pv: 1,
  };
  return { item, retried: res.retried };
}
