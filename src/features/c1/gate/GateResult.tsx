import { chapterById, pendingName, topicExists } from '../../../domain/c1/chapters';
import type { GateOutcome, GateTally } from '../../../domain/c1/gate/score';
import { grammarThreshold, GATE } from '../../../domain/c1/gate/trigger';
import type { ProgramChapter } from '../../../domain/c1/programTypes';
import { useT } from '../../../i18n';
import { ActionBar, PrimaryAction } from '../../../ui/ActionBar';
import { Button } from '../../../ui/Button';
import { topicName } from '../../grammar/topicUi';

// Ergebnis der Kapitelprüfung (Lernplattform 3.0 §4.4, P42). Kein Text wie „durchgefallen“. Bestanden: „Kapitel n abgeschlossen“, der Satz „Abgeschlossen
// heißt …“, drei eigene richtige Sätze als Beleg und die Vorschau auf das nächste Kapitel. Nicht bestanden: „Noch nicht.“, die Themen mit Fehlern und ab
// wann es wieder geht. Die Prüfung ändert weder Serie noch Pflicht, und sie sagt nichts über das Niveau.

export type GateResultData = { tally: GateTally; outcome: GateOutcome; proofs: string[]; retry: string | null };

const pct = (x: number): string => `${Math.round(x * 100)}`;

export function GateResult({ chapter, data, saveState, onRetrySave, onClose }: { chapter: ProgramChapter; data: GateResultData; saveState: 'saving' | 'saved' | 'failed'; onRetrySave: () => void; onClose: () => void }) {
  const { t, lang } = useT();
  const { tally, outcome } = data;
  const next = chapterById(chapter.n + 1);
  const name = (id: string): string => (topicExists(id) ? topicName(id, lang) : (pendingName(id, lang) ?? id));
  const dateText = (d: string): string => new Date(`${d}T12:00:00`).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'long' });
  return (
    <section className="flex flex-col gap-4" data-testid="gate-result" data-ok={outcome.ok ? 'true' : 'false'} aria-labelledby="px-gt-res">
      <h2 id="px-gt-res" className="lx-t-answer tracking-tight">
        {outcome.ok ? t('pxGtResDone', { n: chapter.n }) : t('pxGtResNotYet')}
      </h2>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        <li className="lx-inset lx-tnum" data-testid="gate-res-grammar">
          {t('pxGtResGrammar', { a: tally.g[0], b: tally.g[1], p: pct(grammarThreshold(chapter.n)) })}
        </li>
        <li className="lx-inset lx-tnum" data-testid="gate-res-words">
          {outcome.noWords ? t('pxGtResNoWords') : t('pxGtResWords', { a: tally.w[0], b: tally.w[1], p: pct(GATE.passWords) })}
        </li>
      </ul>

      {outcome.ok ? (
        <>
          <div className="flex flex-col gap-1.5">
            <h3 className="lx-eyebrow">{t('pxGtResGoal')}</h3>
            <p className="leading-relaxed" data-testid="gate-res-goal">
              {chapter.done[lang]}
            </p>
          </div>
          {chapter.use && (
            <div className="flex flex-col gap-1.5">
              <h3 className="lx-eyebrow">{t('pxGtResUse')}</h3>
              <p className="text-sm text-muted">{chapter.use[lang]}</p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="gate-res-use">
                {chapter.use.ex.map((s) => (
                  <li key={s} className="lx-inset" lang="en">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.proofs.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h3 className="lx-eyebrow">{t('pxGtResProof')}</h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="gate-res-proofs">
                {data.proofs.map((s) => (
                  <li key={s} className="lx-inset" lang="en">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {next ? (
            <p className="text-sm text-muted" data-testid="gate-res-next" data-chapter={next.id}>
              {t('pxGtResNext', { n: next.n, name: next.name[lang] })}
            </p>
          ) : (
            <p className="text-sm text-muted" data-testid="gate-res-last">
              {t('pxGtResLast')}
            </p>
          )}
        </>
      ) : (
        <>
          {outcome.weak.length > 0 && (
            <p className="leading-relaxed" data-testid="gate-res-weak">
              {t('pxGtResWeak', { names: outcome.weak.map(name).join(' · ') })}
            </p>
          )}
          {data.retry && (
            <p className="text-sm text-muted" data-testid="gate-res-retry" data-from={data.retry}>
              {t('pxGtResRetry', { d: dateText(data.retry) })}
            </p>
          )}
        </>
      )}

      <p className="text-sm text-muted">{t('pxGtResHonest')}</p>

      {saveState === 'failed' && (
        <p className="text-sm text-danger-text" role="alert" data-testid="gate-save-failed">
          {t('pxGtResSaveFailed')}
        </p>
      )}
      <ActionBar placement="column" stateKey="gate-result">
        {saveState === 'failed' ? (
          <PrimaryAction onClick={onRetrySave} testId="gate-save-retry">
            {t('pxGtResSaveRetry')}
          </PrimaryAction>
        ) : (
          <PrimaryAction onClick={onClose} disabled={saveState === 'saving'} testId="gate-done">
            {t('pxGtResClose')}
          </PrimaryAction>
        )}
        {saveState === 'failed' && (
          <Button variant="ghost" onClick={onClose} data-testid="gate-close-unsaved">
            {t('pxGtResCloseUnsaved')}
          </Button>
        )}
      </ActionBar>
    </section>
  );
}
