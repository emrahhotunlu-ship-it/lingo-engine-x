import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button, dictLookup, getDb, getWriter, Icon, isDictWord, local, readDoc, Skeleton, useLive, useNav, useT, type MessageKey } from '../sharedUi';
import { addDays, logError, toUSText } from '../shared';
import { checkDict } from '../content';
import type { RoundReport, SessionKind } from '../domain/session';
import type { VocabAi } from '../aiPort';
import { VMOD_DAY_PATH, VMOD_USE_PATH } from '../registry';
import { makeUseAi } from './aiCheck';
import { LearnCard } from './LearnCard';
import { sitKey, UseCard } from './UseCard';
import { type DoneSummary, LearnRun, type DraftStore, type StartInfo } from './learnRun';

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
/** Übersetzer der Oberfläche (für den Lage-Text, den Claude beim Prüfen mitbekommt). */
let uiT: ((k: MessageKey) => string) | null = null;

async function readOr(path: string): Promise<Record<string, unknown> | null> {
  const db = getDb();
  if (!db) return null;
  const d = await readDoc(db, path);
  return d.status === 'valid' ? d.doc : null;
}

function createRun(ai?: VocabAi): LearnRun | null {
  const writer = getWriter();
  if (!writer) return null;
  return new LearnRun({
    deps: { writer, device: deviceId() },
    dict: checkDict(isDictWord, toUSText),
    lang: () => uiLang,
    drafts,
    readDay: () => readOr(VMOD_DAY_PATH),
    readUse: () => readOr(VMOD_USE_PATH),
    ai: ai
      ? makeUseAi(
          ai,
          (m) => {
            const k = sitKey(m);
            return k && uiT ? uiT(k) : null;
          },
          () => uiLang,
        )
      : undefined,
    now: () => Date.now(),
    meaningOf,
  });
}

/** Bestand der Live-Daten als Liste (Wörter und Wendungen), wie Runde und Vorab-Einfrieren ihn lesen. */
function liveLexDocs(): { docs: [string, Record<string, unknown>][]; profile: Record<string, unknown> | null; schema: Record<string, unknown> | null } {
  const s = useLive.getState();
  const docs: [string, Record<string, unknown>][] = [];
  for (const [id, doc] of s.collections.vocab ?? []) docs.push([`vocab/${id}`, doc]);
  for (const [id, doc] of s.collections.chunk ?? []) docs.push([`chunk/${id}`, doc]);
  return { docs, profile: s.docs['app/profile'] ?? null, schema: s.docs['app/schema'] ?? null };
}

/**
 * Tagesplan der Wörter vorab einfrieren, sobald Heute einen neuen Tagesplan anlegt (Befund ux 4b Nr. 1): Heute nennt dann dieselben Minuten
 * wie der Start der Runde. `null` = nicht möglich (kein Schreibpfad, Schalter aus, Umrechnung offen, Fehler).
 */
export async function prepareDay(): Promise<number | null> {
  if (useLive.getState().status !== 'ready') return null;
  const run = createRun();
  return run ? run.prepare(liveLexDocs()) : null;
}

function meaningOf(w: string): string | null {
  return dictLookup(w)?.senses[0]?.de ?? null;
}

/** Obere Übungsleiste (✕, Fortschritt, Pflicht/Extra): kommt vom Bereich, weil das Modul `features/learn` nicht kennt (Isolation). */
export type LearnTop = (p: { onClose: () => void; progress: { n: number; total: number } | null; ctx: 'duty' | 'extra' }) => ReactNode;

/** Rundenende und „Fertig“: kommen vom Bereich (Heute, Serie, Tageseinheit), weil das Modul `features/*` nicht kennt (Isolation). */
export type LearnHooks = { onRoundEnd?: (r: RoundReport) => void; onFinish?: () => void };

export function LearnScreen({ kind: routeKind, ai, renderTop, onRoundEnd, onFinish }: { kind: SessionKind; ai?: VocabAi; renderTop?: LearnTop } & LearnHooks) {
  const { t, lang } = useT();
  // „Noch 5“ im Abschluss startet eine neue Runde (Extra) im selben Bildschirm; ein anderer Routen-Parameter beginnt von vorn.
  const [round, setRound] = useState({ base: routeKind, kind: routeKind, n: 0 });
  if (round.base !== routeKind) setRound({ base: routeKind, kind: routeKind, n: round.n + 1 });
  const kind = round.base === routeKind ? round.kind : routeKind;
  const status = useLive((s) => s.status);
  const back = useNav((s) => s.back);
  const switchTab = useNav((s) => s.switchTab);
  useEffect(() => {
    uiLang = lang;
    uiT = (k) => t(k);
  }, [lang, t]);
  const ready = status === 'ready' && getWriter() !== null;
  // Eine Runde je Bildschirm, sobald Live-Daten und Schreibpfad bereit sind.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `round.n` erzwingt bewusst eine neue Runde
  const run = useMemo(() => (ready ? createRun(ai) : null), [ready, round.n]);

  // Start mit einer Momentaufnahme der Live-Daten (die Runde führt ihren Bestand danach selbst nach).
  useEffect(() => {
    if (!run) return;
    run.start({ kind, ...liveLexDocs() }).catch((err: unknown) => logError('vocab:learn-start', err));
  }, [run, kind]);

  // Beim Verlassen (Bildschirmwechsel, Tab im Hintergrund, Seite zu): offene Antwort sofort buchen.
  useEffect(() => {
    if (!run) return;
    const flush = () => {
      void run.leave();
    };
    // Im Hintergrund (anderes Programm am Handy) läuft eine Prüfung durch Claude weiter; nur Seite zu und Bildschirmwechsel brechen sie ab.
    const onVis = () => {
      if (document.visibilityState === 'hidden') void run.leave(false);
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

  // Rundenende genau einmal melden: beim Abschluss ganz, beim Verlassen des Bildschirms (✕, anderer Reiter) als Teilrunde.
  useEffect(() => {
    run?.onEnd(onRoundEnd ?? null);
  }, [run, onRoundEnd]);
  useEffect(() => {
    if (view.k === 'done') run?.end(false);
  }, [view, run]);
  useEffect(() => {
    if (!run) return;
    return () => run.end(true);
  }, [run]);

  const ctx = kind === 'pflicht' ? 'duty' : 'extra';
  const close = () => {
    void run?.leave();
    run?.end(true);
    back();
  };
  const frame = (progress: { n: number; total: number } | null, body: ReactNode) => (
    <div className="lx-vm-frame mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="vlearn">
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
    case 'start':
      return frame(null, <Start s={view.s} onGo={() => run?.begin()} />);
    case 'done':
      if (view.n === 0 || !view.sum) return frame(null, <Notice title={t('vmEmptyTitle')} body={t('vmEmpty')} onBack={back} back={t('vmBack')} testId="vm-done" />);
      return frame(
        null,
        <Done
          sum={view.sum}
          review={view.review + view.extra}
          onMore={() => setRound((r) => ({ ...r, kind: 'more5', n: r.n + 1 }))}
          onToday={() => (onFinish ? onFinish() : switchTab('today'))}
        />,
      );
    case 'card':
    case 'band':
      return run ? frame({ n: view.n + 1, total: view.n + view.left + 1 }, <LearnCard view={view} run={run} />) : null;
    case 'use':
      return run ? frame({ n: view.n + 1, total: view.n + view.left + 1 }, <UseCard view={view} run={run} />) : null;
  }
}

const noSub = () => () => undefined;
const LOADING = { k: 'loading' } as const;
const loadingView = () => LOADING;

const LOCALES = { de: 'de-DE', en: 'en-US' } as const;
const msOf = (day: string) => new Date(`${day}T12:00:00`).getTime();
/** Kurzer Wochentag („Mi“) bzw. Wochentag mit Datum („Fr, 6.11.“) eines Lerntags. */
const weekday = (lang: 'de' | 'en', day: string) => new Intl.DateTimeFormat(LOCALES[lang], { weekday: 'short' }).format(msOf(day)).replace(/\.$/, '');
const dayDate = (lang: 'de' | 'en', day: string) => new Intl.DateTimeFormat(LOCALES[lang], { weekday: 'short', day: 'numeric', month: 'numeric' }).format(msOf(day));

/** Text mit einem englischen Wort an der Stelle `{w}` (das Wort in der Lernsprache ausgezeichnet). */
function WithWord({ text, w }: { text: string; w: string }) {
  const [a, b = ''] = text.split('\u0000');
  return (
    <>
      {a}
      <span lang="en" className="font-medium">
        {w}
      </span>
      {b}
    </>
  );
}

/**
 * ⏎ wirkt wie der Hauptknopf (Befund ux 4b Nr. 4), auf Start und Abschluss der Runde: außer ein echtes Feld, ein Knopf oder ein Blatt hat
 * den Fokus (dort wirkt ⏎ schon selbst). Das unsichtbare Eingabefeld der Karten (`gap-input`) zählt nicht als Feld.
 */
function useEnterGo(go: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
      const a = document.activeElement;
      if (a && a !== document.body && a.getAttribute('data-testid') !== 'gap-input' && a.closest('input, textarea, select, button, a, [contenteditable], [role="dialog"]')) return;
      e.preventDefault();
      go();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);
}

/** Tastenhinweis ⏎ im Hauptknopf (nur ab Laptop-Breite sichtbar, `lx-vh-kb`). */
function EnterKey() {
  const { t } = useT();
  return (
    <kbd className="lx-vh-kb" aria-hidden="true" title={t('vmEnterKey')}>
      ⏎
    </kbd>
  );
}

/**
 * Start der Pflicht-Runde (Bild B8; nach einer Pause B11 „Willkommen zurück“): Minuten, warum diese Wörter, Mischung bzw. Verteilung des
 * Rückstands, ein Knopf. Alle Zahlen kommen aus dem eingefrorenen Tagesplan.
 */
function Start({ s, onGo }: { s: StartInfo; onGo: () => void }) {
  const { t, lang } = useT();
  useEnterGo(onGo);
  // Nur neue Wörter (nichts fällig): „3 neue Wörter“ statt „eingestreut“ (Befund ux 4b Nr. 5).
  const only = s.due + s.ahead === 0;
  const freshText = s.fresh === 1 ? t(only ? 'vmStartWhyFreshOnly1' : 'vmStartWhyFresh1') : t(only ? 'vmStartWhyFreshOnly' : 'vmStartWhyFresh', { n: s.fresh });
  const spread = s.sp ? [[s.today, s.due + s.ahead] as [string, number], ...s.sp] : null;
  const maxN = spread ? Math.max(...spread.map((x) => x[1]), 1) : 1;
  return (
    <section className="flex w-full flex-col gap-4 px-4 sm:px-0" data-testid="vm-start">
      <div className="lx-card mx-auto flex w-full max-w-xl flex-col gap-4 p-5">
        {/* „Heute“ steht schon in der Leiste darüber (Befund ux 4b Nr. 7): die Zeile nur nach einer Pause. */}
        {s.back && (
          <div className="lx-t-label text-muted" data-testid="vm-start-label">
            {t('vmStartBack')}
          </div>
        )}
        <h2 className="lx-t-title" data-testid="vm-start-title">
          {t('vmStartTitle', { min: s.min })}
        </h2>
        {spread ? (
          <>
            <p className="lx-t-body" data-testid="vm-start-why">
              <b>{t('vmStartBackDue', { n: spread.reduce((a, x) => a + x[1], 0) })}</b>{' '}
              {t('vmStartBackToday', { n: s.due + s.ahead, day: weekday(lang, spread[spread.length - 1]![0]) })}
            </p>
            <div className="flex items-end gap-3" role="img" aria-label={t('vmStartSpreadLabel')} data-testid="vm-start-spread">
              {spread.map(([d, n], i) => (
                <div key={d} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <b className="lx-t-support tabular-nums">{n}</b>
                  <i className={`block w-full rounded-md ${i === 0 ? 'bg-accent' : 'bg-surface-strong'}`} style={{ height: `${Math.round(8 + (n / maxN) * 56)}px` }} />
                  <span className="lx-t-meta text-muted">{i === 0 ? t('vmToday') : weekday(lang, d)}</span>
                </div>
              ))}
            </div>
            {s.fresh > 0 && <p className="lx-t-support text-muted">{s.fresh === 1 ? t('vmStartBackFresh1') : t('vmStartBackFresh', { n: s.fresh })}</p>}
          </>
        ) : (
          <>
            <p className="lx-t-body" data-testid="vm-start-why">
              <b>{t('vmStartWhy')}</b> {[s.due > 0 ? t('vmStartWhyDue', { n: s.due }) : null, s.ahead > 0 ? t('vmStartWhyAhead', { n: s.ahead }) : null, s.fresh > 0 ? `${freshText}${s.fewer ? ` ${t('vmStartFewer')}` : ''}` : null].filter(Boolean).join(' · ')}
            </p>
            <div className="flex flex-col gap-1.5" aria-hidden="true">
              <div className="flex h-2.5 gap-1 overflow-hidden rounded-full" data-testid="vm-start-mix">
                {s.due > 0 && <span className="bg-accent rounded-full" style={{ flex: s.due }} />}
                {s.ahead > 0 && <span className="bg-line-strong rounded-full" style={{ flex: s.ahead }} />}
                {s.fresh > 0 && <span className="bg-ok-text rounded-full" style={{ flex: s.fresh }} />}
              </div>
              <div className="lx-t-meta text-muted flex justify-between gap-2">
                {s.due > 0 && <span>{t('vmStartSegDue', { n: s.due })}</span>}
                {s.ahead > 0 && <span>{t('vmStartSegAhead', { n: s.ahead })}</span>}
                {s.fresh > 0 && <span>{t('vmStartSegFresh', { n: s.fresh })}</span>}
              </div>
            </div>
          </>
        )}
        <Button variant="primary" onClick={onGo} data-testid="vm-start-go">
          {t('vmStartGo')}
          <EnterKey />
        </Button>
      </div>
      <p className="lx-t-meta text-muted mx-auto flex max-w-xl items-start gap-2" data-testid="vm-start-lock">
        <Icon name="lock" size={14} aria-hidden="true" />
        <span>{t('vmStartLock')}</span>
      </p>
    </section>
  );
}

/**
 * Abschluss der Runde (Bild B8): Minuten und Pflicht/Extra, dann je Zeile Gelerntes, Wiederholtes, Aufgestiegenes, Gestolpertes mit nächstem
 * Termin und die Vorschau auf morgen. „Noch 5“ als ruhiger zweiter Weg, „Fertig“ zurück zu Heute. Alles ist schon gebucht.
 */
/** Namen je Tag-Gruppe im Abschluss (der Rest als „+n“). */
const SLIP_NAMES = 2;

function Done({ sum, review, onMore, onToday }: { sum: DoneSummary; review: number; onMore: () => void; onToday: () => void }) {
  const { t, lang } = useT();
  useEnterGo(onToday);
  const W = '\u0000';
  const tomorrow = addDays(sum.today, 1);
  const rows: { id: string; icon: 'plus' | 'refresh' | 'sparkle' | 'close' | 'arrowRight'; label: string; body: ReactNode }[] = [];
  if (sum.learned.length)
    rows.push({
      id: 'learned',
      icon: 'plus',
      label: t('vmDoneLearned'),
      body: (
        <>
          <b>{sum.learned.length === 1 ? t('vmDoneLearned1') : t('vmDoneLearnedN', { n: sum.learned.length })}</b>{' '}
          <span lang="en">{sum.learned.join(', ')}</span>
        </>
      ),
    });
  if (review > 0) rows.push({ id: 'review', icon: 'refresh', label: t('vmDoneRepeated'), body: <b>{review === 1 ? t('vmDoneRepeated1') : t('vmDoneRepeatedN', { n: review })}</b> });
  if (sum.up.n > 0)
    rows.push({
      id: 'up',
      icon: 'sparkle',
      label: t('vmDoneUp'),
      body: (
        <>
          <b>{sum.up.n === 1 ? t('vmDoneUp1') : t('vmDoneUpN', { n: sum.up.n })}</b>{' '}
          {sum.up.w && <WithWord w={sum.up.w} text={sum.up.produce ? t('vmDoneUpProduce', { w: W }) : t('vmDoneUpLevel', { w: W, lv: sum.up.lv })} />}
        </>
      ),
    });
  if (sum.slips.n > 0) {
    // Nach Tag gruppiert (Befund ux 4b Nr. 9): „3 kommen morgen wieder: access rights, to achieve, +1“ statt dreimal derselbe Satz.
    const groups = new Map<string, string[]>();
    for (const x of sum.slips.list) groups.set(x.day, [...(groups.get(x.day) ?? []), x.w]);
    const rest = sum.slips.n - sum.slips.list.length;
    const lines = [...groups].map(([day, ws]) => {
      const n = ws.length;
      const shown = ws.slice(0, SLIP_NAMES);
      const more = n - shown.length;
      const head = day === tomorrow ? (n === 1 ? t('vmDoneSlipTomorrow1') : t('vmDoneSlipTomorrowN', { n })) : t('vmDoneSlipOn', { n, date: dayDate(lang, day) });
      return (
        <span key={day} className="block">
          <b>{head}</b> <span lang="en">{shown.join(', ')}</span>
          {more > 0 && <>, +{more}</>}
        </span>
      );
    });
    rows.push({
      id: 'slips',
      icon: 'close',
      label: t('vmDoneSlips'),
      body: (
        <>
          {lines}
          {rest > 0 && <span className="block">{t('vmDoneMore', { n: rest })}</span>}
        </>
      ),
    });
  }
  if (sum.tomorrow)
    rows.push({ id: 'tomorrow', icon: 'arrowRight', label: t('vmDoneTomorrow'), body: <b>{t('vmDoneTomorrowLine', { min: sum.tomorrow.min, due: sum.tomorrow.due, fresh: sum.tomorrow.fresh })}</b> });
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pt-4 sm:px-0" data-testid="vm-done">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="bg-ok-soft text-ok-text flex h-14 w-14 items-center justify-center rounded-full" aria-hidden="true">
          <Icon name="check" size={28} />
        </span>
        <h2 className="lx-t-title">{t('vmDoneWords')}</h2>
        <p className="lx-t-support text-muted" data-testid="vm-done-min">
          {t(sum.duty ? 'vmDoneMinDuty' : 'vmDoneMinExtra', { min: sum.min })}
        </p>
      </div>
      <dl className="lx-card flex flex-col px-4 py-1">
        {rows.map((r, i) => (
          <div key={r.id} className={`flex items-start gap-3 py-3 ${i > 0 ? 'border-line border-t' : ''}`} data-testid={`vm-done-${r.id}`}>
            <span className="text-muted mt-0.5 shrink-0" aria-hidden="true">
              <Icon name={r.icon} size={18} />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="lx-t-label text-muted">{r.label}</dt>
              <dd className="lx-t-body">{r.body}</dd>
            </div>
          </div>
        ))}
      </dl>
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onMore} data-testid="vm-more5">
          {t('vmDoneMore5')} <span className="text-muted font-normal">· {t('vmExtra')}</span>
        </Button>
        <Button variant="primary" className="flex-1" onClick={onToday} data-testid="vm-back">
          {t('vmDoneFinish')}
          <EnterKey />
        </Button>
      </div>
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
