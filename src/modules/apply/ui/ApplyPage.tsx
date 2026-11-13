import { useMemo } from 'react';
import { fehlersaetzeDue, fixToday, Row, RowList, TabTitle, useAiAvailable, useClock, useInputProfile, useLive, useNav, useT, useToday, useTodayPlan, type IconName, type MessageKey } from '../sharedUi';
import { BRIDGE_MIN, BRIDGE_STAT_MIN, bridgeMinutes, readBridgeStat } from '../shared';
import { isShortDayOf, type WriteKind } from '../domain/count';
import { applyStepRoute } from './route';

// Seite „Anwenden“ (F3, anwenden-plan.md „Seite Anwenden“; ersetzt unter Fokus 2.0 den Praxis-Hub):
// 1. „Heute dran“: die Pflicht von Schritt 3. Seit Großpaket P, P4 (Entscheidung E2 vom 13.11.2026) sind das täglich zwei eigene Sätze mit einem
//    Wort und einem Grammatik-Muster (am kurzen Tag einer). Erledigt = Zustand, kein Knopf (Kap. 2.2).
// 2. „Frei üben“ (Extra, zählt nie zur Pflicht): Mail beantworten, Mail schreiben, Artikel zusammenfassen in voller Länge (ehrliche Zeitangabe),
//    der Text mit eigenen Wörtern, und – sobald die Pflicht erledigt ist – zwei weitere eigene Sätze. Solange „Heute dran“ offen ist, stehen die
//    eigenen Sätze dort nicht noch einmal (nichts doppelt, Kap. 2 Nr. 6 und Kap. 15; der einzige Weg zur Pflicht ist Schritt 3).
// 3. „Fehler korrigieren“: fällige Fehlersätze, freiwillig.
// Test-Kennungen `apply-hub`, `hub-combo-own` und `hub-repair-round` bleiben wie im bisherigen Hub.

const KINDS: readonly WriteKind[] = ['reply', 'write', 'summary'];
const ICON: Record<WriteKind, IconName> = { reply: 'send', write: 'pen', summary: 'book' };
const TITLE: Record<WriteKind, MessageKey> = { reply: 'axKindReply', write: 'axKindWrite', summary: 'axKindSummary' };
const WHY: Record<WriteKind, MessageKey> = { reply: 'axWhyReply', write: 'axWhyWrite', summary: 'axWhySummary' };
const TEST_ID: Record<WriteKind, string> = { reply: 'ax-row-reply', write: 'ax-row-write', summary: 'ax-row-summary' };
/** Ehrliche Zeit der freien Schreibübungen in voller Länge: am Handy rund 6, am Laptop bis rund 9 Minuten. */
const FREE_MIN: readonly [number, number] = [6, 9];

export function ApplyPage() {
  const { t } = useT();
  // Wörter-App an: „Text mit deinen Wörtern“ (vorher am Ende der Wörter-Pflicht, Emrah 07.11.2026 „A“).
  const wordsOn = useLive((s) => (s.docs['app/profile']?.vcfg as { mod?: unknown } | undefined)?.mod === 1);
  const go = useNav((s) => s.go);
  const today = useClock((s) => s.today);
  const now = useClock((s) => s.now);
  const ai = useAiAvailable();
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
  const stepDone = step?.state === 'done';
  // Prüfbefund L4: Minuten von Schritt 3 aus dem eingefrorenen Plan (dieselbe Zahl wie Startkarte und Heute; am kurzen Tag die verkleinerten).
  const planMin = plan?.u?.b.find(([, kind]) => kind === 'task.apply')?.[2];
  // Freie Zusatzrunde: die gemessene Zeit, sobald genug eigene Sätze gemessen sind; sonst der Standard.
  const stat = readBridgeStat(profile);
  const freeMin = stat && stat.n >= BRIDGE_STAT_MIN ? bridgeMinutes(stat.ms) : BRIDGE_MIN;

  const startToday = (): void => {
    const r = applyStepRoute({ ap: plan?.u?.ap, short, ai, day: today, block: 3 });
    if (r) go(r);
  };
  // Die eigenen Sätze zählen nur über Schritt 3; solange er offen ist, stehen sie nicht noch einmal unter „Frei üben“.
  const stepOpen = hasStep && !stepDone;

  return (
    <div className="lx-ax mx-auto flex w-full max-w-[47.5rem] flex-col gap-8 px-4 py-6 sm:py-10" data-testid="apply-hub" data-v="3" data-profile={device}>
      <TabTitle title={t('axTitle')} sub={<p className="lx-ax-hint m-0 text-muted">{t('axLead')}</p>} />

      {hasStep && (
        <RowList title={t('axToday')} testId="ax-today">
          {stepDone ? (
            <Row icon="check" channel="grammar" title={t('axTodayDone', { what: t('axBTitle') })} sub={t('axTodayDoneSub')} testId="ax-today-done" data={{ 'data-kind': 'bridge' }} />
          ) : (
            <Row
              icon="sparkle"
              channel="grammar"
              title={t(short ? 'axKindBridgeOne' : 'axKindBridge')}
              sub={t('axTodaySub', { why: t('axWhyBridge') })}
              value={t('axMin', { n: typeof planMin === 'number' ? planMin : BRIDGE_MIN })}
              chevron
              onClick={startToday}
              testId="ax-today-start"
              data={{ 'data-kind': 'bridge' }}
            />
          )}
        </RowList>
      )}

      <RowList title={t('axAll')} testId="ax-all">
        {!stepOpen && (
          <Row
            icon="sparkle"
            channel="grammar"
            title={t(hasStep ? 'axBFree' : 'axKindBridge')}
            sub={!ai ? t('axNeedsAi') : t(hasStep ? 'axBFreeSub' : 'axWhyBridge')}
            value={t('axMin', { n: freeMin })}
            chevron
            onClick={() => go({ name: 'applyBridge' })}
            disabled={!ai}
            testId="hub-combo-own"
            data={{ 'data-kind': 'bridge' }}
          />
        )}
        {KINDS.map((kind) => (
          <Row
            key={kind}
            icon={ICON[kind]}
            channel="grammar"
            title={t(TITLE[kind])}
            sub={!ai ? t('axNeedsAi') : t(WHY[kind])}
            value={t('axMinRange', { a: FREE_MIN[0], b: FREE_MIN[1] })}
            chevron
            onClick={() => go({ name: 'applyTask', kind })}
            disabled={!ai}
            testId={TEST_ID[kind]}
            data={{ 'data-kind': kind }}
          />
        ))}
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
