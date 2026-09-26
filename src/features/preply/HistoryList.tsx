import { useState } from 'react';
import type { ImportView, PreplyView } from '../../domain/preply/docs';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { toast } from '../../ui/Toast';
import { markHomework } from './actions';
import { HeldSheet } from './HeldSheet';
import { PlanView } from './PlanView';
import { openPreplyEntry } from './store';

// Verlauf der Preply-Brücke (Phase 5 §8.3): Pläne und Importe, neueste zuerst. Antippen öffnet
// nur zum Lesen. Importe zeigen Hausaufgaben zum Abhaken (Zustand, kein Knopf danach).

export function HistoryList({ list, openId, onReview }: { list: PreplyView[]; openId: string | null; onReview: (pi: ImportView) => void }) {
  const { t, lang } = useT();
  const [noPlan, setNoPlan] = useState(false);
  const open = openId ? list.find((v) => v.id === openId) : null;
  const date = (ms: number) => (ms ? new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(ms) : '');

  if (open) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <Button variant="ghost" icon="arrowRight" onClick={() => openPreplyEntry(null)} className="[&>svg]:rotate-180" data-testid="pv-back">
            {t('pvBack')}
          </Button>
        </div>
        {open.kind === 'plan' ? <PlanView plan={open} /> : <ImportDetail pi={open} onReview={onReview} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {list.length === 0 && <p className="text-sm text-muted">{t('pvEmpty')}</p>}
      <ul className="flex flex-col gap-2" data-testid="pv-list">
        {list.map((v) => {
          const state = v.kind === 'plan' ? (v.done ? 'done' : 'open') : v.applied ? 'applied' : 'pending';
          const stateLabel = v.kind === 'plan' ? (v.done ? t('pvHeld') : t('pvOpen')) : v.applied ? t('pvApplied') : t('pvOpen');
          return (
            <li key={v.id} data-testid="pv-item" data-kind={v.kind} data-state={state} data-id={v.id}>
              <button type="button" onClick={() => openPreplyEntry(v.id)} className="lx-glass flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left hover:bg-surface-strong">
                <Icon name={v.kind === 'plan' ? 'book' : 'download'} size={20} className="flex-none text-muted" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[0.95rem] font-medium">{v.title || (v.kind === 'plan' ? t('ppTitle') : t('ppImportUntitled'))}</span>
                  <span className="text-xs text-muted">
                    {v.kind === 'plan' ? t('pvPlan') : t('pvImport')} · {date(v.t)}
                  </span>
                </span>
                <span className={`flex-none rounded-full px-2.5 py-0.5 text-xs font-semibold ${state === 'open' || state === 'pending' ? 'bg-gold-soft text-gold-text' : 'bg-surface-strong text-muted'}`}>{stateLabel}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div>
        <Button variant="ghost" icon="plus" onClick={() => setNoPlan(true)} data-testid="pp-held-noplan">
          {t('ppHeldNoPlan')}
        </Button>
      </div>
      <HeldSheet open={noPlan} ppId={null} defaultMinutes={50} onClose={() => setNoPlan(false)} />
    </div>
  );
}

function ImportDetail({ pi, onReview }: { pi: ImportView; onReview: (pi: ImportView) => void }) {
  const { t } = useT();
  const [busy, setBusy] = useState<number | null>(null);
  const src = { area: 'preply' as const, source: `preply/${pi.id}`, title: pi.title || null };
  const check = async (i: number) => {
    setBusy(i);
    const ok = await markHomework(pi.id, i);
    setBusy(null);
    if (!ok) toast(t('ppHeldFailed'), 'error');
  };
  return (
    <Card channel="speak" className="flex flex-col gap-4" data-testid="pi-detail" data-id={pi.id}>
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">{pi.title || t('ppImportUntitled')}</h2>
        {pi.summary && <p className="text-[0.95rem] text-muted">{pi.summary}</p>}
      </header>
      {!pi.applied && (
        <div>
          <Button variant="primary" onClick={() => onReview(pi)} data-testid="pv-review">
            {t('pvReview')}
          </Button>
        </div>
      )}
      {pi.corrections.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className="lx-eyebrow">{t('piCorrections')}</h3>
          <ul className="flex flex-col gap-1.5">
            {pi.corrections.map((c, i) => (
              <li key={i} className="text-[0.95rem] leading-relaxed" lang="en">
                <span className="lx-diff-off">{c.wrong}</span>
                <span className="text-muted"> → </span>
                <strong className="font-semibold">{c.right}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
      {pi.tasks.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className="lx-eyebrow">{t('piExercises')}</h3>
          <ul className="flex flex-col gap-1.5">
            {pi.tasks.map((x, i) => (
              <li key={i} className="text-[0.95rem] leading-relaxed">
                <EnglishText as="span" text={x} {...src} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {pi.words.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className="lx-eyebrow">{t('piWords')}</h3>
          <ul className="flex flex-col gap-1">
            {pi.words.map((w, i) => (
              <li key={i} className="text-[0.95rem]">
                <strong className="font-semibold" lang="en">
                  {w.en}
                </strong>
                <span className="text-muted"> – {w.de}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {pi.homework.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className="lx-eyebrow">{t('piHomework')}</h3>
          <ul className="flex flex-col gap-1">
            {pi.homework.map((h, i) => {
              const done = !!pi.hwDone[String(i)];
              return (
                <li key={i} data-testid="pi-hw" data-state={done ? 'done' : 'open'}>
                  {done ? (
                    <span className="flex min-h-11 items-center gap-3 text-[0.95rem] text-muted">
                      <Icon name="check" size={20} className="flex-none text-accent-text" />
                      <span className="line-through">{h}</span>
                    </span>
                  ) : (
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[0.95rem]">
                      <input type="checkbox" checked={false} disabled={busy === i} onChange={() => void check(i)} className="size-5 flex-none accent-[var(--lx-accent)]" />
                      <span>{h}</span>
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Card>
  );
}
