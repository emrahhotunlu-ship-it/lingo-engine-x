import { useEffect, useMemo, useRef, useState } from 'react';
import { useClock } from '../../app/clock';
import { loadPacked } from '../../content/store';
import { placeItems } from '../../domain/c1/placement/items';
import { LIMITS, answerItem, nextItem, placementResult, savePlacement, startRun, type RunState } from '../../domain/c1/placement/run';
import { buildWordProbe, wordSpan } from '../../domain/c1/placement/words';
import type { C1Item } from '../../domain/c1x/types';
import { useT } from '../../i18n';
import { logWarn } from '../../platform/diagnostics';
import { ActionBar, PrimaryAction } from '../../ui/ActionBar';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { PlacementItem } from './PlacementItem';
import { PlacementResult } from './PlacementResult';

// Einstufung (Lernplattform 3.0 §4.2, P34): zwei Teile in einem Blatt. Teil 1 „Wörter“ (Kenne ich / Kenne ich nicht), Teil 2 „Grammatik“ (adaptiv,
// Verfahren aus `domain/c1/placement`). Der ganze Zustand liegt in diesem Blatt: Schließen oder „Abbrechen“ wirft ihn weg, dann ist NICHTS geschrieben.
// Geschrieben wird erst mit „Programm starten“ am Ende, und nur nach `app/c1.place` (`savePlacement`), nie nach `grammar/<id>`.
// Ohne Claude, ohne Sprachausgabe und ohne Wörterbuch voll bedienbar.

type Phase = 'intro' | 'words' | 'loading' | 'grammar' | 'result';

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-strong" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}

function Flow({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const today = useClock((s) => s.today);
  const [phase, setPhase] = useState<Phase>('intro');
  const probe = useMemo(() => buildWordProbe(today), [today]);
  const [wi, setWi] = useState(0);
  const [yes, setYes] = useState<ReadonlySet<string>>(new Set());
  const [run, setRun] = useState<RunState | null>(null);
  const [cur, setCur] = useState<string | null>(null);
  const [byId, setById] = useState<ReadonlyMap<string, C1Item>>(new Map());
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const startGrammar = (): void => {
    setPhase('loading');
    // Der Einstufungsvorrat ist ein eigenes Bündel (`c1x-place`); er gelangt nie in den Speicher des Trainings (`preload`).
    void loadPacked<C1Item>('c1x-place')
      .catch((err: unknown) => {
        logWarn('place:load', err);
        return null;
      })
      .then((doc) => {
        if (!alive.current) return;
        const pool = placeItems(doc?.items ?? []);
        if (!pool.items.length) {
          setRun(null);
          setPhase('grammar');
          return;
        }
        const r = startRun(pool.items, Date.now());
        setById(pool.byId);
        setRun(r);
        const first = nextItem(r, Date.now());
        setCur(first ? first.id : null);
        setPhase(first ? 'grammar' : 'result');
      });
  };

  const word = (known: boolean): void => {
    const w = probe[wi];
    if (!w) return;
    if (known) setYes((s) => new Set([...s, w.w]));
    if (wi + 1 >= probe.length) startGrammar();
    else setWi(wi + 1);
  };

  const answer = (ok: boolean): void => {
    if (!run || !cur) return;
    const next = answerItem(run, cur, ok);
    setRun(next);
    const n = nextItem(next, Date.now());
    if (n) setCur(n.id);
    else {
      setCur(null);
      setPhase('result');
    }
  };

  const result = useMemo(() => (run && phase === 'result' ? placementResult(run) : null), [run, phase]);
  const vw = useMemo(() => (phase === 'result' ? wordSpan(probe, yes) : null), [phase, probe, yes]);

  const save = (): void => {
    if (!result || saving) return;
    setSaving(true);
    setFailed(false);
    void savePlacement(result, today, vw).then((r) => {
      if (!alive.current) return;
      setSaving(false);
      if (r === 'created' || r === 'updated' || r === 'unchanged') {
        toast(t('pxPlResSaved'));
        onClose();
      } else setFailed(true);
    });
  };

  const partName = phase === 'words' ? t('pxPlPartWords') : t('pxPlPartGrammar');
  const item = cur ? byId.get(cur) : undefined;
  const progress = phase === 'words' ? wi / Math.max(1, probe.length) : run ? run.asked.length / LIMITS.maxN : 0;

  return (
    <div className="flex flex-col gap-5 pb-2" data-testid="placement" data-phase={phase}>
      {(phase === 'words' || phase === 'grammar' || phase === 'loading') && (
        <header className="flex flex-col gap-2">
          <p className="lx-eyebrow" data-testid="place-part">
            {t('pxPlPart', { n: phase === 'words' ? 1 : 2, name: partName })}
          </p>
          <Bar value={progress} label={t('pxPlProgress')} />
        </header>
      )}

      {phase === 'intro' && (
        <section className="flex flex-col gap-3" data-testid="place-intro">
          <p className="leading-relaxed">{t('pxPlIntroLead')}</p>
          <p className="leading-relaxed text-muted">{t('pxPlIntroTap')}</p>
          <p className="leading-relaxed text-muted">{t('pxPlIntroHonest')}</p>
          <p className="leading-relaxed text-muted">{t('pxPlIntroCancel')}</p>
          <ActionBar placement="column" stateKey="place-intro">
            <PrimaryAction iconAfter="arrowRight" onClick={() => setPhase('words')} testId="place-go">
              {t('pxPlStart')}
            </PrimaryAction>
          </ActionBar>
        </section>
      )}

      {phase === 'words' && probe[wi] && (
        <section className="flex flex-col gap-4" data-testid="place-words" key={probe[wi]?.w}>
          <p className="lx-t-support text-muted">{t('pxPlWordsAsk')}</p>
          <p className="lx-t-answer text-center tracking-tight" lang="en" data-testid="place-word-now">
            {probe[wi]?.w}
          </p>
          <p className="text-center text-sm text-muted">{t('pxPlWordsHint')}</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" size="lg" onClick={() => word(false)} data-testid="place-word-no">
              {t('pxPlWordNo')}
            </Button>
            <Button variant="primary" size="lg" onClick={() => word(true)} data-testid="place-word-yes">
              {t('pxPlWordYes')}
            </Button>
          </div>
        </section>
      )}

      {phase === 'loading' && (
        <p className="text-muted" role="status" data-testid="place-loading">
          {t('pxPlLoading')}
        </p>
      )}

      {phase === 'grammar' && !item && (
        <p className="text-muted" role="status" data-testid="place-noitems">
          {t('pxPlNoItems')}
        </p>
      )}
      {phase === 'grammar' && item && <PlacementItem key={item.id} item={item} onAnswer={answer} />}

      {phase === 'result' && result && <PlacementResult result={result} vw={vw} saving={saving} failed={failed} onStart={save} />}
      {phase === 'result' && !result && (
        <p className="text-muted" role="status" data-testid="place-noitems">
          {t('pxPlNoItems')}
        </p>
      )}

      {phase !== 'result' && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={onClose} data-testid="place-cancel">
            {t('pxPlCancel')}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Das Blatt. Geschlossen ist nichts im Speicher: jedes Öffnen beginnt von vorn. */
export function PlacementScreen({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t('pxPlTitle')} closeLabel={t('pxPlClose')}>
      {open && <Flow onClose={onClose} />}
    </Sheet>
  );
}
