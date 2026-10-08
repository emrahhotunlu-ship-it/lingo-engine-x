import { useState } from 'react';
import { useT, type MessageKey } from '../../i18n';
import { patternById } from '../../domain/grammar/patterns';
import type { MailRun } from '../../domain/tutor/mail';
import { MAIL_MAX_CHECKS, mailErrors } from '../../domain/tutor/mail';
import { c1Mail } from '../../prompts/c1Mail';
import { AiMark } from '../../ui/AiMark';
import { Button } from '../../ui/Button';
import { Disclosure } from '../../ui/Disclosure';
import { EditDetail, MarkedText } from './MarkedText';
import { reportMail, reportMailEdit, type MailSaveResult } from './mailSave';

// Ergebnis der Schreibwerkstatt (Lernplattform 3.0 P47, KT T6): Zusammenfassung, Ton, der Text mit Unterstreichungen (rot = Fehler, gold = Verbesserung; Tipp →
// Grund und Muster, mit „Stelle melden“), die Kapitelmuster mit Claudes Urteil, die C1-Fassung (aufklappbar) und die Folgen (Fehlersätze ab morgen, Genauigkeitswert).
// Die App urteilt nicht neu; sie zeigt nur belegte Stellen (`keepEdits`).

const TPL = `${c1Mail.id}@${c1Mail.version}`;
const TONE_KEY: Record<string, MessageKey> = { fits: 'ttWsToneFits', 'too-direct': 'ttWsToneDirect', 'too-informal': 'ttWsToneInformal', 'too-stiff': 'ttWsToneStiff' };

export type MailShown = { run: MailRun; save: MailSaveResult | null };

export function MailResult({ shown, onRevise, onNew, onDone }: { shown: MailShown; onRevise: () => void; onNew: () => void; onDone: () => void }) {
  const { t, lang } = useT();
  const { run, save } = shown;
  const [active, setActive] = useState(0);
  const [hidden, setHidden] = useState<ReadonlySet<number>>(new Set());
  const [reported, setReported] = useState(false);
  const id = `${run.id}:${run.check}`;
  const all = run.out.edits;
  // Gemeldete Stellen verschwinden aus der Anzeige (nie aus der Datenbank gelöscht).
  const edits = all.filter((_, i) => !hidden.has(i));
  const edit = edits[active] ?? edits[0];
  const left = MAIL_MAX_CHECKS - run.check;

  if (reported) {
    return (
      <div className="flex flex-col gap-3" data-testid="ws-reported">
        <p className="lx-t-body m-0 text-muted">{t('ttWsReported')}</p>
        <Button variant="primary" onClick={onNew}>
          {t('ttWsNew')}
        </Button>
      </div>
    );
  }
  const used = run.situation.patterns.map((p) => {
    const hit = run.out.used.find((u) => u.pat === p.id);
    const name = patternById(p.id)?.name[lang] ?? p.id;
    return { id: p.id, name, state: hit ? (hit.ok ? 'ok' : 'bad') : 'none', quote: hit?.quote ?? '' } as const;
  });
  const errors = mailErrors(run.out);
  return (
    <div className="flex flex-col gap-4" data-testid="ws-result" data-errors={errors} data-check={run.check}>
      <h3 className="lx-eyebrow m-0">{t('ttWsResultTitle')}</h3>
      <div className="flex flex-col gap-1">
        <p className="lx-t-label m-0 text-subtle">{t('ttWsSummary')}</p>
        <p className="lx-t-body m-0" lang={lang} data-testid="ws-summary">
          {run.out.summary}
        </p>
        <p className="lx-t-meta m-0 text-muted" data-testid="ws-tone" data-fit={run.out.tone.fit}>
          {t('ttWsToneLine', { tone: t(TONE_KEY[run.out.tone.fit] ?? 'ttWsToneFits') })}
          {run.out.tone.why ? ` · ${run.out.tone.why}` : ''}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {edits.length > 0 ? <p className="lx-t-meta m-0 text-muted">{t('ttWsMarked')}</p> : <p className="lx-t-body m-0" data-testid="ws-nospots">{t('ttWsNoSpots')}</p>}
        <MarkedText text={run.text} edits={edits} active={active} onPick={setActive} testId="ws-text" className="text-base" />
      </div>
      {edit && (
        <EditDetail
          edit={edit}
          tpl={TPL}
          reportId={`${id}:${all.indexOf(edit)}`}
          onReport={() => {
            const at = all.indexOf(edit);
            setHidden((h) => new Set([...h, at]));
            setActive(0);
            void reportMailEdit(run, edit, `${id}:${at}`);
          }}
        />
      )}
      {edits.length > 1 && (
        <Disclosure label={`${t('ttWsAllSpots')} (${edits.length})`} testId="ws-all">
          <ol className="m-0 flex list-none flex-col gap-1 p-0" data-testid="ws-edit-list">
            {edits.map((e, i) => (
              <li key={`${e.from}-${i}`}>
                <button type="button" onClick={() => setActive(i)} aria-pressed={active === i} className={`flex min-h-11 w-full items-center rounded-[var(--radius-control)] px-2 text-left text-sm [overflow-wrap:anywhere] ${active === i ? 'bg-accent-soft font-semibold text-accent-text' : 'hover:bg-surface'}`} lang="en">
                  {e.to ? t('ttClEditChange', { from: e.from, to: e.to }) : t('ttClEditDrop', { from: e.from })}
                </button>
              </li>
            ))}
          </ol>
        </Disclosure>
      )}
      <div className="flex flex-col gap-1.5" data-testid="ws-used">
        <p className="lx-t-label m-0 text-subtle">{t('ttWsPatterns')}</p>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {used.map((u) => (
            <li key={u.id} className="lx-t-body" data-testid={`ws-used-${u.id}`} data-state={u.state}>
              <span className="font-semibold">{u.name}</span> <span className="text-muted">· {t(u.state === 'ok' ? 'ttWsPatOk' : u.state === 'bad' ? 'ttWsPatBad' : 'ttWsPatNone')}</span>
            </li>
          ))}
        </ul>
      </div>
      <Disclosure label={t('ttWsBetter')} testId="ws-better">
        <p className="lx-t-body m-0 whitespace-pre-wrap" lang="en" data-testid="ws-better-text">
          {run.out.upgraded}
        </p>
      </Disclosure>
      <AiMark
        variant="edit"
        tpl={TPL}
        id={id}
        onReport={() => {
          setReported(true);
          void reportMail(run, id);
        }}
        data-testid="ws-mark"
      />
      <div className="flex flex-col gap-1" aria-live="polite">
        {save && save.repairs > 0 && (
          <p className="lx-t-meta m-0 text-muted" data-testid="ws-repairs">
            {save.repairs === 1 ? t('ttWsRepairs1') : t('ttWsRepairsN', { n: save.repairs })}
          </p>
        )}
        {run.check === 1 && !run.pasted && save && save.prod !== 'ignored' && save.prod !== 'failed' && save.prod !== 'unavailable' && (
          <p className="lx-t-meta m-0 text-subtle" data-testid="ws-counted">
            {t('ttWsCounted')}
          </p>
        )}
        {run.pasted && (
          <p className="lx-t-meta m-0 text-subtle" data-testid="ws-notcounted">
            {t('ttWsNotCounted')}
          </p>
        )}
        {run.check > 1 && (
          <p className="lx-t-meta m-0 text-subtle" data-testid="ws-revision">
            {t('ttWsRevisionNote')}
          </p>
        )}
        {save && (!save.out || !save.repairsOk) && (
          <p className="lx-t-meta m-0 text-muted" role="alert" data-testid="ws-savefail">
            {t('ttWsSaveFailed')}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {left > 0 && (
          <Button variant="primary" onClick={onRevise} data-testid="ws-revise">
            {t('ttWsRevise')}
          </Button>
        )}
        <Button variant={left > 0 ? 'secondary' : 'primary'} onClick={onNew} data-testid="ws-new">
          {t('ttWsNew')}
        </Button>
        <Button variant="ghost" onClick={onDone} data-testid="ws-done">
          {t('ttWsDone')}
        </Button>
        {left > 0 && (
          <span className="lx-t-meta text-subtle" data-testid="ws-left">
            {t('ttWsChecksLeft', { n: left })}
          </span>
        )}
      </div>
    </div>
  );
}
