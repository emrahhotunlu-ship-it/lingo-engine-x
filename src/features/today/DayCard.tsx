import { useEffect, type ComponentProps, type ReactNode } from 'react';
import { useNav } from '../../app/nav';
import { useSheets } from '../../app/sheets';
import { todayDocBlocks, type TodayDoc, type TodayDocBlock } from '../../data/todayDoc';
import { ringFills } from '../../domain/metrics';
import type { DutyId, Step3Fmt } from '../../domain/plan/types';
import type { UnitBlockKind } from '../../domain/unit/types';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT, type MessageKey } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { VButton, VDot, ringSegments, type VChannel } from '../../ui/v';
import { dutyLabel } from '../learn/ui';
import { blockName } from '../unit/labels';
import { markStart } from './startPerf';
import { requestStart } from './startRun';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { normGoalMin } from '../../domain/progress/settings';
import { openSettings } from '../../app/sheets';
import { dateLabelOf } from './dateLabel';
import { useStreakWeek } from './TodayWeek';
import { useMediaQuery } from '../../platform/input';

// Die Tageskarte im Design der Vorschau (Relaunch Teil 1c, D2 V-HEUTE; Vorschau H1 screens.js:117–176, L1 desk.js:79–106).
// EIN Aufbau für die echte Karte (`TodayScreen`), das Startbild aus `app/today` (`StartCard`), das Skelett und das Start-Bild in index.html (#lx-boot):
// großer Segmentring mittig (am Laptop links), darunter Thema, „Als Nächstes“ und EIN Knopf. Antippen des Rings zeigt die Blöcke von heute
// (ohne Knöpfe: erledigt ist Zustand, Kap. 2 Nr. 2) an der Stelle von Thema und „Als Nächstes“. Die Blockliste steht immer im Dokument
// (für Screenreader über `aria-controls`), sichtbar nur auf Antippen.
// Änderungen am Aufbau immer auch in `system/HomeSkeleton.tsx` und index.html nachziehen (Test: perf.spec „Start-Bild“).

type T = (k: MessageKey, v?: Record<string, string | number>) => string;

export type DayRowState = 'done' | 'now' | 'open';

/** Eine Zeile der Karte, fertig zum Zeichnen. `why: null` = Grund noch unbekannt (Startbild). */
export type DayRow = { id: string; name: string; why: string | null; whyKey: string; min: number; kind: string; state: DayRowState };

/** Kanal eines Blocks für den Punkt der Vorschau (Wörter, Grammatik, Hören, Sprechen). Rein schmückend, der Name steht daneben. */
export function channelOf(kind: string): VChannel {
  if (kind === 'review') return 'w';
  if (kind === 'input.listen') return 'l';
  if (kind === 'pron.shadow' || kind === 'task.say' || kind === 'task.fluency' || kind === 'task.tones' || kind === 'task.objection' || kind === 'task.meeting' || kind === 'task.roleplay') return 's';
  return 'g';
}

/**
 * Der Tagesring (Vorschau `.ring`): ein Segment je Pflichtschritt, Bogenlänge nach Minuten, Füllung je Segment aus `fills`
 * (`todaySummary().fills` bzw. Startbild; nie neu gerechnet). Gleiche Geometrie und Klassen wie `VRing` (D1), aber mit Füllung je Segment,
 * weil Pflichtschritte nicht immer von vorn erledigt werden. `onToggle` macht den Ring zum Knopf für die Blockliste.
 */
export function TodayRing({
  fills,
  minutes,
  label,
  open,
  onToggle,
  controls,
  closed,
  draw,
  play,
  testId,
  children,
}: {
  fills: readonly number[];
  minutes: readonly number[];
  label: string;
  open?: boolean;
  onToggle?: () => void;
  controls?: string;
  closed?: boolean;
  draw?: boolean;
  play?: boolean;
  testId: string;
  children?: ReactNode;
}) {
  const segs = ringSegments(minutes.map((m) => ({ minutes: Math.max(1, m) })));
  const filled = fills.filter((f) => f >= 1).length;
  const svg = (
    <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      {segs.map((d, i) => {
        const f = Math.max(0, Math.min(1, fills[i] ?? 0));
        return (
          <g key={i}>
            <path className="lx-v-ring-seg lx-v-ring-trk" d={d} />
            {f >= 1 && <path className="lx-v-ring-seg lx-v-ring-on" pathLength={100} style={{ ['--d' as string]: `${i * 90}ms` }} d={d} />}
            {f > 0 && f < 1 && <path className="lx-v-ring-seg lx-v-ring-on" data-part="" pathLength={100} strokeDasharray={`${(f * 100).toFixed(1)} 100`} d={d} />}
          </g>
        );
      })}
    </svg>
  );
  return (
    <div
      className="lx-v-ringwrap"
      data-testid={testId}
      data-segments={segs.length}
      data-filled={filled}
      data-fills={fills.map((f) => Math.round(f * 100) / 100).join(',')}
      data-closed={closed ? 'true' : 'false'}
      data-play={play ? '' : undefined}
    >
      {onToggle ? (
        <button type="button" className="lx-v-ring" aria-label={label} aria-expanded={open ?? false} aria-controls={controls} onClick={onToggle} data-draw={draw ? '' : undefined}>
          {svg}
        </button>
      ) : (
        <div className="lx-v-ring" role="img" aria-label={label} data-draw={draw ? '' : undefined}>
          {svg}
        </div>
      )}
      {children != null && <div className="lx-v-ringc">{children}</div>}
    </div>
  );
}

/**
 * Blöcke von heute (Vorschau `.statelist`, nur auf Antippen des Rings): Zeichen, Kanalpunkt, Name, Minuten bzw. „läuft“. Kein Knopf.
 * Test-Kennungen wie bisher (`duties`/`duty`/`reason`; Startbild `start-…`): `data-state` done/open, der laufende mit `data-now`.
 */
export function DayBlocks({ rows, prefix, id, open }: { rows: readonly DayRow[]; prefix: 'today' | 'start'; id: string; open: boolean }) {
  const { t } = useT();
  const real = prefix === 'today';
  return (
    <ul
      id={id}
      className="lx-v-statelist lx-v-springopen lx-vh-blocks"
      aria-label={t('vRingBlocks')}
      data-testid={real ? 'duties' : 'start-duties'}
      hidden={!open}
    >
      {rows.map((r) => {
        const st = r.state === 'done' ? 'done' : r.state === 'now' ? 'run' : 'open';
        return (
          <li key={r.id} data-testid={real ? 'duty' : 'start-duty'} data-duty={r.id} data-state={r.state === 'done' ? 'done' : 'open'} data-now={r.state === 'now' ? 'true' : undefined} data-min={r.min}>
            <span className="lx-v-st" data-state={st} aria-current={st === 'run' ? 'step' : undefined}>
              <span className="lx-v-st-mk" aria-hidden="true">
                {st === 'done' && <Icon name="check" size={14} />}
              </span>
              <VDot ch={channelOf(r.kind)} />
              <span className="lx-v-st-nm">{r.name}</span>
              <span className="sr-only">
                {' · '}
                {t(st === 'done' ? 'vStepDone' : st === 'run' ? 'vStepRun' : 'vStepOpen')}
                {r.why ? ' · ' : ''}
                {r.why && (
                  <span data-testid={real ? 'reason' : undefined} data-why={r.whyKey}>
                    {r.why}
                  </span>
                )}
              </span>
              <span className="lx-v-st-sm lx-v-num" aria-hidden="true">
                {st === 'run' ? t('vStepRunMeta') : st === 'done' ? t('nbHeuteBlockDone') : t('nbHeuteMin', { min: r.min })}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ------------------------------------------------------------------ Tagesweg (UX-Neuanfang B, Vorschau `5Zwv5noCiNwzrzzfQsfzXy`)
// Emrah 02.11.2026 „Passt, so einbauen“: oben Datum und Serie, „Schritt x von n · ca. m Min.“ und der Name des nächsten Schritts als Titel;
// darunter die Karte „Dein Tag“ mit den Schritten als sichtbarem Weg (Punkt mit Nummer bzw. Häkchen, Name, Grund, Minuten – kein Knopf,
// erledigt ist Zustand, Kap. 2 Nr. 2), ein Balken „x von y Min. · Tagesziel“ und EIN Hauptknopf „Los: …“. Echte Karte, Startbild und Skelett
// teilen diesen Aufbau, damit beim Laden nichts springt.

/** Erledigte Minuten aus Zeilen und Füllung je Schritt (dieselben `fills` wie früher der Ring; nie neu gerechnet). */
export function doneMinutes(rows: readonly { min: number }[], fills: readonly number[]): number {
  return Math.round(rows.reduce((a, r, i) => a + r.min * Math.max(0, Math.min(1, fills[i] ?? 0)), 0));
}

/** Datum und Serie über dem Weg (Vorschau `.hello .row`). Das Datum ist der Lerntag (04:00, `useClock`). */
export function HelloRow({ foot = false }: { foot?: boolean }) {
  const { t, lang } = useT();
  const today = useClock((s) => s.today);
  const sw = useStreakWeek();
  // Ab 1.280 px trägt die Wochenliste rechts die Fußzeile (`today-streak`); darunter steht sie hier für Screenreader (früher im Wochenstreifen).
  const ctxWide = useMediaQuery('(min-width: 1280px)');
  return (
    <p className="lx-vh-hello-row">
      {foot && !ctxWide && sw.foot && (
        <span className="sr-only" data-testid="today-streak">
          {sw.foot}
        </span>
      )}
      <span data-testid="hello-date">{dateLabelOf(today, lang)}</span>
      {sw.streak ? (
        <span className="lx-v-num" data-testid="hello-streak" data-n={sw.streak}>
          {sw.streak === 1 ? t('vhStreak1') : t('vhStreak', { n: sw.streak })}
        </span>
      ) : null}
    </p>
  );
}

/** „Schritt x von n · ca. m Min.“ zum nächsten offenen Schritt. */
export function stepMeta(rows: readonly DayRow[], t: T): string | null {
  const i = rows.findIndex((r) => r.state === 'now');
  if (i < 0) return null;
  return t('vhStepOf', { i: i + 1, n: rows.length, min: rows[i]?.min ?? 0 });
}

/** Die Schritte als Weg (Vorschau `ol.path`). Test-Kennungen wie bisher: `duties`/`duty`/`reason` (Startbild `start-…`). */
export function DayPath({ rows, prefix }: { rows: readonly DayRow[]; prefix: 'today' | 'start' }) {
  const { t } = useT();
  const real = prefix === 'today';
  return (
    <ol className="lx-vh-path" aria-label={t('vRingBlocks')} data-testid={real ? 'duties' : 'start-duties'}>
      {rows.map((r, i) => (
        <li
          key={r.id}
          className="lx-vh-st"
          data-st={r.state}
          data-testid={real ? 'duty' : 'start-duty'}
          data-duty={r.id}
          data-state={r.state === 'done' ? 'done' : 'open'}
          data-now={r.state === 'now' ? 'true' : undefined}
          data-min={r.min}
          aria-current={r.state === 'now' ? 'step' : undefined}
        >
          <span className="lx-vh-dot lx-v-num" aria-hidden="true">
            {r.state === 'done' ? <Icon name="check" size={16} /> : i + 1}
          </span>
          <div className="lx-vh-st-b">
            <h3 className="lx-vh-st-n">
              {r.name}
              <span className="sr-only">
                {' · '}
                {t(r.state === 'done' ? 'vStepDone' : r.state === 'now' ? 'vStepRun' : 'vStepOpen')}
              </span>
            </h3>
            {r.state === 'done' ? (
              <p className="lx-vh-meta">{t('vhStepDone')}</p>
            ) : r.why ? (
              <p className="lx-vh-meta">
                <span data-testid={real ? 'reason' : undefined} data-why={r.whyKey}>
                  {r.why}
                </span>
              </p>
            ) : null}
          </div>
          <span className="lx-vh-st-min lx-v-num">{t('nbHeuteMin', { min: r.min })}</span>
        </li>
      ))}
    </ol>
  );
}

/** Balken und „x von y Min. · Tagesziel“ (Vorschau `.bar`). */
export function DayBar({ done, total }: { done: number; total: number }) {
  const { t } = useT();
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="lx-vh-prog" data-testid="day-bar" data-done={done} data-total={total}>
      <div className="lx-vh-bar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </div>
      <span className="lx-vh-meta lx-v-num">{t('vhBarLine', { done, total })}</span>
    </div>
  );
}

/** Aufbau von Kopf, Karte „Dein Tag“ und Hauptknopf – gleich für echte Karte, Startbild und Skelett. */
export function DayLayout({
  hello,
  card,
  go,
  ...rest
}: { hello: ReactNode; card: ReactNode; go: ReactNode } & Omit<ComponentProps<'div'>, 'children'>) {
  const { t } = useT();
  return (
    <div className="lx-vh-today" {...rest}>
      <header className="lx-vh-hello">{hello}</header>
      <section className="lx-v-card lx-vh-pathcard" aria-label={t('vhDayCard')}>
        {card}
      </section>
      <div className="lx-vh-go">{go}</div>
    </div>
  );
}

/** „Tagesziel x Min. ändern“ (Vorschau): öffnet die Einstellungen (Lernen › Tagesziel steht oben). */
export function GoalLink() {
  const { t } = useT();
  const profile = useLive((s) => s.docs['app/profile']);
  const min = normGoalMin((profile as { goalMin?: unknown } | undefined)?.goalMin);
  return (
    <button type="button" className="lx-vh-link lx-vh-goal" onClick={openSettings} data-testid="today-goal-change">
      {t('vhGoalChange', { min })}
    </button>
  );
}

/** „Als Nächstes: Grammatik · <em>Thema</em>“ mit Kanalpunkt (Vorschau `.nextl`). */
export function NextLine({ now, testId }: { now: DayRow | null; testId?: string }) {
  const { t } = useT();
  if (!now) return null;
  return (
    <p className="lx-vh-next" data-testid={testId}>
      <VDot ch={channelOf(now.kind)} />
      <span>
        {t('vhNext', { what: now.name })}
        {now.why ? (
          <>
            {' · '}
            <em>{now.why}</em>
          </>
        ) : null}
      </span>
    </p>
  );
}

/** Beschriftung des Start-Knopfs, ab 1.024 px mit dem Hinweis ⏎ (Vorschau L1). */
export function GoLabel({ label }: { label: string }) {
  const { t } = useT();
  return (
    <>
      {label}
      <kbd className="lx-vh-kb" aria-hidden="true" title={t('stEnter')}>
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

/**
 * Der EINE Zeilenname der Tageskarte (Tarek S2): Block der Einheit (`block` > 0 → `blockName`), alter Plan ohne Block → Pflichtpunkt
 * (`dutyLabel`). Echte Karte (`TodayScreen`) und Startbild nutzen dieselbe Funktion, damit Zeilen, Titel und Knopf nie auseinanderlaufen.
 */
export function dayRowName(r: { kind: string; block: number; id: string; fmt?: string | undefined }, t: T): string {
  if (r.block > 0) return blockName(r.kind as UnitBlockKind, r.block, t, r.fmt as Step3Fmt | undefined);
  return dutyLabel(r.id as DutyId, t);
}

/** Rahmen der Tageskarte (Vorschau `.daycard`): Ring, rechts bzw. darunter der Inhalt. Gleiche Klassen für Start-Bild, Skelett und Karte. */
export function DayCardFrame({ ring, children, className, ...rest }: { ring: ReactNode; children: ReactNode } & Omit<ComponentProps<'section'>, 'children'>) {
  return (
    <section className={`lx-v-card lx-vh-day${className ? ` ${className}` : ''}`} data-raised="" {...rest}>
      <div className="lx-vh-day-ring">{ring}</div>
      <div className="lx-vh-day-main">{children}</div>
    </section>
  );
}

// ------------------------------------------------------------------ Startbild aus `app/today`

const docRowName = (b: TodayDocBlock, t: T): string => dayRowName({ kind: b.k, block: b.bl, id: b.id, fmt: b.f }, t);

/**
 * Startbild (Relaunch P6, stufe1-plan §4.3): Ring, Restminuten, Thema, „Als Nächstes“ und der Knopf aus dem gültigen `app/today`, solange der Plan
 * noch berechnet wird. Gründe erscheinen erst mit der echten Karte. Der Knopf startet nach dem BERECHNETEN Plan (`requestStart` → wartender Start).
 */
export function StartCard({ doc }: { doc: TodayDoc }) {
  const { t } = useT();
  const api = useHiddenInput();
  const blocks = todayDocBlocks(doc);
  const now = blocks.find((b) => b.id === doc.go?.id) ?? null;
  const total = blocks.length;
  const done = blocks.filter((b) => b.st === 'done').length;
  const fills = ringFills(blocks.map((b) => ({ state: b.st === 'done' ? ('done' as const) : ('open' as const), progress: b.of > 0 ? { done: b.n, total: b.of } : null })));
  const rows: DayRow[] = blocks.map((b) => ({ id: b.id, name: docRowName(b, t), why: null, whyKey: b.k, min: b.m, kind: b.k, state: b.id === now?.id ? 'now' : b.st === 'done' ? 'done' : 'open' }));
  const nowRow = rows.find((r) => r.state === 'now') ?? null;
  const started = done > 0 || fills.some((f) => f > 0);
  const start = () => requestStart(api, false);
  const sum = rows.reduce((a, r) => a + r.min, 0);
  useEffect(() => markStart('lx:button'), []);
  return (
    <DayLayout
      data-testid="start-card"
      data-source="doc"
      data-day={doc.d}
      data-rest={doc.rest ?? 0}
      aria-labelledby="td-start-title"
      hello={
        <>
          <HelloRow />
          <p className="lx-vh-meta">{stepMeta(rows, t)}</p>
          <h2 id="td-start-title" className="lx-vh-t" data-testid="start-title">
            {nowRow?.name ?? t('vhDayTitle')}
          </h2>
          <span data-testid="start-status" data-done={done} data-total={total} className="sr-only">
            {t('nbHeuteRing', { done, total })}
          </span>
          <span hidden data-testid="start-min">
            {doc.rest ?? 0}
          </span>
        </>
      }
      card={
        <>
          <DayPath rows={rows} prefix="start" />
          <DayBar done={doneMinutes(rows, fills)} total={sum} />
        </>
      }
      go={
        <VButton variant="pri" full onClick={start} data-testid="start-go" data-duty={doc.go?.id}>
          <GoLabel label={nowRow ? t(started ? 'vhContinueStep' : 'vhGoStep', { what: nowRow.name }) : started ? t('vhContinue') : t('vhGo')} />
        </VButton>
      }
    />
  );
}

/** Platzhalter von Heute (Vorschau-Aufbau): Datumszeile, Titel, drei Schritte, Balken, Knopf – derselbe Aufbau wie die Karte. */
export function TodaySkeletonCard() {
  return (
    <DayLayout
      aria-hidden="true"
      data-testid="today-skeleton"
      data-settled="true"
      hello={
        <>
          <div className="lx-v-sk lx-vh-sk-row" />
          <div className="lx-v-sk lx-vh-sk-meta" />
          <div className="lx-v-sk lx-vh-sk-t" />
        </>
      }
      card={
        <>
          <div className="lx-vh-path">
            {[0, 1, 2].map((i) => (
              <div key={i} className="lx-vh-st" data-st="open">
                <div className="lx-v-sk lx-vh-dot" data-round="" />
                <div className="lx-vh-st-b">
                  <div className="lx-v-sk lx-vh-sk-n" />
                  <div className="lx-v-sk lx-vh-sk-s" />
                </div>
              </div>
            ))}
          </div>
          <div className="lx-vh-prog">
            <div className="lx-vh-bar" />
            <div className="lx-v-sk lx-vh-sk-s" />
          </div>
        </>
      }
      go={<div className="lx-v-sk lx-vh-sk-go" />}
    />
  );
}
