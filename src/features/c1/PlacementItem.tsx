import { useMemo, useState } from 'react';
import { splitWords } from '../../domain/answer/align';
import { kwtWords } from '../../domain/c1x/kwtNorm';
import { mccOrder } from '../../domain/c1x/kinds/mcc';
import { isFull, scoreC1 } from '../../domain/c1x/score';
import { dayKey } from '../../domain/date';
import type { C1Item, C1Response, Err, Kwt, Mcc, Ocl } from '../../domain/c1x/types';
import { Tiles } from '../../engine/Tiles';
import { kwtTiles } from '../c1x/kinds/Kwt';
import { useT } from '../../i18n';
import { ActionBar, PrimaryAction } from '../../ui/ActionBar';
import { Button } from '../../ui/Button';

// Eine Einstufungsaufgabe (Lernplattform 3.0 §4.2, P34). Bewusst schlicht: kein Tipp, keine Rückmeldung, kein Wörterbuch, keine Buchung, nichts wird
// geschrieben. Am Handy reicht Tippen: Auswahl, Wort antippen, Bausteine; nur die offene Lücke verlangt ein einzelnes Wort. Die Wertung ist `scoreC1`;
// „richtig“ heißt volle Punktzahl. Bei „Fehler finden“ zählt hier das Finden der Stelle (die Korrektur wird nicht gefragt, sonst verriete die Frage,
// dass ein Fehler da ist).

type Props = { item: C1Item; onAnswer: (ok: boolean) => void };

/** Antwort als „richtig?“ bewerten (rein, für Tests). */
export const placementRight = (item: C1Item, r: C1Response): boolean => isFull(scoreC1(item, r));

function Sentence({ text }: { text: string }) {
  return (
    <p className="lx-t-prompt" lang="en" data-testid="place-sentence">
      {text.replace(/_{3,}/g, '______')}
    </p>
  );
}

function McBody({ item, set }: { item: Mcc; set: (r: C1Response | null) => void }) {
  const [pick, setPick] = useState<number | null>(null);
  const [day] = useState(() => dayKey(Date.now()));
  const order = useMemo(() => mccOrder(item, day), [item, day]);
  return (
    <div className="flex flex-col gap-3">
      <Sentence text={item.text} />
      <div className="flex flex-col gap-2" role="group" aria-label={item.text}>
        {order.map((i) => [item.options[i] ?? '', i] as const).map(([o, i]) => (
          <button
            key={o}
            type="button"
            className="lx-choice min-h-12 justify-start text-left"
            aria-pressed={pick === i}
            lang="en"
            data-testid="place-option"
            onClick={() => {
              setPick(i);
              set({ kind: 'mcc', pick: i });
            }}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function GapBody({ item, set, submit }: { item: Ocl; set: (r: C1Response | null) => void; submit: () => void }) {
  const { t } = useT();
  const [value, setValue] = useState('');
  return (
    <div className="flex flex-col gap-3">
      <Sentence text={item.text} />
      <label className="flex flex-col gap-1">
        <span className="lx-t-meta text-muted">{t('pxPlGapLabel')}</span>
        <input
          type="text"
          className="lx-input min-h-12 rounded-[var(--radius-control)] border border-line bg-surface-solid px-3 text-base"
          value={value}
          maxLength={24}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          lang="en"
          data-testid="place-gap"
          onChange={(e) => {
            setValue(e.target.value);
            set(e.target.value.trim() ? { kind: 'ocl', text: e.target.value } : null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
      </label>
    </div>
  );
}

function FindBody({ item, set }: { item: Err; set: (r: C1Response | null) => void }) {
  const { t } = useT();
  const words = useMemo(() => splitWords(item.text), [item.text]);
  const [tap, setTap] = useState<number | 'none' | null>(null);
  const choose = (v: number | 'none'): void => {
    setTap(v);
    // Gefragt wird nur nach der Stelle; war sie richtig, gilt die erste gültige Korrektur mit.
    set({ kind: 'err', tap: v, ...(item.bad && v !== 'none' ? { fix: item.bad.fix[0] ?? '' } : {}) });
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="lx-t-prompt flex flex-wrap gap-x-1 gap-y-1.5" lang="en" data-testid="place-sentence">
        {words.map((w, i) => (
          <button
            key={`${i}-${w}`}
            type="button"
            className="lx-choice min-h-11 px-2"
            aria-pressed={tap === i}
            data-testid="place-word"
            onClick={() => choose(i)}
          >
            {w}
          </button>
        ))}
      </p>
      <Button variant="secondary" aria-pressed={tap === 'none'} data-testid="place-none" onClick={() => choose('none')} className={tap === 'none' ? 'ring-2 ring-[var(--lx-ch-grammar)]' : ''}>
        {t('pxPlNoError')}
      </Button>
    </div>
  );
}

function KwtBody({ item, set }: { item: Kwt; set: (r: C1Response | null) => void }) {
  const { t } = useT();
  const tiles = useMemo(() => kwtTiles(item, 'all'), [item]);
  const [placed, setPlaced] = useState<number[]>([]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="lx-t-meta text-muted">{t('pxPlKwtFirst')}</span>
        <p className="lx-t-prompt" lang="en" data-testid="place-lead">
          {item.lead}
        </p>
      </div>
      <p className="lx-t-meta text-muted">
        {t('pxPlKwtKey')}: <b lang="en">{item.key}</b>
      </p>
      <div className="flex flex-col gap-0.5">
        <span className="lx-t-meta text-muted">{t('pxPlKwtSecond')}</span>
        <p className="lx-t-prompt" lang="en">
          {`${item.before} ______ ${item.after}`.trim()}
        </p>
      </div>
      <Tiles
        tiles={tiles}
        placed={placed}
        onChange={(ids) => {
          setPlaced(ids);
          const text = ids.map((id) => tiles.find((x) => x.id === id)?.text ?? '').join(' ').trim();
          set(kwtWords(text, [item.key]).length > 0 ? { kind: 'kwt', text, typed: false } : null);
        }}
        locked={false}
        labels={{ line: t('drTileLine'), pool: t('drTilePool') }}
        slots={placed.length + 1}
      />
    </div>
  );
}

export function PlacementItem({ item, onAnswer }: Props) {
  const { t } = useT();
  const [resp, setResp] = useState<C1Response | null>(null);
  const send = (r: C1Response | null): void => onAnswer(r ? placementRight(item, r) : false);
  const ask =
    item.kind === 'mcc' ? 'pxPlAskMc' : item.kind === 'ocl' ? 'pxPlAskGap' : item.kind === 'err' ? 'pxPlAskFind' : 'pxPlAskKwt';
  return (
    <article className="flex flex-col gap-4" data-testid="place-item" data-kind={item.kind} data-id={item.id}>
      <p className="lx-t-support text-muted" data-testid="place-ask">
        {t(ask)}
      </p>
      {item.kind === 'mcc' && <McBody item={item} set={setResp} />}
      {item.kind === 'ocl' && <GapBody item={item} set={setResp} submit={() => resp && send(resp)} />}
      {item.kind === 'err' && <FindBody item={item} set={setResp} />}
      {item.kind === 'kwt' && <KwtBody item={item} set={setResp} />}
      <ActionBar placement="column" stateKey={`place-${item.id}`} aside={null}>
        <PrimaryAction iconAfter="arrowRight" disabled={!resp} onClick={() => send(resp)} testId="place-next">
          {t('pxPlNext')}
        </PrimaryAction>
        <Button variant="ghost" onClick={() => send(null)} data-testid="place-dontknow">
          {t('pxPlDontKnow')}
        </Button>
      </ActionBar>
    </article>
  );
}
