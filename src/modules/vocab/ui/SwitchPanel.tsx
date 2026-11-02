import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, getWriter, Icon, Segmented, toast, useLive, useT, type MessageKey } from '../sharedUi';
import { logError, logWarn } from '../shared';
import * as sw from './switch';
import type { SwitchRead } from './switch';

// Einstellungen › Wortschatz: „Neue Wörter-App einschalten“ (docs/umbau/vokabeln/plan.md §9.3/9.4). Nachgeladen (eigene Teil-Datei).
// Ablauf: Probelauf (volles Lesen, nichts wird geschrieben) → Sicherung (Datei, nur auf Klick) → Übernehmen und einschalten → Rückweg.
// Nie automatisch wiederholt. Volles Lesen und Sicherung kommen von außen (Einstellungen kennt Datenbank-Lesen und Export; das Modul nicht).

type State = sw.SwitchState;
type Summary = sw.SwitchSummary;
/** Ergebnis des Speicherns (wie platform/downloads). Erst „saved“ zählt als Sicherung. */
export type SaveOutcome = 'saved' | 'declined' | 'unavailable' | 'busy' | 'error';
export type SwitchPorts = {
  /** Volles Lesen der Datenbank (wie die Sicherung). Wirft bei Lesefehlern. */
  read: () => Promise<SwitchRead>;
  /** Sicherung als Datei (nur auf Klick, frisch gelesen). */
  backup: () => Promise<SaveOutcome>;
};
type Pair = readonly [string, string];
type Note = { key: MessageKey; retry?: boolean } | null;
type Doc = Record<string, unknown>;

const SHOW_SKIPPED = 12;
const BLOCK_KEY: Record<string, MessageKey> = {
  profile_invalid: 'vmSwLockProfile',
  possibly_truncated: 'vmSwLockTruncated',
  no_backup: 'vmSwBackupNeeded',
  not_migrated: 'vmSwNotMigrated',
};
const SKIP_KEY: Record<string, MessageKey> = { invalid: 'vmSwWhyInvalid', hidden: 'vmSwWhyHidden', done: 'vmSwWhyDone', future_lex: 'vmSwWhyFuture', future_fsrs: 'vmSwWhyFuture' };
const DUP_KEY: Record<string, MessageKey> = { british: 'vmSwDupBritish', article: 'vmSwDupArticle', placeholder: 'vmSwDupPlaceholder' };
const SHOW_DUPES = 8;
const SAVE_KEY: Record<SaveOutcome, MessageKey> = { saved: 'exportSaved', declined: 'exportDeclined', unavailable: 'exportUnavailable', busy: 'exportBusy', error: 'exportFailed' };

async function readAll(read: SwitchPorts['read']): Promise<{ st: State; raw: ReadonlyMap<string, Doc> }> {
  const snap = await read();
  return { st: sw.fromRead(snap, Date.now()), raw: snap.raw };
}

const headOf = (raw: ReadonlyMap<string, Doc>, path: string): string => {
  const d = raw.get(path);
  const h = d ? (path.startsWith('chunk/') ? d.en : d.word) : undefined;
  return typeof h === 'string' && h.trim() ? h : path.slice(path.indexOf('/') + 1);
};

/** Feste Zustandszeile mit Erledigt-Häkchen (Erledigt = Indigo, kompass.md §2). */
function Done({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <p className="lx-reveal-in m-0 inline-flex items-center gap-2 self-start rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-accent-text" role="status" data-testid={testId}>
      <Icon name="check" size={16} />
      {children}
    </p>
  );
}

/** Nach dem Umschalten den Abschnittsanfang ins Bild holen (sonst stünden fremde Einstellungen da); bei reduzierter Bewegung ohne Gleiten. */
function jumpTo(el: HTMLElement | null): void {
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

export function SwitchPanel({ on, read, backup: saveBackup, children }: { on: boolean; children?: ReactNode } & SwitchPorts) {
  const { t, tn } = useT();
  const done = useLive((s) => {
    const m = s.docs['app/schema']?.vocabModule as { state?: unknown } | undefined;
    return m?.state === 'done';
  });
  const [phase, setPhase] = useState<'idle' | 'reading' | 'readFailed' | 'review' | 'running'>('idle');
  const [data, setData] = useState<{ st: State; raw: ReadonlyMap<string, Doc> } | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [backup, setBackup] = useState<SaveOutcome | null>(null);
  const [note, setNote] = useState<Note>(null);
  const ref = useRef<HTMLElement>(null);
  // Nach Erfolg: sobald der Schalter so steht (Live-Daten), einmal zum Abschnittsanfang.
  const want = useRef<boolean | null>(null);
  useEffect(() => {
    if (want.current === null || want.current !== on) return;
    want.current = null;
    jumpTo(ref.current);
  }, [on, phase]);

  const view = useMemo(() => (data ? sw.preview(data.st.input, pairs, data.st.skipped).summary : null), [data, pairs]);

  /** Nach dem Einschalten: Häkchen-Zeile oben im Abschnitt; nur Nachgetragenes als EINE Meldung. */
  const switchedOn = (caught: sw.CatchUpResult | undefined) => {
    want.current = true;
    const msg = [caught?.docs ? tn('vmSwCaught', caught.docs) : '', caught?.incomplete.length ? tn('vmSwGap', caught.incomplete.length) : ''].filter(Boolean).join(' ');
    if (msg) toast(msg);
  };

  const dry = async () => {
    setPhase('reading');
    setNote(null);
    try {
      const r = await readAll(read);
      setData(r);
      setPairs([]);
      const s = sw.preview(r.st.input, [], r.st.skipped).summary;
      // Bericht auch ins Diagnose-Protokoll (Einstellungen › Diagnose).
      logWarn('vocab:switch', { message: 'Probelauf' }, sw.summaryText(s, []));
      setPhase('review');
    } catch (err) {
      logError('vocab:switch', err, 'Probelauf lesen');
      setPhase('readFailed');
    }
  };

  const save = async () => {
    // Frisch gelesen (nicht der Stand des Probelaufs), damit die Datei alles bis jetzt enthält. Erst „gespeichert“ zählt als Sicherung.
    const out = await saveBackup();
    setBackup(out);
    if (out !== 'saved') logWarn('vocab:switch', { message: 'Sicherung nicht gespeichert' }, out);
  };

  /** Übernehmen und einschalten: frisch lesen (Wächter aus diesem Lesen), bestätigte Doppel nur, wenn beide Karten noch da sind. */
  const apply = async () => {
    const writer = getWriter();
    if (!writer || backup !== 'saved') return;
    setPhase('running');
    setNote(null);
    try {
      const { st, raw } = await readAll(read);
      const keep = pairs.filter(([l, o]) => st.input.docs.has(l) && st.input.docs.has(o));
      logWarn('vocab:switch', { message: 'Übernehmen' }, sw.summaryText(sw.preview(st.input, keep, st.skipped).summary, keep));
      const r = await sw.enableModule(writer, { ...st.input, confirmedPairs: keep }, {
        confirmed: true,
        backupWritten: true,
        profileValid: st.profileValid,
        possiblyTruncated: st.truncated,
        holder: sw.lockHolder(),
      });
      setData({ st, raw });
      setPairs(keep);
      if (r.state === 'done' || r.state === 'already') {
        setNote(null);
        switchedOn(r.caught);
        setPhase('review');
        return;
      }
      setPhase('review');
      logWarn('vocab:switch', { message: `Nicht eingeschaltet: ${r.state}` }, r.why ?? '');
      if (r.state === 'busy') setNote({ key: 'vmSwBusy' });
      else if (r.state === 'partial') setNote({ key: 'vmSwPartialNote', retry: true });
      else if (r.state === 'switch_failed') setNote({ key: 'vmSwSwitchFailed' });
      else setNote({ key: BLOCK_KEY[r.why ?? ''] ?? 'vmSwError' });
    } catch (err) {
      logError('vocab:switch', err, 'Übernehmen');
      setPhase('review');
      setNote({ key: 'vmSwError' });
    }
  };

  /** Wieder einschalten ohne neue Umrechnung: frisch lesen, Antworten aus der Zwischenzeit nachholen, dann mod = 1. */
  const reenable = async () => {
    const writer = getWriter();
    if (!writer) return;
    setPhase('running');
    setNote(null);
    try {
      const { st } = await readAll(read);
      const r = await sw.reenableModule(writer, st.input, { schema: st.schema, profileValid: st.profileValid, possiblyTruncated: st.truncated });
      if (r.state === 'done') {
        switchedOn(r.caught);
        setPhase('idle');
        return;
      }
      setPhase('idle');
      logWarn('vocab:switch', { message: `Nicht wieder eingeschaltet: ${r.state}` }, r.why ?? '');
      setNote({ key: r.state === 'switch_failed' ? 'vmSwSwitchFailed' : (BLOCK_KEY[r.why ?? ''] ?? 'vmSwError') });
    } catch (err) {
      logError('vocab:switch', err, 'Wieder einschalten');
      setPhase('idle');
      setNote({ key: 'vmSwError' });
    }
  };

  const back = async () => {
    const writer = getWriter();
    if (!writer) return;
    setPhase('running');
    setNote(null);
    try {
      const ok = await sw.setModuleSwitch(writer, 0);
      if (ok) want.current = false;
      else setNote({ key: 'vmSwError' });
      setPhase('idle');
    } catch (err) {
      logError('vocab:switch', err, 'Rückweg');
      setPhase('idle');
      setNote({ key: 'vmSwError' });
    }
  };

  const busy = phase === 'running';
  const noteEl = note && (
    <div className="lx-reveal-in flex flex-col gap-2 rounded-lg border border-line p-3" role="status" data-testid="vsw-note">
      <p className="m-0 text-sm">{t(note.key)}</p>
      {note.retry && (
        <div>
          <Button variant="secondary" onClick={() => void apply()} disabled={busy} data-testid="vsw-continue">
            {t('vmSwContinue')}
          </Button>
        </div>
      )}
    </div>
  );

  // Eigene Karte, abgesetzt von den Einstellungen der alten Ansicht darunter; der Anfang ist das Sprungziel nach dem Umschalten.
  const card = (testId: string, inner: ReactNode) => (
    <section ref={ref} className="lx-card flex scroll-mt-4 flex-col gap-3 p-4" data-testid={testId}>
      <h3 className="m-0 text-base font-semibold">{t('vmSwTitle')}</h3>
      {inner}
    </section>
  );

  // Eingeschaltet: Zustand oben, die Einstellungen der Wörter-App, darunter der Rückweg.
  if (on) {
    return card(
      'vsw-on',
      <>
        <Done testId="vsw-state">{t('vmSwOnState')}</Done>
        <p className="m-0 text-sm text-muted">{t('vmSwOnHint')}</p>
        {children}
        <div className="flex flex-col gap-2 border-t border-line pt-3" data-testid="vsw-back">
          <p className="m-0 text-sm text-muted">{t('vmSwBackHint')}</p>
          <div>
            <Button variant="secondary" onClick={() => void back()} busy={busy} data-testid="vsw-back-btn">
              {t('vmSwBack')}
            </Button>
          </div>
          {noteEl}
        </div>
      </>,
    );
  }

  // Schon umgestellt, aber zurückgeschaltet: wieder einschalten ohne neue Umrechnung (Zweitknopf, kein zweiter Hauptknopf im Blatt).
  if (done) {
    return card(
      'vsw',
      <>
        <Done testId="vsw-state">{t('vmSwOffState')}</Done>
        <p className="m-0 text-sm text-muted">{t('vmSwOffHint')}</p>
        <div>
          <Button variant="secondary" onClick={() => void reenable()} busy={busy} busyLabel={t('vmSwApplying')} data-testid="vsw-reenable">
            {t('vmSwReenable')}
          </Button>
        </div>
        {noteEl}
      </>,
    );
  }

  const st = data?.st;
  const locked = st ? (!st.profileValid ? 'vmSwLockProfile' : st.truncated ? 'vmSwLockTruncated' : null) : null;
  const confirmed = new Set(pairs.map(([l, o]) => `${l}|${o}`));
  const togglePair = (lead: string, other: string, merge: boolean) =>
    setPairs((cur) => (merge ? [...cur.filter(([l, o]) => !(l === lead && o === other)), [lead, other] as const] : cur.filter(([l, o]) => !(l === lead && o === other))));
  const saved = backup === 'saved';

  return card(
    'vsw',
    <>
      <p className="m-0 text-sm text-muted">{t('vmSwIntro')}</p>
      {phase !== 'review' && phase !== 'running' && (
        <div>
          <Button variant="secondary" onClick={() => void dry()} busy={phase === 'reading'} busyLabel={t('vmSwReading')} data-testid="vsw-dry">
            {phase === 'readFailed' ? t('vmSwRetry') : t('vmSwDry')}
          </Button>
        </div>
      )}
      {phase === 'readFailed' && (
        <p className="m-0 text-sm" role="status" data-testid="vsw-read-failed">
          {t('vmSwReadFailed')}
        </p>
      )}
      {view && data && (phase === 'review' || phase === 'running') && (
        <Report view={view} raw={data.raw} confirmed={confirmed} onPair={togglePair} disabled={busy} />
      )}
      {view && (phase === 'review' || phase === 'running') && (
        <>
          {locked ? (
            <p className="m-0 rounded-lg border border-line p-3 text-sm" role="status" data-testid="vsw-locked">
              {t(locked)}
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                <p className="m-0 text-sm font-medium">{t('vmSwStep1')}</p>
                {saved ? (
                  <>
                    <Done testId="vsw-backup-state">{t('exportSaved')}</Done>
                    <div>
                      <Button variant="ghost" onClick={() => void save()} disabled={busy} data-testid="vsw-backup-again">
                        {t('vmSwBackupAgain')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="m-0 text-sm text-muted">{t('vmSwStep1Hint')}</p>
                    <div>
                      <Button variant={backup === 'unavailable' ? 'secondary' : 'primary'} onClick={() => void save()} disabled={busy} data-testid="vsw-backup">
                        {t('vmSwBackup')}
                      </Button>
                    </div>
                    {backup && (
                      <p className="lx-reveal-in m-0 text-sm" role="status" data-testid="vsw-backup-state">
                        {t(SAVE_KEY[backup])} {t(backup === 'unavailable' ? 'vmSwBackupElsewhere' : 'vmSwBackupNeeded')}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                <p className="m-0 text-sm font-medium">{t('vmSwStep2')}</p>
                <p className="m-0 text-sm text-muted">{t('vmSwApplyHint')}</p>
                <div>
                  <Button variant="primary" onClick={() => void apply()} disabled={!saved} busy={busy} busyLabel={t('vmSwApplying')} data-testid="vsw-apply">
                    {t('vmSwApply')}
                  </Button>
                </div>
                {backup === null && !note && <p className="m-0 text-sm text-muted">{t('vmSwBackupNeeded')}</p>}
              </div>
            </>
          )}
          {noteEl}
        </>
      )}
    </>,
  );
}

function Report({ view, raw, confirmed, onPair, disabled }: { view: Summary; raw: ReadonlyMap<string, Doc>; confirmed: ReadonlySet<string>; onPair: (lead: string, other: string, merge: boolean) => void; disabled: boolean }) {
  const { t, tn, num } = useT();
  const [allDupes, setAllDupes] = useState(false);
  // Gleiche Reihenfolge und Begriffe wie Fortschritt › Wörter (Overview: Bildest du selbst, Auf dem Weg, Erkennst du, Noch nicht begonnen).
  const groups: [MessageKey, number, string][] = [
    ['vmOvProduce', view.produce, 'produce'],
    ['vmOvOnway', view.onway, 'onway'],
    ['vmOvRecognize', view.recognize, 'recognize'],
    ['vmOvFresh', view.fresh, 'fresh'],
  ];
  // Wählbar ist nur „gleiches Wort“; Ähnliches (britisch, Artikel, „jemanden/etwas“) steht nur als Hinweis da (plan.md §9.2).
  const dupes = [...view.dupes.filter((d) => d.kind === 'propose'), ...view.dupes.filter((d) => d.kind !== 'propose')];
  const shown = allDupes ? dupes : dupes.slice(0, SHOW_DUPES);
  const same = shown.filter((d) => d.kind === 'propose');
  const like = shown.filter((d) => d.kind !== 'propose');
  return (
    <div className="lx-reveal-in flex flex-col gap-3 rounded-lg border border-line p-3" data-testid="vsw-report">
      <p className="m-0 text-sm font-medium">{t('vmSwReportTitle')}</p>
      <p className="m-0 flex flex-wrap items-baseline gap-x-2">
        <span className="flex items-baseline gap-2" data-testid="vsw-words">
          <span className="lx-tnum text-3xl font-semibold tracking-tight">{num(view.words)}</span>
          <span className="text-base font-medium">{tn('vmSwWords', view.words)}</span>
        </span>
        <span className="text-sm text-muted">{tn('vmSwCards', view.cards)}</span>
      </p>
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
        {groups.map(([key, n, id]) => (
          <li key={id} className="flex flex-col rounded-md bg-surface px-3 py-2" data-testid={`vsw-g-${id}`}>
            <span className="text-base font-semibold tabular-nums">{num(n)}</span>
            <span className="text-sm text-muted">{t(key)}</span>
          </li>
        ))}
      </ul>
      {view.partial > 0 && (
        <p className="m-0 text-sm text-muted" data-testid="vsw-partial">
          {tn('vmSwPartial', view.partial)}
        </p>
      )}
      {view.skipped.length > 0 && (
        <div className="flex flex-col gap-1" data-testid="vsw-skipped">
          <p className="m-0 text-sm font-medium">{tn('vmSwSkipped', view.skipped.length)}</p>
          <p className="m-0 text-sm text-muted">{t('vmSwSkippedHint')}</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
            {view.skipped.slice(0, SHOW_SKIPPED).map((s) => (
              <li key={s.path} className="break-words">
                <span className="font-medium">{headOf(raw, s.path)}</span> <span className="text-muted">· {t(SKIP_KEY[s.why] ?? 'vmSwWhyInvalid')}</span>
              </li>
            ))}
            {view.skipped.length > SHOW_SKIPPED && <li className="text-muted">{t('vmSwMore', { n: view.skipped.length - SHOW_SKIPPED })}</li>}
          </ul>
        </div>
      )}
      {dupes.length > 0 && (
        <div className="flex flex-col gap-2" data-testid="vsw-dupes">
          <p className="m-0 text-sm font-medium">{t('vmSwDupesTitle')}</p>
          {same.length > 0 && (
            <>
              <p className="m-0 text-sm text-muted">{t('vmSwDupesHint')}</p>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {same.map((d) => {
                  const key = `${d.lead}|${d.other}`;
                  const label = `${headOf(raw, d.lead)} · ${headOf(raw, d.other)}`;
                  return (
                    <li key={key} className="flex flex-col gap-1" data-testid="vsw-dupe">
                      <p className="m-0 break-words text-sm font-medium">{label}</p>
                      <fieldset disabled={disabled} className="m-0 border-0 p-0">
                        <Segmented
                          label={label}
                          value={confirmed.has(key) ? 'merge' : 'keep'}
                          options={[
                            { value: 'keep', label: t('vmSwKeep') },
                            { value: 'merge', label: t('vmSwMerge'), testId: 'vsw-merge' },
                          ]}
                          onChange={(v) => onPair(d.lead, d.other, v === 'merge')}
                        />
                      </fieldset>
                      <p className="m-0 break-words text-sm text-muted">{t('vmSwMergeKeeps', { w: headOf(raw, d.lead) })}</p>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {like.length > 0 && (
            <>
              <p className="m-0 text-sm text-muted">{t('vmSwDupesLike')}</p>
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm" data-testid="vsw-like">
                {like.map((d) => (
                  <li key={`${d.lead}|${d.other}`} className="break-words" data-testid="vsw-like-item">
                    <span className="font-medium">
                      {headOf(raw, d.lead)} · {headOf(raw, d.other)}
                    </span>{' '}
                    <span className="text-muted">({t(DUP_KEY[d.why] ?? 'vmSwDupBritish')})</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {dupes.length > SHOW_DUPES && !allDupes && (
            <div>
              <Button variant="ghost" onClick={() => setAllDupes(true)} data-testid="vsw-dupes-all">
                {t('vmSwShowAll', { n: dupes.length })}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
