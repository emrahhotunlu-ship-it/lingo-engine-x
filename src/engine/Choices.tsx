import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { DURATION } from '../ui/motion';
import { verdictHaptic } from '../platform/haptics';
import { playCue } from '../platform/sound';
import { useT } from '../i18n';
import { CHOICE_LETTERS, keyToIndex } from './choiceKeys';

// Auswahl aus Optionen. Zwei Formen mit gemeinsamer Optik:
//  - NEU (Lernplattform 2.0 §4.4): `options` + Zahlen (`chosen`, `correct`, `revealed`). Große Karten A–D, Tasten A–D und 1–4,
//    nach dem Prüfen ✓ an der richtigen und ✕ an der gewählten falschen Option, `why` unter der gewählten falschen Option,
//    am Handy (`collapse`) bleiben danach nur diese beiden. Haptik und Ton gehören dem Urteil (`Verdict`), nicht diesem Baustein.
//    `aria-pressed` zeigt nur die Auswahl VOR dem Prüfen (Ausgewählt ist nicht Richtig).
//  - ALT: `items` + `onChoose`; wählt sofort und löst Haptik/Ton selbst aus (bestehende Aufrufer).

export type ChoiceItem = { id: string; label: string; lang: 'de' | 'en'; correct: boolean };

type LegacyProps = {
  items: ChoiceItem[];
  chosen: string | null;
  onChoose: (id: string) => void;
  label: string;
  /** Große Karten A–D, immer sichtbar, volle Breite, nach der Wahl mit Zeichen ✓/✕ (Grammatik, Gesamtkonzept R3). */
  letters?: boolean;
};

export type ChoicesProps = {
  options: readonly string[];
  chosen: number | null;
  correct: number | null;
  revealed: boolean;
  onPick: (i: number) => void;
  lang?: 'en' | 'de';
  /** Handy: nach dem Prüfen nur gewählte (✕) und richtige (✓) Option, die übrigen blenden in 150 ms aus. */
  collapse?: boolean;
  /** Zeile unter der gewählten falschen Option. */
  why?: Partial<Record<number, string>>;
  /** Zugänglicher Name der Gruppe. */
  label?: string;
  /** Tasten A–D und 1–4 wählen (Standard an). Der Aufrufer schaltet ab, wenn er die Tasten selbst behandelt. */
  keys?: boolean;
  testId?: string;
};

type Props = LegacyProps | ChoicesProps;

export function Choices(props: Props) {
  return 'items' in props ? <LegacyChoices {...props} /> : <ModernChoices {...props} />;
}

function LegacyChoices({ items, chosen, onChoose, label, letters = false }: LegacyProps) {
  const done = chosen !== null;
  // Vibration beim Wählen (Kap. 4.3) – auch bei Wahl per Ziffer; nur wo möglich und eingeschaltet.
  const verdict = chosen === null ? null : items.find((o) => o.id === chosen)?.correct ? 'correct' : 'wrong';
  useEffect(() => {
    if (verdict) verdictHaptic(verdict);
  }, [verdict, chosen]);
  return (
    <div role="group" aria-label={label} className={letters ? 'grid grid-cols-1 gap-3' : 'grid gap-2 sm:grid-cols-2'} data-testid="choices">
      {items.map((o, i) => {
        const state = !done ? 'idle' : o.correct ? 'correct' : o.id === chosen ? 'wrong' : 'dim';
        return (
          <motion.button
            key={o.id}
            type="button"
            data-testid="choice"
            data-state={state}
            disabled={done}
            aria-pressed={o.id === chosen}
            whileTap={done ? undefined : { scale: 0.98 }}
            transition={{ duration: DURATION.fast }}
            onClick={() => {
              playCue(o.correct ? 'correct' : 'wrong');
              onChoose(o.id);
            }}
            className={letters ? 'lx-choice lx-choice-big' : 'lx-choice'}
          >
            <span className={letters ? 'lx-choice-key lx-choice-letter' : 'lx-choice-key'} aria-hidden="true">
              {letters ? (CHOICE_LETTERS[i] ?? i + 1) : i + 1}
            </span>
            <span lang={o.lang} className="min-w-0 flex-1 text-left">
              {o.label}
            </span>
            {letters && (state === 'correct' || state === 'wrong') && <Mark state={state} />}
          </motion.button>
        );
      })}
    </div>
  );
}

function Mark({ state }: { state: 'correct' | 'wrong' }) {
  const { t } = useT();
  return (
    <span className="lx-choice-mark" data-mark={state}>
      <span aria-hidden="true">{state === 'correct' ? '✓' : '✕'}</span>
      <span className="sr-only">{state === 'correct' ? t('chMarkRight') : t('chMarkWrong')}</span>
    </span>
  );
}

function ModernChoices({ options, chosen, correct, revealed, onPick, lang = 'en', collapse = false, why, label, keys = true, testId = 'choices' }: ChoicesProps) {
  const reduce = useReducedMotion();
  const live = useRef({ onPick, revealed, n: options.length });
  useEffect(() => {
    live.current = { onPick, revealed, n: options.length };
  });
  useEffect(() => {
    if (!keys) return;
    const onKey = (e: KeyboardEvent): void => {
      const s = live.current;
      if (s.revealed || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      // Ein modaler Dialog liegt darüber, oder ein Textfeld hat den Fokus: keine Übungstasten.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const i = keyToIndex(e.key, s.n);
      if (i === null) return;
      e.preventDefault();
      s.onPick(i);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keys]);

  const dur = reduce ? 0 : DURATION.fast;
  return (
    <div role="group" aria-label={label} className="flex flex-col" data-testid={testId} data-revealed={revealed || undefined}>
      <AnimatePresence initial={false}>
        {options.map((text, i) => {
          const state = !revealed ? 'idle' : i === correct ? 'correct' : i === chosen ? 'wrong' : 'dim';
          if (revealed && collapse && state === 'dim') return null;
          const line = revealed && state === 'wrong' ? why?.[i] : undefined;
          return (
            <motion.div
              key={i}
              className="pt-3 first:pt-0"
              exit={{ opacity: 0, height: 0, paddingTop: 0, overflow: 'hidden', transition: { duration: dur } }}
            >
              <button
                type="button"
                data-testid="choice"
                data-state={state}
                disabled={revealed}
                aria-pressed={!revealed && chosen === i}
                onClick={() => onPick(i)}
                className="lx-choice lx-choice-big"
              >
                <span className="lx-choice-key lx-choice-letter" aria-hidden="true">
                  {CHOICE_LETTERS[i] ?? i + 1}
                </span>
                <span lang={lang} className="min-w-0 flex-1 text-left">
                  {text}
                </span>
                {(state === 'correct' || state === 'wrong') && <Mark state={state} />}
              </button>
              {line && (
                <p className="px-1 pt-1.5 text-sm text-muted" data-testid="choice-why">
                  {line}
                </p>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
