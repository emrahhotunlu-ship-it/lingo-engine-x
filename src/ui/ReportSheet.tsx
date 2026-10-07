import { flagShown, noteQuality } from '../domain/tutor/quality';
import { useT, type MessageKey } from '../i18n';
import { logWarn } from '../platform/diagnostics';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { toast } from './Toast';

// Melde-Blatt für jeden Inhalt von Claude (Lernplattform 3.0 P25, KT §3.1, T-R5): fünf Gründe, ein Tipp. Gemeldet wird ausgeblendet, nie gelöscht.
// Was dabei passiert:
// - Qualitätszähler `flag` (nur Browser) und der Eintrag in der KI-Stichprobe,
// - eine Zeile im Diagnose-Protokoll,
// - die Markierung am Ort des Inhalts: Der Aufrufer gibt `onReport` mit (z. B. `ax.bad`); weitere Senken meldet `registerReportSink` an
//   (P31 hängt hier `app/c1.bad` über `c1doc.ts` ein, sobald es das Dokument gibt; bis dahin genügt das Protokoll).

export type ReportReason = 'solution' | 'twofit' | 'explain' | 'unnatural' | 'other';

export type ReportInfo = {
  /** `<vorlage>@<version>`. */
  tpl: string;
  /** Kennung des Inhalts (Aufgaben-ID oder `Thema:Fehlerindex`). */
  id: string;
  reason: ReportReason;
};

const REASONS: ReadonlyArray<{ id: ReportReason; label: MessageKey }> = [
  { id: 'solution', label: 'ttReportWrongSolution' },
  { id: 'twofit', label: 'ttReportTwoFit' },
  { id: 'explain', label: 'ttReportWrongExplain' },
  { id: 'unnatural', label: 'ttReportUnnatural' },
  { id: 'other', label: 'ttReportOther' },
];

type Sink = (r: ReportInfo) => void;
const sinks: Sink[] = [];

/** Meldet eine Senke an, die jede Meldung bekommt (z. B. `app/c1.bad`). */
export function registerReportSink(fn: Sink): void {
  sinks.push(fn);
}

/** Erfasst eine Meldung: Zähler, Stichprobe, Protokoll, Senken. Getrennt von der Oberfläche, damit sie testbar ist. */
export function submitReport(r: ReportInfo, now: number = Date.now()): void {
  noteQuality(r.tpl, 'flag');
  flagShown(r.id, r.tpl, r.reason, now);
  logWarn('ai:flag', { code: 'reported', message: `${r.tpl} · ${r.reason}` }, r.id);
  for (const s of sinks) {
    try {
      s(r);
    } catch (err) {
      logWarn('ai:flag-sink', err, r.id);
    }
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
  tpl: string;
  id: string;
  /** Markiert den Inhalt am Ort (z. B. `ax.bad = 1`); Fehler darin werden protokolliert. */
  onReport?: ((r: ReportInfo) => void) | undefined;
};

export function ReportSheet({ open, onClose, tpl, id, onReport }: Props) {
  const { t } = useT();
  const pick = (reason: ReportReason) => {
    const info: ReportInfo = { tpl, id, reason };
    submitReport(info);
    try {
      onReport?.(info);
    } catch (err) {
      logWarn('ai:flag-local', err, id);
    }
    toast(t('ttReportThanks'));
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('ttReportTitle')} closeLabel={t('ttReportClose')}>
      <div className="flex flex-col gap-2" data-testid="report-sheet">
        {REASONS.map((r) => (
          <Button key={r.id} variant="secondary" onClick={() => pick(r.id)} data-testid={`report-${r.id}`}>
            {t(r.label)}
          </Button>
        ))}
      </div>
    </Sheet>
  );
}
