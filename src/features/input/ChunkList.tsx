import { useMemo, useState } from 'react';
import { useLive } from '../../data/live';
import { slug } from '../../domain/content';
import { sentenceWith } from '../../domain/text/chunkMatch';
import { EnglishText } from '../../engine/EnglishText';
import type { WordTapArea } from '../../engine/wordTap';
import { useT } from '../../i18n';
import { speak, unlockSpeech, useSpeech } from '../../platform/speech';
import { Button, IconButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { toast } from '../../ui/Toast';
import { useLookupData } from '../lookup/store';
import { saveChunkCard } from './cards';

// Wendungen einer Einheit (Glossar, Wörter vorab, Kernwendungen): jede antippbar, anhörbar und
// „Als Karte speichern" – nur mit Ursprungssatz aus dem Text (Kap. 15, Plan F22). Fehlt der
// Satz, gibt es keinen Knopf, sondern einen Hinweis. „Alle als Karten" (M12) speichert nur die
// speicherbaren.

export type ChunkRow = { en: string; de?: string | undefined; note?: string | undefined };

type Props = {
  rows: readonly ChunkRow[];
  /** Text, aus dem der Ursprungssatz kommt. */
  sourceText: string;
  area: WordTapArea;
  sourceRef: string;
  title: string;
  /** Beim Anwenden: welche Wendungen im eigenen Text schon vorkommen. */
  used?: readonly boolean[];
  saveAll?: boolean;
  testId?: string;
};

type RowState = 'idle' | 'busy' | 'saved' | 'failed';

export function ChunkList({ rows, sourceText, area, sourceRef, title, used, saveAll = false, testId = 'chunk-row' }: Props) {
  const { t, tn, lang } = useT();
  const speech = useSpeech((s) => s.status);
  const vocab = useLive((s) => s.collections.vocab);
  const savedIds = useLookupData((s) => s.saved);
  const [state, setState] = useState<Record<number, RowState>>({});
  const [allBusy, setAllBusy] = useState(false);

  const prepared = useMemo(
    () =>
      rows.map((r) => {
        const sentence = sentenceWith(sourceText, r.en);
        const id = slug(r.en);
        return { ...r, sentence, id };
      }),
    [rows, sourceText],
  );

  const exists = (id: string) => !!savedIds[id] || !!vocab?.has(id);

  const saveOne = async (i: number): Promise<boolean> => {
    const r = prepared[i];
    if (!r?.sentence || !r.de) return false;
    setState((s) => ({ ...s, [i]: 'busy' }));
    const ok = await saveChunkCard({ en: r.en, de: r.de, sentence: r.sentence }, area, sourceRef, title);
    setState((s) => ({ ...s, [i]: ok ? 'saved' : 'failed' }));
    return ok;
  };

  const savable = prepared.map((r, i) => ({ r, i })).filter(({ r, i }) => !!r.sentence && !!r.de && !exists(r.id) && state[i] !== 'saved');

  const saveEverything = async () => {
    setAllBusy(true);
    let n = 0;
    for (const { i } of savable) if (await saveOne(i)) n++;
    setAllBusy(false);
    toast(tn('inSavedAll', n));
  };

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {prepared.map((r, i) => {
          const st = state[i] ?? 'idle';
          const isSaved = st === 'saved' || exists(r.id);
          const note = r.note;
          return (
            <li key={`${r.en}-${i}`} className="flex items-start justify-between gap-3 rounded-xl bg-surface px-3 py-2" data-testid={testId} data-used={used ? String(!!used[i]) : undefined}>
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="flex items-center gap-2 font-medium">
                  {used && (
                    <span className={used[i] ? 'text-accent-text' : 'text-subtle'} aria-hidden="true">
                      <Icon name="check" size={16} />
                    </span>
                  )}
                  <EnglishText text={r.en} area={area} source={sourceRef} title={title} as="span" />
                </p>
                {lang === 'de' && r.de && (
                  <p className="text-sm text-muted" lang="de">
                    {r.de}
                  </p>
                )}
                {note && (
                  <p className="text-xs text-subtle" lang={lang}>
                    {note}
                  </p>
                )}
                {!r.sentence && !isSaved && (
                  <p className="text-xs text-subtle" data-testid="no-sentence">
                    {t('inNoSentence')}
                  </p>
                )}
              </div>
              <div className="flex flex-none items-center">
                {speech === 'ready' && (
                  <IconButton
                    icon="speaker"
                    label={t('inSpeak')}
                    onClick={() => {
                      unlockSpeech();
                      void speak(r.en);
                    }}
                  />
                )}
                {isSaved ? (
                  <span className="inline-flex size-11 items-center justify-center text-accent-text" role="img" aria-label={t('inCardSaved')} data-testid="chunk-saved">
                    <Icon name="check" size={18} />
                  </span>
                ) : r.sentence && r.de ? (
                  <IconButton icon="bookmarkPlus" label={t('inSaveCard')} onClick={() => void saveOne(i)} disabled={st === 'busy'} data-testid="chunk-save" />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {saveAll && savable.length > 1 && (
        <div>
          <Button variant="ghost" icon="bookmarkPlus" onClick={() => void saveEverything()} busy={allBusy} data-testid="chunk-save-all">
            {t('inSaveAll')}
          </Button>
        </div>
      )}
      {Object.values(state).includes('failed') && (
        <p className="text-sm text-danger-text" role="status">
          {t('inSaveFailed')}
        </p>
      )}
    </div>
  );
}
