import { useMemo } from 'react';
import { fehlersaetzeDue, fixToday, Row, RowList, TabTitle, useAiAvailable, useClock, useComboPairs, useInputProfile, useLive, useNav, useT, useToday, useTodayPlan, type IconName, type MessageKey } from '../sharedUi';
import { isShortDayOf, type ApplyKind } from '../domain/count';
import { APPLY_MINUTES } from '../domain/kinds';
import { applyStepRoute } from './route';

// Seite „Anwenden“ (F3, anwenden-plan.md „Seite Anwenden“; ersetzt unter Fokus 2.0 den Praxis-Hub):
// 1. „Heute dran“: die Disziplin des Tages aus dem eingefrorenen Plan (Pflicht, Schritt 3). Erledigt = Zustand, kein Knopf (Kap. 2.2).
// 2. Die Disziplinen als Zeilen (Handlung, Wozu, Dauer), frei geübt (Extra, zählt nie zur Pflicht). Solange „Heute dran“ offen ist, fehlt dort dessen Art
//    (nichts doppelt, Kap. 2 Nr. 6 und Kap. 15; der einzige Weg zur Pflicht ist Schritt 3).
// 3. „Fehler korrigieren“: fällige Fehlersätze, freiwillig.
// Test-Kennungen `apply-hub`, `hub-combo-own` und `hub-repair-round` bleiben wie im bisherigen Hub.

const KINDS: readonly ApplyKind[] = ['combo', 'reply', 'write', 'summary'];
const ICON: Record<ApplyKind, IconName> = { combo: 'sparkle', reply: 'send', write: 'pen', summary: 'book' };
const TITLE: Record<ApplyKind, MessageKey> = { combo: 'axKindCombo', reply: 'axKindReply', write: 'axKindWrite', summary: 'axKindSummary' };
const WHY: Record<ApplyKind, MessageKey> = { combo: 'axWhyCombo', reply: 'axWhyReply', write: 'axWhyWrite', summary: 'axWhySummary' };
const TEST_ID: Record<ApplyKind, string> = { combo: 'hub-combo-own', reply: 'ax-row-reply', write: 'ax-row-write', summary: 'ax-row-summary' };

export function ApplyPage() {
  const { t } = useT();
  // Wörter-App an: „Text mit deinen Wörtern“ (vorher am Ende der Wörter-Pflicht, Emrah 07.11.2026 „A“).
  const wordsOn = useLive((s) => (s.docs['app/profile']?.vcfg as { mod?: unknown } | undefined)?.mod === 1);
  const go = useNav((s) => s.go);
  const today = useClock((s) => s.today);
  const now = useClock((s) => s.now);
  const ai = useAiAvailable();
  const pairs = useComboPairs();
  const device = useInputProfile();
  const profile = useLive((s) => s.docs['app/profile']);
  const grammar = useLive((s) => s.collections.grammar);
  const repairDoc = useLive((s) => s.docs['app/repair']);
  const plan = useTodayPlan((s) => (s.plan && s.plan.d === today ? s.plan : null));
  const step = useToday((s) => s.duties.items.find((d) => d.id === 'ch:u-task') ?? null);
  const fixOpen = useToday((s) => s.duties.items.some((d) => d.id === 'ch:u-again' && d.state === 'open'));

  // „Fehler korrigieren“: nur, was nach dem Pflichtschritt von heute noch fällig ist (nie dieselben Sätze zweimal anbieten).
  const moreFix = useMemo(() => {
    const due = fehlersaetzeDue({ grammarDocs: grammar ?? new Map(), repairDoc, nowMs: now, today });
    return fixOpen ? Math.max(0, due - fixToday({ plan, fixDue: due })) : due;
  }, [grammar, repairDoc, now, today, plan, fixOpen]);

  const hasStep = !!plan?.u?.b.some(([, kind]) => kind === 'task.apply');
  const short = isShortDayOf(profile, today);
  const todayKind: ApplyKind = short ? 'combo' : (plan?.u?.ap ?? 'combo');
  const stepDone = step?.state === 'done';
  // Prüfbefund L4: Minuten von Schritt 3 aus dem eingefrorenen Plan (dieselbe Zahl wie Startkarte und Heute; am kurzen Tag die verkleinerten).
  const planMin = plan?.u?.b.find(([, kind]) => kind === 'task.apply')?.[2];

  const startToday = (): void => {
    const r = applyStepRoute({ ap: plan?.u?.ap, short, ai, day: today, block: 3 });
    if (r) go(r);
  };
  // Prüfbefund L8 / UX-Befund 4: Die Disziplin des Tages zählt nur über Schritt 3; solange er offen ist, steht sie nicht noch einmal unter „Frei üben“.
  const stepOpen = hasStep && !stepDone;
  const freeKinds = stepOpen ? KINDS.filter((k) => k !== todayKind) : KINDS;
  const startFree = (kind: ApplyKind): void => {
    if (kind === 'combo') go({ name: 'comboSentence' });
    else go({ name: 'applyTask', kind });
  };
  const blocked = (kind: ApplyKind): MessageKey | null => (!ai ? 'axNeedsAi' : kind === 'combo' && pairs.length === 0 ? 'axNeedsWords' : null);
  const min = (kind: ApplyKind): string => t('axMin', { n: kind === todayKind && stepOpen && typeof planMin === 'number' ? planMin : APPLY_MINUTES[kind] });

  return (
    <div className="lx-ax mx-auto flex w-full max-w-[47.5rem] flex-col gap-8 px-4 py-6 sm:py-10" data-testid="apply-hub" data-v="2" data-profile={device}>
      <TabTitle title={t('axTitle')} sub={<p className="lx-ax-hint m-0 text-muted">{t('axLead')}</p>} />

      {hasStep && (
        <RowList title={t('axToday')} testId="ax-today">
          {stepDone ? (
            <Row icon="check" channel="grammar" title={t('axTodayDone', { what: t(TITLE[todayKind]) })} sub={t('axTodayDoneSub')} testId="ax-today-done" data={{ 'data-kind': todayKind }} />
          ) : (
            <Row
              icon={ICON[todayKind]}
              channel="grammar"
              title={short ? t('axTodayShort') : t(TITLE[todayKind])}
              sub={t('axTodaySub', { why: t(WHY[todayKind]) })}
              value={min(todayKind)}
              chevron
              onClick={startToday}
              testId="ax-today-start"
              data={{ 'data-kind': todayKind }}
            />
          )}
        </RowList>
      )}

      <RowList title={t('axAll')} testId="ax-all">
        {freeKinds.map((kind) => {
          const why = blocked(kind);
          return (
            <Row
              key={kind}
              icon={ICON[kind]}
              channel="grammar"
              title={t(TITLE[kind])}
              sub={why ? t(why) : t(WHY[kind])}
              value={min(kind)}
              chevron
              onClick={() => startFree(kind)}
              disabled={!!why}
              testId={TEST_ID[kind]}
              data={{ 'data-kind': kind }}
            />
          );
        })}
        {wordsOn && <Row icon="sparkle" channel="grammar" title={t('axUseTitle')} sub={t('axUseSub')} value={t('axMin', { n: 5 })} chevron onClick={() => go({ name: 'vlearn', kind: 'use' })} testId="ax-row-use" />}
      </RowList>

      {moreFix > 0 && (
        <RowList label={t('axFixTitle')} testId="ax-fix">
          <Row icon="refresh" channel="grammar" title={t('axFixTitle')} sub={t(moreFix === 1 ? 'axFixSub_one' : 'axFixSub_other', { n: moreFix })} onClick={() => go({ name: 'repairRound' })} testId="hub-repair-round" />
        </RowList>
      )}
    </div>
  );
}
