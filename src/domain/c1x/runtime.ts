import type { GrammarTask } from '../learn/types';
import { errFixed, errRange } from './kinds/err';
import type { C1Item } from './types';

// Aufgabe des Aufgabensystems c1x als `GrammarTask` der Runde (Lernplattform 3.0 §3.3, P13). Die alten Felder bleiben die Wahrheit für
// `seen` (Schlüssel `c1:<id>`), den Fehlersatz (`prompt` = Frage bzw. falscher Satz, `answer` = richtige Fassung) und das Protokoll;
// die Oberfläche (`<C1Item/>`, P14) liest `task.c1`.

export const C1_KEY_PREFIX = 'c1:';
export const c1Key = (id: string): string => `${C1_KEY_PREFIX}${id}`;
export const isC1Key = (key: string): boolean => key.startsWith(C1_KEY_PREFIX);
export type C1Task = GrammarTask & { c1: C1Item };
export const isC1Task = (t: GrammarTask): t is C1Task => t.c1 !== undefined;

/** Das Wort-Beispiel einer Aufgabe, das gefragt wird (für Fehlersatz-Texte und Protokoll). */
function fields(item: C1Item): Pick<GrammarTask, 'type' | 'prompt' | 'answer' | 'accepted' | 'options' | 'x'> {
  switch (item.kind) {
    case 'mcc':
      return { type: 'mc', prompt: item.text, answer: item.options[item.answer], accepted: [], options: [...item.options] };
    case 'ocl':
    case 'wf':
      return { type: 'gap', prompt: item.text, answer: item.accept[0] ?? '', accepted: item.accept.slice(1), options: null };
    case 'kwt': {
      const sols = item.keys.flatMap((k) => k.a.flatMap((a) => k.b.map((b) => `${a} ${b}`)));
      return {
        type: 'kwt',
        prompt: `${item.before} ___ ${item.after}`.trim(),
        answer: sols[0] ?? '',
        accepted: sols.slice(1),
        options: null,
        x: { kind: 'kwt', from: item.lead, key: item.key, words: item.words ?? [3, 6] },
      };
    }
    case 'err': {
      const range = errRange(item);
      const fixed = item.bad ? errFixed(item, item.bad.fix[0] ?? '') : null;
      return { type: 'find', prompt: item.text, answer: fixed ?? item.text, accepted: [], options: null, x: { kind: 'find', err: range, fixed } };
    }
    case 'pair':
      return { type: 'mc', prompt: item.sa, answer: item.sb, accepted: [], options: null };
    case 'cnet':
      return { type: 'mc', prompt: item.hub, answer: item.right[0]?.w ?? '', accepted: [], options: null };
    case 'reg':
      return { type: 'transform', prompt: item.text, answer: item.answers[0] ?? '', accepted: item.answers.slice(1), options: null };
    case 'para':
      return { type: 'mc', prompt: item.a, answer: item.options[item.answer], accepted: [], options: [...item.options] };
  }
}

/** Aufgabe der Runde zu einer c1x-Aufgabe. `errorT`: Zeitstempel des Fehlereintrags, wenn die Aufgabe eine Fehler-Wiederholung ist. */
export function toTask(item: C1Item, opts: { errorT?: number | null; ref?: string } = {}): C1Task {
  const f = fields(item);
  return {
    key: c1Key(item.id),
    topic: item.topic ?? 'lex',
    hint: null,
    expl: { de: item.why.ok.de, en: item.why.ok.en },
    src: item.src === 'ai' ? 'ai' : 'seed',
    ref: opts.ref ?? 'content/c1x',
    errorT: opts.errorT ?? null,
    pat: item.pat,
    why: item.why,
    c1: item,
    ...f,
  };
}

/**
 * Zahl der Wahlmöglichkeiten für die Ratekorrektur im BKT (Lernplattform 3.0 §3.4): Auswahl = Zahl der Optionen, `pair` = 6
 * (zwei Verbindungen aus drei Bedeutungen), `cnet` = 4 **(Annahme)**, Register-Chips = 3 je Abschnitt, `err` = Wortzahl (der Fundort; `guessOf` rechnet 1/(n+1)).
 * Getippte Arten haben keine (`undefined`, es gilt die Tipp-Ratewahrscheinlichkeit).
 */
export function nOptionsOf(item: C1Item): number | undefined {
  switch (item.kind) {
    case 'mcc':
    case 'para':
      return 4;
    case 'pair':
      return 6;
    case 'cnet':
      return 4;
    case 'reg':
      return 3;
    case 'err':
      return item.text.split(/\s+/).filter(Boolean).length;
    default:
      return undefined;
  }
}
