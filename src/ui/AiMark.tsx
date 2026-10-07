import { useEffect, useState } from 'react';
import { noteQuality } from '../domain/tutor/quality';
import { useT, type MessageKey } from '../i18n';
import { ReportSheet, type ReportInfo } from './ReportSheet';

// Kennzeichnung an jedem Inhalt von Claude (Lernplattform 3.0 P25, T-R5): eine Zeile mit „von Claude · kann Fehler enthalten“ und dem Textknopf
// „Melden“ (Tippfläche ≥ 44 px). Feste Inhalte der App tragen keine Marke. Beim ersten Zeigen zählt der Qualitätszähler `shown`.

export type AiMarkVariant = 'task' | 'explain' | 'diag' | 'edit';

const TEXT: Record<AiMarkVariant, MessageKey> = {
  task: 'ttMarkTask',
  explain: 'ttMarkExplain',
  diag: 'ttMarkDiag',
  edit: 'ttMarkEdit',
};

/** Schon gezählte Inhalte dieser Ansicht (ein erneutes Zeichnen zählt nicht doppelt). */
const counted = new Set<string>();

type Props = {
  variant: AiMarkVariant;
  /** `<vorlage>@<version>` des gezeigten Inhalts. */
  tpl: string;
  /** Kennung des Inhalts; ohne sie gibt es keinen „Melden“-Knopf. */
  id?: string;
  /** Markiert den Inhalt am Ort (z. B. `ax.bad`). */
  onReport?: ((r: ReportInfo) => void) | undefined;
  className?: string;
  'data-testid'?: string;
};

export function AiMark({ variant, tpl, id, onReport, className, 'data-testid': testId = 'ai-mark' }: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const key = `${tpl}|${id ?? ''}`;
    if (counted.has(key)) return;
    counted.add(key);
    noteQuality(tpl, 'shown');
  }, [tpl, id]);
  return (
    <>
      <p className={`m-0 flex flex-wrap items-center gap-x-2 lx-t-meta text-subtle ${className ?? ''}`} data-testid={testId} data-ai-mark={variant}>
        <span>{t(TEXT[variant])}</span>
        {id && (
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-control)] px-2 font-semibold text-muted underline-offset-2 hover:text-fg hover:underline"
            onClick={() => setOpen(true)}
            data-testid="ai-report"
          >
            {t('ttReport')}
          </button>
        )}
      </p>
      {id && <ReportSheet open={open} onClose={() => setOpen(false)} tpl={tpl} id={id} onReport={onReport} />}
    </>
  );
}

/** Nur für Tests. */
export function resetAiMarkCounted(): void {
  counted.clear();
}
