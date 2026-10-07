import { useMemo, useState } from 'react';
import { splitWords } from '../../../domain/answer/align';
import { errRange } from '../../../domain/c1x/kinds/err';
import type { Err } from '../../../domain/c1x/types';
import { SpotSentence } from '../../../engine/SpotSentence';
import { useT } from '../../../i18n';
import { Button } from '../../../ui/Button';
import type { C1Ctrl, C1Ui } from '../types';

// `err` (Fehler finden, auch fehlerfreie Sätze). P14: Wort antippen, Korrektur tippen (oder „Kein Fehler“). P17 baut `TapSentence` (Trefferfläche ≥ 44 px),
// die Korrektur-Chips am Handy und die Handy-Form „Korrektur ≤ 3 Wörter getippt“.

export function useErrUi(ctrl: C1Ctrl): C1Ui {
  const item = ctrl.item as Err;
  const { t } = useT();
  const words = useMemo(() => splitWords(item.text), [item.text]);
  const range = useMemo(() => errRange(item), [item]);
  const [sel, setSel] = useState<[number, number] | null>(null);
  const [fix, setFix] = useState('');

  const report = (s: [number, number] | null, f: string): void => {
    if (!s) {
      ctrl.setResponse(null);
      return;
    }
    const word = words[s[0]] ?? '';
    ctrl.setResponse({ kind: 'err', tap: s[0], ...(f.trim() ? { fix: f.trim(), typed: true } : {}) }, { form: 'typed', tapped: word, chars: f.length });
  };
  const noError = (): void => {
    ctrl.setResponse({ kind: 'err', tap: 'none' }, { form: 'typed', tapped: 'none' });
    ctrl.submit();
  };

  const verdict = ctrl.score?.verdict;
  const marks = ctrl.locked && range ? [{ span: range, tone: verdict === 'correct' ? ('ok' as const) : ('wrong' as const) }] : [];
  return {
    prompt: (
      <SpotSentence
        words={words}
        pick="one"
        selected={sel}
        onSelect={(s) => {
          setSel(s);
          report(s, fix);
        }}
        locked={ctrl.locked}
        marks={marks}
        area={ctrl.area}
        source={`grammar/${ctrl.task.topic}`}
        testId="spot-sentence"
      />
    ),
    answer: (
      <div className="flex flex-col gap-3">
        {!ctrl.locked && (
          <label className="flex flex-col gap-1">
            <span className="lx-t-support text-muted">{t('cxFixLabel')}</span>
            <input
              className="lx-field"
              lang="en"
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={fix}
              placeholder={t('cxAnswerPlaceholder')}
              disabled={!sel}
              data-testid="err-fix"
              onChange={(e) => {
                setFix(e.target.value);
                ctrl.markFirstKey();
                report(sel, e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') ctrl.submit();
              }}
            />
          </label>
        )}
        {!ctrl.locked && (
          <div>
            <Button variant="ghost" onClick={noError} data-testid="no-error">
              {t('cxNoError')}
            </Button>
          </div>
        )}
      </div>
    ),
  };
}
