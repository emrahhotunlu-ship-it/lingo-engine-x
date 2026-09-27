import { useState } from 'react';
import { useNav } from '../../app/nav';
import { DECKS, DECK_SIZES, type Deck } from '../../domain/srs/vocabList';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT, type MessageKey } from '../../i18n';
import { unlockSpeech } from '../../platform/speech';
import { Button } from '../../ui/Button';
import { Segmented } from '../../ui/Segmented';
import { Sheet } from '../../ui/Sheet';
import { startSession } from './session';

// Freie Vokabelrunde (UX-Beratung, Zuordnung: Üben → Wortschatz → „Freie Runde"): Stapel und
// Größe in einem Blatt statt eines Kastens auf „Heute". Zählt als Extra, nie zum Tagesziel.

const DECK_KEY: Record<Deck, MessageKey> = { all: 'tdDeckAll', hard: 'tdDeckHard', job: 'tdDeckJob', phrases: 'tdDeckPhrases' };

export function FreeRoundSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const [deck, setDeck] = useState<Deck>('all');
  const [size, setSize] = useState<(typeof DECK_SIZES)[number]>(10);
  const start = () => {
    unlockSpeech();
    // Tastatur am iPhone: im selben Handler fokussieren (Kap. 4.1).
    const first = startSession('extra', { deck, size });
    if (first === 'typed') api.focusNow();
    // Das Blatt schließt mit dem Bildschirmwechsel; ein eigenes Schließen gäbe den Fokus an den
    // auslösenden Knopf zurück und nähme der Lücke die Tastatur (iPhone).
    go({ name: 'trainer', round: 'extra' });
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('frTitle')} closeLabel={t('close')}>
      <div className="flex flex-col gap-5" data-testid="free-round">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t('tdDeck')}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('tdDeck')}>
            {DECKS.map((d) => (
              <button key={d} type="button" className="lx-chip" aria-pressed={deck === d} onClick={() => setDeck(d)} data-testid="deck" data-deck={d}>
                {t(DECK_KEY[d])}
              </button>
            ))}
          </div>
        </div>
        <div className="flex max-w-xs flex-col gap-2">
          <p className="text-sm font-medium">{t('tdDeckSize')}</p>
          <Segmented
            label={t('tdDeckSize')}
            value={String(size) as '10' | '20' | '30'}
            options={DECK_SIZES.map((n) => ({ value: String(n) as '10' | '20' | '30', label: String(n) }))}
            onChange={(v) => setSize(Number(v) as (typeof DECK_SIZES)[number])}
          />
        </div>
        <p className="text-sm text-muted">{t('tdExtraHint')}</p>
        <div>
          <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={start} data-testid="start-extra">
            {t('tdExtraStart')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
