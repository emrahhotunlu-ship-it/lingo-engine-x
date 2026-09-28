import { create } from 'zustand';
import { askJson } from '../../ai/gate';
import { isAiFailure, type AiMessageKey } from '../../ai/types';
import { useSettings } from '../../app/settings';
import { checkTyped } from '../../domain/answer/check';
import { logWarn } from '../../platform/diagnostics';
import { claudeDrill, type ClaudeDrillItem } from '../../prompts/nb/p6/claudeDrill';

// „Mach mir eine Übung dazu“ (N96): Sitzung der Übung `claudeDrill` – fünf Lückensätze aus dem
// Gespräch. Der Aufruf startet im Klick (ausdrückliche Handlung) und lebt hier, nicht im
// Bildschirm. Geprüft wird lokal; die Übung ist ein Extra und schreibt nichts in die db.

export type DrillAnswer = { given: string; ok: boolean };
type State = {
  phase: 'idle' | 'loading' | 'ready' | 'error';
  error: AiMessageKey | null;
  context: string;
  title: string;
  items: ClaudeDrillItem[];
  pos: number;
  answers: DrillAnswer[];
};

const initial: State = { phase: 'idle', error: null, context: '', title: '', items: [], pos: 0, answers: [] };
export const useClaudeDrill = create<State>(() => initial);

let ctl: AbortController | null = null;

/** Startet die Übung aus dem Gesprächsausschnitt (synchron im Klick; die KI antwortet nach). */
export function startClaudeDrill(context: string): void {
  ctl?.abort();
  const c = new AbortController();
  ctl = c;
  useClaudeDrill.setState({ ...initial, phase: 'loading', context });
  void askJson({ template: claudeDrill, vars: { context, uiLang: useSettings.getState().lang }, signal: c.signal }).then(
    (r) => {
      if (ctl === c) useClaudeDrill.setState({ phase: 'ready', title: r.data.title, items: r.data.items });
    },
    (err: unknown) => {
      if (ctl !== c) return;
      if (isAiFailure(err) && err.kind === 'cancelled') return;
      if (!isAiFailure(err)) logWarn('claude-drill', err);
      useClaudeDrill.setState({ phase: 'error', error: isAiFailure(err) ? (err.messageKey ?? 'aiFailed') : 'aiFailed' });
    },
  );
}

export function retryClaudeDrill(): void {
  startClaudeDrill(useClaudeDrill.getState().context);
}

export function stopClaudeDrill(): void {
  ctl?.abort();
  ctl = null;
}

/** Pure: Antwort gegen Lösung und erlaubte Varianten (UK = richtig, lokale Regeln von `checkTyped`). */
export function checkDrill(item: Pick<ClaudeDrillItem, 'answer' | 'accept'>, given: string): boolean {
  return checkTyped(given, [item.answer, ...item.accept], { lemma: item.answer }).verdict !== 'wrong';
}

export function answerClaudeDrill(given: string): void {
  const s = useClaudeDrill.getState();
  const item = s.items[s.pos];
  if (!item || s.answers.length > s.pos) return;
  useClaudeDrill.setState({ answers: [...s.answers, { given, ok: checkDrill(item, given) }] });
}

export function nextClaudeDrill(): void {
  const s = useClaudeDrill.getState();
  if (s.answers.length > s.pos) useClaudeDrill.setState({ pos: s.pos + 1 });
}
