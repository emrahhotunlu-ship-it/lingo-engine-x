import { useMachine } from '@xstate/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useSettings } from '../../app/settings';
import { checkTyped } from '../../domain/answer/check';
import { maskOf } from '../../domain/answer/mask';
import { VT_BANDS } from '../../domain/vtest/build';
import { vtestPatch } from '../../domain/vtest/persist';
import type { VtestResult } from '../../domain/vtest/score';
import { Choices } from '../../engine/Choices';
import { useHiddenInput } from '../../engine/HiddenInput';
import { KineticGap } from '../../engine/KineticGap';
import { useHotkeys } from '../../engine/useHotkeys';
import { useT } from '../../i18n';
import { playCue } from '../../platform/sound';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { useCompanionSee } from '../companion/seeing';
import { InfoToggle } from '../progress/JudgeTab';
import { ExerciseTop } from '../learn/ui';
import { recordProfileFields } from '../progress/persist';
import { restoredVtest, vtestMachine, vtestSnapOf } from './machine';
import { setVtestSnap, takePendingVtest, useVtestSession } from './session';

// Wortschatztest (Plan §8, E17): freiwillig, nie Pflicht. Teil 1 ist eine Wissensabfrage des
// Tests (Kenne ich / Kenne ich nicht) – keine Selbstbewertung einer Wiederholung. Teil 2 wählt
// die Bedeutung, Teil 3 tippt das Wort in die Lücke (Buchstaben-Platzhalter und erster Buchstabe).
// Neubau (G3): Nach jedem Schritt liegt eine Momentaufnahme in `session.ts`; nach dem Neuladen
// bzw. beim erneuten Öffnen am selben Lerntag geht es an genau derselben Stelle weiter. ✕ fragt
// nie nach (N02) und behält den Stand; „Abbrechen“ fragt und verwirft ihn.

async function saveResult(r: VtestResult, day: string): Promise<void> {
  const ok = await recordProfileFields('vtest:save', (cur) => vtestPatch(cur, r, day));
  if (!ok) throw new Error('vtest not saved');
}

export function VtestScreen() {
  const { t, num, lang } = useT();
  const go = useNav((s) => s.go);
  const back = useNav((s) => s.back);
  const api = useHiddenInput();
  const day = useClock((s) => s.today);
  const input = useMemo(() => ({ seed: day, lang: useSettings.getState().lang, day, now: () => Date.now(), save: (r: VtestResult) => saveResult(r, day) }), [day]);
  // Herstellen: vom Rahmen übergeben (Neuladen) oder der Stand dieses Lerntags (✕ und erneut öffnen).
  const [restored] = useState(() => {
    const p = takePendingVtest() ?? useVtestSession.getState().snap;
    return p && p.day === day ? restoredVtest(p, input) : null;
  });
  const [snap, send] = useMachine(vtestMachine, restored ? { input, snapshot: restored } : { input });
  const c = snap.context;
  const state = snap.value as string;
  const [typed, setTyped] = useState('');
  const typedRef = useRef('');

  useCompanionSee({ area: 'overview', label: t('vtTitle'), phase: state === 'result' ? 'feedback' : 'question' });

  // Momentaufnahme nach jedem Schritt (reiner Lesezugriff; Ergebnis/Abbruch → null = gelöscht).
  useEffect(() => {
    setVtestSnap(vtestSnapOf(state, c));
  }, [state, c]);

  // Tasten im Ja/Nein-Teil: J/N bzw. 1/2 (Plan §8.1).
  useEffect(() => {
    if (state !== 'yesno') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const k = e.key.toLowerCase();
      if (k === 'j' || k === 'y') send({ type: 'YES' });
      else if (k === 'n') send({ type: 'NO' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, send]);

  const activeItem = state === 'active' ? c.active[c.i] : undefined;
  const running = state === 'yesno' || state === 'meaning' || state === 'active';
  const meaningItem = state === 'meaning' ? c.meaning[c.i] : undefined;

  const checkActive = () => {
    if (!activeItem || c.answered) return;
    const res = checkTyped(typedRef.current, [activeItem.w], { lemma: activeItem.w });
    send({ type: 'TYPED', correct: res.verdict !== 'wrong' });
  };
  const next = () => {
    typedRef.current = '';
    setTyped('');
    send({ type: 'NEXT' });
    // Tastatur in derselben Geste öffnen (iOS): nächstes Wort in Teil 3 bzw. Wechsel zu Teil 3.
    if ((state === 'active' && c.i + 1 < c.active.length) || (state === 'meaning' && c.i + 1 >= c.meaning.length)) api.focusNow();
  };

  useHotkeys(
    {
      digit: (n) => {
        if (state === 'yesno' && (n === 1 || n === 2)) send({ type: n === 1 ? 'YES' : 'NO' });
        else if (meaningItem && !c.answered) {
          const o = meaningItem.options[n - 1];
          if (o) {
            playCue(o.correct ? 'correct' : 'wrong');
            send({ type: 'CHOOSE', id: o.id });
          }
        }
      },
      enter: () => {
        if (state === 'meaning' && c.answered) next();
        else if (state === 'active') {
          if (c.answered) next();
          else checkActive();
        }
      },
      escape: () => {
        if (state === 'yesno' || state === 'meaning' || state === 'active') send({ type: 'CANCEL' });
      },
    },
    api.isInput,
  );

  // Fortschritt steht in der Übungsleiste; hier nur der Teil (UX-Beratung Nr. 4).
  const header = (step: string, n: number, total: number) => (
    <div className="flex items-center justify-between gap-3">
      <p className="lx-eyebrow">{step}</p>
      <p className="sr-only" data-testid="vt-progress">
        {t('vtProgress', { n: n + 1, total })}
      </p>
    </div>
  );

  const cancelBtn = (
    <Button variant="ghost" onClick={() => send({ type: 'CANCEL' })} data-testid="vt-cancel">
      {t('vtCancel')}
    </Button>
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6 sm:py-10" data-testid="vtest" data-state={state}>
      <ExerciseTop
        onClose={back}
        closeLabel={t('vtCancel')}
        closeTestId="vt-close"
        progress={running ? { n: c.i + 1, total: state === 'yesno' ? c.yesno.length : state === 'meaning' ? c.meaning.length : c.active.length } : null}
        progressTestId="vt-bar"
        ctx="extra"
      />
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('vtTitle')}</h1>
        </div>
        <InfoToggle label={t('assessInfoLabel')} text={t('vtPurpose')} />
      </header>

      {state === 'intro' && (
        <Card className="flex flex-col gap-4">
          <p className="text-base text-muted">{t('vtIntro')}</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => send({ type: 'START' })} data-testid="vt-start">
              {t('vtStart')}
            </Button>
            <Button variant="ghost" onClick={back}>
              {t('vtBack')}
            </Button>
          </div>
        </Card>
      )}

      {state === 'yesno' && c.yesno[c.i] && (
        <Card className="flex flex-col gap-6">
          {header(t('vtStepYesNo'), c.i, c.yesno.length)}
          <p className="py-6 text-center text-4xl font-semibold tracking-tight" lang="en" data-testid="vt-word">
            {c.yesno[c.i]?.w}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" onClick={() => send({ type: 'NO' })} data-testid="vt-no">
              {t('vtDontKnow')}
            </Button>
            <Button size="lg" variant="primary" onClick={() => send({ type: 'YES' })} data-testid="vt-yes">
              {t('vtKnow')}
            </Button>
          </div>
          <div className="flex justify-end">{cancelBtn}</div>
        </Card>
      )}

      {meaningItem && (
        <Card className="flex flex-col gap-5">
          {header(t('vtStepMeaning'), c.i, c.meaning.length)}
          <p className="text-center text-3xl font-semibold tracking-tight" lang="en" data-testid="vt-word">
            {meaningItem.w}
          </p>
          <div data-testid="vt-choices">
            <Choices
              label={t('vtStepMeaning')}
              items={meaningItem.options.map((o) => ({ id: o.id, label: o.label, lang, correct: o.correct }))}
              chosen={c.answered?.id ?? null}
              onChoose={(id) => send({ type: 'CHOOSE', id })}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            {cancelBtn}
            {c.answered && (
              <Button variant="primary" iconAfter="arrowRight" onClick={next} data-testid="vt-next">
                {t('vtNext')}
              </Button>
            )}
          </div>
        </Card>
      )}

      {activeItem && (
        <Card className="flex flex-col gap-5">
          {header(t('vtStepActive'), c.i, c.active.length)}
          <p className="text-center text-lg" data-testid="vt-meaning">
            {activeItem.meaning}
          </p>
          <p className="lx-sentence text-center" lang="en">
            <KineticGap
              key={activeItem.w}
              label={t('vtGapLabel')}
              maxLength={activeItem.w.length + 8}
              state={!c.answered ? 'input' : c.answered.correct ? 'correct' : 'wrong'}
              mask={maskOf(activeItem.w, { firstLetter: true })}
              shown={c.answered ? typed : null}
              onChange={(v) => {
                typedRef.current = v;
                setTyped(v);
              }}
              onEnter={() => (c.answered ? next() : checkActive())}
            />
          </p>
          {c.answered && (
            <p className={`text-center text-sm ${c.answered.correct ? 'text-ok-text' : 'text-danger-text'}`} data-testid="vt-verdict" data-correct={c.answered.correct ? '1' : '0'}>
              {c.answered.correct ? t('vtCorrect') : t('vtWrongWas', { w: activeItem.w })}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            {cancelBtn}
            {c.answered ? (
              <Button variant="primary" iconAfter="arrowRight" onClick={next} data-testid="vt-next">
                {t('vtNext')}
              </Button>
            ) : (
              <Button variant="primary" onClick={checkActive} data-testid="vt-check">
                {t('vtCheck')}
              </Button>
            )}
          </div>
        </Card>
      )}

      {state === 'asking' && (
        <Card role="alertdialog" aria-labelledby="vt-ask" className="flex flex-col gap-4">
          <p id="vt-ask" className="text-base">
            {t('vtCancelAsk')}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => send({ type: 'RESUME' })} data-testid="vt-resume">
              {t('vtCancelNo')}
            </Button>
            <Button onClick={() => send({ type: 'CONFIRM_CANCEL' })} data-testid="vt-cancel-yes">
              {t('vtCancelYes')}
            </Button>
          </div>
        </Card>
      )}

      {(state === 'saving' || state === 'scoring') && (
        <p role="status" className="text-sm text-muted">
          {t('vtSaving')}
        </p>
      )}

      {state === 'saveError' && (
        <Card role="alert" className="flex flex-col gap-3">
          <p className="text-sm text-danger-text">{t('vtSaveError')}</p>
          <div>
            <Button icon="refresh" onClick={() => send({ type: 'RETRY' })} data-testid="vt-retry">
              {t('vtSaveRetry')}
            </Button>
          </div>
        </Card>
      )}

      {state === 'result' && c.result && (
        <Card className="flex flex-col gap-4" data-testid="vt-result" data-passive={c.result.passive} data-active={c.result.active}>
          <p className="lx-eyebrow">{t('vtResultTitle')}</p>
          <p className="lx-tnum text-5xl font-semibold tracking-tight">{num(c.result.passive)}</p>
          <p className="lx-tnum text-base text-muted">{t('vtResult', { p: c.result.passive, lo: c.result.pLo, hi: c.result.pHi, a: c.result.active })}</p>
          <table className="w-full text-left text-xs">
            <caption className="pb-1 text-left text-sm font-semibold">{t('vtBandsTitle')}</caption>
            <tbody>
              {c.result.bands.slice(0, VT_BANDS).map((b, i) => (
                <tr key={i} className="border-t border-line">
                  <th scope="row" className="lx-tnum py-1 pr-3 font-normal text-muted">
                    {t('vtBand', { from: i * 1000 + 1, to: (i + 1) * 1000 })}
                  </th>
                  <td className="lx-tnum py-1 text-right text-muted">{num(Math.round(b * 100))} %</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <Button variant="primary" iconAfter="arrowRight" onClick={() => go({ name: 'overview', tab: 'path' })} data-testid="vt-done">
              {t('vtBack')}
            </Button>
          </div>
        </Card>
      )}

      {state === 'cancelled' && (
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t('vtCancelled')}</p>
          <div>
            <Button onClick={back} data-testid="vt-back">
              {t('vtBack')}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
