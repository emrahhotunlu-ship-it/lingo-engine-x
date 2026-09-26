import { useMachine } from '@xstate/react';
import { useEffect, useMemo, useState } from 'react';
import { fromPromise } from 'xstate';
import { useNav } from '../../app/nav';
import { watchCollection } from '../../data/watch';
import { invalidIdsOf, useLive } from '../../data/live';
import { mergedVocab } from '../../domain/overview';
import { wordState, type ApplySel } from '../../domain/preply/apply';
import { lastImport, openPlan, preplyList, type ImportView } from '../../domain/preply/docs';
import { useT } from '../../i18n';
import { getDb, useCapabilities } from '../../platform/capabilities';
import { local } from '../../platform/storage';
import { Button } from '../../ui/Button';
import { useCompanionSee } from '../companion/seeing';
import { analyzeImport, applyPlanFor, runApply } from './actions';
import { HistoryList } from './HistoryList';
import { DRAFT_KEY, ImportPane } from './ImportPane';
import { importMachine } from './importMachine';
import { PlanView } from './PlanView';
import { PrepForm } from './PrepForm';
import { openPreplyEntry, receivePreply, setPreplyTab, usePreply, type PreplyTab } from './store';

// Preply-Brücke (Phase 5 §8.3, Kap. 6.10): Vorbereiten | Übernehmen | Verlauf. Je Reiter
// höchstens EIN Primärknopf. Die Sammlung `preply` ist nur abonniert, solange der Bildschirm offen ist.

type Doc = Record<string, unknown>;

function defaultSel(pi: ImportView, vocabIds: ReadonlySet<string>): ApplySel {
  return {
    c: pi.corrections.map((_, i) => i),
    t: pi.items.map((_, i) => i),
    w: pi.words.map((w, i) => (wordState(pi, w, vocabIds) === 'ok' ? i : -1)).filter((i) => i >= 0),
  };
}

function currentVocabIds(): Set<string> {
  const s = useLive.getState();
  return new Set(mergedVocab(s.collections.vocab ?? new Map<string, Doc>(), invalidIdsOf(s.invalid, 'vocab')).keys());
}

export function PreplyScreen() {
  const { t } = useT();
  const db = useCapabilities((s) => s.db);
  const docs = usePreply((s) => s.docs);
  const loaded = usePreply((s) => s.loaded);
  const tabState = usePreply((s) => s.tab);
  const openId = usePreply((s) => s.openId);
  const go = useNav((s) => s.go);
  const [newPlan, setNewPlan] = useState(false);

  // E5-19: ein Abo auf die Sammlung, nur solange der Bildschirm offen ist.
  useEffect(() => {
    if (db !== 'ready') return;
    const handle = getDb();
    if (!handle) return;
    return watchCollection(
      handle,
      'preply',
      (w) => receivePreply(w.docs),
      () => usePreply.setState({ failed: true, loaded: true }),
    );
  }, [db]);

  const list = useMemo(() => preplyList(docs), [docs]);
  const plan = openPlan(list);
  const last = lastImport(list);
  const tab: PreplyTab = tabState ?? 'prep';

  const [machine] = useState(() =>
    importMachine.provide({
      actors: {
        analyze: fromPromise(async ({ input, signal }) => {
          const pi = await analyzeImport({ raw: input.raw, signal, onPhase: input.onPhase });
          local.remove(DRAFT_KEY);
          return { pi, sel: defaultSel(pi, currentVocabIds()) };
        }),
        apply: fromPromise(async ({ input }) => runApply(input.pi, input.sel, input.plan ?? applyPlanFor(input.pi, input.sel))),
      },
    }),
  );
  // Bildschirmwechsel bricht die laufende Analyse ab (Kap. 10): XState stoppt `invoke` beim
  // Aushängen und bricht dabei das Signal des Dienstes ab.
  const [snap, send] = useMachine(machine, { input: { raw: local.get(DRAFT_KEY) ?? '' } });

  useCompanionSee({ area: 'preply', label: `${t('ppTitle')} · ${tab === 'prep' ? t('ppTabPrep') : tab === 'import' ? t('ppTabImport') : t('ppTabHistory')}`, phase: 'idle' });

  const tabs: Array<{ id: PreplyTab; label: string }> = [
    { id: 'prep', label: t('ppTabPrep') },
    { id: 'import', label: t('ppTabImport') },
    { id: 'history', label: t('ppTabHistory') },
  ];

  const review = (pi: ImportView) => {
    send({ type: 'OPEN', pi, sel: defaultSel(pi, currentVocabIds()) });
    setPreplyTab('import');
  };

  return (
    <div className="flex flex-col gap-5 py-6 sm:py-10">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" icon="arrowRight" className="-ml-2 [&>svg]:rotate-180" onClick={() => go({ name: 'today' })} data-testid="pp-back">
            {t('navToday')}
          </Button>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('ppTitle')}</h1>
        <div role="tablist" aria-label={t('ppTitle')} className="flex w-full max-w-md rounded-[var(--radius-control)] bg-track p-1">
          {tabs.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => setPreplyTab(x.id)}
              className={`min-h-11 flex-1 rounded-[calc(var(--radius-control)-4px)] px-3 text-sm transition-colors ${tab === x.id ? 'bg-surface-solid font-semibold text-fg shadow-sm' : 'font-medium text-muted hover:text-fg'}`}
              data-testid={`pp-tab-${x.id}`}
            >
              {x.label}
            </button>
          ))}
        </div>
      </header>

      {!loaded && db === 'ready' && <p className="text-sm text-muted">{t('loadingData')}</p>}

      {tab === 'prep' &&
        (plan && !newPlan ? (
          <div className="flex flex-col gap-3">
            <PlanView plan={plan} />
            <div>
              <Button variant="ghost" icon="plus" onClick={() => setNewPlan(true)} data-testid="pp-new-plan">
                {t('ppNewPlan')}
              </Button>
            </div>
          </div>
        ) : (
          <PrepForm
            last={last}
            onCreated={(id) => {
              setNewPlan(false);
              openPreplyEntry(null);
              // Der neue Plan ist der jüngste offene und erscheint oben, sobald das Abo ihn liefert.
              void id;
            }}
          />
        ))}

      {tab === 'import' && <ImportPane snap={snap} send={send} />}

      {tab === 'history' && <HistoryList list={list} openId={openId} onReview={review} />}
    </div>
  );
}
