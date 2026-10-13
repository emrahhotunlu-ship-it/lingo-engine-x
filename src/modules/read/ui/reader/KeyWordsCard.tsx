import { useCallback, useRef, useState } from 'react';
import type { ArticleItem } from '../../schemas';
import type { KeyWordPick } from '../../domain/readerModel';
import { cardLevel } from '../../domain/readerModel';
import { rdrText, type RdrLang } from '../../domain/readerText';
import { dayKey, logError } from '../../shared';
import { Button, EnglishText, Icon, saveLookupCard } from '../../sharedUi';

// „Wörter aus dem Text“ (docs/umbau/lesen-plan.md §2.2): bis zu 5 Wörter, je ein Knopf „Als Karte“. Die Karte bekommt den Satz des
// Artikels als Ursprungssatz (Kap. 15); das Wort muss in diesem Satz stehen (sonst gibt es keinen Knopf). Karten werden nur über
// `saveLookupCard` angelegt (Dublettenregel, Dokument-Wächter), das Lesemodul schreibt nie selbst in `vocab/`.

type CardState = 'idle' | 'busy' | 'saved' | 'exists' | 'failed';

export type KeyWordsCardProps = {
  picks: readonly KeyWordPick[];
  article: Pick<ArticleItem, 'id' | 'title' | 'level'>;
  lang: RdrLang;
  /** Eine NEUE Karte wurde angelegt (für den Lesezustand). */
  onSaved: () => void;
};

export function KeyWordsCard({ picks, article, lang, onSaved }: KeyWordsCardProps) {
  const [state, setState] = useState<Record<number, CardState>>({});
  const busy = useRef(new Set<number>());

  const save = useCallback(
    async (i: number) => {
      const p = picks[i];
      if (!p?.sentence || !p.surface || busy.current.has(i)) return;
      busy.current.add(i);
      setState((s) => ({ ...s, [i]: 'busy' }));
      let next: CardState = 'failed';
      try {
        const level = cardLevel(article.level);
        const r = await saveLookupCard({
          word: p.kw.w,
          de: p.kw.de,
          ex: p.sentence.e,
          surface: p.surface,
          src: 'read',
          origin: { v: 1, kind: 'read', t: Date.now(), ref: article.id, title: article.title },
          today: dayKey(Date.now()),
          ...(level ? { level } : {}),
        });
        if (r === 'saved' || r === 'added') {
          next = 'saved';
          onSaved();
        } else if (r === 'exists') next = 'exists';
        else if (r === 'invalid') logError('read:keyword', { code: 'invalid_card', message: `${p.kw.w} ohne gültigen Satz` }, article.id);
      } finally {
        busy.current.delete(i);
        setState((s) => ({ ...s, [i]: next }));
      }
    },
    [picks, article.id, article.title, article.level, onSaved],
  );

  if (!picks.length) return null;
  return (
    <section className="lx-card flex flex-col gap-3 p-4" aria-labelledby="rdr-kw-h" data-testid="rdr-keywords">
      <div className="flex flex-col gap-1">
        <h2 id="rdr-kw-h" className="m-0 text-base font-semibold text-fg">
          {rdrText(lang, 'rdrKeyWords')}
        </h2>
        <p className="m-0 text-xs text-muted">{rdrText(lang, 'rdrKeyHint')}</p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {picks.map((p, i) => {
          const st = state[i] ?? 'idle';
          return (
            <li key={p.kw.w} className="flex flex-col gap-1.5" data-testid="rdr-kw" data-w={p.kw.w} data-state={st}>
              <p className="m-0 text-base">
                <span className="font-semibold text-fg" lang="en">
                  {p.kw.w}
                </span>
                <span className="text-muted"> · </span>
                <span className="text-muted" lang="de">
                  {p.kw.de}
                </span>
              </p>
              {p.sentence ? (
                <EnglishText as="p" text={p.sentence.e} area="read" source={article.id} title={article.title} highlight={p.span} className="m-0 text-sm leading-6 text-muted" testId="rdr-kw-sentence" />
              ) : null}
              <div className="flex min-h-11 items-center gap-3">
                {!p.sentence ? (
                  <p className="m-0 text-xs text-subtle" data-testid="rdr-kw-nosentence">
                    {rdrText(lang, 'rdrCardNoSentence')}
                  </p>
                ) : st === 'saved' || st === 'exists' ? (
                  <p className="m-0 inline-flex items-center gap-1.5 text-sm font-medium text-accent-text" role="status" data-testid="rdr-kw-saved">
                    <Icon name="check" size={18} />
                    {rdrText(lang, st === 'saved' ? 'rdrCardSaved' : 'rdrCardExists')}
                  </p>
                ) : (
                  <Button
                    variant="secondary"
                    icon="bookmarkPlus"
                    busy={st === 'busy'}
                    busyLabel={rdrText(lang, 'rdrSaving')}
                    aria-label={rdrText(lang, 'rdrSaveCardFor', { word: p.kw.w })}
                    onClick={() => void save(i)}
                    data-testid="rdr-kw-save"
                  >
                    {rdrText(lang, 'rdrSaveCard')}
                  </Button>
                )}
                {st === 'failed' ? (
                  <p className="m-0 text-xs text-danger-text" role="status" data-testid="rdr-kw-failed">
                    {rdrText(lang, 'rdrCardFailed')}
                  </p>
                ) : null}
                {p.sentence ? <span className="ml-auto text-2xs text-subtle">{rdrText(lang, 'rdrInSentence', { n: p.sentence.n })}</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
