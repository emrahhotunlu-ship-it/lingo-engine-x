import { useEffect } from 'react';
import { useNav } from '../../app/nav';
import { useSheets } from '../../app/sheets';
import { todayDocBlocks, type TodayDoc, type TodayDocBlock } from '../../data/todayDoc';
import { ringFills } from '../../domain/metrics';
import type { DutyId, Step3Fmt } from '../../domain/plan/types';
import type { UnitBlockKind } from '../../domain/unit/types';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { DayRing } from '../../ui/DayRing';
import { Icon } from '../../ui/Icon';
import { dutyLabel } from '../learn/ui';
import { blockName } from '../unit/labels';
import { markStart } from './startPerf';
import { requestStart } from './startRun';

// Die Tageskarte als Ansicht (Relaunch Stufe 1 P6): EIN Aufbau für die echte Karte (`UnitCard`), das Startbild aus `app/today` (`StartCard`),
// das Skelett und das Start-Bild in index.html (#lx-boot). Am Handy wie bisher (Ring neben dem Titel, Schritte, Knopf unten); ab 1.024 px quer wie
// die Vorschau L1 (desk.js 79–137): Ring 13em links, rechts Titel, Schritte und Knopf (min. 12em, ⏎). Gleiche Klassen → kein Sprung beim Wechsel.
// Änderungen an diesen Klassen immer auch in `system/HomeSkeleton.tsx` und index.html nachziehen (Test: perf.spec „Start-Bild“).

export const DAY_CARD_CLS =
  'lx-card lx-today-card flex flex-col gap-4 p-[1.125rem] sm:p-6';
export const DAY_HEAD_CLS = 'flex items-center gap-3.5 lg:contents';
export const DAY_TITLE_CLS = 'flex min-w-0 flex-1 flex-col gap-0.5 lg:col-start-2 lg:row-start-1';
export const DAY_LIST_CLS = 'flex flex-col gap-4 lg:col-start-2 lg:row-start-2';
export const DAY_GO_CLS = 'mt-auto w-full lg:col-start-2 lg:row-start-4 lg:w-auto lg:min-w-[12em] lg:justify-self-start';
export const DAY_FOOT_CLS = 'min-h-4 lg:col-start-2 lg:row-start-5';

type T = (k: MessageKey, v?: Record<string, string | number>) => string;

export type DayRowState = 'done' | 'now' | 'open';

/** Eine Zeile der Karte, fertig zum Zeichnen. `why: null` = Grund noch unbekannt (Startbild) → Platzhalter gleicher Höhe. */
export type DayRow = { id: string; name: string; why: string | null; whyKey: string; min: number; kind: string; state: DayRowState };

export function BlockDot({ state, kind }: { state: DayRowState; kind?: string }) {
  // Design-Lead: der nächste Schritt trägt seine Bereichsfarbe (Wörter violett, sonst Grammatik blau), wie in der Vorschau.
  const tc = kind === 'review' ? 'var(--lx-ch-cards)' : 'var(--lx-ch-grammar)';
  if (state === 'done')
    return (
      <span className="inline-flex size-6 flex-none items-center justify-center rounded-full bg-ok" style={{ color: 'var(--fg-on)' }} aria-hidden="true">
        <Icon name="check" size={14} />
      </span>
    );
  return (
    <span className="inline-flex size-6 flex-none items-center justify-center rounded-full border-2" style={{ borderColor: state === 'now' ? tc : 'var(--lx-line-strong)' }} aria-hidden="true">
      {state === 'now' && <span className="size-2.5 rounded-full" style={{ background: tc }} />}
    </span>
  );
}

/** Schrittliste der Karte (echte Karte: `duties`/`duty`/`reason`; Startbild: `start-…`). */
export function DayRows({ rows, prefix }: { rows: readonly DayRow[]; prefix: 'today' | 'start' }) {
  const { t } = useT();
  const real = prefix === 'today';
  return (
    <ol className="flex flex-col gap-1.5" aria-label={t('tdPflicht')} data-testid={real ? 'duties' : 'start-duties'}>
      {rows.map((r) => (
        <li
          key={r.id}
          data-testid={real ? 'duty' : 'start-duty'}
          data-duty={r.id}
          data-state={r.state === 'done' ? 'done' : 'open'}
          data-now={r.state === 'now' ? 'true' : undefined}
          className={`flex min-h-[3.25rem] items-center gap-3 rounded-[0.875rem] px-3 py-1.5 ${r.state === 'now' ? 'bg-surface-strong' : ''}`}
        >
          <BlockDot state={r.state} kind={r.kind} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={`text-base font-medium ${r.state === 'now' ? 'text-fg' : 'text-muted'}`}>{r.name}</span>
            {r.why === null ? (
              <span className="flex h-4 items-center" aria-hidden="true">
                <span className="lx-skeleton h-2.5 w-2/3" />
              </span>
            ) : (
              <span className="text-xs text-muted" data-testid={real ? 'reason' : undefined} data-why={r.whyKey}>
                {r.why}
              </span>
            )}
          </span>
          <span className="lx-tnum flex-none text-xs text-muted">
            {r.state === 'done' ? t('nbHeuteBlockDone') : t('nbHeuteMin', { min: r.min })}
            <span className="sr-only"> · {r.state === 'done' ? t('nbHeuteBlockDone') : r.state === 'now' ? t('nbHeuteBlockNow') : t('nbHeuteBlockOpen')}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Beschriftung des Start-Knopfs, ab 1.024 px mit dem Hinweis ⏎ (Vorschau L1). */
export function GoLabel({ label }: { label: string }) {
  const { t } = useT();
  return (
    <>
      {label}
      <kbd className="ml-2 hidden rounded-md border border-current px-1.5 text-xs font-medium opacity-70 lg:inline" aria-hidden="true" title={t('stEnter')}>
        ⏎
      </kbd>
    </>
  );
}

/**
 * ⏎ startet ab 1.024 px wie der Knopf (Vorschau L1) – nur auf Heute selbst: keine Übung darüber, kein Blatt offen, kein Feld/Knopf im Fokus
 * (dort wirkt ⏎ schon selbst).
 */
export function useEnterStart(enabled: boolean, start: () => void): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
      if (!window.matchMedia('(min-width: 1024px)').matches) return;
      const nav = useNav.getState();
      if (nav.overlay || nav.route.name !== 'today' || useSheets.getState().stack.length > 0) return;
      const a = document.activeElement;
      if (a && a !== document.body && a.closest('input, textarea, select, button, a, [contenteditable], [role="dialog"]')) return;
      e.preventDefault();
      start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, start]);
}

// ------------------------------------------------------------------ Startbild aus `app/today`

/**
 * Der EINE Zeilenname der Tageskarte (Tarek S2): Block der Einheit (`block` > 0 → `blockName`), alter Plan ohne Block → Pflichtpunkt
 * (`dutyLabel`). Echte Karte (`TodayScreen`) und Startbild nutzen dieselbe Funktion, damit Zeilen, Titel und Knopf nie auseinanderlaufen.
 */
export function dayRowName(r: { kind: string; block: number; id: string; fmt?: string | undefined }, t: T): string {
  if (r.block > 0) return blockName(r.kind as UnitBlockKind, r.block, t, r.fmt as Step3Fmt | undefined);
  return dutyLabel(r.id as DutyId, t);
}

const docRowName = (b: TodayDocBlock, t: T): string => dayRowName({ kind: b.k, block: b.bl, id: b.id, fmt: b.f }, t);

/** Titel wie `nextTitle` der echten Karte, aber aus `th` und `go` des Startbilds. */
function docTitle(doc: TodayDoc, now: TodayDocBlock | null, t: T, lang: 'de' | 'en'): string {
  if (!now) return t('hxTodayNext', { what: t('nbHeuteBlock_review') });
  const th = doc.th;
  const topic = (lang === 'en' ? th?.nm?.en : th?.nm?.de) ?? null;
  if (now.k === 'grammar' && th?.k === 'ch' && th.ch && topic) return t('hxTodayNext', { what: t('pxKNext', { n: th.ch, topic }) });
  if (now.k === 'grammar' && th?.k === 'intro' && topic) return t('hxTodayNextGrammarNew', { topic });
  return t('hxTodayNext', { what: docRowName(now, t) });
}

/**
 * Startbild (Relaunch P6, stufe1-plan §4.3): Ring, Restminuten, „x von N“, Schritte und der Knopf aus dem gültigen `app/today`, solange der Plan
 * noch berechnet wird. Gründe erscheinen erst mit der echten Karte (Platzhalter gleicher Höhe). Der Knopf startet nach dem BERECHNETEN Plan
 * (`requestStart` → wartender Start); `go` ist nur die Beschriftung.
 */
export function StartCard({ doc }: { doc: TodayDoc }) {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const blocks = todayDocBlocks(doc);
  const now = blocks.find((b) => b.id === doc.go?.id) ?? null;
  const total = blocks.length;
  const done = blocks.filter((b) => b.st === 'done').length;
  const fills = ringFills(blocks.map((b) => ({ state: b.st === 'done' ? ('done' as const) : ('open' as const), progress: b.of > 0 ? { done: b.n, total: b.of } : null })));
  const rows: DayRow[] = blocks.map((b) => ({ id: b.id, name: docRowName(b, t), why: null, whyKey: b.k, min: b.m, kind: b.k, state: b.id === now?.id ? 'now' : b.st === 'done' ? 'done' : 'open' }));
  const name = now ? docRowName(now, t) : '';
  const start = () => requestStart(api, false);
  useEffect(() => markStart('lx:button'), []);
  return (
    <section className={DAY_CARD_CLS} data-settled="" aria-labelledby="td-start-title" data-testid="start-card" data-source="doc" data-day={doc.d}>
      <div className={DAY_HEAD_CLS}>
        <span className="lx-td-ring flex flex-none">
          <DayRing fills={fills} size={112} stroke={8} label={t('nbHeuteRingLabel', { done, total })} testId="start-ring">
            <span className="flex flex-col items-center gap-0.5">
              <span className="text-2xl leading-none font-semibold tracking-tight lg:text-5xl" data-testid="start-min">
                {doc.rest ?? 0}
              </span>
              <span className="text-xs font-normal text-subtle">{t('hxTodayRingOpen')}</span>
            </span>
          </DayRing>
        </span>
        <div className={DAY_TITLE_CLS}>
          <h2 id="td-start-title" className="text-lg leading-7 font-semibold tracking-tight text-balance lg:text-2xl lg:leading-8" data-testid="start-title">
            {docTitle(doc, now, t, lang)}
          </h2>
          <span data-testid="start-status" data-done={done} data-total={total} className="lx-tnum text-xs text-muted">
            {t('nbHeuteRing', { done, total })}
          </span>
        </div>
      </div>
      <div className={DAY_LIST_CLS}>
        <DayRows rows={rows} prefix="start" />
      </div>
      <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={start} data-testid="start-go" data-duty={doc.go?.id} className={DAY_GO_CLS}>
        <GoLabel label={done > 0 && now ? t('nbHeuteContinue', { block: name }) : t('nbHeuteStart')} />
      </Button>
      <div className={DAY_FOOT_CLS} />
    </section>
  );
}

/** Platzhalter der Tageskarte: Ring, Titel, drei Schritte, Knopf unten, Fußzeile – derselbe Aufbau wie die Karte (auch quer ab 1.024 px). */
export function TodaySkeletonCard() {
  return (
    <div className={DAY_CARD_CLS} aria-hidden="true" data-testid="today-skeleton" data-settled="true">
      <div className={DAY_HEAD_CLS}>
        <div className="lx-td-ring lx-skeleton size-28 flex-none rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2 lg:col-start-2 lg:row-start-1">
          <div className="lx-skeleton h-5 w-4/5" />
          <div className="lx-skeleton h-3 w-24" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5 lg:col-start-2 lg:row-start-2">
        <div className="lx-skeleton h-[3.25rem] rounded-[0.875rem]" />
        <div className="lx-skeleton h-[3.25rem] rounded-[0.875rem]" />
        <div className="lx-skeleton h-[3.25rem] rounded-[0.875rem]" />
      </div>
      <div className={`lx-skeleton min-h-14 rounded-full ${DAY_GO_CLS}`} />
      <div className={DAY_FOOT_CLS} />
    </div>
  );
}
