import { pendingName, programChapters, topicExists } from '../../domain/c1/chapters';
import type { PlaceResult } from '../../domain/c1/placement/run';
import { WORD_SCOPE } from '../../domain/c1/placement/words';
import { useT } from '../../i18n';
import { ActionBar, PrimaryAction } from '../../ui/ActionBar';
import { Disclosure } from '../../ui/Disclosure';
import { topicName } from '../grammar/topicUi';

// Ergebnis der Einstufung (Lernplattform 3.0 §4.2, P34): „Dein Start“. Nennt KEIN Niveau (kein „B2“, kein „C1“): nur die Belastbarkeit, die Wortschatz-Spanne,
// das Startkapitel und die Themen mit Kurzweg. θ und Standardfehler stehen nur eingeklappt unter „Messwerte dahinter“.

/** Das Kapitel, mit dem das Programm beginnt: das erste, in dem noch ein vorhandenes Thema ohne Kurzweg ist; sonst das letzte. */
export function startChapterIndex(skip: readonly string[]): number {
  const chs = programChapters();
  const i = chs.findIndex((c) => c.topics.some((tp) => topicExists(tp) && !skip.includes(tp)));
  return i >= 0 ? i : Math.max(0, chs.length - 1);
}

const fmtN = (n: number, lang: 'de' | 'en'): string => n.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US');
const fmt2 = (x: number, lang: 'de' | 'en'): string => x.toFixed(2).replace('.', lang === 'de' ? ',' : '.');

type Props = {
  result: Pick<PlaceResult, 'theta' | 'se' | 'n' | 'reliability' | 'skip'> | { theta: number; se: number; n: number; reliability: PlaceResult['reliability']; skip: readonly string[] };
  vw: readonly [number, number] | null;
  saving?: boolean;
  failed?: boolean;
  onStart?: () => void;
  onClose?: () => void;
};

export function PlacementResult({ result, vw, saving = false, failed = false, onStart, onClose }: Props) {
  const { t, lang } = useT();
  const chs = programChapters();
  const ci = startChapterIndex(result.skip);
  const ch = chs[ci];
  const rel = result.reliability === 'good' ? t('pxPlRelGood') : result.reliability === 'ok' ? t('pxPlRelOk') : t('pxPlRelThin');
  const skip = [...result.skip].sort((a, b) => a.localeCompare(b));
  const name = (id: string): string => (topicExists(id) ? topicName(id, lang) : (pendingName(id, lang) ?? id));
  return (
    <section className="flex flex-col gap-4" data-testid="place-result" data-skip={skip.length} aria-labelledby="px-pl-res">
      <h2 id="px-pl-res" className="lx-t-answer tracking-tight">
        {t('pxPlResTitle')}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        <li className="lx-inset" data-testid="place-res-grammar">
          {t('pxPlResGrammar', { n: result.n, r: rel })}
        </li>
        <li className="lx-inset lx-tnum" data-testid="place-res-words">
          {vw ? t('pxPlResWords', { a: fmtN(vw[0], lang), b: fmtN(vw[1], lang), c: fmtN(WORD_SCOPE, lang) }) : t('pxPlResNoWords')}
        </li>
      </ul>
      {ch && (
        <p className="font-semibold" data-testid="place-res-start" data-chapter={ch.id}>
          {t('pxPlResStart', { n: ch.n, name: ch.name[lang] })}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <p data-testid="place-res-skip">{skip.length === 0 ? t('pxPlResSkipNone') : skip.length === 1 ? t('pxPlResSkipOne') : t('pxPlResSkip', { n: skip.length })}</p>
        {skip.length > 0 && (
          <Disclosure label={t('pxPlResSkipOpen')} testId="place-skip-open">
            <ul className="m-0 flex list-none flex-col gap-1 p-0 pb-2" data-testid="place-skip-list">
              {skip.map((id) => (
                <li key={id} data-topic={id} className="text-sm">
                  {name(id)}
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
      </div>
      <p className="text-sm text-muted">{t('pxPlResHonest')}</p>
      <Disclosure label={t('pxPlResRaw')} testId="place-raw-open">
        <p className="lx-tnum pb-2 text-sm text-muted" data-testid="place-raw">
          {t('pxPlResRawText', { th: fmt2(result.theta, lang), se: fmt2(result.se, lang), n: result.n })}
        </p>
      </Disclosure>
      {failed && (
        <p className="text-sm text-danger-text" role="alert" data-testid="place-save-failed">
          {t('pxPlResSaveFailed')}
        </p>
      )}
      <ActionBar placement="column" stateKey="place-result">
        {onStart ? (
          <PrimaryAction onClick={onStart} busy={saving} busyLabel={t('pxPlResSaving')} testId="place-save">
            {t('pxPlResStartBtn')}
          </PrimaryAction>
        ) : (
          <PrimaryAction onClick={() => onClose?.()} testId="place-close">
            {t('pxPlClose')}
          </PrimaryAction>
        )}
      </ActionBar>
    </section>
  );
}
