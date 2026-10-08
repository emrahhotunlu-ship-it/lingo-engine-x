import { Fragment, useState, type ReactNode } from 'react';
import { locateRaw, type Edit } from '../../domain/tutor/edits';
import { patternById } from '../../domain/grammar/patterns';
import { useT } from '../../i18n';
import { ReportSheet } from '../../ui/ReportSheet';

// Gemeinsame Bausteine für Satz-Klinik und Schreibwerkstatt (Lernplattform 3.0 P46/P47): der Text mit den markierten Stellen (jede Stelle ein Knopf; Tipp →
// Grund und Muster) und die Karte zu einer Stelle. Rot unterstrichen = Fehler, gold = Verbesserung (nie ein Fehler). Farbe ist nie das Einzige: die Karte nennt
// „Fehler“ oder „Verbesserung“ in Worten.

export function MarkedText({ text, edits, active, onPick, testId = 'cl-sentence', className = 'lx-t-answer' }: { text: string; edits: readonly Edit[]; active: number; onPick: (i: number) => void; testId?: string; className?: string }) {
  const spots = locateRaw(text, edits);
  const parts: ReactNode[] = [];
  let at = 0;
  spots.forEach((s, k) => {
    if (s.start > at) parts.push(<Fragment key={`t${k}`}>{text.slice(at, s.start)}</Fragment>);
    const idx = edits.indexOf(s.edit);
    const err = s.edit.sev === 'error';
    parts.push(
      <button
        key={`m${k}`}
        type="button"
        aria-pressed={active === idx}
        onClick={() => onPick(idx)}
        data-testid={`${testId.startsWith('ws') ? 'ws' : 'cl'}-mark-${idx}`}
        data-sev={s.edit.sev}
        className={`inline rounded-sm px-0.5 text-left underline decoration-2 underline-offset-4 ${err ? 'bg-wrong-soft decoration-wrong' : 'bg-gold-soft decoration-gold-text'} ${active === idx ? 'ring-2 ring-accent' : ''}`}
      >
        {text.slice(s.start, s.end)}
      </button>,
    );
    at = s.end;
  });
  if (at < text.length) parts.push(<Fragment key="rest">{text.slice(at)}</Fragment>);
  return (
    <p className={`${className} m-0 whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]`} lang="en" data-testid={testId}>
      {parts}
    </p>
  );
}

/** Die Karte zu einer Stelle: Art (in Worten), Änderung, Grund, Muster; optional „Stelle melden“. */
export function EditDetail({ edit, reportId, tpl, onReport }: { edit: Edit; reportId?: string; tpl?: string; onReport?: () => void }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const pat = edit.pat ? patternById(edit.pat) : null;
  return (
    <div className="lx-card flex flex-col gap-1.5 p-3" data-testid="cl-edit" data-sev={edit.sev}>
      <p className="lx-t-label m-0 text-subtle">{edit.sev === 'error' ? t('ttClError') : t('ttClUpgrade')}</p>
      <p className="lx-t-body m-0 font-semibold [overflow-wrap:anywhere]" lang="en">
        {edit.to ? t('ttClEditChange', { from: edit.from, to: edit.to }) : t('ttClEditDrop', { from: edit.from })}
      </p>
      <p className="lx-t-body m-0" lang={lang} data-testid="cl-edit-why">
        {edit.why}
      </p>
      {pat && (
        <p className="lx-t-meta m-0 text-muted" data-testid="cl-edit-pat">
          {t('ttClPattern', { name: pat.name[lang] })}
        </p>
      )}
      {reportId && tpl && onReport && (
        <>
          <div>
            <button type="button" onClick={() => setOpen(true)} data-testid="cl-edit-report" className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-2 text-sm font-semibold text-muted underline-offset-2 hover:text-fg hover:underline">
              {t('ttClReportEdit')}
            </button>
          </div>
          <ReportSheet open={open} onClose={() => setOpen(false)} tpl={tpl} id={reportId} onReport={onReport} />
        </>
      )}
    </div>
  );
}
