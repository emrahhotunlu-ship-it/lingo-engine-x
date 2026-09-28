import { useMachine } from '@xstate/react';
import { mailResume } from '../speak/resumable';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useClock } from '../../app/clock';
import { TitleActions } from '../system/Chrome';
import { useNav } from '../../app/nav';
import { useT } from '../../i18n';
import { askJson } from '../../ai/gate';
import { useAiAvailable, useAiScope } from '../../ai/scope';
import { isAiFailure } from '../../ai/types';
import { bizId, MAIL_TEXT_MAX } from '../../domain/business/bizDoc';
import { changesOf, composeMail, MAIL_MAX, pickList, segmentMail, wordCount } from '../../domain/business/mailCompose';
import type { Intent, Recipient } from '../../domain/business/types';
import { monthOf } from '../../domain/speak/talkDoc';
import { EnglishText } from '../../engine/EnglishText';
import { logWarn } from '../../platform/diagnostics';
import { KEY_PREFIX, local } from '../../platform/storage';
import { mailRefine } from '../../prompts/mailRefine';
import { Button, IconButton } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Segmented } from '../../ui/Segmented';
import { Skeleton } from '../../ui/Skeleton';
import { TakeChunkButton } from '../speak/TakeChunkButton';
import { mailMachine } from './mailMachine';
import { saveBizItem } from './persist';
import { TilePicker } from './TilePicker';
import { useCompanionSee } from '../companion/seeing';

// E-Mail-Refiner (Plan §5.5): Eingabe → Claude bewertet Satz für Satz → je schwachem Satz
// Bausteine wählen → fertige Mail zum Kopieren, Zahl der Änderungen, Wendungen mitnehmen.
// Gespeichert (biz/<Monat>, Log, Profil) wird einmal beim „Fertig“.

const DRAFT_KEY = `${KEY_PREFIX}draft:mail`;
const STATUS_KEY = { ok: 'mailSt_ok', stiff: 'mailSt_stiff', unclear: 'mailSt_unclear', wrong: 'mailSt_wrong' } as const;

export function MailRefiner() {
  const { t, lang } = useT();
  const back = useNav((s) => s.back);
  const ai = useAiAvailable();
  const scope = useAiScope();
  const [snap, send] = useMachine(mailMachine);
  useCompanionSee({ area: 'business', label: `${t('bizTitle')} · ${t('bizMail')}`, phase: 'idle' });
  // Fortsetzen (G3): Entwurf aus der Momentaufnahme, sonst aus `lx:draft:mail`.
  const [text, setText] = useState(() => mailResume.take()?.text ?? local.get(DRAFT_KEY) ?? '');
  const [recipient, setRecipient] = useState<Recipient>('client');
  const [intent, setIntent] = useState<Intent>('inform');
  const [copied, setCopied] = useState<'none' | 'ok' | 'manual'>('none');
  const [saveFailed, setSaveFailed] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  const started = useRef(0);
  const saved = useRef<string | null>(null);
  const [savedRef, setSavedRef] = useState('');
  const finalRef = useRef<HTMLDivElement>(null);
  const c = snap.context;
  const state = snap.value;
  useEffect(() => {
    if (state === 'done') mailResume.clear();
    else if (text.trim()) mailResume.set({ step: state === 'choosing' ? 'pick' : 'write', text: text.slice(0, 4000) });
  }, [state, text]);

  const recipients: ReadonlyArray<{ value: Recipient; label: string }> = [
    { value: 'client', label: t('mailRcpClient') },
    { value: 'boss', label: t('mailRcpBoss') },
    { value: 'partner', label: t('mailRcpPartner') },
    { value: 'team', label: t('mailRcpTeam') },
  ];
  const intents: ReadonlyArray<{ value: Intent; label: string }> = [
    { value: 'inform', label: t('mailIntInform') },
    { value: 'request', label: t('mailIntRequest') },
    { value: 'decline', label: t('mailIntDecline') },
    { value: 'followup', label: t('mailIntFollowup') },
    { value: 'escalate', label: t('mailIntEscalate') },
  ];

  const byI = useMemo(() => new Map((c.result?.segments ?? []).map((s) => [s.i, s])), [c.result]);
  const final = useMemo(() => composeMail(c.segments, c.result?.segments ?? [], c.picks), [c.segments, c.result, c.picks]);
  const orig = useMemo(() => composeMail(c.segments, [], {}), [c.segments]);

  const refine = async () => {
    const segments = segmentMail(text);
    if (!segments.length) return;
    started.current = Date.now();
    saved.current = null;
    // Neuversuch nach einem Fehler: Zwischenspeicher von `sample` einmal übergehen.
    const refresh = !!c.error;
    send({ type: 'REFINE', segments });
    const x = scope.controller();
    ctl.current = x;
    try {
      const r = await askJson({
        template: mailRefine,
        vars: { segments: segments.map((s) => ({ i: s.i, text: s.text })), recipient, intent, uiLang: lang },
        signal: x.signal,
        refresh,
        onPhase: (p) => {
          if (p === 'slow') send({ type: 'SLOW' });
        },
      });
      send({ type: 'RESULT', result: r.data });
    } catch (err) {
      if (isAiFailure(err) && err.kind === 'cancelled') send({ type: 'CANCEL' });
      else {
        if (!isAiFailure(err)) logWarn('biz:mail', err);
        send({ type: 'FAIL', error: isAiFailure(err) ? (err.messageKey ?? 'aiFailed') : 'aiFailed' });
      }
    }
  };

  const finish = async () => {
    send({ type: 'FINISH' });
    local.remove(DRAFT_KEY);
    const t0 = started.current || Date.now();
    const id = bizId('mail', t0);
    if (saved.current === id) return;
    saved.current = id;
    setSavedRef(`biz/${monthOf(useClock.getState().today)}#${id}`);
    const taken: string[] = [];
    const ok = await saveBizItem(
      { id, t: t0, day: useClock.getState().today, kind: 'mail', recipient, intent, orig: orig.slice(0, MAIL_TEXT_MAX), final: final.slice(0, MAIL_TEXT_MAX), picks: pickList(c.picks), changes: changesOf(c.picks), taken, lang },
      { lang, title: t('bizMail'), n: 1, right: 1, activeMs: Date.now() - t0 },
    );
    setSaveFailed(!ok);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(final);
      setCopied('ok');
    } catch (err) {
      logWarn('biz:copy', err);
      const el = finalRef.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      setCopied('manual');
    }
  };

  const chosenPhrases = pickList(c.picks)
    .map(([i, k]) => {
      const opt = byI.get(i)?.options[k];
      const seg = c.segments.find((s) => s.i === i);
      return opt && opt.phrase && opt.de && opt.def && seg ? { phrase: opt.phrase, de: opt.de, def: opt.def, register: opt.register, why: opt.why, text: opt.text, orig: seg.text } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <div className="flex flex-col gap-6 py-6" data-testid="mail-refiner" data-state={state}>
      <header className="flex items-start gap-2">
        <IconButton icon="arrowLeft" label={t('spBack')} onClick={back} className="-ml-2 flex-none" data-testid="back" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('bizMail')}</h1>
          <p className="text-sm text-muted">{state === 'choosing' ? t('mailTask') : state === 'done' ? t('mailDone') : t('mailLead')}</p>
        </div>
        <TitleActions />
      </header>

      {(state === 'input' || state === 'refining') && (
        <Card channel="business" className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">{t('mailInputLabel')}</span>
            <textarea
              lang="en"
              data-testid="mail-input"
              value={text}
              maxLength={MAIL_MAX}
              rows={8}
              disabled={state === 'refining'}
              onChange={(e) => {
                setText(e.target.value);
                local.set(DRAFT_KEY, e.target.value);
              }}
              className="resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-fg outline-none focus:border-[var(--lx-accent)]"
            />
          </label>
          <div className="flex flex-col gap-2" data-testid="mail-recipient">
            <p className="text-sm font-medium">{t('mailRecipient')}</p>
            <Segmented label={t('mailRecipient')} value={recipient} options={recipients} onChange={setRecipient} />
          </div>
          <div className="flex flex-col gap-2" data-testid="mail-intent">
            <p className="text-sm font-medium">{t('mailIntent')}</p>
            <Segmented label={t('mailIntent')} value={intent} options={intents} onChange={setIntent} />
          </div>
          {!ai && <p className="text-sm text-muted">{t('bizNoAi')}</p>}
          {c.error && state === 'input' && (
            <p role="alert" className="text-sm text-danger-text">
              {t(c.error)}
            </p>
          )}
          {state === 'refining' ? (
            <div role="status" className="flex flex-col gap-2">
              <p className="text-sm text-muted">{c.slow ? t('aiSlow') : t('aiThinking')}</p>
              <Skeleton className="h-16 w-full" />
              <div>
                <Button icon="stop" onClick={() => ctl.current?.abort()}>
                  {t('aiStop')}
                </Button>
              </div>
            </div>
          ) : (
            ai && (
              <div>
                <Button variant="primary" size="lg" icon="sparkle" disabled={!text.trim()} onClick={() => void refine()} data-testid="mail-refine" data-ai="">
                  {c.error ? t('aiRetry') : t('mailRefine')}
                </Button>
              </div>
            )
          )}
        </Card>
      )}

      {state === 'choosing' && c.result && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted" data-testid="mail-tone">
            {c.result.tone}
          </p>
          {c.segments.map((s) => {
            const r = byI.get(s.i);
            const status = r?.status ?? 'ok';
            return (
              <div key={s.i} data-testid="mail-seg" data-status={status} className="flex flex-col gap-1.5">
                {status === 'ok' || !r?.options.length ? (
                  <EnglishText text={s.text} area="business" className="px-1 text-base text-muted" />
                ) : (
                  <>
                    <p className="px-1 text-xs font-medium text-gold-text">{t(STATUS_KEY[status])}</p>
                    <TilePicker seg={s.i} original={s.text} options={r.options} chosen={c.picks[s.i] ?? -1} onPick={(opt) => send({ type: 'PICK', seg: s.i, opt })} />
                  </>
                )}
              </div>
            );
          })}
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" iconAfter="arrowRight" onClick={() => void finish()} data-testid="mail-finish">
              {t('mailFinish')}
            </Button>
            <Button variant="ghost" onClick={() => send({ type: 'EDIT' })}>
              {t('mailEdit')}
            </Button>
          </div>
        </div>
      )}

      {state === 'done' && (
        <div className="flex flex-col gap-4">
          <Card channel="business">
            <div ref={finalRef} data-testid="mail-final" className="whitespace-pre-wrap">
              <EnglishText as="div" text={final} area="business" className="text-base leading-relaxed" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button icon="copy" onClick={() => void copy()} data-testid="mail-copy">
                {copied === 'ok' ? t('mailCopied') : t('mailCopy')}
              </Button>
              {copied === 'manual' && (
                <span className="text-sm text-muted" data-testid="mail-copy-manual">
                  {t('mailCopyManual')}
                </span>
              )}
            </div>
          </Card>
          <p className="lx-tnum text-sm text-muted" data-testid="mail-stats">
            {t('mailStats', { changes: changesOf(c.picks), before: wordCount(orig), after: wordCount(final) })}
          </p>
          {saveFailed && (
            <p role="alert" className="text-sm text-danger-text">
              {t('repNotSaved')}
            </p>
          )}
          {chosenPhrases.length > 0 && (
            <Card as="div" className="flex flex-col gap-3">
              <p className="lx-eyebrow">{t('bizPhrases')}</p>
              {chosenPhrases.map((p) => (
                <div key={p.phrase} className="flex flex-wrap items-center justify-between gap-2">
                  <EnglishText as="span" text={p.phrase} area="business" className="font-medium" />
                  <TakeChunkButton
                    input={{
                      en: p.phrase,
                      de: p.de,
                      def: p.def,
                      kind: 'phrase',
                      register: p.register,
                      why: p.why,
                      whyLang: lang,
                      level: 'C1',
                      src: { kind: 'mail', ref: savedRef, title: t('bizMail'), utterance: p.orig, upgraded: p.text },
                    }}
                  />
                </div>
              ))}
            </Card>
          )}
          <div>
            <Button
              onClick={() => {
                setText('');
                setCopied('none');
                send({ type: 'RESET' });
              }}
              data-testid="mail-new"
            >
              {t('mailNew')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
