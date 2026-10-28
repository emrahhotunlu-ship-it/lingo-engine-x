import { useEffect, useRef, useState } from 'react';
import { getWriter } from '../../data';
import { currentDevice, dkStep } from '../../domain/dictation/dk';
import { DICTATION_TARGET, evaluateProbe, isTypingKey, type ProbeReason, type ProbeResult } from '../../domain/dictation/probe';
import { createAttemptTracker, bindInputKind, type InputTally } from '../../engine/inputKind';
import { useT, type MessageKey } from '../../i18n';
import { logError, logWarn } from '../../platform/diagnostics';
import { Button } from '../../ui/Button';
import { SentenceInput } from '../../ui/exercise/SentenceInput';
import { toast } from '../../ui/Toast';

// Relaunch Stufe 1 P7 S1-DIKTAT (docs/relaunch/stufe1-plan.md §7.1–7.3): Laptop-Diktat-Probe in Einstellungen › Diagnose.
// Ein Feld mit den Attributen aus §6.4, die P4-Erkennung der Eingabeart (`bindInputKind`) und ein Zielsatz. Erfolg: diktiert
// (ohne Taste, `in = 'd'`), Englisch und mindestens 70 % gleiche Wörter. Ergebnis über den einen Schreibweg in `app/profile.dk`,
// nur bei Änderung. Höchstens zwei Versuche je Laden der Seite (ein zweiter nur auf Wunsch), keine Schleife. Zählt nicht für F1.

const MAX_TRIES = 2;
/** Versuche seit dem Laden der Seite (über Öffnen und Schließen der Probe hinweg). */
let tries = 0;

const REASON: Record<ProbeReason, MessageKey> = {
  empty: 'dkReasonEmpty',
  keys: 'dkReasonKeys',
  paste: 'dkReasonPaste',
  notDictation: 'dkReasonNotDictation',
  notEnglish: 'dkReasonNotEnglish',
  mismatch: 'dkReasonMismatch',
};

type Done = { result: ProbeResult; text: string; tally: InputTally };

export function DictationProbe() {
  const { t } = useT();
  const [text, setText] = useState('');
  const [done, setDone] = useState<Done | null>(null);
  const [left, setLeft] = useState(MAX_TRIES - tries);
  const box = useRef<HTMLDivElement>(null);
  const tracker = useRef(createAttemptTracker());
  const typed = useRef(0);
  const device = currentDevice();

  useEffect(() => {
    const el = box.current;
    if (!el || done) return;
    const tr = tracker.current;
    tr.reset();
    typed.current = 0;
    const accept = (target: EventTarget | null) => target instanceof HTMLTextAreaElement && el.contains(target);
    const unbind = bindInputKind(el, { accept, tracker: tr, now: () => performance.now(), paused: () => 0 });
    const onKey = (e: KeyboardEvent) => {
      if (accept(e.target) && isTypingKey(e.key, { ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey })) typed.current += 1;
    };
    el.addEventListener('keydown', onKey, { capture: true });
    return () => {
      unbind();
      el.removeEventListener('keydown', onKey, { capture: true });
    };
  }, [done]);

  const check = () => {
    if (done || left <= 0) return;
    const tally = tracker.current.rec.tally();
    const result = evaluateProbe({ text, tally, typedKeys: typed.current });
    tries += 1;
    setLeft(MAX_TRIES - tries);
    setDone({ result, text: text.trim(), tally });
    if (!result.ok) logWarn('dictation:probe', { message: result.reason ?? 'fail' }, `key ${tally.keyChars} free ${tally.freeChars} paste ${tally.pasteChars} typed ${typed.current}`);
    if (!device) return;
    const writer = getWriter();
    if (!writer) return;
    const entry = { ok: result.ok, t: Date.now(), sig: device.sig };
    writer.transform('app/profile', (cur) => dkStep(cur, device.os, entry)).catch((err: unknown) => {
      logError('dictation:save', err);
      toast(t('dkSaveFailed'), 'error');
    });
  };

  const retry = () => {
    setText('');
    setDone(null);
  };

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-line p-3" data-testid="dk-probe" data-state={done ? (done.result.ok ? 'ok' : 'fail') : 'input'}>
      <p className="text-sm text-muted">{t('dkWhy')}</p>
      <p className="text-sm">{t('dkDo')}</p>
      <p className="text-sm text-muted" data-testid="dk-how">
        {t('dkHintDictate')}
      </p>
      <div className="flex flex-col gap-1">
        <span className="lx-eyebrow">{t('dkSay')}</span>
        <p className="text-base font-semibold" lang="en" data-testid="dk-target">
          {DICTATION_TARGET}
        </p>
      </div>
      {!done && left <= 0 && (
        <p className="text-sm text-muted" data-testid="dk-no-more">
          {t('dkNoMore')}
        </p>
      )}
      {!done && left > 0 && (
        <div ref={box}className="flex flex-col gap-2">
          <SentenceInput mode="free" value={text} onChange={setText} onSubmit={check} testId="dk-input" />
          <div>
            <Button variant="primary" onClick={check} data-testid="dk-check">
              {t('dkCheck')}
            </Button>
          </div>
        </div>
      )}
      {done?.result.ok && (
        <div role="status" data-testid="dk-ok">
          <p className="text-sm font-semibold text-ok-text">{t('dkOk')}</p>
          <p className="text-sm text-muted">{t('dkOkSub')}</p>
        </div>
      )}
      {done && !done.result.ok && (
        <div className="flex flex-col gap-1" role="status" data-testid="dk-fail" data-reason={done.result.reason ?? ''}>
          <p className="text-sm font-semibold text-near-text">{t('dkFail')}</p>
          <p className="text-sm" data-testid="dk-reason">
            {t(REASON[done.result.reason ?? 'empty'])}
          </p>
          {done.text && (
            <p className="text-sm text-muted" lang="en">
              {t('dkYou', { text: done.text })}
            </p>
          )}
          <p className="lx-tnum text-xs text-muted" data-testid="dk-tech">
            {t('dkTech', { key: done.tally.keyChars, free: done.tally.freeChars, paste: done.tally.pasteChars, match: Math.round(done.result.match * 100) })}
          </p>
          {left > 0 ? (
            <div>
              <Button variant="quiet" onClick={retry} data-testid="dk-retry">
                {t('dkRetry')}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted" data-testid="dk-no-more">
              {t('dkNoMore')}
            </p>
          )}
        </div>
      )}
      {done && !device && (
        <p className="text-xs text-muted" data-testid="dk-not-saved">
          {t('dkNotSaved')}
        </p>
      )}
    </div>
  );
}
