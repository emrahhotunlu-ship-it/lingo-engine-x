import { useCallback, useRef, useState } from 'react';
import type { ArticleItem } from '../../schemas';
import type { KeyWordPick } from '../../domain/readerModel';
import { cardLevel } from '../../domain/readerModel';
import { rdrText, type RdrLang } from '../../domain/readerText';
import { dayKey, logError } from '../../shared';
import { Button, EnglishText, Icon, checkCardUnit, saveLookupCard, useAiScope, type UnitDecision } from '../../sharedUi';

// „Wörter aus dem Text“ (docs/umbau/lesen-plan.md §2.2): bis zu 5 Wörter, je ein Knopf „Als Karte“. Die Karte bekommt den Satz des
// Artikels als Ursprungssatz (Kap. 15); das Wort muss in diesem Satz stehen (sonst gibt es keinen Knopf). Karten werden nur über
// `saveLookupCard` angelegt (Dublettenregel, Dokument-Wächter), das Lesemodul schreibt nie selbst in `vocab/`.
// Kartenqualität (26.10.2026, docs/umbau/card-quality.md): Eine Wortgruppe wird nur als Karte gespeichert, wenn sie eine feste Einheit ist
// (`checkCardUnit`: Prüfung, bei Zweifel Claude). Sonst Hinweis „keine feste Wendung“ und höchstens das tragende Einzelwort als Karte.

type CardState = 'idle' | 'busy' | 'saved' | 'exists' | 'failed' | 'notUnit' | 'single';
type NotUnit = Extract<UnitDecision, { kind: 'not_unit' }>;

export type KeyWordsCardProps = {
  picks: readonly KeyWordPick[];
  article: Pick<ArticleItem, 'id' | 'title' | 'level'>;
  lang: RdrLang;
  /** Eine NEUE Karte wurde angelegt (für den Lesezustand). */
  onSaved: () => void;
  /** Wendungen einer Kurslektion sind Berufswortschatz: die Karte wird als Kernwort markiert (Fahrplan A5, Lernwissenschaft N4). */
  core?: boolean;
};

export function KeyWordsCard({ picks, article, lang, onSaved, core = false }: KeyWordsCardProps) {
  const [state, setState] = useState<Record<number, CardState>>({});
  const [shown, setShown] = useState<Record<number, boolean>>({});
  const [notUnit, setNotUnit] = useState<Record<number, NotUnit>>({});
  const busy = useRef(new Set<number>());
  const scope = useAiScope();

  const save = useCallback(
    async (i: number) => {
      const p = picks[i];
      if (!p?.sentence || !p.surface || busy.current.has(i)) return;
      busy.current.add(i);
      setState((s) => ({ ...s, [i]: 'busy' }));
      let next: CardState = 'failed';
      try {
        const d = await checkCardUnit({ word: p.kw.w, sentence: p.sentence.e, uiLang: lang, signal: scope.signal, src: 'read' });
        if (d.kind === 'not_unit') {
          setNotUnit((m) => ({ ...m, [i]: d }));
          next = 'notUnit';
          return;
        }
        const level = cardLevel(article.level);
        const r = await saveLookupCard({
          word: p.kw.w,
          de: p.kw.de,
          ex: p.sentence.e,
          surface: p.surface,
          src: 'read',
          ...(core ? { core: true } : {}),
          ...(d.lu ? { lu: d.lu } : {}),
          origin: { v: 1, kind: 'read', t: Date.now(), ref: article.id, title: article.title },
          today: dayKey(Date.now()),
          ...(level ? { level } : {}),
        });
        if (r === 'saved' || r === 'added') {
          next = 'saved';
          onSaved();
        } else if (r === 'exists') next = 'exists';
        else if (r === 'not_unit') {
          setNotUnit((m) => ({ ...m, [i]: { kind: 'not_unit', by: 'rule', single: null } }));
          next = 'notUnit';
        } else if (r === 'invalid') logError('read:keyword', { code: 'invalid_card', message: `${p.kw.w} ohne gültigen Satz` }, article.id);
      } finally {
        busy.current.delete(i);
        setState((s) => ({ ...s, [i]: next }));
      }
    },
    [picks, article.id, article.title, article.level, onSaved, core, lang, scope],
  );

  // Ausweg bei „keine feste Wendung“: nur das tragende Einzelwort (mit demselben Artikelsatz) als Karte.
  const saveSingle = useCallback(
    async (i: number) => {
      const p = picks[i];
      const one = notUnit[i]?.single;
      if (!p?.sentence || !one || busy.current.has(i)) return;
      busy.current.add(i);
      setState((s) => ({ ...s, [i]: 'busy' }));
      let next: CardState = 'notUnit';
      try {
        const level = cardLevel(article.level);
        const r = await saveLookupCard({
          word: one.word,
          de: one.de,
          ...(one.pos ? { pos: one.pos } : {}),
          ex: p.sentence.e,
          surface: one.surface,
          src: 'read',
          origin: { v: 1, kind: 'read', t: Date.now(), ref: article.id, title: article.title },
          today: dayKey(Date.now()),
          ...(level ? { level } : {}),
        });
        if (r === 'saved' || r === 'added' || r === 'exists') {
          next = 'single';
          if (r !== 'exists') onSaved();
        } else logError('read:keyword-single', { code: r, message: `${one.word} nicht gespeichert` }, article.id);
      } finally {
        busy.current.delete(i);
        setState((s) => ({ ...s, [i]: next }));
      }
    },
    [picks, notUnit, article.id, article.title, article.level, onSaved],
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
                {shown[i] || st === 'saved' || st === 'exists' ? (
                  <span className="text-muted" lang="de" data-testid="rdr-kw-de">
                    {p.kw.de}
                  </span>
                ) : (
                  <button type="button" onClick={() => setShown((s) => ({ ...s, [i]: true }))} className="min-h-11 rounded-[var(--radius-inline)] px-2 text-sm font-medium text-accent-text" data-testid="rdr-kw-reveal">
                    {rdrText(lang, 'rdrKeyShow')}
                  </button>
                )}
              </p>
              {p.sentence ? (
                <EnglishText as="p" text={p.sentence.e} area="read" source={article.id} title={article.title} highlight={p.span} className="m-0 text-sm leading-6 text-muted" testId="rdr-kw-sentence" />
              ) : null}
              <div className="flex min-h-11 items-center gap-3">
                {!p.sentence ? (
                  <p className="m-0 text-xs text-subtle" data-testid="rdr-kw-nosentence">
                    {rdrText(lang, 'rdrCardNoSentence')}
                  </p>
                ) : st === 'notUnit' || st === 'single' || (st === 'busy' && notUnit[i]) ? (
                  <NotUnitNote info={notUnit[i]} st={st} lang={lang} onSingle={() => void saveSingle(i)} />
                ) : st === 'saved' || st === 'exists' ? (
                  <p className="m-0 inline-flex items-center gap-1.5 text-sm font-medium text-ok-text" role="status" data-testid="rdr-kw-saved">
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
                {p.sentence && !notUnit[i] ? <span className="ml-auto text-2xs text-subtle">{rdrText(lang, 'rdrInSentence', { n: p.sentence.n })}</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NotUnitNote({ info, st, lang, onSingle }: { info: NotUnit | undefined; st: CardState; lang: RdrLang; onSingle: () => void }) {
  const one = info?.single ?? null;
  return (
    <div className="flex flex-col gap-1.5" data-testid="rdr-kw-notunit" data-by={info?.by ?? 'rule'}>
      <p className="m-0 inline-flex items-center gap-1.5 text-sm font-medium text-fg" role="status">
        <Icon name="info" size={18} />
        {rdrText(lang, 'rdrNotUnit')}
      </p>
      {info?.better ? (
        <p className="m-0 text-sm text-muted" data-testid="rdr-kw-better">
          {rdrText(lang, 'rdrNotUnitBetter')}{' '}
          <span className="font-semibold text-fg" lang="en">
            {info.better}
          </span>
        </p>
      ) : null}
      {info?.why ? <p className="m-0 text-xs text-muted">{info.why}</p> : null}
      {info?.by === 'claude' ? <p className="m-0 text-2xs text-subtle">{rdrText(lang, 'rdrNotUnitClaude')}</p> : null}
      {one && st === 'single' ? (
        <p className="m-0 inline-flex items-center gap-1.5 text-sm font-medium text-ok-text" role="status" data-testid="rdr-kw-single-saved">
          <Icon name="check" size={18} />
          {rdrText(lang, 'rdrSingleSaved', { word: one.word })}
        </p>
      ) : one ? (
        <div>
          <Button variant="secondary" icon="bookmarkPlus" busy={st === 'busy'} busyLabel={rdrText(lang, 'rdrSaving')} onClick={onSingle} data-testid="rdr-kw-single">
            {rdrText(lang, 'rdrSaveSingle', { word: one.word })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
