import { useNav, type Route } from '../../app/nav';
import type { Lang } from '../../app/settings';
import { isKnownAction } from '../../domain/assessment/actions';
import { lessonById, TOPICS } from '../../domain/content';
import type { MessageKey } from '../../i18n';
import { unlockSpeech } from '../../platform/speech';
import { startDrill } from '../drills/session';
import { startGrammar } from '../grammar/session';
import { startSession } from '../vocab/session';

// „Üben"-Ziele der Einschätzung und des Radars (Plan §0.1, §4.6): Aktion → Bildschirm. Gibt es
// kein Ziel, fehlt der Knopf (`actionRoute` = null) – nie ein Knopf ins Leere.
// Seit 04.10.2026 (Fokus Vokabeln und Grammatik) führt kein Knopf mehr zu Lesen, Hören, Schreiben oder Entdecken.

type FocusApi = { focusNow(): void; blur(): void };
type T = (k: MessageKey, v?: Record<string, string | number>) => string;

const FIXED: Readonly<Record<string, { route: Route; label: MessageKey }>> = {
  'vocab:review': { route: { name: 'trainer', round: 'extra' }, label: 'actVocabReview' },
  'vocab:leech': { route: { name: 'trainer', round: 'extra' }, label: 'actVocabLeech' },
  chunks: { route: { name: 'trainer', round: 'extra' }, label: 'actChunks' },
  cloze: { route: { name: 'drill', kind: 'cloze', ctx: 'xtra' }, label: 'actCloze' },
  order: { route: { name: 'drill', kind: 'order', ctx: 'xtra' }, label: 'actOrder' },
};

/** Ziel einer Aktion oder `null` (dann gibt es keinen „Üben"-Knopf). */
export function actionRoute(action: string | null): Route | null {
  if (!action || !isKnownAction(action)) return null;
  const fixed = FIXED[action];
  if (fixed) return fixed.route;
  const [kind, id] = action.split(':') as [string, string];
  if (kind === 'grammar' || kind === 'errors') return { name: 'grammarSession', mode: 'topic', topic: id };
  // `lesson:<id>` (alte gespeicherte Einschätzungen): den Kurs gibt es nicht mehr, also kein Üben-Knopf.
  return null;
}

/** Kurze Bezeichnung einer Aktion in der Oberflächensprache (für „Claudes Fokus · …"). */
export function actionLabel(action: string, t: T, lang: Lang): string {
  const fixed = FIXED[action];
  if (fixed) return t(fixed.label);
  const [kind, id] = action.split(':') as [string, string | undefined];
  if ((kind === 'grammar' || kind === 'errors') && id) {
    const topic = TOPICS.find((x) => x.id === id);
    if (topic) return lang === 'en' ? (topic.name_en ?? topic.name) : topic.name;
  }
  if (kind === 'lesson' && id) {
    const l = lessonById(id);
    if (l) return t('actLesson', { title: lang === 'en' ? l.en : l.de });
  }
  return t('actPractice');
}

/** Übung starten und hinwechseln (Runde vorbereiten wie auf Heute). */
export function startAction(action: string, api: FocusApi): boolean {
  const route = actionRoute(action);
  if (!route) return false;
  const go = useNav.getState().go;
  unlockSpeech();
  if (route.name === 'grammarSession') {
    const first = startGrammar({ mode: 'topic', topic: route.topic });
    if (first === 'typed') api.focusNow();
    else api.blur();
  } else if (route.name === 'drill') {
    const first = startDrill(route.kind);
    if (first === 'typed') api.focusNow();
    else api.blur();
  } else if (route.name === 'trainer') {
    const deck = action === 'vocab:leech' ? 'hard' : action === 'chunks' ? 'phrases' : 'all';
    const first = startSession('extra', { deck, size: 10 });
    if (first === 'typed') api.focusNow();
  } else api.blur();
  go(route);
  return true;
}
