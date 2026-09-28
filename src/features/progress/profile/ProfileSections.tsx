import { useEffect, useMemo, type ReactNode } from 'react';
import { useClock } from '../../../app/clock';
import { useNav } from '../../../app/nav';
import { closeSheet, openSheet } from '../../../app/sheets';
import { useLive } from '../../../data/live';
import { readAssess } from '../../../domain/assessment/envelope';
import { lastVtest } from '../../../domain/assessment/sources';
import { checkDoneThisWeek, compareLast, readChecks } from '../../../domain/check/record';
import { dayKey, dayKeyNoon } from '../../../domain/date';
import { firstSentence, streakView, type DotState } from '../../../domain/progress/weekDots';
import { useT, type MessageKey } from '../../../i18n';
import { useCapabilities } from '../../../platform/capabilities';
import { Icon, type IconName } from '../../../ui/Icon';
import { useLateRescue } from '../../migration/lateRescue';
import type { ProgressTab } from '../ProgressScreen';

// Profil-Blatt (plan.md §1.2, N90; Optik wie docs/prototyp/v1.html „profileSheet“): Abschnitte auf
// dem Platz `profile`, die der Blatt-Host (WP0b) von oben nach unten zeichnet.
//   Kopf    Serie · Wochenstreifen (Pflicht · nur Extra · Ruhetag · offen) · Urteil in einem Satz
//   Stand   Urteil › · Fehler › · Ziel C1 › · Statistik › · Verlauf › (Seite „Dein Stand“ direkt dort)
//   Tests   Wochen-Check › · Wortschatztest ›
//   Mehr    Wochenbericht › · Einstellungen ›
//   Zeile „Aus diesem Browser nachtragen“, nur wenn nötig.
// Jede Zeile ist 1 Tipp ab dem Blatt, das Blatt 1 Tipp ab jeder Reiter-Wurzel (Ortsregel 1.4).

type Doc = Record<string, unknown>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const EMPTY = new Map<string, Doc>();

/** Blatt schließen und dann weiter (die Herkunft bleibt der Reiter darunter). */
function leave(run: () => void): void {
  closeSheet('profile');
  run();
}

export function ProfileRow({ icon, title, sub, onClick, testId, trailing }: { icon: IconName; title: string; sub?: ReactNode; onClick: () => void; testId: string; trailing?: ReactNode }) {
  return (
    <li>
      <button type="button" onClick={onClick} data-testid={testId} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-strong">
        <span className="inline-flex size-9 flex-none items-center justify-center rounded-xl bg-surface-strong text-muted" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{title}</span>
          {sub && <span className="lx-tnum text-sm text-muted">{sub}</span>}
        </span>
        {trailing}
        <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
      </button>
    </li>
  );
}

export function ProfileGroup({ title, testId, children }: { title?: string; testId: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2" aria-label={title} data-testid={testId}>
      {title && <h2 className="lx-eyebrow px-1">{title}</h2>}
      <ul className="lx-glass flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)]">{children}</ul>
    </section>
  );
}

const DOT_CLASS: Record<DotState, string> = {
  done: 'border-accent bg-accent text-accent-fg',
  extra: 'border-accent bg-accent-soft',
  rest: 'border-dashed border-subtle',
  open: 'border-subtle',
  future: 'border-dotted border-line',
};

/** Ein Tagespunkt: nie nur Farbe – Füllung, Rand (gestrichelt/gepunktet) und Häkchen unterscheiden. */
function Dot({ state, today, small }: { state: DotState; today?: boolean; small?: boolean }) {
  return (
    <span
      className={`inline-flex flex-none items-center justify-center rounded-full border-2 ${small ? 'size-3' : 'size-6'} ${DOT_CLASS[state]} ${today ? 'ring-2 ring-accent-text ring-offset-2 ring-offset-bg' : ''}`}
      data-dot={state}
      aria-hidden="true"
    >
      {!small && state === 'done' && <Icon name="check" size={12} />}
    </span>
  );
}

const DOT_LABEL: Record<DotState, MessageKey> = { done: 'nbProfilDotDone', extra: 'nbProfilDotExtra', rest: 'nbProfilDotRest', open: 'nbProfilDotOpen', future: 'nbProfilDotFuture' };

/** Kopf: Serie, sieben Punkte Mo–So, Urteil in einem Satz (Tipp → Stand/Urteil). */
export function ProfileHead() {
  const { t, tn, num, lang } = useT();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const profile = useLive((s) => s.docs['app/profile']);
  const schema = useLive((s) => s.docs['app/schema']);
  const assessDoc = useLive((s) => s.docs['app/assess']);
  const archive = useLive((s) => s.collections.archive) ?? EMPTY;
  const view = useMemo(() => streakView({ nowMs: now, profile, schema, archives: archive.values() }), [now, profile, schema, archive]);
  const judge = useMemo(() => {
    const a = readAssess(assessDoc);
    if (!a) return null;
    const sentence = a.lang === lang ? firstSentence(a.data.level) : '';
    return { cefr: a.data.cefr, sentence };
  }, [assessDoc, lang]);
  const fmt = useMemo(() => {
    const short = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { weekday: 'narrow' });
    const long = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { weekday: 'long' });
    return { short: (d: string) => short.format(dayKeyNoon(d)), long: (d: string) => long.format(dayKeyNoon(d)) };
  }, [lang]);
  const restFree = !view.dots.some((d) => d.dot === 'rest');
  const count = view.streak.count;

  return (
    <section className="lx-glass flex flex-col gap-4 rounded-[var(--radius-card)] p-4" aria-label={t('nbProfilHeadLabel')} data-testid="profile-head">
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-baseline gap-2">
          <span className="lx-tnum text-3xl font-semibold tracking-tight" data-testid="profile-streak" data-count={count}>
            {num(count)}
          </span>
          <span className="text-sm text-muted">{tn('nbProfilStreak', count)}</span>
        </p>
        <p className="text-xs text-muted" data-testid="profile-rest">
          {restFree ? t('nbProfilRestFree') : t('nbProfilRestUsed')}
        </p>
      </div>
      <ol className="grid grid-cols-7 gap-1" aria-label={t('wkTitle')} data-testid="profile-week">
        {view.dots.map((d) => {
          const label = `${fmt.long(d.day)}: ${t(DOT_LABEL[d.dot])}`;
          return (
            <li key={d.day} className="flex flex-col items-center gap-1" data-testid="profile-dot" data-day={d.day} data-dot={d.dot} data-today={d.today ? '' : undefined} title={label}>
              <span className="sr-only">{label}</span>
              <Dot state={d.dot} today={d.today} />
              <span className={`text-2xs ${d.today ? 'font-semibold text-fg' : 'text-muted'}`} aria-hidden="true">
                {fmt.short(d.day)}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-2xs text-muted" aria-hidden="true">
        {(['done', 'extra', 'rest', 'open'] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <Dot state={s} small />
            {t(DOT_LABEL[s])}
          </span>
        ))}
      </p>
      <button
        type="button"
        onClick={() => leave(() => go({ name: 'overview', tab: 'judge' }))}
        className="flex min-h-11 w-full items-start gap-3 rounded-xl border-t border-line pt-3 text-left"
        data-testid="profile-judge-line"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="lx-eyebrow">{t('nbProfilJudgeEyebrow')}</span>
          <span className="text-sm">
            {judge?.sentence ? judge.sentence : judge?.cefr ? t('nbProfilJudgeLevel', { level: judge.cefr }) : t('nbProfilJudgeNone')}
          </span>
        </span>
        <Icon name="arrowRight" size={18} className="mt-4 flex-none text-subtle" />
      </button>
    </section>
  );
}

const STAND_ROWS: ReadonlyArray<{ tab: ProgressTab; icon: IconName; label: MessageKey; sub: MessageKey }> = [
  { tab: 'judge', icon: 'sparkle', label: 'progJudge', sub: 'nbProfilSubJudge' },
  { tab: 'errors', icon: 'alert', label: 'progErrors', sub: 'nbProfilSubErrors' },
  { tab: 'path', icon: 'target', label: 'progPath', sub: 'nbProfilSubPath' },
  { tab: 'stats', icon: 'chart', label: 'nbProfilTabStats', sub: 'nbProfilSubStats' },
  { tab: 'history', icon: 'history', label: 'progHistory', sub: 'nbProfilSubHistory' },
];

/** Stand: jede Zeile öffnet „Dein Stand“ direkt auf ihrem Reiter. */
export function ProfileStandRows() {
  const { t } = useT();
  const go = useNav((s) => s.go);
  return (
    <ProfileGroup title={t('nbProfilGroupStand')} testId="profile-stand">
      {STAND_ROWS.map((r) => (
        <ProfileRow key={r.tab} icon={r.icon} title={t(r.label)} sub={t(r.sub)} testId={`profile-${r.tab}`} onClick={() => leave(() => go({ name: 'overview', tab: r.tab }))} />
      ))}
    </ProfileGroup>
  );
}

/** Tests: Wochen-Check (Seite mit bisherigen Checks) und Wortschatztest (Übung mit Einstieg). */
export function ProfileTestRows() {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const today = useClock((s) => s.today);
  const profile = useLive((s) => s.docs['app/profile']);
  const checks = useMemo(() => readChecks(profile), [profile]);
  const cmp = compareLast(checks);
  const doneWeek = checkDoneThisWeek(checks, today, dayKey);
  const vt = lastVtest(obj(profile));
  const checkSub = doneWeek ? t('nbProfilCheckDone', { pct: cmp?.pct ?? 0 }) : cmp ? t('nbProfilCheckLast', { pct: cmp.pct }) : t('nbProfilCheckNever');
  const vtSub = vt ? t('nbProfilVtestLast', { p: vt.passive }) : t('vtestNever');
  return (
    <ProfileGroup title={t('nbProfilGroupTests')} testId="profile-tests">
      <ProfileRow icon="target" title={t('ckTitle')} sub={checkSub} testId="profile-check" onClick={() => leave(() => go({ name: 'checks' }))} />
      <ProfileRow icon="cards" title={t('vtestTitle')} sub={vtSub} testId="profile-vtest" onClick={() => leave(() => go({ name: 'vtest' }))} />
    </ProfileGroup>
  );
}

/** Wochenbericht und Einstellungen (Einstellungen legt sich als zweites Blatt darüber). */
export function ProfileMoreRows() {
  const { t } = useT();
  const go = useNav((s) => s.go);
  return (
    <ProfileGroup testId="profile-more">
      <ProfileRow icon="book" title={t('nbProfilWeekly')} sub={t('nbProfilWeeklySub')} testId="profile-weekly" onClick={() => leave(() => go({ name: 'weekly' }))} />
      <ProfileRow icon="gear" title={t('settings')} sub={t('nbProfilSettingsSub')} testId="profile-settings" onClick={() => openSheet('settings')} />
    </ProfileGroup>
  );
}

/** „Aus diesem Browser nachtragen“ – nur, wenn dieser Browser noch Kopien der alten App hat (A4). */
export function ProfileRescueRow() {
  const { t, tn } = useT();
  const go = useNav((s) => s.go);
  const db = useCapabilities((s) => s.db);
  const state = useLateRescue();
  const { check } = state;
  useEffect(() => {
    if (db === 'ready') void check();
  }, [db, check]);
  if (state.phase !== 'pending' && state.phase !== 'failed') return null;
  const n = state.items.length + state.notes.length;
  return (
    <ProfileGroup testId="profile-rescue">
      <ProfileRow icon="download" title={t('nbProfilRescue')} sub={tn('lateTodayHint', n)} testId="profile-rescue-row" onClick={() => leave(() => go({ name: 'overview', tab: 'history' }))} />
    </ProfileGroup>
  );
}
