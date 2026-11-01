import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { Button, dictLookup, getDb, getWriter, isDictWord, local, readDoc, Skeleton, useLive, useNav, useT } from '../sharedUi';
import { logError, toUSText } from '../shared';
import { checkDict } from '../content';
import type { SessionKind } from '../domain/session';
import { VMOD_DAY_PATH } from '../registry';
import { LearnCard } from './LearnCard';
import { LearnRun, type DraftStore } from './learnRun';

// Wörter-Modul V3 Schritt 2b-2: Bildschirm der neuen Lernrunde (Route `vlearn`, nur bei `vcfg.mod = 1`). Liest die Live-Daten einmal beim
// Start (die Runde rechnet danach mit ihrem eigenen Bestand), bucht jede Antwort beim Weiter und beim Verlassen genau einmal.

const PENDING_KEY = 'lx:vm-pending';
const DEVICE_KEY = 'lx:vm-dev';

const drafts: DraftStore = {
  get: () => local.get(PENDING_KEY),
  set: (v) => {
    local.set(PENDING_KEY, v);
  },
  remove: () => local.remove(PENDING_KEY),
};

/** Gerätekennung für die Verlaufsschlüssel (zufällig, einmal je Browser). */
function deviceId(): string {
  const cur = local.get(DEVICE_KEY);
  if (cur && /^[a-z0-9]{6,16}$/.test(cur)) return cur;
  const id = `d${Math.random().toString(36).slice(2, 10)}`;
  local.set(DEVICE_KEY, id);
  return id;
}

/** Oberflächensprache für die Texte des Bands (zum Zeitpunkt des Prüfens). */
let uiLang: 'de' | 'en' = 'de';

function createRun(): LearnRun | null {
  const writer = getWriter();
  if (!writer) return null;
  return new LearnRun({
    deps: { writer, device: deviceId() },
    dict: checkDict(isDictWord, toUSText),
    lang: () => uiLang,
    drafts,
    readDay: async () => {
      const db = getDb();
      if (!db) return null;
      const d = await readDoc(db, VMOD_DAY_PATH);
      return d.status === 'valid' ? d.doc : null;
    },
    now: () => Date.now(),
    meaningOf,
  });
}

function meaningOf(w: string): string | null {
  return dictLookup(w)?.senses[0]?.de ?? null;
}

/** Obere Übungsleiste (✕, Fortschritt, Pflicht/Extra): kommt vom Bereich, weil das Modul `features/learn` nicht kennt (Isolation). */
export type LearnTop = (p: { onClose: () => void; progress: { n: number; total: number } | null; ctx: 'duty' | 'extra' }) => ReactNode;

export function LearnScreen({ kind, renderTop }: { kind: SessionKind; renderTop?: LearnTop }) {
  const { t, lang } = useT();
  const status = useLive((s) => s.status);
  const back = useNav((s) => s.back);
  const switchTab = useNav((s) => s.switchTab);
  useEffect(() => {
    uiLang = lang;
  }, [lang]);
  const ready = status === 'ready' && getWriter() !== null;
  // Eine Runde je Bildschirm, sobald Live-Daten und Schreibpfad bereit sind.
  const run = useMemo(() => (ready ? createRun() : null), [ready]);

  // Start mit einer Momentaufnahme der Live-Daten (die Runde führt ihren Bestand danach selbst nach).
  useEffect(() => {
    if (!run) return;
    const s = useLive.getState();
    const docs: [string, Record<string, unknown>][] = [];
    for (const [id, doc] of s.collections.vocab ?? []) docs.push([`vocab/${id}`, doc]);
    for (const [id, doc] of s.collections.chunk ?? []) docs.push([`chunk/${id}`, doc]);
    run.start({ kind, docs, profile: s.docs['app/profile'] ?? null, schema: s.docs['app/schema'] ?? null }).catch((err: unknown) => logError('vocab:learn-start', err));
  }, [run, kind]);

  // Beim Verlassen (Bildschirmwechsel, Tab im Hintergrund, Seite zu): offene Antwort sofort buchen.
  useEffect(() => {
    if (!run) return;
    const flush = () => {
      void run.leave();
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVis);
      flush();
    };
  }, [run]);

  const view = useSyncExternalStore(run?.subscribe ?? noSub, run?.get ?? loadingView);

  const ctx = kind === 'pflicht' ? 'duty' : 'extra';
  const close = () => {
    void run?.leave();
    back();
  };
  const frame = (progress: { n: number; total: number } | null, body: ReactNode) => (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="vlearn">
      {renderTop?.({ onClose: close, progress, ctx })}
      {body}
    </div>
  );

  if (status === 'error') return <Notice title={t('vmClosedErrorTitle')} body={t('vmClosedError')} onBack={back} back={t('vmBack')} />;
  switch (view.k) {
    case 'loading':
      return (
        <div className="flex flex-col gap-3 p-4" data-testid="vm-loading" aria-busy="true">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      );
    case 'closed':
      return (
        <Notice
          title={t(view.why === 'error' ? 'vmClosedErrorTitle' : 'vmClosedTitle')}
          body={t(view.why === 'off' ? 'vmClosedOff' : view.why === 'migrate' ? 'vmClosedMigrate' : 'vmClosedError')}
          onBack={back}
          back={t('vmBack')}
        />
      );
    case 'done':
      if (view.n === 0) return frame(null, <Notice title={t('vmEmptyTitle')} body={t('vmEmpty')} onBack={back} back={t('vmBack')} testId="vm-done" />);
      return frame(null, <Done fresh={view.fresh} review={view.review} extra={view.extra} onToday={() => switchTab('today')} />);
    case 'card':
    case 'band':
      return run ? frame({ n: view.n + 1, total: view.n + view.left + 1 }, <LearnCard view={view} run={run} />) : null;
  }
}

const noSub = () => () => undefined;
const LOADING = { k: 'loading' } as const;
const loadingView = () => LOADING;

/** Abschluss der Runde (UX-Prüfung V3 Nr. 7): getrennte Zahlen statt einer Summe, ein Knopf zurück zu Heute. Alles ist schon gebucht. */
function Done({ fresh, review, extra, onToday }: { fresh: number; review: number; extra: number; onToday: () => void }) {
  const { t } = useT();
  const rows = [
    { n: fresh, label: t('vmDoneFresh'), id: 'fresh' },
    { n: review, label: t('vmDoneReview'), id: 'review' },
    { n: extra, label: t('vmDoneExtra'), id: 'extra' },
  ].filter((r) => r.n > 0);
  return (
    <section className="lx-card mx-auto flex w-full max-w-xl flex-col gap-4 p-5" data-testid="vm-done">
      <div className="flex flex-col gap-1">
        <h2 className="lx-t-title">{t('vmDoneTitle')}</h2>
        <p className="lx-t-support text-muted">{t('vmDoneSaved')}</p>
      </div>
      <dl className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-baseline justify-between gap-3" data-testid={`vm-done-${r.id}`}>
            <dt className="lx-t-support">{r.label}</dt>
            <dd className="lx-t-title tabular-nums">{r.n}</dd>
          </div>
        ))}
      </dl>
      <Button variant="primary" onClick={onToday} data-testid="vm-back">
        {t('vmToToday')}
      </Button>
    </section>
  );
}

function Notice({ title, body, onBack, back, testId = 'vm-notice' }: { title: string; body: string; onBack: () => void; back: string; testId?: string }) {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-start gap-3 p-4" data-testid={testId}>
      <h2 className="lx-t-title">{title}</h2>
      <p className="lx-t-support text-muted">{body}</p>
      <Button variant="primary" onClick={onBack} data-testid="vm-back">
        {back}
      </Button>
    </section>
  );
}
