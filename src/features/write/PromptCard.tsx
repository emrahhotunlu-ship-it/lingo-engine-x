import { useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import type { WritingPrompt } from '../../domain/input/types';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Disclosure } from '../../ui/Disclosure';
import { InputIcon } from '../../ui/InputIcon';

// Aufgabe des Tages (Plan §4.3 Nr. 1, M12): Titel und Aufgabe in der Oberflächensprache, in der
// DE-Oberfläche aufklappbar auch auf Englisch, Umfang und Fokus. „Andere Aufgabe" und
// „Eigenes Thema" gibt es nur, solange heute noch kein Text abgegeben ist.

type Props = {
  prompt: WritingPrompt;
  canChange: boolean;
  busy: boolean;
  onOther: () => void;
  onOwn: (topic: string) => void;
};

export const OWN_TOPIC_LIMIT = 120;

export function PromptCard({ prompt, canChange, busy, onOther, onOwn }: Props) {
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const [ownOpen, setOwnOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const focus = prompt.focus[lang] ?? null;
  return (
    <section className="lx-glass flex flex-col gap-3 rounded-[var(--radius-card)] p-5" style={{ boxShadow: 'inset 3px 0 0 0 var(--lx-ch-write), var(--lx-shadow)' }} data-testid="prompt-card" data-id={prompt.id}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-[var(--lx-ch-write)]">
          <InputIcon name="pen" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">{prompt.title[lang]}</h2>
          {lang === 'en' ? (
            <EnglishText text={prompt.task.en} area="write" source={null} title={prompt.title.en} className="text-base" testId="prompt-task" />
          ) : (
            <p className="text-base" lang={lang}>
              {prompt.task[lang]}
            </p>
          )}
        </div>
      </div>
      {lang === 'de' && prompt.task.en && (
        <Disclosure label={t('wrTaskEn')}>
          <EnglishText text={prompt.task.en} area="write" source={null} title={prompt.title.en} className="text-sm text-muted" testId="prompt-task-en" />
        </Disclosure>
      )}
      <p className="lx-tnum text-sm text-muted">
        {t('wrRange', { min: prompt.words[0], max: prompt.words[1] })}
        {focus ? ` · ${t('wrFocus')}: ${focus}` : ''}
      </p>
      {canChange && ai && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" icon="refresh" onClick={onOther} disabled={busy} data-testid="prompt-other" data-ai="">
              {t('wrOther')}
            </Button>
            <Button variant="ghost" icon="plus" onClick={() => setOwnOpen((v) => !v)} aria-expanded={ownOpen} disabled={busy} data-testid="prompt-own-open" data-ai="">
              {t('wrOwn')}
            </Button>
          </div>
          {ownOpen && (
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (topic.trim()) onOwn(topic.trim());
              }}
            >
              <label className="sr-only" htmlFor="wr-own-topic">
                {t('wrOwnPlaceholder')}
              </label>
              <input
                id="wr-own-topic"
                value={topic}
                maxLength={OWN_TOPIC_LIMIT}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t('wrOwnPlaceholder')}
                className="lx-glass min-h-11 flex-1 rounded-[var(--radius-control)] px-4 text-base text-fg placeholder:text-subtle"
                data-testid="prompt-own-input"
              />
              <Button type="submit" variant="secondary" disabled={!topic.trim() || busy} data-testid="prompt-own-create" data-ai="">
                {t('wrOwnCreate')}
              </Button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
