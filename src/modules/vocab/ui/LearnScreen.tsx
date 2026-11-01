import { useEffect, useMemo, useSyncExternalStore } from 'react';
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

export function LearnScreen({ kind }: { kind: SessionKind }) {
  const { t, lang } = useT();
  const status = useLive((s) => s.status);
  const back = useNav((s) => s.back);
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
      return <Notice title={t(view.n > 0 ? 'vmDoneTitle' : 'vmEmptyTitle')} body={view.n > 0 ? t('vmDoneSub', { n: view.n }) : t('vmEmpty')} onBack={back} back={t('vmBack')} testId="vm-done" />;
    case 'card':
    case 'band':
      return run ? <LearnCard view={view} run={run} /> : null;
  }
}

const noSub = () => () => undefined;
const LOADING = { k: 'loading' } as const;
const loadingView = () => LOADING;

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
