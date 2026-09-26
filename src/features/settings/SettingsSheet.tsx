import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { Segmented } from '../../ui/Segmented';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { useCapabilities, getDb, type CapStatus } from '../../platform/capabilities';
import { clearLog, getLog, logWarn, subscribeLog } from '../../platform/diagnostics';
import { useLive } from '../../data/live';
import { loadSnapshot } from '../../data/snapshot';
import { useSettings, type Lang, type ThemeMode } from '../../app/settings';
import { changeLang, changeTheme } from '../../app/actions';
import { exportMessage } from '../migration/MigrationScreen';
import { exportAll } from './exportData';

// Einstellungen (Kap. 6.14): Sprache, Darstellung, Datenexport, Diagnose.

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t('settings')} closeLabel={t('close')}>
      <div className="flex flex-col gap-8 pt-2">
        <Appearance />
        <DataSection />
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
  return (
    <>
      <Section title={t('settingsLanguage')}>
        <Segmented label={t('settingsLanguage')} value={lang} options={langs} onChange={(v) => void changeLang(v)} />
      </Section>
      <Section title={t('settingsAppearance')}>
        <Segmented label={t('settingsAppearance')} value={theme} options={themes} onChange={(v) => void changeTheme(v)} />
      </Section>
    </>
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
  const log = useSyncExternalStore(subscribeLog, getLog);
  const [docCount, setDocCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open || caps.db !== 'ready') return;
    const db = getDb();
    if (!db) return;
    let alive = true;
    loadSnapshot(db).then(
      (s) => {
        if (alive) setDocCount(s.raw.size);
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
    [
      t('diagSchema'),
      schema && typeof schema.version === 'number'
        ? `${num(schema.version)}${typeof schema.migratedAt === 'number' ? ` · ${date(schema.migratedAt)}` : ''}`
        : t('diagSchemaNone'),
    ],
  ];

  return (
    <Section title={t('settingsDiagnostics')}>
      <dl className="flex flex-col">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
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
              {e.code && <span className="text-muted">[{e.code}]</span>} <span className="text-fg">{e.message}</span>
              {e.detail && <span className="text-subtle"> · {e.detail}</span>}
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
