import { Icon } from '../Icon';
import { VDot, type VChannel } from './VDot';

// D1 V-BAU: Blockliste ohne Knöpfe (`.statelist`/`.st`, Vorschau style.css:201–210; screens.js:168–171). Erscheint auf Antippen des
// Rings. Erledigt ist Zustand, kein Knopf (Kap. 2 Nr. 2). Zustand über Zeichen und Text, für Screenreader zusätzlich als Wort.

export type VStepState = 'done' | 'run' | 'open';

export type VStep = { id: string; name: string; /** Rechts: Minuten oder „läuft“. */ meta?: string; state: VStepState; ch?: VChannel };

type Props = {
  steps: readonly VStep[];
  label: string;
  stateLabels: Record<VStepState, string>;
  /** Federnd aufgehen (beim Öffnen über den Ring). */
  spring?: boolean;
  id?: string;
  'data-testid'?: string;
};

export function VStateList({ steps, label, stateLabels, spring, id, ...rest }: Props) {
  return (
    <ul id={id} className={`lx-v-statelist${spring ? ' lx-v-springopen' : ''}`} aria-label={label} data-testid={rest['data-testid']}>
      {steps.map((s) => (
        <li key={s.id} className="lx-v-st" data-state={s.state} aria-current={s.state === 'run' ? 'step' : undefined}>
          <span className="lx-v-st-mk" aria-hidden="true">
            {s.state === 'done' && <Icon name="check" size={14} />}
          </span>
          {s.ch && <VDot ch={s.ch} />}
          <span className="lx-v-st-nm">{s.name}</span>
          <span className="sr-only">{stateLabels[s.state]}</span>
          {s.meta && <span className="lx-v-st-sm lx-v-num">{s.meta}</span>}
        </li>
      ))}
    </ul>
  );
}
