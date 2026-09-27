import { useState } from 'react';
import { z } from 'zod';
import { defineArea } from '../app/registry';
import { HubSections } from '../app/shell/Hub';
import { placesOf } from '../app/shell/tabs';
import { useHiddenInput } from '../engine/HiddenInput';
import { startDuty } from '../features/learn/flow';
import { useToday } from '../features/today/state';
import { FreeRoundSheet } from '../features/vocab/FreeRoundSheet';
import { installFlushOnHide } from '../features/vocab/persist';
import { TrainerScreen } from '../features/vocab/TrainerScreen';
import { VocabScreen } from '../features/vocab/list/VocabScreen';
import { useT } from '../i18n';
import { ChannelIcon } from '../ui/Card';
import { Icon } from '../ui/Icon';

// Bereich „Wortschatz“ – Besitz: Paket P3 (docs/neubau/architektur.md §5.2).
// WP0a: Die Reiter-Wurzel zeigt die heutige Wortliste; darüber der direkte Einstieg in den
// Vokabeltrainer (Wiederholen als Pflicht, freie Runde als Extra). P3 baut Stapel und Anki-Modus.

declare module '../app/router/types' {
  interface RouteParams {
    vocab: NoParams;
    trainer: { round: 'pflicht' | 'extra' };
  }
}

function Row({ title, sub, onClick, testId, icon }: { title: string; sub: string; onClick: () => void; testId: string; icon: 'cards' | 'plus' }) {
  return (
    <li>
      <button type="button" onClick={onClick} data-testid={testId} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-strong">
        <ChannelIcon channel="cards">
          <Icon name={icon} />
        </ChannelIcon>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{title}</span>
          <span className="text-sm text-muted">{sub}</span>
        </span>
        <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
      </button>
    </li>
  );
}

/** Direkter Einstieg in den Trainer (Platz `vocab`): Pflicht-Wiederholung, solange offen, und freie Runde. */
function TrainerEntry() {
  const { t } = useT();
  const api = useHiddenInput();
  const st = useToday();
  const [free, setFree] = useState(false);
  const reviewOpen = st.ready && st.duties.items.some((d) => d.id === 'review' && d.state === 'open');
  return (
    <>
      <ul className="lx-glass flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)]" aria-label={t('lhVocab')} data-testid="vocab-trainer">
        {reviewOpen && <Row icon="cards" title={t('tdReviewTitle')} sub={t('nbShReviewSub')} onClick={() => startDuty('review', api)} testId="vocab-review" />}
        <Row icon="plus" title={t('lhVocabFree')} sub={t('lhFreeRoundSub')} onClick={() => setFree(true)} testId="vocab-free-round" />
      </ul>
      <FreeRoundSheet open={free} onClose={() => setFree(false)} />
    </>
  );
}

/** Reiter-Wurzel: Wortliste mit den Abschnitten des Platzes `vocab` unter der Titelzeile. */
function VocabRoot() {
  return (
    <VocabScreen root>
      <HubSections places={placesOf('vocab')} />
    </VocabScreen>
  );
}

export const wortschatz = defineArea({
  id: 'wortschatz',
  screens: {
    vocab: { kind: 'tab', component: VocabRoot, title: 'vcTitle', keepScroll: true },
    trainer: { kind: 'exercise', component: TrainerScreen, params: z.object({ round: z.enum(['pflicht', 'extra']) }) },
  },
  sections: [{ id: 'ws-trainer', place: 'vocab', order: 10, component: TrainerEntry }],
  boot: () => installFlushOnHide(),
});
