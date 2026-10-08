import { useEffect, useMemo, useRef, useState } from 'react';
import { useClock } from '../../../app/clock';
import { useNav } from '../../../app/nav';
import { loadPacked } from '../../../content/store';
import { useLive } from '../../../data/live';
import { readC1, type C1Check } from '../../../domain/c1/c1doc';
import { saveCheck } from '../../../domain/c1/check/save';
import { checkEntry, checkRepairs, scoreCheck, type CheckAnswer } from '../../../domain/c1/check/score';
import { CHECK_PARTS, checkSet, formFor } from '../../../domain/c1/check/select';
import type { C1Input, C1Item, C1Response } from '../../../domain/c1x/types';
import { useT } from '../../../i18n';
import { logWarn } from '../../../platform/diagnostics';
import { inputProfile } from '../../../platform/input';
import { ActionBar, PrimaryAction } from '../../../ui/ActionBar';
import { Button } from '../../../ui/Button';
import { Sheet } from '../../../ui/Sheet';
import { saveRepairs } from '../../repair/store';
import { markBlockDone } from '../../unit/run';
import { CheckItem } from './CheckItem';
import { CheckResult, type CheckResultData } from './CheckResult';
import { requestCloseCheck, useC1CheckSheet, type CheckCtx } from './store';

// C1-Check (Lernplattform 3.0 §4.3, P40): ein Blatt, 30 Aufgaben Satz für Satz (8 mcc · 8 ocl · 8 wf · 6 kwt), ohne Hilfe, ohne Zeitanzeige, Rückmeldung
// erst am Ende. Nichts wird gebucht (weder Muster noch Themen noch Karten). Abbrechen speichert nichts. Am Ende wird genau ein Eintrag in
// `app/c1.checks` angehängt (`saveCheck`, zwei Tabs schreiben ihn nicht doppelt) und höchstens 8 Fehlersätze kommen in `app/repair` (`src: 'check'`).
// Am Check-Tag (aus dem Tagesablauf gestartet, `ctx`) zählen danach Schritt 2 und 3 als erledigt; Serie und Pflicht ändern sich sonst nicht.

type Phase = 'intro' | 'loading' | 'run' | 'result' | 'empty' | 'noform';
type SaveState = 'saving' | 'saved' | 'failed';

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-strong" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}

/** Verlauf: gespeicherte Checks plus der eben gemachte (falls noch nicht im Dokument), nach Tag. */
function historyOf(saved: readonly C1Check[], entry: C1Check | null): C1Check[] {
  const all = [...saved];
  if (entry && !all.some((c) => c.d === entry.d && c.f === entry.f && c.inp === entry.inp)) all.push(entry);
  return all.sort((a, b) => a.d.localeCompare(b.d));
}

function Flow({ ctx, onClose }: { ctx: CheckCtx | null; onClose: () => void }) {
  const { t, lang } = useT();
  const today = useClock((s) => s.today);
  const c1Raw = useLive((s) => s.docs['app/c1']);
  const checks = useMemo(() => readC1(c1Raw).checks, [c1Raw]);
  const ask = useC1CheckSheet((s) => s.ask);
  // Das Gerät wird einmal beim Öffnen festgelegt (eine Runde liest das Eingabeprofil genau einmal).
  const [inp] = useState<C1Input>(() => (inputProfile() === 'touch' ? 'touch' : 'desk'));
  const [form] = useState<string | null>(() => formFor(inp, readC1(useLive.getState().docs['app/c1']).checks));
  const [phase, setPhase] = useState<Phase>(() => (form ? 'intro' : 'noform'));
  const [items, setItems] = useState<C1Item[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<CheckAnswer[]>([]);
  const [result, setResult] = useState<(CheckResultData & { entry: C1Check }) | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saving');
  const alive = useRef(true);
  const saved = useRef(false);
  const repairsDone = useRef(false);
  useEffect(
    () => () => {
      alive.current = false;
      useC1CheckSheet.setState({ running: false, ask: false });
    },
    [],
  );
  useEffect(() => {
    useC1CheckSheet.setState({ running: phase === 'run' || phase === 'loading' });
  }, [phase]);

  const start = (): void => {
    if (!form) return;
    setPhase('loading');
    // Der Check-Vorrat ist ein eigenes Bündel (`c1x-check`); er gelangt nie in den Speicher des Trainings.
    void loadPacked<C1Item>('c1x-check')
      .catch((err: unknown) => {
        logWarn('check:load', err);
        return null;
      })
      .then((doc) => {
        if (!alive.current) return;
        const set = checkSet(doc?.items ?? [], form);
        if (!set.length) {
          setPhase('empty');
          return;
        }
        setItems(set);
        setIdx(0);
        setAnswers([]);
        setPhase('run');
      });
  };

  const persist = async (entry: C1Check, add: ReturnType<typeof checkRepairs>): Promise<void> => {
    setSaveState('saving');
    const r = await saveCheck(entry);
    if (!alive.current) return;
    if (r === 'failed' || r === 'unavailable') {
      saved.current = false;
      setSaveState('failed');
      return;
    }
    setSaveState('saved');
    useC1CheckSheet.setState({ saved: true });
    // Fehlersätze nur mit dem ersten Speichern (ein zweiter Tab mit demselben Check hat sie schon geschrieben: `unchanged`).
    if (r !== 'unchanged' && add.length && !repairsDone.current) {
      repairsDone.current = true;
      void saveRepairs(add).then((ok) => {
        if (!ok) logWarn('check:repairs', { code: 'not_saved', message: `${add.length} Fehlersätze nicht gespeichert` }, 'app/repair');
      });
    }
    // Am Check-Tag ersetzt der Check Schritt 2 und 3: beide zählen jetzt als erledigt.
    if (ctx) for (const duty of ctx.duties) markBlockDone(ctx.day, duty);
  };

  const finish = (all: CheckAnswer[]): void => {
    if (!form) return;
    const tally = scoreCheck(items, all);
    const entry = checkEntry(tally, { day: ctx?.day ?? today, form, inp });
    const add = checkRepairs(tally.lines, lang);
    setResult({ tally, inp, form, repairs: add.length, entry });
    setPhase('result');
    // Genau ein Eintrag wird gespeichert; ein zweites Auslösen schreibt nichts.
    if (saved.current) return;
    saved.current = true;
    void persist(entry, add);
  };

  const retrySave = (): void => {
    if (!result || saved.current) return;
    saved.current = true;
    void persist(result.entry, checkRepairs(result.tally.lines, lang));
  };

  const answer = (r: C1Response | null): void => {
    const it = items[idx];
    if (!it) return;
    const next = [...answers, { id: it.id, r }];
    setAnswers(next);
    if (idx + 1 < items.length) setIdx(idx + 1);
    else finish(next);
  };

  const item = items[idx];
  const partNo = item ? CHECK_PARTS.indexOf(item.kind) + 1 : 1;

  if (ask) {
    return (
      <section className="flex flex-col gap-4" data-testid="ck-ask-cancel">
        <p className="leading-relaxed">{t('pxCkCancelAsk')}</p>
        <ActionBar placement="column" stateKey="ck-cancel">
          <PrimaryAction onClick={() => useC1CheckSheet.setState({ ask: false })} testId="ck-cancel-no">
            {t('pxCkCancelNo')}
          </PrimaryAction>
          <Button variant="ghost" onClick={onClose} data-testid="ck-cancel-yes">
            {t('pxCkCancelYes')}
          </Button>
        </ActionBar>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-2" data-testid="ck" data-phase={phase} data-form={form ?? ''} data-inp={inp}>
      {phase === 'run' && item && (
        <header className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="lx-eyebrow" data-testid="ck-part">
              {t('pxCkPart', { n: partNo, name: t(`pxCkPart_${item.kind}` as Parameters<typeof t>[0]) })}
            </p>
            <p className="lx-t-meta lx-tnum text-muted" data-testid="ck-count">
              {t('pxCkCount', { n: idx + 1, m: items.length })}
            </p>
          </div>
          <Bar value={items.length ? idx / items.length : 0} label={t('pxCkProgress')} />
          {inp === 'touch' && item.kind === 'kwt' && (
            <p className="lx-t-meta text-muted" data-testid="ck-touch-note">
              {t('pxCkTouchShort')}
            </p>
          )}
        </header>
      )}

      {phase === 'intro' && (
        <section className="flex flex-col gap-3" data-testid="ck-intro">
          <p className="leading-relaxed">{t('pxCkTask')}</p>
          <p className="leading-relaxed">{t('pxCkPurpose')}</p>
          <p className="leading-relaxed text-muted">{t('pxCkRules')}</p>
          {inp === 'touch' && (
            <p className="leading-relaxed text-muted" data-testid="ck-intro-touch">
              {t('pxCkTouchNote')}
            </p>
          )}
          <p className="leading-relaxed text-muted">{t('pxCkNothing')}</p>
          <p className="lx-t-meta text-subtle">{t('pxCkForm', { f: form ?? '' })}</p>
          <ActionBar placement="column" stateKey="ck-intro">
            <PrimaryAction iconAfter="arrowRight" onClick={start} testId="ck-go">
              {t('pxCkGo')}
            </PrimaryAction>
          </ActionBar>
        </section>
      )}

      {phase === 'loading' && (
        <p className="text-muted" role="status" data-testid="ck-loading">
          {t('pxCkLoading')}
        </p>
      )}
      {phase === 'empty' && (
        <p className="text-muted" role="status" data-testid="ck-empty">
          {t('pxCkEmpty')}
        </p>
      )}
      {phase === 'noform' && (
        <p className="text-muted" role="status" data-testid="ck-noform">
          {t('pxCkNoForm')}
        </p>
      )}

      {phase === 'run' && item && <CheckItem key={item.id} item={item} inp={inp} last={idx + 1 === items.length} onAnswer={answer} />}

      {phase === 'result' && result && (
        <CheckResult data={result} history={historyOf(checks, result.entry)} saveState={saveState} onRetrySave={retrySave} onClose={onClose} />
      )}

      {phase !== 'result' && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={phase === 'run' ? () => useC1CheckSheet.setState({ ask: true }) : onClose} data-testid="ck-cancel">
            {t('pxCkCancel')}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Das Blatt (in der Shell eingehängt). Geschlossen ist nichts im Speicher: jedes Öffnen beginnt von vorn (Abbrechen speichert nichts). */
export function CheckHost() {
  const { t } = useT();
  const open = useC1CheckSheet((s) => s.open);
  const ctx = useC1CheckSheet((s) => s.ctx);
  const go = useNav((s) => s.go);
  const close = (): void => {
    const s = useC1CheckSheet.getState();
    s.close();
    // Am Check-Tag geht es nach dem gespeicherten Check mit dem nächsten Schritt weiter.
    if (s.ctx && s.saved) go({ name: 'unitCard', step: 'next' });
  };
  return (
    <Sheet open={open} onClose={() => (useC1CheckSheet.getState().running ? requestCloseCheck() : close())} title={t('pxCkTitle')} closeLabel={t('pxCkClose')}>
      {open && <Flow ctx={ctx} onClose={close} />}
    </Sheet>
  );
}
