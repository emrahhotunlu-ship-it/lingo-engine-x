import { useState } from 'react';
import { useClock } from '../../../app/clock';
import { useNav } from '../../../app/nav';
import { checkTyped } from '../../../domain/answer/check';
import { meaningOf } from '../../../domain/srs/cards';
import { CONFIDENCE_KEYS, confidenceDots, confidenceOf } from '../../../domain/srs/confidence';
import { cardExamples } from '../../../domain/srs/examples';
import { posKey } from '../../../domain/srs/explain';
import { retrievability } from '../../../domain/srs/scheduler';
import { exerciseBalance } from '../../../domain/srs/vocabList';
import type { AnswerEvent, TrainCard } from '../../../domain/srs/types';
import { EnglishText } from '../../../engine/EnglishText';
import { useHiddenInput } from '../../../engine/HiddenInput';
import { useT, type MessageKey } from '../../../i18n';
import { speak, useSpeech } from '../../../platform/speech';
import { Button } from '../../../ui/Button';
import { Disclosure } from '../../../ui/Disclosure';
import { Sheet } from '../../../ui/Sheet';
import { toast } from '../../../ui/Toast';
import { nextT, recordAnswer } from '../../progress/persist';
import { Dots } from '../../grammar/GrammarScreen';
import { isLeech, MnemonicBlock } from '../mnemonic';
import { startSession } from '../session';
import { markKnown, resetCard, setHidden } from './actions';

// Wortblatt (M1): oben Status (Sicherheit, Stufe, nächste Wiederholung), dann Ursprungssatz und
// Beispiele (jedes Wort antippbar), Wortpartner, Bilanz je Abfrageart, Merkhilfe (M3) und die
// Aktionen. FSRS-Zahlen nur unter „Messwerte".

const DAY = 86_400_000;
const STAGE_KEYS: MessageKey[] = ['stage0', 'stage1', 'stage2', 'stage3', 'stage4', 'stage5'];

export function WordSheet({ card, onClose }: { card: TrainCard | null; onClose: () => void }) {
  const { t } = useT();
  return (
    <Sheet open={!!card} onClose={onClose} title={card?.word ?? t('lhVocab')} closeLabel={t('close')}>
      {card && <WordBody key={card.key} card={card} onClose={onClose} />}
    </Sheet>
  );
}

function when(ms: number, t: (k: MessageKey, v?: Record<string, string | number>) => string, tn: (b: 'ivDay', n: number) => string): string {
  if (ms <= 0) return t('vcDueNow');
  const min = Math.round(ms / 60_000);
  if (min < 60) return t('ivMin', { n: Math.max(1, min) });
  const h = Math.round(ms / 3_600_000);
  if (h < 24) return t('ivHour', { n: h });
  return tn('ivDay', Math.round(ms / DAY));
}

function WordBody({ card, onClose }: { card: TrainCard; onClose: () => void }) {
  const { t, tn, lang, num } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const tts = useSpeech((s) => s.status === 'ready');
  const [probe, setProbe] = useState<'idle' | 'asking' | 'wrong'>('idle');
  const [answer, setAnswer] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const conf = confidenceOf(card, now);
  const meaning = meaningOf(card, lang);
  const pk = posKey(card.pos);
  const examples = cardExamples(card, null);
  const balance = exerciseBalance(card);
  const src = { area: 'lookup' as const, source: card.path, title: card.word };

  const practice = () => {
    const first = startSession('extra', { only: [card.key] });
    if (first === 'typed') api.focusNow();
    onClose();
    go({ name: 'trainer', round: 'extra' });
  };

  const checkProbe = async () => {
    const r = checkTyped(answer, [card.word, card.lemma], { lemma: card.lemma });
    const ok = r.verdict !== 'wrong';
    const a: AnswerEvent = { t: nextT(), day: today, kind: 'v', id: card.id, ex: 'type', grade: ok ? 4 : 1, given: answer, ans: card.word, ms: 0, lang, ctx: 'xtra' };
    recordAnswer(a, true);
    if (!ok) {
      setProbe('wrong');
      return;
    }
    setBusy(true);
    const done = await markKnown(card, today);
    setBusy(false);
    toast(done ? t('vcKnownSaved') : t('saveFailed'), done ? 'info' : 'error');
    if (done) onClose();
  };

  const hide = async (hidden: boolean) => {
    setBusy(true);
    const ok = await setHidden(card, hidden);
    setBusy(false);
    toast(ok ? t(hidden ? 'vcHiddenToast' : 'vcUnhiddenToast') : t('saveFailed'), ok ? 'info' : 'error');
    if (ok) onClose();
  };

  const reset = async () => {
    setBusy(true);
    const ok = await resetCard(card);
    setBusy(false);
    toast(ok ? t('vcResetToast') : t('saveFailed'), ok ? 'info' : 'error');
    if (ok) onClose();
  };

  return (
    <div className="flex flex-col gap-6 pb-4" data-testid="word-sheet" data-word={card.id}>
      <section className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted" data-testid="word-status">
          <Dots n={confidenceDots(conf)} />
          <span>{t(CONFIDENCE_KEYS[conf])}</span>
          <span className="text-subtle">·</span>
          <span>{t('lkStage', { n: card.stage })}</span>
          <span className="text-subtle">· {t(STAGE_KEYS[card.stage] ?? 'stage0')}</span>
        </p>
        {(meaning || pk) && (
          <p className="text-base">
            {meaning && <span lang={lang}>{meaning}</span>}
            {meaning && pk && <span className="text-muted"> · </span>}
            {pk && <span className="text-muted">{t(pk as MessageKey)}</span>}
          </p>
        )}
        <p className="text-sm text-muted" data-testid="word-next">
          {card.hidden ? t('vcHiddenState') : card.isNew ? t('vcNewState') : t('vcNextReview', { when: when(card.fsrs.due - now, t, tn) })}
        </p>
        {tts && (
          <div>
            <Button variant="ghost" icon="speaker" onClick={() => void speak(card.word)} data-testid="word-speak">
              {t('lkListen')}
            </Button>
          </div>
        )}
      </section>
      {examples.length > 0 && (
        <section className="flex flex-col gap-1.5" data-testid="examples">
          <p className="lx-eyebrow">{t('trExamples')}</p>
          <ul className="flex flex-col gap-1.5">
            {examples.map((x) => (
              <li key={x.en} className="text-[0.95rem] leading-relaxed" data-testid="example" data-src={x.src}>
                <EnglishText as="span" text={x.en} {...src} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {card.col.some((c) => c.p) && (
        <section className="flex flex-col gap-1.5">
          <p className="lx-eyebrow">{t('vcCollocations')}</p>
          <ul className="flex flex-col gap-1 text-sm">
            {card.col
              .filter((c) => c.p)
              .map((c) => (
                <li key={c.index}>
                  <span className="font-medium" lang="en">
                    {c.p}
                  </span>
                  {lang === 'de' && c.de && <span className="text-muted"> – {c.de}</span>}
                </li>
              ))}
          </ul>
        </section>
      )}
      {balance.length > 0 && (
        <section className="flex flex-col gap-1.5" data-testid="word-balance">
          <p className="lx-eyebrow">{t('vcBalance')}</p>
          <ul className="flex flex-col gap-1 text-sm">
            {balance.map((b) => (
              <li key={b.ex} className="flex justify-between gap-3">
                <span>{t(`exName_${b.ex}` as MessageKey)}</span>
                <span className="lx-tnum text-muted">{t('vcBalanceValue', { c: b.c, n: b.c + b.w })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(isLeech(card.doc) || !!card.doc.mnemo) && <MnemonicBlock card={card} always />}

      {probe !== 'idle' && (
        <section className="flex flex-col gap-2 rounded-xl bg-surface p-3" data-testid="probe">
          <p className="text-sm font-medium">{t('vcProbeTask')}</p>
          {meaning && (
            <p className="text-base" lang={lang}>
              {meaning}
            </p>
          )}
          <input
            className="lx-field"
            lang="en"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && probe === 'asking') {
                e.preventDefault();
                void checkProbe();
              }
            }}
            readOnly={probe === 'wrong'}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label={t('vcProbeTask')}
            data-testid="probe-input"
            autoFocus
          />
          {probe === 'asking' ? (
            <div>
              <Button variant="primary" onClick={() => void checkProbe()} disabled={!answer.trim() || busy} data-testid="probe-check">
                {t('trCheck')}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-danger-text" data-testid="probe-wrong">
              {t('vcProbeWrong', { word: card.word })}
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2" aria-label={t('vcActions')}>
        {!card.hidden && (
          <Button variant="primary" iconAfter="arrowRight" onClick={practice} data-testid="word-practice">
            {t('vcPractice')}
          </Button>
        )}
        {!card.hidden && card.stage < 4 && probe === 'idle' && (
          <Button variant="secondary" icon="check" onClick={() => setProbe('asking')} data-testid="word-known">
            {t('vcKnown')}
          </Button>
        )}
        {card.hidden ? (
          <Button variant="secondary" icon="refresh" onClick={() => void hide(false)} busy={busy} data-testid="word-unhide">
            {t('vcUnhide')}
          </Button>
        ) : (
          <Button variant="ghost" icon="eyeOff" onClick={() => void hide(true)} busy={busy} data-testid="word-hide">
            {t('vcHide')}
          </Button>
        )}
        {card.inDb && !card.hidden && !card.isNew && (
          <Button variant="ghost" icon="undo" onClick={() => (confirmReset ? void reset() : setConfirmReset(true))} busy={busy} data-testid="word-reset">
            {confirmReset ? t('vcResetConfirm') : t('vcReset')}
          </Button>
        )}
      </section>

      <Disclosure label={t('grRaw')}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm" data-testid="word-raw">
          <dt className="text-muted">{t('vcRawR')}</dt>
          <dd className="lx-tnum">{card.isNew ? '–' : `${num(Math.round(retrievability(card.fsrs, now) * 100))} %`}</dd>
          <dt className="text-muted">{t('vcRawS')}</dt>
          <dd className="lx-tnum">{tn('streakDays', Math.round(card.fsrs.stability))}</dd>
          <dt className="text-muted">{t('vcRawD')}</dt>
          <dd className="lx-tnum">{num(Math.round(card.fsrs.difficulty * 10) / 10)}</dd>
          <dt className="text-muted">{t('vcRawReps')}</dt>
          <dd className="lx-tnum">{num(card.fsrs.reps)}</dd>
          <dt className="text-muted">{t('vcRawLapses')}</dt>
          <dd className="lx-tnum">{num(card.fsrs.lapses)}</dd>
        </dl>
      </Disclosure>
    </div>
  );
}
