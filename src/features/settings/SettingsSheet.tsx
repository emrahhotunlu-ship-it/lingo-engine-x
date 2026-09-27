import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { Segmented } from '../../ui/Segmented';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { useCapabilities, getDb, type CapStatus } from '../../platform/capabilities';
import { clearLog, getLog, logWarn, subscribeLog } from '../../platform/diagnostics';
import { phase5Diag } from '../companion/diag';
import { useLive } from '../../data/live';
import { countDocuments } from '../../data/reads';
import { docCount as docCountOf, DOC_COUNT_WARN, profileSize } from '../../domain/capacity/profileSize';
import { useClock } from '../../app/clock';
import { COMPACT_ENABLED, compactPreview, runCompact } from './compactRun';
import { useSettings, type Lang, type Palette, type ThemeMode } from '../../app/settings';
import { changeAutoNext, changeLang, changePalette, changeTheme } from '../../app/actions';
import { WorkContextSection } from './WorkContextSection';
import { exportMessage } from '../migration/MigrationScreen';
import { exportAll } from './exportData';
import { VoiceSection } from './VoiceSection';
import { LearningSection, SoundSection, SourcesSection } from './LearningSection';
import { HapticSection } from './HapticSection';
import { discCount } from '../../domain/discover/steps';
import { diagText } from './diagText';

// Einstellungen (Kap. 6.14): Sprache, Darstellung, Lernen (neue Wörter, Tagesziel), Üben, Stimme,
// Ton, Datenexport, Quellen und Lizenzen, Diagnose.

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t('settings')} closeLabel={t('close')}>
      <div className="flex flex-col gap-8 pt-2">
        <Appearance />
        <LearningSection />
        <WorkContextSection />
        <Practice />
        <VoiceSection />
        <SoundSection />
        <HapticSection />
        <DataSection />
        <SourcesSection />
        <Diagnostics open={open} />
      </div>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="lx-eyebrow">{title}</h3>
      {children}
    </section>
  );
}

function Appearance() {
  const { t } = useT();
  const lang = useSettings((s) => s.lang);
  const theme = useSettings((s) => s.theme);
  const langs: ReadonlyArray<{ value: Lang; label: string }> = [
    { value: 'de', label: 'Deutsch' },
    { value: 'en', label: 'English' },
  ];
  const themes: ReadonlyArray<{ value: ThemeMode; label: string }> = [
    { value: 'dark', label: t('themeDark') },
    { value: 'dim', label: t('themeDim') },
    { value: 'light', label: t('themeLight') },
    { value: 'auto', label: t('themeAuto') },
  ];
  // Farbthema (M21): Salbei · Ozean · Pflaume · Graphit, gespeichert in `app/profile.theme.p`.
  const palette = useSettings((s) => s.palette);
  const palettes: ReadonlyArray<{ value: Palette; label: string }> = [
    { value: 'sage', label: t('palette_sage') },
    { value: 'ocean', label: t('palette_ocean') },
    { value: 'plum', label: t('palette_plum') },
    { value: 'graphite', label: t('palette_graphite') },
  ];
  return (
    <>
      <Section title={t('settingsLanguage')}>
        <Segmented label={t('settingsLanguage')} value={lang} options={langs} onChange={(v) => void changeLang(v)} />
      </Section>
      <Section title={t('settingsAppearance')}>
        <Segmented label={t('settingsAppearance')} value={theme} options={themes} onChange={(v) => void changeTheme(v)} />
        <p className="mt-2 text-sm font-medium">{t('setPalette')}</p>
        <Segmented label={t('setPalette')} value={palette} options={palettes} columns={4} testId="set-palette" onChange={(v) => void changePalette(v)} />
      </Section>
    </>
  );
}

/** Üben (M6): nach richtiger Antwort ohne Hilfe automatisch weiter (Standard an, wie in der alten App). */
function Practice() {
  const { t } = useT();
  const auto = useLive((s) => s.docs['app/profile']?.autoNext) !== false;
  const db = useCapabilities((s) => s.db);
  if (db !== 'ready') return null;
  return (
    <Section title={t('settingsPractice')}>
      <Segmented
        label={t('settingsAutoNext')}
        value={auto ? 'on' : 'off'}
        options={[
          { value: 'on', label: t('settingsOn') },
          { value: 'off', label: t('settingsOff') },
        ]}
        onChange={(v) => void changeAutoNext(v === 'on')}
      />
      <p className="text-sm text-muted">{t('settingsAutoNextHint')}</p>
    </Section>
  );
}

function DataSection() {
  const { t } = useT();
  const downloads = useCapabilities((s) => s.downloads);
  const db = useCapabilities((s) => s.db);
  const [busy, setBusy] = useState(false);
  if (downloads !== 'ready' || db !== 'ready') return null;
  const run = async () => {
    setBusy(true);
    const outcome = await exportAll();
    setBusy(false);
    toast(t(exportMessage[outcome]), outcome === 'saved' || outcome === 'declined' ? 'info' : 'error');
  };
  return (
    <Section title={t('settingsData')}>
      <Button icon="download" onClick={() => void run()} busy={busy} busyLabel={t('exportRunning')} className="w-full">
        {t('exportButton')}
      </Button>
    </Section>
  );
}

const CAP_LABEL: Record<CapStatus, MessageKey> = { ready: 'capReady', pending: 'capPending', absent: 'capAbsent' };

function Diagnostics({ open }: { open: boolean }) {
  const { t, num, date, lang } = useT();
  const caps = useCapabilities();
  const time = (ms: number) => new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { timeStyle: 'medium' }).format(ms);
  const schema = useLive((s) => s.docs['app/schema']);
  const disc = useLive((s) => s.docs['app/profile']?.disc);
  const profile = useLive((s) => s.docs['app/profile']);
  const today = useClock((s) => s.today);
  const size = useMemo(() => profileSize(profile, today), [profile, today]);
  const log = useSyncExternalStore(subscribeLog, getLog);
  const [docCount, setDocCount] = useState<number | null>(null);
  const [p5, setP5] = useState<ReturnType<typeof phase5Diag> | null>(null);

  useEffect(() => {
    if (!open || caps.db !== 'ready') return;
    const db = getDb();
    if (!db) return;
    let alive = true;
    // P7-1 (d): je Sammlung nur zählen, statt die ganze Datenbank zu prüfen – einmal je Öffnen.
    countDocuments(db).then(
      (c) => {
        if (!alive) return;
        setDocCount(docCountOf(c.byCollection).total);
        const raw = new Map<string, Record<string, unknown>>();
        if (c.chat) raw.set('app/chat', c.chat);
        for (let i = 0; i < c.preply; i++) raw.set(`preply/${i}`, {});
        setP5(phase5Diag(raw));
      },
      (err: unknown) => {
        logWarn('diagnostics:count', err);
        if (alive) setDocCount(null);
      },
    );
    return () => {
      alive = false;
    };
  }, [open, caps.db]);

  const copy = async () => {
    const text = log.map((e) => `${new Date(e.t).toISOString()} ${e.level} ${e.scope} ${e.code ?? ''} ${e.message} ${e.detail ?? ''}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast(t('diagLogCopied'));
    } catch (err) {
      logWarn('diagnostics:copy', err);
      toast(t('diagLogCopyFailed'), 'error');
    }
  };

  const rows: Array<[string, string]> = [
    [t('capDb'), t(CAP_LABEL[caps.db])],
    [t('capSample'), t(CAP_LABEL[caps.sampleRevoked ? 'absent' : caps.sample])],
    [t('capDownloads'), t(CAP_LABEL[caps.downloads])],
    [t('diagDocuments'), docCount === null ? t('diagDocumentsUnknown') : t('diagDocumentsValue', { n: docCount })],
    // Phase 7 (Plan §12.3): Profilgröße gegen 256 KiB und Prognose.
    [t('diagProfileSize'), `${t('diagProfileSizeValue', { kb: Math.round(size.bytes / 1024) })}${size.yearsLeft !== null ? ` · ${t('diagProfileYears', { years: size.yearsLeft })}` : ''}`],
    // Phase 5 (§5.8): Größe des Chat-Verlaufs und Preply-Dokumente.
    ...(p5 ? ([[t('diagChat'), t('diagChatValue', { n: p5.chatMsgs, kb: p5.chatKb })], [t('diagPreply'), t('diagDocumentsValue', { n: p5.preply })]] as Array<[string, string]>) : []),
    [
      t('diagSchema'),
      schema && typeof schema.version === 'number'
        ? `${num(schema.version)}${typeof schema.migratedAt === 'number' ? ` · ${date(schema.migratedAt)}` : ''}`
        : t('diagSchemaNone'),
    ],
    [t('diagDisc'), num(discCount(disc))],
  ];

  return (
    <Section title={t('settingsDiagnostics')}>
      {docCount !== null && docCount >= DOC_COUNT_WARN && (
        <p className="text-sm text-gold-text" role="status" data-testid="diag-capacity-warn">
          {t('diagCapacityWarn', { n: docCount })}
        </p>
      )}
      {size.warn && (
        <p className="text-sm text-gold-text" role="status">
          {t('diagProfileWarn')}
        </p>
      )}
      {COMPACT_ENABLED && size.compactable && <CompactOffer />}
      <dl className="flex flex-col">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5" data-testid={k === t('diagDocuments') ? 'diag-capacity' : k === t('diagProfileSize') ? 'diag-profile-size' : undefined}>
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="lx-tnum text-right text-sm font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <h4 className="mt-2 text-sm font-semibold">{t('diagLog')}</h4>
      {log.length === 0 ? (
        <p className="text-sm text-muted">{t('diagLogEmpty')}</p>
      ) : (
        <ol className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-xl bg-surface p-3 text-xs" data-testid="diag-log">
          {[...log].reverse().map((e) => (
            <li key={e.id} className="break-words">
              <span className="lx-tnum text-subtle">{time(e.t)}</span>{' '}
              <span className={e.level === 'error' ? 'text-danger-text' : e.level === 'warn' ? 'text-gold-text' : 'text-muted'}>{e.scope}</span>{' '}
              {e.code && <span className="text-muted">[{e.code}]</span>} <span className="text-fg">{diagText(e.message, t)}</span>
              {e.detail && <span className="text-subtle"> · {diagText(e.detail, t)}</span>}
            </li>
          ))}
        </ol>
      )}
      {log.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button icon="copy" onClick={() => void copy()}>
            {t('diagLogCopy')}
          </Button>
          <Button variant="ghost" onClick={clearLog}>
            {t('diagLogClear')}
          </Button>
        </div>
      )}
    </Section>
  );
}

/** Auslagern alter Jahre (Plan §12.3): Trockenlauf zuerst, Ausführen nur per Tipp. */
function CompactOffer() {
  const { t } = useT();
  const profile = useLive((s) => s.docs['app/profile']);
  const today = useClock((s) => s.today);
  const plan = useMemo(() => compactPreview(profile, today), [profile, today]);
  const [dry, setDry] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!plan) return <p className="text-sm text-muted">{t('compactNothing')}</p>;
  const run = async () => {
    setBusy(true);
    const r = await runCompact(today);
    setBusy(false);
    setDry(false);
    if (r.status === 'done') toast(t('compactDone', { kb: r.kb }));
    else if (r.status === 'nothing') toast(t('compactNothing'));
    else toast(t('compactFailed'), 'error');
  };
  return (
    <div className="flex flex-col gap-2" data-testid="compact-offer">
      {!dry ? (
        <Button onClick={() => setDry(true)}>{t('compactOffer')}</Button>
      ) : (
        <>
          <p className="text-sm text-muted">{t('compactDry', { years: plan.years.join(', '), kb: Math.round(plan.bytesMoved / 1024) })}</p>
          <Button variant="primary" busy={busy} onClick={() => void run()} data-testid="compact-run">
            {t('compactRun')}
          </Button>
        </>
      )}
    </div>
  );
}
