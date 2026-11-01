import { useMemo, useState } from 'react';
import { Button, getWriter, Segmented, toast, useLive, useT, type MessageKey } from '../sharedUi';
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
const DUP_KEY: Record<string, MessageKey> = { same: 'vmSwDupSame', british: 'vmSwDupBritish', article: 'vmSwDupArticle', placeholder: 'vmSwDupPlaceholder' };
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

export function SwitchPanel({ on, read, backup: saveBackup }: { on: boolean } & SwitchPorts) {
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

  const view = useMemo(() => (data ? sw.preview(data.st.input, pairs, data.st.skipped).summary : null), [data, pairs]);

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
      setPhase('review');
      if (r.state === 'done' || r.state === 'already') {
        setNote(null);
        toast(t('vmSwOnToast'));
        if (r.caught?.docs) toast(tn('vmSwCaught', r.caught.docs));
        return;
      }
      logWarn('vocab:switch', { message: `Nicht eingeschaltet: ${r.state}` }, r.why ?? '');
      if (r.state === 'busy') setNote({ key: 'vmSwBusy' });
      else if (r.state === 'partial') setNote({ key: 'vmSwPartial', retry: true });
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
      setPhase('idle');
      if (r.state === 'done') {
        toast(t('vmSwOnToast'));
        if (r.caught?.docs) toast(tn('vmSwCaught', r.caught.docs));
        return;
      }
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
      setPhase('idle');
      if (ok) toast(t('vmSwOffToast'));
      else setNote({ key: 'vmSwError' });
    } catch (err) {
      logError('vocab:switch', err, 'Rückweg');
      setPhase('idle');
      setNote({ key: 'vmSwError' });
    }
  };

  const busy = phase === 'running';
  const noteEl = note && (
    <div className="flex flex-col gap-2 rounded-lg border border-line p-3" role="status" data-testid="vsw-note">
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

  // Eingeschaltet: nur der Rückweg (unter den Einstellungen der Wörter-App).
  if (on) {
    return (
      <section className="mt-4 flex flex-col gap-2 border-t border-line pt-4" data-testid="vsw-back">
        <p className="m-0 text-sm font-medium">{t('vmSwBackTitle')}</p>
        <p className="m-0 text-sm text-muted">{t('vmSwBackHint')}</p>
        <div>
          <Button variant="secondary" onClick={() => void back()} busy={busy} data-testid="vsw-back-btn">
            {t('vmSwBack')}
          </Button>
        </div>
        {noteEl}
      </section>
    );
  }

  // Schon umgestellt, aber zurückgeschaltet: wieder einschalten ohne neue Umrechnung.
  if (done) {
    return (
      <section className="flex flex-col gap-2" data-testid="vsw">
        <p className="m-0 text-sm font-medium">{t('vmSwTitle')}</p>
        <p className="m-0 text-sm text-muted">{t('vmSwOffHint')}</p>
        <div>
          <Button variant="primary" onClick={() => void reenable()} busy={busy} busyLabel={t('vmSwApplying')} data-testid="vsw-reenable">
            {t('vmSwReenable')}
          </Button>
        </div>
        {noteEl}
      </section>
    );
  }

  const st = data?.st;
  const locked = st ? (!st.profileValid ? 'vmSwLockProfile' : st.truncated ? 'vmSwLockTruncated' : null) : null;
  const confirmed = new Set(pairs.map(([l, o]) => `${l}|${o}`));
  const togglePair = (lead: string, other: string, merge: boolean) =>
    setPairs((cur) => (merge ? [...cur.filter(([l, o]) => !(l === lead && o === other)), [lead, other] as const] : cur.filter(([l, o]) => !(l === lead && o === other))));

  return (
    <section className="flex flex-col gap-3" data-testid="vsw">
      <p className="m-0 text-sm font-medium">{t('vmSwTitle')}</p>
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
                <p className="m-0 text-sm text-muted">{t('vmSwStep1Hint')}</p>
                <div>
                  <Button variant={backup === 'saved' ? 'secondary' : 'primary'} onClick={() => void save()} disabled={busy} data-testid="vsw-backup">
                    {t('vmSwBackup')}
                  </Button>
                </div>
                {backup && (
                  <p className="m-0 text-sm" role="status" data-testid="vsw-backup-state">
                    {t(SAVE_KEY[backup])}
                    {backup !== 'saved' && ` ${t('vmSwBackupNeeded')}`}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                <p className="m-0 text-sm font-medium">{t('vmSwStep2')}</p>
                <p className="m-0 text-sm text-muted">{t('vmSwApplyHint')}</p>
                <div>
                  <Button variant="primary" onClick={() => void apply()} disabled={backup !== 'saved'} busy={busy} busyLabel={t('vmSwApplying')} data-testid="vsw-apply">
                    {t('vmSwApply')}
                  </Button>
                </div>
                {backup !== 'saved' && !note && <p className="m-0 text-sm text-muted">{t('vmSwBackupNeeded')}</p>}
              </div>
            </>
          )}
          {noteEl}
        </>
      )}
    </section>
  );
}

function Report({ view, raw, confirmed, onPair, disabled }: { view: Summary; raw: ReadonlyMap<string, Doc>; confirmed: ReadonlySet<string>; onPair: (lead: string, other: string, merge: boolean) => void; disabled: boolean }) {
  const { t, tn, num } = useT();
  const groups: [MessageKey, number, string][] = [
    ['vmOvRecognize', view.recognize, 'recognize'],
    ['vmOvOnway', view.onway, 'onway'],
    ['vmOvProduce', view.produce, 'produce'],
    ['vmOvFresh', view.fresh, 'fresh'],
  ];
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line p-3" data-testid="vsw-report">
      <p className="m-0 text-sm font-medium">{t('vmSwReportTitle')}</p>
      <p className="m-0">
        <span className="text-lg font-semibold" data-testid="vsw-words">
          {tn('vmSwWords', view.words)}
        </span>{' '}
        <span className="text-sm text-muted">{tn('vmSwCards', view.cards)}</span>
      </p>
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
        {groups.map(([key, n, id]) => (
          <li key={id} className="flex flex-col rounded-md bg-surface px-3 py-2" data-testid={`vsw-g-${id}`}>
            <span className="text-lg font-semibold tabular-nums">{num(n)}</span>
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
      {view.dupes.length > 0 && (
        <div className="flex flex-col gap-2" data-testid="vsw-dupes">
          <p className="m-0 text-sm font-medium">{t('vmSwDupesTitle')}</p>
          <p className="m-0 text-sm text-muted">{t('vmSwDupesHint')}</p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {view.dupes.map((d) => {
              const key = `${d.lead}|${d.other}`;
              const label = `${headOf(raw, d.lead)} · ${headOf(raw, d.other)}`;
              return (
                <li key={key} className="flex flex-col gap-1" data-testid="vsw-dupe">
                  <p className="m-0 break-words text-sm">
                    <span className="font-medium">{label}</span> <span className="text-muted">({t(DUP_KEY[d.why] ?? 'vmSwDupSame')})</span>
                  </p>
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
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
