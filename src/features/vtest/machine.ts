import { assign, fromPromise, setup } from 'xstate';
import { buildActive, buildMeaning, buildYesNo, type ActiveItem, type MeaningItem, type YesNoItem } from '../../domain/vtest/build';
import { scoreVtest, type VtestResult } from '../../domain/vtest/score';

// Ablauf des Wortschatztests (Plan §8.1): intro → yesno(112) → meaning(≤ 20) → active(≤ 10) →
// scoring → saving → result, dazu saveError („Erneut speichern") und cancelled (nichts gespeichert).
// Abbrechen fragt vorher nach (`asking`). Gespeichert wird genau einmal, im Zustand `saving`.

export type VtestInput = { seed: string; lang: 'de' | 'en'; day: string; now: () => number; save: (r: VtestResult) => Promise<void> };

export type VtestEvent =
  | { type: 'START' }
  | { type: 'YES' }
  | { type: 'NO' }
  | { type: 'CHOOSE'; id: string }
  | { type: 'TYPED'; correct: boolean }
  | { type: 'NEXT' }
  | { type: 'CANCEL' }
  | { type: 'CONFIRM_CANCEL' }
  | { type: 'RESUME' }
  | { type: 'RETRY' };

type Ctx = {
  input: VtestInput;
  started: number;
  yesno: YesNoItem[];
  yes: Set<string>;
  i: number;
  meaning: MeaningItem[];
  mRight: number;
  active: ActiveItem[];
  aRight: number;
  /** Letzte Antwort im laufenden Teil (Rückmeldung vor „Weiter"). */
  answered: { id?: string; correct: boolean } | null;
  result: VtestResult | null;
  resumeTo: 'yesno' | 'meaning' | 'active';
};

export const vtestMachine = setup({
  types: { context: {} as Ctx, input: {} as VtestInput, events: {} as VtestEvent },
  actors: {
    save: fromPromise<void, { save: VtestInput['save']; result: VtestResult }>(({ input }) => input.save(input.result)),
  },
  guards: {
    lastYesNo: ({ context }) => context.i + 1 >= context.yesno.length,
    noMeaning: ({ context }) => context.meaning.length === 0,
    lastMeaning: ({ context }) => context.i + 1 >= context.meaning.length,
    noActive: ({ context }) => context.active.length === 0,
    lastActive: ({ context }) => context.i + 1 >= context.active.length,
    resumeYesNo: ({ context }) => context.resumeTo === 'yesno',
    resumeMeaning: ({ context }) => context.resumeTo === 'meaning',
  },
  actions: {
    markYes: assign({ yes: ({ context }) => new Set([...context.yes, context.yesno[context.i]?.w ?? '']) }),
    step: assign({ i: ({ context }) => context.i + 1, answered: null }),
    buildMeaning: assign(({ context }) => ({ meaning: buildMeaning(context.yes, context.input.lang, context.input.seed), i: 0, answered: null })),
    buildActive: assign(({ context }) => ({ active: buildActive(context.yes, new Set(context.meaning.map((m) => m.w)), context.input.lang, context.input.seed), i: 0, answered: null })),
    score: assign(({ context }) => {
      const t = context.input.now();
      return {
        result: scoreVtest(
          {
            yes: context.yes,
            pseudoShown: context.yesno.filter((y) => y.pseudo).map((y) => y.w),
            meaning: { right: context.mRight, n: context.meaning.length },
            active: { right: context.aRight, n: context.active.length },
          },
          { t, d: context.input.day, dur: t - context.started },
        ),
      };
    }),
  },
}).createMachine({
  id: 'vtest',
  context: ({ input }) => ({ input, started: 0, yesno: buildYesNo(input.seed), yes: new Set<string>(), i: 0, meaning: [], mRight: 0, active: [], aRight: 0, answered: null, result: null, resumeTo: 'yesno' }),
  initial: 'intro',
  states: {
    intro: { on: { START: { target: 'yesno', actions: assign({ started: ({ context }) => context.input.now() }) } } },
    yesno: {
      entry: assign({ resumeTo: () => 'yesno' as const }),
      on: {
        YES: [
          { guard: 'lastYesNo', target: 'toMeaning', actions: 'markYes' },
          { actions: ['markYes', 'step'] },
        ],
        NO: [{ guard: 'lastYesNo', target: 'toMeaning' }, { actions: 'step' }],
        CANCEL: 'asking',
      },
    },
    toMeaning: { entry: 'buildMeaning', always: [{ guard: 'noMeaning', target: 'toActive' }, { target: 'meaning' }] },
    meaning: {
      entry: assign({ resumeTo: () => 'meaning' as const }),
      on: {
        CHOOSE: {
          guard: ({ context }) => context.answered === null,
          actions: assign(({ context, event }) => {
            const item = context.meaning[context.i];
            const correct = !!item?.options.find((o) => o.id === event.id)?.correct;
            return { answered: { id: event.id, correct }, mRight: context.mRight + (correct ? 1 : 0) };
          }),
        },
        NEXT: [
          { guard: ({ context }) => context.answered === null, actions: [] },
          { guard: 'lastMeaning', target: 'toActive' },
          { actions: 'step' },
        ],
        CANCEL: 'asking',
      },
    },
    toActive: { entry: 'buildActive', always: [{ guard: 'noActive', target: 'scoring' }, { target: 'active' }] },
    active: {
      entry: assign({ resumeTo: () => 'active' as const }),
      on: {
        TYPED: {
          guard: ({ context }) => context.answered === null,
          actions: assign(({ context, event }) => ({ answered: { correct: event.correct }, aRight: context.aRight + (event.correct ? 1 : 0) })),
        },
        NEXT: [
          { guard: ({ context }) => context.answered === null, actions: [] },
          { guard: 'lastActive', target: 'scoring' },
          { actions: 'step' },
        ],
        CANCEL: 'asking',
      },
    },
    asking: {
      on: {
        CONFIRM_CANCEL: 'cancelled',
        RESUME: [{ guard: 'resumeYesNo', target: 'yesno' }, { guard: 'resumeMeaning', target: 'meaning' }, { target: 'active' }],
      },
    },
    scoring: { entry: 'score', always: 'saving' },
    saving: {
      invoke: {
        src: 'save',
        input: ({ context }) => ({ save: context.input.save, result: context.result as VtestResult }),
        onDone: 'result',
        onError: 'saveError',
      },
    },
    saveError: { on: { RETRY: 'saving' } },
    result: { type: 'final' },
    cancelled: { type: 'final' },
  },
});

// ------------------------------------------------------------------ Fortsetzen (Neubau G3, §3.2)

/** Momentaufnahme des laufenden Tests: nur Zustand und Antworten, die Aufgaben entstehen neu aus `seed`. */
export type VtestSnap = {
  v: 1;
  seed: string;
  lang: 'de' | 'en';
  day: string;
  state: 'yesno' | 'meaning' | 'active' | 'asking';
  resumeTo: 'yesno' | 'meaning' | 'active';
  i: number;
  yes: string[];
  mRight: number;
  aRight: number;
  started: number;
  answered: { id?: string; correct: boolean } | null;
};

const RUNNING: ReadonlySet<string> = new Set(['yesno', 'meaning', 'active', 'asking']);

/** Momentaufnahme aus dem Maschinenzustand; `null` außerhalb der drei Teile (Einstieg, Ergebnis …). */
export function vtestSnapOf(state: string, c: Ctx): VtestSnap | null {
  if (!RUNNING.has(state)) return null;
  return {
    v: 1,
    seed: c.input.seed,
    lang: c.input.lang,
    day: c.input.day,
    state: state as VtestSnap['state'],
    resumeTo: c.resumeTo,
    i: c.i,
    yes: [...c.yes],
    mRight: c.mRight,
    aRight: c.aRight,
    started: c.started,
    answered: c.answered,
  };
}

export function isVtestSnap(x: unknown): x is VtestSnap {
  if (!x || typeof x !== 'object') return false;
  const s = x as Record<string, unknown>;
  return (
    s.v === 1 &&
    typeof s.seed === 'string' &&
    typeof s.day === 'string' &&
    (s.lang === 'de' || s.lang === 'en') &&
    typeof s.state === 'string' &&
    RUNNING.has(s.state) &&
    (s.resumeTo === 'yesno' || s.resumeTo === 'meaning' || s.resumeTo === 'active') &&
    typeof s.i === 'number' &&
    Array.isArray(s.yes) &&
    s.yes.every((w) => typeof w === 'string') &&
    typeof s.mRight === 'number' &&
    typeof s.aRight === 'number' &&
    typeof s.started === 'number'
  );
}

/**
 * Stellt den Maschinenzustand genau an derselben Stelle her (gleiches Wort, gleiche Antwort). Die
 * Aufgaben entstehen aus `seed` deterministisch neu; `input` bringt die aktuellen Speicherwege.
 * `null` = passt nicht (z. B. Position außerhalb der Liste) → verwerfen.
 */
export function restoredVtest(s: VtestSnap, input: VtestInput) {
  const yes = new Set(s.yes);
  const yesno = buildYesNo(s.seed);
  const part = s.state === 'asking' ? s.resumeTo : s.state;
  const meaning = part === 'yesno' ? [] : buildMeaning(yes, s.lang, s.seed);
  const active = part === 'active' ? buildActive(yes, new Set(meaning.map((m) => m.w)), s.lang, s.seed) : [];
  const len = part === 'yesno' ? yesno.length : part === 'meaning' ? meaning.length : active.length;
  if (s.i < 0 || s.i >= len) return null;
  const context: Ctx = {
    input: { ...input, seed: s.seed, lang: s.lang, day: s.day },
    started: s.started,
    yesno,
    yes,
    i: s.i,
    meaning,
    mRight: s.mRight,
    active,
    aRight: s.aRight,
    answered: s.answered,
    result: null,
    resumeTo: s.resumeTo,
  };
  return vtestMachine.resolveState({ value: s.state, context });
}
