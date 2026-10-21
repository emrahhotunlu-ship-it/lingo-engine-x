import { useState, type ReactNode } from 'react';
import { gateStatus, reviewFault, TEACHER_SAMPLE, type SbGate } from '../../domain/tutor/sentenceBank';
import { useT, type MessageKey } from '../../i18n';
import { Button, IconButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { toast } from '../../ui/Toast';
import { saveGateReview } from '../vocab/sentenceBank';

// Satzbank-Freigabe (Einstellungen › KI-Stichprobe, 21.10.2026): Emrah trägt den Befund des Englischlehrers ein (harte Fehler, unklare Lücken aus
// der Stichprobe von 30 Sätzen). Geschrieben wird nur über `saveGateReview` (`writer.transform('app/profile')`, `releaseGate`). Die Liste darüber
// sagt ehrlich, was erfüllt ist und was noch fehlt: Sammelzeit 4 Wochen, Stichprobe, Schwelle (≤ 1 harter Fehler, ≤ 2 unklare Lücken) und die
// 4-Wochen-Quarantäne je Satz, die auch nach der Freigabe gilt.

type Props = {
  /** Gespeicherter Schalter (`readGate`), nicht der wirksame. */
  gate: SbGate;
  sampleN: number;
  quarantined: number;
  now: number;
};

function Row({ ok, children, testId }: { ok: boolean; children: ReactNode; testId: string }) {
  const { t } = useT();
  return (
    <li className="flex items-start gap-2 text-sm" data-testid={testId} data-ok={ok ? '1' : '0'}>
      {ok ? (
        <Icon name="check" size={16} aria-hidden="true" className="mt-0.5 flex-none text-accent-text" />
      ) : (
        <span aria-hidden="true" className="mt-1 inline-block size-3.5 flex-none rounded-full border border-current text-subtle" />
      )}
      <span className="sr-only">{ok ? t('ttSbgDone') : t('ttSbgOpen')}</span>
      <span className={ok ? 'text-fg' : 'text-muted'}>{children}</span>
    </li>
  );
}

function Stepper({ label, hint, value, max, disabled, onChange, testId }: { label: string; hint: string; value: number; max: number; disabled: boolean; onChange: (n: number) => void; testId: string }) {
  const { t, num } = useT();
  const id = `${testId}-label`;
  return (
    <div className="flex items-center justify-between gap-3" data-testid={testId} data-value={value}>
      <div className="min-w-0" id={id}>
        <p className="m-0 text-sm font-medium">{label}</p>
        <p className="m-0 text-xs text-subtle">{hint}</p>
      </div>
      <div className="flex flex-none items-center gap-1" role="group" aria-labelledby={id}>
        <IconButton icon="minus" label={t('ttSbgLess', { label })} disabled={disabled || value <= 0} onClick={() => onChange(Math.max(0, value - 1))} data-testid={`${testId}-less`} className="disabled:opacity-40" />
        <output className="w-8 text-center text-base tabular-nums" aria-live="polite" data-testid={`${testId}-value`}>
          {num(value)}
        </output>
        <IconButton icon="plus" label={t('ttSbgMore', { label })} disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, value + 1))} data-testid={`${testId}-more`} className="disabled:opacity-40" />
      </div>
    </div>
  );
}

export function SbGatePanel({ gate, sampleN, quarantined, now }: Props) {
  const { t, num, date } = useT();
  const st = gateStatus(gate, now, sampleN);
  const [hard, setHard] = useState(() => st.review?.hard ?? 0);
  const [unclear, setUnclear] = useState(() => st.review?.unclear ?? 0);
  const [busy, setBusy] = useState(false);
  const review = { hard, unclear };
  const fault = reviewFault(gate, now, review, sampleN);
  // Vor der Sammelzeit, ohne Sätze oder ohne Stichprobe gibt es nichts einzutragen: die Zähler ruhen, der Grund steht darunter.
  const locked = fault === 'no_start' || fault === 'too_early' || fault === 'no_sample';
  const sentences = (k: number): string => (k === 1 ? t('ttSbSentence1') : t('ttSbSentences', { n: num(k) }));
  const save = async () => {
    if (fault || busy) return;
    setBusy(true);
    try {
      const r = await saveGateReview(review, sampleN, Date.now());
      if (r.r === 'released') toast(t('ttSbgReleased'));
      else if (r.r === 'closed') toast(t('ttSbgClosed'));
      else if (r.r === 'same') toast(t('ttSbgSame'));
      else if (r.r === 'invalid') toast(t('ttSbgInvalid'), 'error');
      else if (r.r === 'fault') toast(t(`ttSbgFault_${r.fault}` as MessageKey, { date: st.releaseFrom ? date(st.releaseFrom) : '', n: num(sampleN) }), 'error');
      else toast(t('ttSbgFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };
  const faultText = fault ? t(`ttSbgFault_${fault}` as MessageKey, { date: st.releaseFrom ? date(st.releaseFrom) : '', n: num(sampleN) }) : null;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line p-4" data-testid="sbg" data-on={st.on ? '1' : '0'}>
      <h4 className="m-0 text-sm font-semibold">{t('ttSbgTitle')}</h4>
      <p className="m-0 text-sm text-muted">{t('ttSbgIntro')}</p>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        <Row ok={st.start !== null} testId="sbg-start">
          {st.start !== null ? t('ttSbgStart', { date: date(st.start) }) : t('ttSbgNoStart')}
        </Row>
        <Row ok={st.quarantineOver} testId="sbg-wait">
          {st.quarantineOver ? t('ttSbgWaitDone') : st.releaseFrom === null ? t('ttSbgWait', { n: num(st.daysLeft), date: '–' }) : st.daysLeft === 1 ? t('ttSbgWait1', { date: date(st.releaseFrom) }) : t('ttSbgWait', { n: num(st.daysLeft), date: date(st.releaseFrom) })}
        </Row>
        <Row ok={sampleN > 0} testId="sbg-sample">
          {sampleN <= 0 ? t('ttSbgNoSample') : sampleN < TEACHER_SAMPLE ? t('ttSbgSampleSmall', { ss: sentences(sampleN) }) : t('ttSbgSample', { ss: sentences(sampleN) })}
        </Row>
        <Row ok={st.passes === true} testId="sbg-rule">
          {t('ttSbgRule')}
          {st.review && st.checkedAt ? ` ${t('ttSbgLast', { date: date(st.checkedAt), hard: num(st.review.hard), unclear: num(st.review.unclear) })} ${st.passes ? t('ttSbgLastPass') : t('ttSbgLastFail')}` : ''}
        </Row>
        <Row ok={st.on} testId="sbg-state">
          {st.on ? t('ttSbgStateOn') : t('ttSbgStateOff')}
        </Row>
      </ul>
      <p className="m-0 text-xs text-subtle" data-testid="sbg-per-sentence">
        {t('ttSbgPerSentence', { q: sentences(quarantined) })}
      </p>
      <div className="flex flex-col gap-2">
        <Stepper label={t('ttSbgHard')} hint={t('ttSbgHardHint')} value={hard} max={Math.max(0, sampleN - unclear)} disabled={locked || busy} onChange={setHard} testId="sbg-hard" />
        <Stepper label={t('ttSbgUnclear')} hint={t('ttSbgUnclearHint')} value={unclear} max={Math.max(0, sampleN - hard)} disabled={locked || busy} onChange={setUnclear} testId="sbg-unclear" />
      </div>
      {faultText && (
        <p className="m-0 text-sm text-muted" role="status" data-testid="sbg-fault" data-fault={fault ?? undefined}>
          {faultText}
        </p>
      )}
      <div>
        <Button variant="secondary" onClick={() => void save()} busy={busy} disabled={!!fault} data-testid="sbg-save">
          {t('ttSbgSave')}
        </Button>
      </div>
    </div>
  );
}
