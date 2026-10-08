import { useMemo, useState } from 'react';
import { kwtWords } from '../../../domain/c1x/kwtNorm';
import type { C1Input, C1Item, C1Response, Kwt, Mcc, Ocl, Wf } from '../../../domain/c1x/types';
import { Tiles } from '../../../engine/Tiles';
import { useT, type MessageKey } from '../../../i18n';
import { ActionBar, PrimaryAction } from '../../../ui/ActionBar';
import { Button } from '../../../ui/Button';
import { kwtTiles } from '../../c1x/kinds/Kwt';

// Eine Aufgabe des C1-Checks (Lernplattform 3.0 §4.3, P40). Bewusst schlicht wie eine Prüfung: kein Tipp, keine Rückmeldung, kein Wörterbuch, kein
// Antippen von Wörtern, keine Zeitanzeige, nichts wird gebucht. Die Antwort geht unverändert an den Ablauf (gewertet wird erst am Ende).
// Laptop: alles getippt. Handy: Umformungen mit Bausteinen (Vermerk „Handy-Fassung“ steht im Kopf des Checks).

type Props = { item: C1Item; inp: C1Input; last: boolean; onAnswer: (r: C1Response | null) => void };

const input =
  'lx-input min-h-12 w-full rounded-[var(--radius-control)] border border-line bg-surface-solid px-3 text-base';

function Sentence({ text }: { text: string }) {
  return (
    <p className="lx-t-prompt" lang="en" data-testid="ck-sentence">
      {text.replace(/_{2,}/g, '______')}
    </p>
  );
}

function TypedField({ max, onChange, submit, label }: { max: number; onChange: (v: string) => void; submit: () => void; label: string }) {
  const [value, setValue] = useState('');
  return (
    <label className="flex flex-col gap-1">
      <span className="lx-t-meta text-muted">{label}</span>
      <input
        type="text"
        className={input}
        value={value}
        maxLength={max}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        lang="en"
        data-testid="ck-input"
        onChange={(e) => {
          setValue(e.target.value);
          onChange(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
      />
    </label>
  );
}

function McBody({ item, set }: { item: Mcc; set: (r: C1Response | null) => void }) {
  const [pick, setPick] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <Sentence text={item.text} />
      <div className="flex flex-col gap-2" role="group" aria-label={item.text}>
        {item.options.map((o, i) => (
          <button
            key={o}
            type="button"
            className="lx-choice min-h-12 justify-start text-left"
            aria-pressed={pick === i}
            lang="en"
            data-testid="ck-option"
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

function GapBody({ item, set, submit }: { item: Ocl | Wf; set: (r: C1Response | null) => void; submit: () => void }) {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-3">
      <Sentence text={item.text} />
      {item.kind === 'wf' && (
        <p className="lx-t-meta text-muted">
          {t('pxCkStem')}: <b lang="en" data-testid="ck-stem">{item.stem}</b>
        </p>
      )}
      <TypedField
        max={item.kind === 'wf' ? 24 : 20}
        label={t('pxCkGapLabel')}
        submit={submit}
        onChange={(v) => set(v.trim() ? { kind: item.kind, text: v } : null)}
      />
    </div>
  );
}

function KwtBody({ item, inp, set, submit }: { item: Kwt; inp: C1Input; set: (r: C1Response | null) => void; submit: () => void }) {
  const { t } = useT();
  const tiles = useMemo(() => kwtTiles(item, 'all'), [item]);
  const [placed, setPlaced] = useState<number[]>([]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="lx-t-meta text-muted">{t('pxCkKwtFirst')}</span>
        <p className="lx-t-prompt" lang="en" data-testid="ck-lead">
          {item.lead}
        </p>
      </div>
      <p className="lx-t-meta text-muted">
        {t('pxCkKwtKey')}: <b lang="en" data-testid="ck-key">{item.key}</b>
      </p>
      <div className="flex flex-col gap-0.5">
        <span className="lx-t-meta text-muted">{t('pxCkKwtSecond')}</span>
        <p className="lx-t-prompt" lang="en">
          {`${item.before} ______${/^[.,;:!?]/.test(item.after) ? '' : ' '}${item.after}`.trim()}
        </p>
      </div>
      {inp === 'desk' ? (
        <TypedField max={80} label={t('pxCkGapLabel')} submit={submit} onChange={(v) => set(kwtWords(v, [item.key]).length > 0 ? { kind: 'kwt', text: v, typed: true } : null)} />
      ) : (
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
      )}
    </div>
  );
}

export function CheckItem({ item, inp, last, onAnswer }: Props) {
  const { t } = useT();
  const [resp, setResp] = useState<C1Response | null>(null);
  const ask: MessageKey = item.kind === 'kwt' && inp === 'touch' ? 'pxCkAsk_kwtTiles' : (`pxCkAsk_${item.kind}` as MessageKey);
  const submit = (): void => {
    if (resp) onAnswer(resp);
  };
  return (
    <article className="flex flex-col gap-4" data-testid="ck-item" data-kind={item.kind} data-id={item.id}>
      <p className="lx-t-support text-muted" data-testid="ck-ask">
        {t(ask)}
      </p>
      {item.kind === 'mcc' && <McBody item={item} set={setResp} />}
      {(item.kind === 'ocl' || item.kind === 'wf') && <GapBody item={item} set={setResp} submit={submit} />}
      {item.kind === 'kwt' && <KwtBody item={item} inp={inp} set={setResp} submit={submit} />}
      <ActionBar placement="column" stateKey={`ck-${item.id}`} aside={null}>
        <PrimaryAction iconAfter="arrowRight" disabled={!resp} onClick={submit} testId="ck-next">
          {last ? t('pxCkFinish') : t('pxCkNext')}
        </PrimaryAction>
        <Button variant="ghost" onClick={() => onAnswer(null)} data-testid="ck-dontknow">
          {t('pxCkDontKnow')}
        </Button>
      </ActionBar>
    </article>
  );
}
