import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { useNav } from '../../app/nav';
import type { ScreenProps } from '../../app/registry';
import { useSettings } from '../../app/settings';
import { dayKey } from '../../domain/date';
import { wordCount } from '../../domain/input/textStats';
import { EnglishText } from '../../engine/EnglishText';
import { useT, type MessageKey } from '../../i18n';
import { speak, stopSpeech, unlockSpeech, useSpeech } from '../../platform/speech';
import { followupCheck } from '../../prompts/nb/p4/followupCheck';
import { listeningDialog, type Accent, type ListeningDialogOut } from '../../prompts/nb/p4/listeningDialog';
import { Button } from '../../ui/Button';
import { FeedbackPanel } from '../../ui/FeedbackPanel';
import { useActiveClock } from '../input/activeClock';
import { AiRunPanel, isBusy } from '../input/AiRunPanel';
import { clearDraft, loadDraft } from '../input/draft';
import { DraftArea } from '../input/DraftArea';
import { UnitShell } from '../input/UnitShell';
import { recordUnitEnd } from '../progress/persist';
import { coverageList, dialogFeedback } from './dialogFeedback';
import { assignVoices } from './dialogVoices';

// Meeting hören (Backlog B6, Lehrer H3 + H4): Claude schreibt ein kurzes Meeting mit 2–3 Stimmen
// (listening-dialog@1); jede Person spricht mit eigener Stimme, möglichst mit ihrem Akzent (sonst
// sauberer Rückfall auf eine Stimme). Ablauf: hören (ohne Text) → Stichworte → Follow-up-Mail →
// Prüfung, ob alle Vereinbarungen drin sind (followup-check@1). Ein Extra: zählt als Hör-Einheit.

const SCENARIOS = ['project status call', 'budget meeting', 'vendor selection meeting', 'rollout planning call', 'customer escalation call', 'kickoff meeting'] as const;
const ACCENT_KEY: Record<Accent, MessageKey> = { us: 'nbLesenDlgAccentUs', gb: 'nbLesenDlgAccentGb', in: 'nbLesenDlgAccentIn', au: 'nbLesenDlgAccentAu' };
const NOTES_KEY = 'listen:dialog:notes';
const MAIL_KEY = 'listen:dialog:mail';
const MAIL_MIN = 40;

type Step = 'listen' | 'notes' | 'mail' | 'review';

export function DialogScreen({ route }: ScreenProps<'listenDialog'>) {
  const { t, lang } = useT();
  const back = useNav((s) => s.back);
  const ai = useAiAvailable();
  const [day] = useState(() => dayKey(Date.now()));
  const [pick, setPick] = useState(() => Number(day.replace(/-/g, '')) % SCENARIOS.length);
  const gen = useAsk(listeningDialog);
  const genRun = gen.run;
  const run = (refresh = false) => void genRun({ scenario: SCENARIOS[pick] ?? SCENARIOS[0], level: 'C1', uiLang: useSettings.getState().lang }, refresh ? { refresh: true } : undefined);
  // Das Öffnen ist die Handlung: einmal je Meeting-Wahl fragen, nie automatisch wiederholen (A6.3).
  useEffect(() => {
    if (ai) void genRun({ scenario: SCENARIOS[pick] ?? SCENARIOS[0], level: 'C1', uiLang: useSettings.getState().lang });
  }, [ai, pick, genRun]);
  const close = () => {
    stopSpeech();
    back();
  };

  if (gen.data && !isBusy(gen.phase)) {
    return (
      <DialogRun
        key={`${pick}|${gen.data.title}`}
        data={gen.data}
        ctx={route.ctx}
        day={day}
        onClose={close}
        onAnother={() => {
          clearDraft(NOTES_KEY);
          clearDraft(MAIL_KEY);
          setPick((p) => (p + 1) % SCENARIOS.length);
        }}
      />
    );
  }
  return (
    <UnitShell kind="listen" ctx={route.ctx} state="gen" title={t('nbLesenDlgTitle')} onClose={close} task={t('nbLesenDlgTask')} purpose={t('nbLesenDlgPurpose')}>
      <div className="flex flex-col gap-4" data-testid="dialog-gen" lang={lang}>
        {!ai ? (
          <p className="text-sm text-muted" role="status" data-testid="dialog-no-ai">
            {t('nbLesenDlgNoAi')}
          </p>
        ) : (
          <AiRunPanel phase={gen.phase} error={gen.error} onStop={gen.stop} onRetry={() => run(true)} />
        )}
      </div>
    </UnitShell>
  );
}

type RunProps = { data: ListeningDialogOut; ctx: 'duty' | 'extra'; day: string; onClose: () => void; onAnother: () => void };

function DialogRun({ data, ctx, day, onClose, onAnother }: RunProps) {
  const { t } = useT();
  const clock = useActiveClock();
  const status = useSpeech((s) => s.status);
  const voices = useSpeech((s) => s.voices);
  const plan = useMemo(() => assignVoices(data.speakers.map((s) => s.accent), voices ?? []), [data, voices]);
  const noAudio = status === 'unsupported' || status === 'novoice';
  const [step, setStep] = useState<Step>('listen');
  const [heard, setHeard] = useState(false);
  const [textShown, setTextShown] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [notes, setNotes] = useState(() => loadDraft(NOTES_KEY));
  const [mail, setMail] = useState(() => loadDraft(MAIL_KEY));
  const playRun = useRef(0);
  const check = useAsk(followupCheck);
  const recorded = useRef(false);

  useEffect(
    () => () => {
      playRun.current++;
      stopSpeech();
    },
    [],
  );

  const stop = () => {
    playRun.current++;
    stopSpeech();
    setActive(null);
  };
  // Zeile für Zeile mit der Stimme der Person; jede Zeile wird in Stücke ≤ 150 Zeichen zerlegt (speak).
  const play = () => {
    unlockSpeech();
    const id = ++playRun.current;
    const next = (i: number) => {
      if (playRun.current !== id) return;
      const line = data.lines[i];
      if (!line) {
        setActive(null);
        setHeard(true);
        return;
      }
      setActive(i);
      const voice = plan.names[line.s];
      void speak(line.text, voice ? { voice } : {}).then((o) => {
        if (playRun.current !== id) return;
        if (o === 'done') next(i + 1);
        else setActive(null);
      });
    };
    next(0);
  };

  const runCheck = (refresh = false) => {
    stop();
    void check.run({ points: data.points, notes: notes.trim(), mail: mail.trim(), uiLang: useSettings.getState().lang }, refresh ? { refresh: true } : undefined).then((out) => {
      if (!out) return;
      setStep('review');
      clearDraft(NOTES_KEY);
      clearDraft(MAIL_KEY);
      if (!recorded.current) {
        recorded.current = true;
        void recordUnitEnd({ day, act: 'listen', answers: 0, right: 0, activeMs: clock.ms(), domain: 'work' });
      }
    });
  };

  const speaking = active !== null ? (data.lines[active]?.s ?? null) : null;
  const speakers = (
    <ul className="flex flex-col gap-2" data-testid="dialog-speakers" data-voices={plan.distinct}>
      {data.speakers.map((s, i) => (
        <li
          key={i}
          className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors ${speaking === i ? 'bg-[var(--lx-cyan-soft)]' : 'bg-surface'}`}
          data-testid="dialog-speaker"
          data-active={speaking === i || undefined}
          data-accent={s.accent}
          data-voice={plan.names[i] ?? ''}
        >
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">{s.name}</span>
            <EnglishText as="span" text={s.role} area="listen" title={data.title} className="text-sm text-muted" />
          </span>
          <span className="flex-none text-xs text-muted">
            {t(ACCENT_KEY[s.accent])}
            {speaking === i ? ` · ${t('nbLesenDlgSpeaking')}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
  const player = noAudio ? (
    <p className="text-sm text-muted" role="status" data-testid="dialog-audio-off">
      {t('nbLesenDlgAudioOff')}
    </p>
  ) : (
    <div className="flex flex-wrap items-center gap-3">
      {active !== null ? (
        <Button variant="secondary" icon="close" onClick={stop} data-testid="dialog-stop">
          {t('nbLesenDlgStop')}
        </Button>
      ) : (
        <Button variant={heard ? 'secondary' : 'primary'} icon="speaker" onClick={play} data-testid="dialog-play" disabled={status !== 'ready'}>
          {heard ? t('nbLesenDlgPlayAgain') : t('nbLesenDlgPlay')}
        </Button>
      )}
      <p className="text-xs text-muted" data-testid="dialog-voices">
        {plan.distinct > 1 ? t('nbLesenDlgVoices', { n: plan.distinct }) : t('nbLesenDlgOneVoice')}
      </p>
    </div>
  );
  const transcript = (
    <section className="flex flex-col gap-2" data-testid="dialog-transcript">
      <h3 className="lx-eyebrow">{t('nbLesenDlgTranscript')}</h3>
      <ol className="flex flex-col gap-2">
        {data.lines.map((l, i) => (
          <li key={i} className={`rounded-xl px-2 py-1 ${active === i ? 'bg-[var(--lx-cyan-soft)]' : ''}`}>
            <span className="text-sm font-semibold">{data.speakers[l.s]?.name ?? ''}: </span>
            <EnglishText as="span" text={l.text} area="listen" title={data.title} className="text-base leading-relaxed" />
          </li>
        ))}
      </ol>
    </section>
  );

  let task: string | undefined = t('nbLesenDlgTask');
  let body: ReactNode;
  if (step === 'listen') {
    body = (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight" lang="en">
            {data.title}
          </h2>
          <p className="text-sm text-muted">{data.setting}</p>
        </div>
        {speakers}
        {player}
        {(textShown || noAudio) && transcript}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" iconAfter="arrowRight" disabled={!heard && !textShown && !noAudio} onClick={() => {
              stop();
              setStep('notes');
            }} data-testid="dialog-to-notes">
            {t('nbLesenDlgToNotes')}
          </Button>
          {!textShown && !noAudio && (
            <Button variant="ghost" onClick={() => setTextShown(true)} data-testid="dialog-show-text">
              {t('nbLesenDlgShowText')}
            </Button>
          )}
        </div>
      </div>
    );
  } else if (step === 'notes') {
    task = t('nbLesenDlgNotesTask');
    body = (
      <div className="flex max-w-3xl flex-col gap-5">
        {speakers}
        {player}
        <DraftArea value={notes} onChange={setNotes} label={t('nbLesenDlgNotesLabel')} draftKey={NOTES_KEY} rows={5} testId="dialog-notes" />
        <div>
          <Button variant="primary" iconAfter="arrowRight" disabled={wordCount(notes) < 3} onClick={() => {
              stop();
              setStep('mail');
            }} data-testid="dialog-to-mail">
            {t('nbLesenDlgToMail')}
          </Button>
        </div>
      </div>
    );
  } else if (step === 'mail') {
    task = t('nbLesenDlgMailTask');
    body = (
      <div className="flex max-w-3xl flex-col gap-5">
        <section className="flex flex-col gap-1 rounded-xl bg-surface px-3 py-2">
          <p className="lx-eyebrow">{t('nbLesenDlgNotesLabel')}</p>
          <p className="whitespace-pre-wrap text-sm" data-testid="dialog-notes-view">
            {notes}
          </p>
        </section>
        <DraftArea value={mail} onChange={setMail} label={t('nbLesenDlgMailLabel')} draftKey={MAIL_KEY} min={60} max={100} testId="dialog-mail" disabled={isBusy(check.phase)} />
        <AiRunPanel phase={check.phase} error={check.error} onStop={check.stop} onRetry={() => runCheck(true)} />
        {!isBusy(check.phase) && (
          <div>
            <Button variant="primary" iconAfter="arrowRight" disabled={wordCount(mail) < MAIL_MIN} onClick={() => runCheck()} data-testid="dialog-check" data-ai="">
              {t('nbLesenDlgCheck')}
            </Button>
          </div>
        )}
      </div>
    );
  } else {
    task = undefined;
    const out = check.data;
    const cov = out ? coverageList(data.points, out) : [];
    body = (
      <div className="flex max-w-3xl flex-col gap-5" data-testid="dialog-review">
        {out && <FeedbackPanel fb={dialogFeedback(data.points, out, { missing: t('nbLesenDlgMissing'), why: t('nbLesenDlgWhyQuestion') })} area="listen" />}
        <section className="flex flex-col gap-2" data-testid="dialog-points">
          <h3 className="lx-eyebrow">{t('nbLesenDlgPoints')}</h3>
          <ul className="flex flex-col gap-1">
            {data.points.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" data-testid="dialog-point" data-covered={cov[i] ?? 'no'}>
                <span className={`flex-none font-semibold ${cov[i] === 'yes' ? 'text-accent-text' : cov[i] === 'partly' ? 'text-gold-text' : 'text-danger-text'}`}>
                  {cov[i] === 'yes' ? t('nbLesenDlgCovYes') : cov[i] === 'partly' ? t('nbLesenDlgCovPartly') : t('nbLesenDlgCovNo')}
                </span>
                <EnglishText as="span" text={p} area="listen" title={data.title} />
              </li>
            ))}
          </ul>
        </section>
        {transcript}
        <div className="flex flex-wrap gap-2">
          <Button icon="plus" onClick={onAnother} data-testid="dialog-another">
            {t('nbLesenDlgAnother')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <UnitShell kind="listen" ctx={ctx} state={step} title={t('nbLesenDlgTitle')} seeDetail={data.title} onClose={onClose} task={task} purpose={t('nbLesenDlgPurpose')}>
      {body}
    </UnitShell>
  );
}
