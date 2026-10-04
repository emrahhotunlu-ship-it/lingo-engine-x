import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { setAskContext } from '../app/route';
import { useCoach } from '../coach/store';
import { answerRepair, boxDays, checkRepair, taskOfRepair, type RepairRec } from '../coach/repair';
import { StepHead } from './Exercise';
import { GrammarItem } from './GrammarTask';

// „Repariere den Satz“ (docs/neustart.md §5 Nr. 11): ein früherer Fehler kommt als Aufgabe zurück.
// Aus dem Schreiben: Der Satz mit dem Fehler steht schon im Feld, Emrah verbessert ihn und tippt die
// richtige Fassung. Aus der Grammatik: dieselbe Aufgabe noch einmal (nichts Neues erfunden).
// Nach jeder Antwort das Warum. Gespeichert wird erst beim „Weiter“ (die Sitzung ruft `onDone`).

export function RepairTask({ slot, onDone }: { slot: string; onDone: (ok: boolean) => void }) {
  // Stand beim Öffnen merken: Nach der Antwort ändert sich der Eintrag in der Datenbank.
  const [rec] = useState<RepairRec | undefined>(() => useCoach.getState().repair[slot]);
  const task = rec ? taskOfRepair(rec) : undefined;
  useEffect(() => {
    if (rec) setAskContext(`Repair task. Sentence with a mistake: ${rec.orig}`.slice(0, 600));
  }, [rec]);
  if (!rec) return null;
  if (task) {
    return (
      <div data-testid="repair-task" data-src="grammar">
        <GrammarItem task={task} bare kind="repair" revealOnSkip onDone={onDone} />
      </div>
    );
  }
  return <RepairSentence rec={rec} onDone={onDone} />;
}

type Result = 'correct' | 'near' | 'wrong';

function RepairSentence({ rec, onDone }: { rec: RepairRec; onDone: (ok: boolean) => void }) {
  const { t } = useT();
  const [value, setValue] = useState(rec.orig);
  const [done, setDone] = useState<{ res: Result; days: number } | null>(null);

  // Antwort festhalten und gleich ausrechnen, wann der Eintrag wiederkommt (nicht beim Zeichnen).
  const settle = (r: Result) => setDone({ res: r, days: boxDays(answerRepair(rec, r !== 'wrong', Date.now())) });
  const check = () => {
    if (done === null && value.trim()) settle(checkRepair(value, rec));
  };
  const res = done?.res ?? null;
  const days = done?.days ?? 0;
  const ok = res === 'correct' || res === 'near';
  const tone = res === 'correct' ? 'text-accent-text' : res === 'near' ? 'text-gold-text' : 'text-danger-text';

  return (
    <div data-testid="repair-task" data-src="write">
      <StepHead kind="repair" lv={null} />
      <p className="text-sm text-muted">{t('schRepairTask')}</p>
      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
      >
        <label htmlFor="repair-input" className="sr-only">
          {t('schRepairLabel')}
        </label>
        <textarea
          id="repair-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              check();
            }
          }}
          disabled={res !== null}
          rows={3}
          lang="en"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="block w-full resize-none rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2.5 text-lg leading-relaxed text-fg outline-none focus:border-accent"
          data-testid="repair-input"
        />
        {res === null && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={!value.trim()} data-testid="repair-check">
              {t('cCheck')}
            </Button>
            <Button variant="ghost" onClick={() => settle('wrong')} data-testid="repair-skip">
              {t('schDontKnow')}
            </Button>
          </div>
        )}
      </form>
      {res !== null && (
        <div className="mt-4 border-t border-line/60 pt-4 text-sm" data-testid="repair-feedback" data-verdict={res}>
          <p className={`flex flex-wrap items-center gap-2 text-base font-semibold ${tone}`}>
            <Icon name={res === 'wrong' ? 'close' : 'check'} size={18} />
            {res === 'correct' ? t('cFbRight') : res === 'near' ? t('cFbNear') : t('cFbWrong')}
            {res !== 'correct' && (
              <span lang="en" className="text-fg" data-testid="repair-solution">
                {rec.fix}
              </span>
            )}
          </p>
          {rec.why && (
            <p className="mt-2 text-muted" data-testid="repair-why">
              <span className="font-semibold text-fg">{t('schWhy')}: </span>
              {rec.why}
            </p>
          )}
          <p className="mt-3 text-2xs text-subtle" data-testid="repair-due">
            {days === 0 ? t('schRepairDone') : days === 1 ? t('schRepairTomorrow') : t('schRepairInDays', { n: days })}
          </p>
          <div className="mt-4">
            <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => onDone(ok)} data-testid="repair-next">
              {t('cNext')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
