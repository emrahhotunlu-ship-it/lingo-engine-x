import { useT } from '../i18n';

// Kleine Auswahl-Chips (Lernplattform 3.0 §3.1, P14): 3–4 kurze Antworten in einer Reihe (Korrekturen bei „Fehler finden“,
// Abschnitte bei „Register“). Nach dem Prüfen zeigt ✓ die richtige und ✕ die gewählte falsche Option; Farbe nie allein.
// Mindestens 44 px hoch, `aria-pressed` zeigt nur die Auswahl VOR dem Prüfen.

export type ChipRowProps = {
  options: readonly string[];
  chosen: number | null;
  /** Index der richtigen Option (nach dem Prüfen); `null` = unbekannt/mehrere. */
  correct?: number | null;
  revealed?: boolean;
  onPick: (i: number) => void;
  lang?: 'en' | 'de';
  label: string;
  disabled?: boolean;
  testId?: string;
};

export function ChipRow({ options, chosen, correct = null, revealed = false, onPick, lang = 'en', label, disabled = false, testId = 'chip-row' }: ChipRowProps) {
  const { t } = useT();
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2" data-testid={testId}>
      {options.map((o, i) => {
        const state = !revealed ? (i === chosen ? 'picked' : 'idle') : i === correct ? 'correct' : i === chosen ? 'wrong' : 'dim';
        return (
          <button
            key={`${i}:${o}`}
            type="button"
            lang={lang}
            disabled={disabled || revealed}
            aria-pressed={revealed ? undefined : i === chosen}
            data-testid="chip"
            data-state={state}
            className="cx-chip"
            onClick={() => onPick(i)}
          >
            {revealed && (state === 'correct' || state === 'wrong') && (
              <span aria-hidden="true" className="cx-chip-mark">
                {state === 'correct' ? '✓' : '✕'}
              </span>
            )}
            <span>{o}</span>
            {revealed && state === 'correct' && <span className="sr-only"> — {t('cxPartOk')}</span>}
            {revealed && state === 'wrong' && <span className="sr-only"> — {t('cxPartNo')}</span>}
          </button>
        );
      })}
    </div>
  );
}
