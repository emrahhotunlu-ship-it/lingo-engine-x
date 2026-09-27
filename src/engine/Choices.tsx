import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { DURATION } from '../ui/motion';
import { verdictHaptic } from '../platform/haptics';
import { playCue } from '../platform/sound';

// Auswahl aus vier Optionen: Tippen oder Ziffer 1–4. Nach der Wahl: gewählte rot bzw. grün,
// die richtige grün (Lern-Entwurf §4.1).

export type ChoiceItem = { id: string; label: string; lang: 'de' | 'en'; correct: boolean };

type Props = { items: ChoiceItem[]; chosen: string | null; onChoose: (id: string) => void; label: string };

export function Choices({ items, chosen, onChoose, label }: Props) {
  const done = chosen !== null;
  // Vibration beim Wählen (Kap. 4.3) – auch bei Wahl per Ziffer; nur wo möglich und eingeschaltet.
  const verdict = chosen === null ? null : items.find((o) => o.id === chosen)?.correct ? 'correct' : 'wrong';
  useEffect(() => {
    if (verdict) verdictHaptic(verdict);
  }, [verdict, chosen]);
  return (
    <div role="group" aria-label={label} className="grid gap-2 sm:grid-cols-2" data-testid="choices">
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
            className="lx-choice"
          >
            <span className="lx-choice-key" aria-hidden="true">
              {i + 1}
            </span>
            <span lang={o.lang} className="min-w-0 flex-1 text-left">
              {o.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
