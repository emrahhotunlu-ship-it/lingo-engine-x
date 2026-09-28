import { useMemo, useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { useSettings } from '../../app/settings';
import { sentenceSplit } from '../../domain/input/textStats';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';
import { alternatives } from '../../prompts/nb/p4/alternatives';
import { Button } from '../../ui/Button';
import { Disclosure } from '../../ui/Disclosure';
import { toast } from '../../ui/Toast';
import { AiRunPanel } from '../input/AiRunPanel';
import { saveChunkCard } from '../input/cards';

// Alternativen je Satz (Neubau N60, DeepL Write): erst auf Tipp auf einen Satz des eigenen Texts,
// jeweils mit „Übernehmen“ (in die Überarbeitung) und „+ Wortschatz“ (mit dem Satz als Ursprung).

type Props = { text: string; sourceRef: string; title: string; onAdopt: (next: string) => void };

export function Alternatives({ text, sourceRef, title, onAdopt }: Props) {
  const { t } = useT();
  const ai = useAiAvailable();
  const ask = useAsk(alternatives);
  const sentences = useMemo(() => sentenceSplit(text).map((s) => s.text), [text]);
  const [active, setActive] = useState<number | null>(null);
  const [saved, setSaved] = useState<Record<string, true>>({});
  if (!ai || sentences.length === 0) return null;

  const pick = (i: number) => {
    setActive(i);
    void ask.run({ sentence: sentences[i] ?? '', context: text, uiLang: useSettings.getState().lang });
  };
  const alts = ask.data?.alts ?? [];
  const cur = active !== null ? (sentences[active] ?? '') : '';

  return (
    <div data-testid="alternatives">
      <Disclosure label={t('nbLesenAltTitle')}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t('nbLesenAltHint')}</p>
          <ul className="flex flex-col gap-1">
            {sentences.map((s, i) => (
              <li key={i}>
                <button type="button" onClick={() => pick(i)} aria-pressed={active === i} data-testid="alt-sentence" className={`w-full rounded-xl px-3 py-2 text-left text-sm ${active === i ? 'bg-accent-soft' : 'bg-surface hover:bg-surface-strong'}`} lang="en">
                  {s}
                </button>
              </li>
            ))}
          </ul>
          {active !== null && <AiRunPanel phase={ask.phase} error={ask.error} onStop={ask.stop} onRetry={() => pick(active)} skeleton={false} />}
          {active !== null && alts.length > 0 && (
            <ul className="flex flex-col gap-2" data-testid="alt-list">
              {alts.map((a) => (
                <li key={a.text} className="flex flex-col gap-2 rounded-xl bg-surface px-3 py-2">
                  <EnglishText text={a.text} area="write" source={sourceRef} title={title} className="text-base" />
                  <p className="text-sm text-muted">{a.note}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => onAdopt(text.replace(cur, a.text))} data-testid="alt-adopt">
                      {t('nbLesenAltAdopt')}
                    </Button>
                    <Button
                      variant="ghost"
                      icon="bookmarkPlus"
                      disabled={!!saved[a.text]}
                      onClick={() => {
                        void saveChunkCard({ en: a.text, de: a.de, sentence: a.text }, 'write', sourceRef, title).then((ok) => {
                          if (ok) setSaved((s) => ({ ...s, [a.text]: true }));
                          else toast(t('inSaveFailed'), 'error');
                        });
                      }}
                      data-testid="alt-save"
                    >
                      {saved[a.text] ? t('nbLesenAltSaved') : t('nbLesenAltSave')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Disclosure>
    </div>
  );
}
