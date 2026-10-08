import { useState } from 'react';
import { checkGateWord, maskedSentence, type GateWord } from '../../../domain/c1/gate/words';
import { useT } from '../../../i18n';
import { ActionBar, PrimaryAction } from '../../../ui/ActionBar';
import { Button } from '../../../ui/Button';

// Ein Kapitelwort der Kapitelprüfung (Lernplattform 3.0 §4.4): Satz mit Lücke, gesucht wird das englische Wort zur deutschen Bedeutung. Frei getippt, ohne Tipps,
// ohne Rückmeldung; nichts wird gebucht. Nur ein genau (oder britisch) getipptes Wort zählt.

export function GateWordItem({ word, onAnswer }: { word: GateWord; onAnswer: (right: boolean, given: string) => void }) {
  const { t } = useT();
  const [value, setValue] = useState('');
  const send = (given: string): void => onAnswer(given.trim() ? checkGateWord(word, given).right : false, given.trim());
  return (
    <article className="flex flex-col gap-4" data-testid="gate-word" data-card={word.cardId}>
      <p className="lx-t-support text-muted">{t('pxGtWordAsk')}</p>
      <p className="lx-t-prompt" lang="en" data-testid="gate-word-sentence">
        {maskedSentence(word)}
      </p>
      <p className="text-sm text-muted" data-testid="gate-word-de">
        {t('pxGtWordMeaning')}: <b>{word.de}</b>
      </p>
      <label className="flex flex-col gap-1">
        <span className="lx-t-meta text-muted">{t('pxGtWordLabel')}</span>
        <input
          type="text"
          className="lx-input min-h-12 rounded-[var(--radius-control)] border border-line bg-surface-solid px-3 text-base"
          value={value}
          maxLength={40}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          lang="en"
          data-testid="gate-word-input"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) {
              e.preventDefault();
              send(value);
            }
          }}
        />
      </label>
      <ActionBar placement="column" stateKey={`gate-word-${word.key}`} aside={null}>
        <PrimaryAction iconAfter="arrowRight" disabled={!value.trim()} onClick={() => send(value)} testId="gate-word-next">
          {t('pxPlNext')}
        </PrimaryAction>
        <Button variant="ghost" onClick={() => send('')} data-testid="gate-word-dontknow">
          {t('pxPlDontKnow')}
        </Button>
      </ActionBar>
    </article>
  );
}
