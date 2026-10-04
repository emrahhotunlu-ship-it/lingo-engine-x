import { useState } from 'react';
import type { ScreenProps } from '../../app/registry';
import { useSettings } from '../../app/settings';
import type { InboxMail } from '../../content/nb/schemas';
import { INBOX_GIST_MAX, INBOX_REPLY_MAX, wordsOf } from '../../domain/nbdrill/inbox';
import { EnglishText } from '../../engine/EnglishText';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { FeedbackPanel } from '../../ui/FeedbackPanel';
import type { Feedback } from '../../ui/feedback/types';
import { AiRunPanel } from '../../ui/AiRunPanel';
import { finishUnit, GoalLine, Note, StepBoundary, TaskHead, TrainingBar } from '../nbdrill/shared';
import { advance, endInbox, ensureInbox, finishReview, inboxResult, mailOf, retryInboxCheck, setGist, setReply, toggleMust, useInbox, type InboxSession } from './session';

// Posteingang (Plan N104): drei Schritte – lesen, Anliegen benennen (Deutsch erlaubt), antworten –
// dann Rückmeldung: Anliegen getroffen? Pflichtpunkte? Ton? ≤ 3 Korrekturen, bessere Fassung.
// Ohne KI: Selbstvergleich mit dem verdeckten Anliegen, den Punkten und der Musterantwort.

const STEP_NO: Record<InboxSession['step'], number> = { read: 1, gist: 2, reply: 3, review: 3 };

export function InboxScreen({ route }: ScreenProps<'inbox'>) {
  const { t } = useT();
  useState(() => ensureInbox(route, useSettings.getState().lang));
  const s = useInbox((x) => x.s);
  const m = s ? mailOf(s) : null;
  if (!s || !m) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4" data-testid="inbox" data-state="empty">
        <TrainingBar route={route} unit={null} progress={null} />
        <p className="text-sm text-muted">{t('nbTrainingEmpty')}</p>
      </div>
    );
  }
  const finish = () => {
    const unit = s.unit;
    const result = inboxResult(s);
    if (!s.done) finishReview();
    endInbox();
    finishUnit(unit, unit ? result : undefined);
  };
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-8" data-testid="inbox" data-step={s.step} data-mail={m.id} data-state={s.done ? 'done' : 'open'}>
      <TrainingBar route={route} unit={s.unit} progress={{ n: STEP_NO[s.step], total: 3 }} />
      <StepBoundary resetKey={s.step} scope="inbox" onSkip={finish}>
        <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7">
          <TaskHead
            status={`${t('nbTrainingInbox')} · ${STEP_NO[s.step]} / 3`}
            task={t(s.step === 'read' ? 'nbTrainingInboxRead' : s.step === 'gist' ? 'nbTrainingInboxGistTask' : 'nbTrainingInboxReplyTask')}
            purpose={t('nbTrainingInboxPurpose')}
          />
          {(s.step === 'read' || s.step === 'gist') && <Mail m={m} />}
          {s.step === 'reply' && (
            <details className="text-sm" data-testid="inbox-mail-fold">
              <summary className="cursor-pointer text-muted">{t('nbTrainingInboxShowMail')}</summary>
              <div className="mt-3">
                <Mail m={m} />
              </div>
            </details>
          )}
          {s.step === 'read' && (
            <div>
              <Button variant="primary" iconAfter="arrowRight" onClick={advance} data-testid="inbox-next">
                {t('nbTrainingNext')}
              </Button>
            </div>
          )}
          {s.step === 'gist' && (
            <div className="flex flex-col gap-3">
              <textarea
                className="lx-field min-h-20 text-base"
                rows={2}
                maxLength={INBOX_GIST_MAX}
                value={s.gist}
                onChange={(e) => setGist(e.target.value)}
                aria-label={t('nbTrainingInboxGistLabel')}
                placeholder={t('nbTrainingInboxGistLabel')}
                autoCapitalize="sentences"
                data-testid="inbox-gist"
              />
              <div>
                <Button variant="primary" disabled={!s.gist.trim()} onClick={advance} data-testid="inbox-next">
                  {t('nbTrainingNext')}
                </Button>
              </div>
            </div>
          )}
          {s.step === 'reply' && (
            <div className="flex flex-col gap-3">
              <textarea
                className="lx-field min-h-48 text-base"
                lang="en"
                rows={9}
                maxLength={INBOX_REPLY_MAX}
                value={s.reply}
                onChange={(e) => setReply(e.target.value)}
                aria-label={t('nbTrainingInboxReplyLabel')}
                placeholder={t('nbTrainingInboxReplyLabel')}
                autoCapitalize="sentences"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-testid="inbox-reply"
              />
              <p className="lx-tnum text-xs text-muted" data-testid="inbox-words">
                {t('nbTrainingWords', { n: wordsOf(s.reply) })}
              </p>
              <GoalLine text={s.reply} targets={s.unit?.targets} />
              <div>
                <Button variant="primary" disabled={!s.reply.trim()} onClick={advance} data-testid="inbox-check">
                  {t('nbTrainingCheck')}
                </Button>
              </div>
            </div>
          )}
          {s.step === 'review' && <Review s={s} m={m} onNext={finish} />}
        </article>
      </StepBoundary>
    </div>
  );
}

function Mail({ m }: { m: InboxMail }) {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface p-4" data-testid="inbox-mail">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted">{t('nbTrainingInboxFrom')}</dt>
        <dd>
          {m.from} · <span className="text-muted">{m.role}</span>
        </dd>
        <dt className="text-muted">{t('nbTrainingInboxSubject')}</dt>
        <dd className="font-medium" lang="en">
          {m.subject}
        </dd>
      </dl>
      <div className="flex flex-col gap-3">
        {m.body.split(/\n{2,}/).map((p, i) => (
          <EnglishText key={i} text={p.replace(/\n/g, ' ')} area="write" source={`inbox/${m.id}`} className="text-base leading-relaxed" />
        ))}
      </div>
    </div>
  );
}

const TONE_KEY: Record<string, MessageKey> = {
  fits: 'nbTrainingInboxTone_fits',
  too_formal: 'nbTrainingInboxTone_too_formal',
  too_casual: 'nbTrainingInboxTone_too_casual',
  too_direct: 'nbTrainingInboxTone_too_direct',
};

function Review({ s, m, onNext }: { s: InboxSession; m: InboxMail; onNext: () => void }) {
  const { t, lang } = useT();
  const out = s.ai.out;
  const busy = ['queued', 'thinking', 'streaming', 'slow'].includes(s.ai.phase);
  const onlyRead = !s.reply.trim();
  const fb: Feedback | null = onlyRead
    ? null
    : out
      ? {
          verdict: out.gist && out.must.every(Boolean) ? 'ok' : out.gist || out.must.some(Boolean) ? 'close' : 'wrong',
          effect: `${t(TONE_KEY[out.tone] ?? 'nbTrainingInboxTone_fits')} ${out.effect}`,
          mine: s.reply.trim(),
          solution: out.better,
          fixes: out.fixes.map((f) => ({ kind: 'form' as const, mine: f.mine, right: f.right, why: f.why })),
          why: { question: `${m.subject}: ${s.reply.trim().slice(0, 300)}` },
        }
      : busy
        ? null
        : { verdict: 'unchecked', mine: s.reply.trim(), solution: m.reply, fixes: [] };
  return (
    <div className="flex flex-col gap-4 border-t border-line pt-4" data-testid="inbox-review" data-mode={out ? 'ai' : busy ? 'busy' : 'self'}>
      <div className="flex flex-col gap-1" data-testid="inbox-hidden">
        <p className="lx-eyebrow">{t('nbTrainingInboxHidden')}</p>
        <p className="text-sm">{m.hidden[lang]}</p>
        <p className="text-sm text-muted">
          {t('nbTrainingInboxYourGist')}: {s.gist.trim()}
        </p>
        {out && (
          <Note tone={out.gist ? 'ok' : 'warn'} testId="inbox-gist-verdict" kind={out.gist ? 'ok' : 'miss'}>
            <span className="font-medium">{t(out.gist ? 'nbTrainingInboxGistOk' : 'nbTrainingInboxGistMiss')}</span> · {out.gistNote}
          </Note>
        )}
      </div>
      {onlyRead && <Note tone="info">{t('nbTrainingInboxReadDone')}</Note>}
      {!onlyRead && (
        <fieldset className="flex flex-col gap-2" data-testid="inbox-must">
          <legend className="mb-1 text-sm font-medium">{out ? t('nbTrainingInboxMust') : t('nbTrainingInboxSelfCompare')}</legend>
          {m.must.map((p, i) => (
            <label key={i} className="flex min-h-11 items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 size-5 accent-[var(--color-accent)]" checked={out ? !!out.must[i] : !!s.self[i]} disabled={!!out || busy} onChange={() => toggleMust(i)} data-testid={`inbox-must-${i}`} />
              <span>{p[lang]}</span>
            </label>
          ))}
        </fieldset>
      )}
      {busy && <AiRunPanel phase={s.ai.phase === 'idle' ? 'queued' : s.ai.phase} error={null} skeleton={false} />}
      {s.ai.phase === 'error' && s.ai.error && <AiRunPanel phase="error" error={s.ai.error} onRetry={retryInboxCheck} skeleton={false} />}
      {fb ? (
        <FeedbackPanel fb={fb} onNext={onNext} />
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button variant={onlyRead ? 'primary' : 'ghost'} onClick={onNext} data-testid="next">
            {onlyRead ? t('nbTrainingNext') : t('nbTrainingInboxSaveUnchecked')}
          </Button>
        </div>
      )}
      {!onlyRead && !out && !busy && (
        <div className="flex flex-col gap-2" data-testid="inbox-model">
          <p className="lx-eyebrow">{t('nbTrainingModel')}</p>
          {m.reply.split(/\n{2,}/).map((p, i) => (
            <EnglishText key={i} text={p.replace(/\n/g, ' ')} area="write" source={`inbox/${m.id}`} className="text-sm leading-relaxed" />
          ))}
        </div>
      )}
    </div>
  );
}
