import { useEffect, useMemo, useState } from 'react';
import { splitWords } from '../../../domain/answer/align';
import { errRange } from '../../../domain/c1x/kinds/err';
import type { Err } from '../../../domain/c1x/types';
import { ChipRow } from '../../../engine/ChipRow';
import { TapSentence } from '../../../engine/TapSentence';
import { WordCounter } from '../../../engine/WordCounter';
import { kwtCount } from '../../../domain/c1x/kwtNorm';
import { useT } from '../../../i18n';
import { Button } from '../../../ui/Button';
import type { C1Ctrl, C1Ui } from '../types';

// `err` (Fehler finden, auch fehlerfreie Sätze), P17. Erst das Wort antippen, dann die Korrektur (Lernplattform 3.0 §2.10, §3.4):
//  · Laptop (`desk`): anklicken oder mit ←/→ und Enter wählen, Korrektur tippen, Taste N = „Kein Fehler“; Note `err_fix`.
//  · Handy, p ≤ 0,7 (`tap`): drei Korrektur-Chips und „Doch nicht“ (Auswahl, kein freier Abruf); Note `err_tap`.
//  · Handy, p > 0,7 (`tapfix`): Wort antippen, Korrektur höchstens 3 Wörter tippen (Produktion, freier Abruf); Note `err_tapfix`.
// Gibt es keine Chips (Aufgaben aus dem LP2-Adapter), gilt auch am Handy die getippte Korrektur.

export type ErrMode = 'desk' | 'tap' | 'tapfix';
export const FIX_MAX_WORDS = 3;

export function errMode(inp: 'touch' | 'desk', p: number, hasChoices: boolean): ErrMode {
  if (inp === 'desk') return 'desk';
  return p > 0.7 || !hasChoices ? 'tapfix' : 'tap';
}

export function useErrUi(ctrl: C1Ctrl): C1Ui {
  const item = ctrl.item as Err;
  const { t } = useT();
  const words = useMemo(() => splitWords(item.text), [item.text]);
  const range = useMemo(() => errRange(item), [item]);
  const choices = item.bad?.choices ?? null;
  const mode = errMode(ctrl.inp, ctrl.p, !!choices);
  const [sel, setSel] = useState<number | null>(null);
  const [fix, setFix] = useState('');
  const [chip, setChip] = useState<number | null>(null);

  const form = mode === 'tap' ? 'tap' : mode === 'tapfix' ? 'tapfix' : 'typed';
  const report = (s: number | null, f: string, c: number | null): void => {
    if (s === null) {
      ctrl.setResponse(null);
      return;
    }
    const word = words[s] ?? '';
    const text = mode === 'tap' ? (c !== null ? (choices?.[c] ?? '') : '') : f.trim();
    // Höchstens 3 Wörter Korrektur am Handy (Teil-Tippen).
    if (mode === 'tapfix' && text && kwtCount(text) > FIX_MAX_WORDS) {
      ctrl.setResponse(null);
      return;
    }
    ctrl.setResponse({ kind: 'err', tap: s, ...(text ? { fix: text, typed: mode !== 'tap' } : {}) }, { form, tapped: word, chars: text.length });
  };
  const noError = (): void => {
    ctrl.setResponse({ kind: 'err', tap: 'none' }, { form, tapped: 'none' });
    ctrl.submit();
  };
  const undo = (): void => {
    setSel(null);
    setFix('');
    setChip(null);
    ctrl.setResponse(null);
  };

  // Laptop: Taste N = „Kein Fehler“ (nicht im Eingabefeld).
  useEffect(() => {
    if (mode !== 'desk' || ctrl.locked) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() !== 'n' || e.altKey || e.ctrlKey || e.metaKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      e.preventDefault();
      ctrl.setResponse({ kind: 'err', tap: 'none' }, { form, tapped: 'none' });
      ctrl.submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, ctrl, form]);

  const verdict = ctrl.score?.verdict;
  // UX-Prüfung B2: die Korrektur steht im Satz („~~hear~~ → hearing“), wie bei der Lücke; das falsche Wort wird nie grün.
  const fixText = item.bad?.fix[0] ?? null;
  const marks = ctrl.locked && range ? [{ span: range, tone: verdict === 'correct' ? ('ok' as const) : ('wrong' as const), ...(fixText ? { fix: fixText } : {}) }] : [];
  const fixedSentence = range && fixText ? [...words.slice(0, range[0]), fixText, ...words.slice(range[1] + 1)].join(' ') : null;
  const correctChip = choices && item.bad ? choices.findIndex((c) => item.bad?.fix.some((f) => f.trim().toLowerCase() === c.trim().toLowerCase())) : -1;

  return {
    right:
      ctrl.locked && fixedSentence ? (
        <p className="lx-t-support m-0" data-testid="err-correction">
          <span className="text-muted">{t('cxKwtSolution')} </span>
          <span lang="en" className="font-semibold text-ok-text">
            {fixedSentence}
          </span>
        </p>
      ) : null,
    prompt: (
      <div className="flex flex-col gap-2" data-testid="c1x-err" data-err-mode={mode}>
        <TapSentence
          words={words}
          selected={sel}
          onSelect={(i) => {
            setSel(i);
            if (i === null) {
              setFix('');
              setChip(null);
            }
            report(i, fix, chip);
          }}
          locked={ctrl.locked}
          marks={marks}
          area={ctrl.area}
          source={`grammar/${ctrl.task.topic}`}
          wide={mode !== 'desk'}
        />
      </div>
    ),
    answer: (
      <div className="flex flex-col gap-3">
        {!ctrl.locked && sel === null && (
          <p className="lx-t-support text-muted" data-testid="err-hint">
            {t('cxErrTapHint')}
          </p>
        )}
        {!ctrl.locked && sel !== null && mode === 'tap' && choices && (
          <div className="flex flex-col gap-2">
            <span className="lx-t-support text-muted">{t('cxFixLabel')}</span>
            <ChipRow
              options={choices}
              chosen={chip}
              label={t('cxFixLabel')}
              onPick={(i) => {
                setChip(i);
                report(sel, fix, i);
              }}
              testId="err-chips"
            />
          </div>
        )}
        {!ctrl.locked && mode !== 'tap' && (
          <label className="flex flex-col gap-1">
            <span className="lx-t-support text-muted">{mode === 'tapfix' ? t('cxErrFixMax', { max: FIX_MAX_WORDS }) : t('cxFixLabel')}</span>
            <input
              className="lx-field"
              lang="en"
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={fix}
              placeholder={t('cxAnswerPlaceholder')}
              disabled={sel === null}
              data-testid="err-fix"
              onChange={(e) => {
                setFix(e.target.value);
                ctrl.markFirstKey();
                report(sel, e.target.value, chip);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') ctrl.submit();
              }}
            />
            {mode === 'tapfix' && sel !== null && <WordCounter n={kwtCount(fix)} min={1} max={FIX_MAX_WORDS} testId="word-counter-fix" />}
          </label>
        )}
        {!ctrl.locked && (
          // UX-Prüfung KLEIN: „Kein Fehler“ ist eine echte Antwort (Form wie die Bausteine), „Doch nicht“ steht in derselben Reihe.
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="cx-chip" onClick={noError} data-testid="no-error">
              {t('cxNoError')}
              {mode === 'desk' && <span className="lx-t-meta ml-2 text-subtle">N</span>}
            </button>
            {sel !== null && (
              <Button variant="ghost" onClick={undo} data-testid="err-undo">
                {t('cxErrUndo')}
              </Button>
            )}
          </div>
        )}
        {ctrl.locked && correctChip >= 0 && mode === 'tap' && choices && (
          <ChipRow options={choices} chosen={chip} correct={correctChip} revealed label={t('cxFixLabel')} onPick={() => undefined} testId="err-chips" />
        )}
      </div>
    ),
  };
}
