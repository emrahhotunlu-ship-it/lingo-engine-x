import { useMemo, useState } from 'react';
import { useAsk } from '../../ai/useAsk';
import { useAiAvailable } from '../../ai/scope';
import { takeTutorCall } from '../../ai/tutorBudget';
import { useLive } from '../../data/live';
import { errorsOf } from '../../domain/grammar/errors';
import type { Pattern } from '../../domain/grammar/patternTypes';
import { axFits, explainOps, neighborsOf, readAx, toAx, type Ax } from '../../domain/tutor/explainOps';
import { tutorCtx } from '../../domain/tutor/ctx';
import { noteQuality } from '../../domain/tutor/quality';
import { SpeakButton } from '../../engine/SpeakButton';
import { useT } from '../../i18n';
import { explainAnswerV2, type ExplainOut, type ExplainVars } from '../../prompts/explainAnswerV2';
import { AiMark } from '../../ui/AiMark';
import { AiRunPanel, isBusy } from '../../ui/AiRunPanel';
import { Button } from '../../ui/Button';
import { Examples } from '../../ui/exercise/Examples';
import { submitReport } from '../../ui/ReportSheet';
import { openCompanion } from '../companion/store';
import { dropAx, saveAx, type ExplainStore } from './explainSave';

// „Erklär mir meine Antwort“ (Lernplattform 3.0 P26, KT T1) unter der Erklär-Karte einer falschen Antwort. Nur auf Tipp, nie automatisch.
// Ablauf: Knopf → „Was war mein Fehler?“ (erst die eigene Vermutung, gegen Abhängigkeit) → ein Aufruf `explain-answer@2` → Karte mit
// „Deine Antwort“, „Richtig, weil“, Beispiel und Kennzeichnung. Die App urteilt, Claude erklärt (T-R2): `alsoRight` ändert nichts, bis
// „Ich lag richtig“ getippt wird. Das Ergebnis liegt in der Datenbank (`ax`/`axs`); beim zweiten Öffnen derselben Antwort gibt es keinen Aufruf.
// Tagesbremse: höchstens 20 Aufrufe je Tag und Gerät (`ai/tutorBudget.ts`). Ohne Claude gibt es weder Knopf noch Zeile.

const TPL = `${explainAnswerV2.id}@${explainAnswerV2.version}`;
type Shown = { out: ExplainOut; guess: string; stored: boolean };
/** Erklärungen dieser Ansicht je Aufgabe (bis zum Neuladen). */
const memo = new Map<string, Shown>();

export type ExplainMineProps = {
  /** Eindeutig je Aufgabe und Antwort; unter diesem Schlüssel hält die Karte die Erklärung im Speicher. */
  taskKey: string;
  kind?: 'grammar' | 'word';
  vars: {
    topic: string;
    prompt: string;
    answer: string;
    given: string;
    pattern: { name: string; form: string } | null;
  };
  /** Das volle Muster der Aufgabe (Formel, Signalwörter, typischer Fehler); sonst nur Name und Formel aus `vars`. */
  pattern?: Pattern | null;
  accepted?: readonly string[];
  word?: ExplainVars['word'];
  /** Wo die Erklärung gespeichert und beim nächsten Mal gelesen wird. */
  store?: ExplainStore;
  /** „Ich lag richtig“ (vorhandener Einspruch der Übung); ohne ihn gibt es die goldene Zeile nicht. */
  onRight?: (() => void) | undefined;
  /** „Einmal richtig schreiben“ (vorhandene Selbstkorrektur der Übung). */
  onRewrite?: (() => void) | undefined;
};

/** Gespeicherte, zu dieser Antwort passende Erklärung aus den Live-Dokumenten. */
function storedAx(store: ExplainStore | undefined, doc: Readonly<Record<string, unknown>> | undefined, given: string, now: number): Ax | null {
  if (!store || !doc) return null;
  if (store.kind === 'grammar') {
    const k = store.q.trim().toLowerCase();
    const e = errorsOf(doc).find((x) => typeof x.q === 'string' && x.q.trim().toLowerCase() === k);
    const ax = readAx(e?.ax);
    return axFits(ax, given, now) ? ax : null;
  }
  const list = Array.isArray(doc.axs) ? doc.axs : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const ax = readAx(list[i]);
    if (axFits(ax, given, now)) return ax;
  }
  return null;
}

function outOfAx(ax: Ax): ExplainOut {
  return { yours: ax.y ?? null, why: ax.w, signal: ax.sig ?? [], confused: ax.cf ?? null, alsoRight: ax.alt === 1, example: ax.ex ?? null };
}

export function ExplainMine(props: ExplainMineProps) {
  const { taskKey, kind = 'grammar', vars, pattern, accepted, word, store, onRight, onRewrite } = props;
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const ask = useAsk(explainAnswerV2);
  const profile = useLive((s) => s.docs['app/profile']);
  const doc = useLive((s) => (store ? (store.kind === 'grammar' ? s.collections.grammar?.get(store.topic) : (store.path.startsWith('chunk/') ? s.collections.chunk : s.collections.vocab)?.get(store.path.slice(store.path.indexOf('/') + 1))) : undefined));
  const [openedAt] = useState(() => Date.now());
  const fromDb = useMemo(() => storedAx(store, doc, vars.given, openedAt), [store, doc, vars.given, openedAt]);
  const [shown, setShown] = useState<Shown | null>(() => memo.get(taskKey) ?? null);
  const [step, setStep] = useState<'idle' | 'guess'>('idle');
  const [guess, setGuess] = useState('');
  const [limited, setLimited] = useState(false);
  const [rightTapped, setRightTapped] = useState(false);
  const [reported, setReported] = useState(false);
  if (!ai || reported) return null;

  const current: Shown | null = shown ?? (fromDb ? { out: outOfAx(fromDb), guess: '', stored: true } : null);

  const go = async () => {
    if (!takeTutorCall()) {
      setLimited(true);
      return;
    }
    setLimited(false);
    const given = vars.given.trim();
    const ev: ExplainVars = {
      kind,
      task: vars.prompt,
      given,
      answer: vars.answer,
      accepted: accepted && accepted.length ? accepted : [vars.answer],
      ops: explainOps(given, vars.answer),
      pattern: pattern
        ? { id: pattern.id, name: pattern.name.en, form: pattern.form.en, signals: pattern.signals, trap: `${pattern.trap.bad} → ${pattern.trap.good}` }
        : null,
      neighbors: kind === 'grammar' ? neighborsOf(vars.topic, pattern?.id ?? null) : [],
      word: kind === 'word' ? (word ?? null) : null,
      ctx: tutorCtx(profile),
      uiLang: lang,
    };
    noteQuality(TPL, 'gen');
    const r = await ask.run(ev);
    if (!r) return;
    noteQuality(TPL, 'acc');
    const entry: Shown = { out: r, guess: guess.trim(), stored: false };
    memo.set(taskKey, entry);
    setShown(entry);
    setStep('idle');
    if (store) void saveAx(store, toAx(given, r, TPL, Date.now()));
  };

  const more = () =>
    openCompanion({
      tab: 'chat',
      text: t('ttQuestion', { task: vars.prompt, given: vars.given || '–', solution: vars.answer, pattern: vars.topic || '–' }),
    });

  const onReport = (): void => {
    memo.delete(taskKey);
    setShown(null);
    setReported(true);
    if (store && current) void dropAx(store, toAx(vars.given.trim(), current.out, TPL, Date.now()));
  };

  const right = (): void => {
    setRightTapped(true);
    submitReport({ tpl: TPL, id: taskKey, reason: 'twofit' });
    onRight?.();
  };

  const busy = isBusy(ask.phase);
  const pick = (b: { de: string; en: string }): string => (lang === 'de' ? b.de : b.en);

  if (current) {
    const o = current.out;
    const conf = o.confused ? neighborsOf(vars.topic, pattern?.id ?? null).find((n) => n.id === o.confused) : null;
    return (
      <div className="flex flex-col gap-2" data-testid="tutor" data-ai="">
        <div className="lx-card flex flex-col gap-3 p-3" data-testid="tutor-text">
          <p className="lx-eyebrow m-0 text-subtle">{t('ttLabel')}</p>
          {current.guess && (
            <p className="lx-t-meta m-0 text-muted" data-testid="tutor-guess">
              {t('ttXMyGuess', { text: current.guess })}
            </p>
          )}
          {o.yours && (
            <div className="flex flex-col gap-0.5" data-testid="tutor-yours">
              <p className="lx-t-label m-0">{t('ttXYours')}</p>
              <p className="lx-t-body m-0" lang={lang}>
                {pick(o.yours)}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-0.5" data-testid="tutor-why">
            <p className="lx-t-label m-0">{t('ttXWhy')}</p>
            <p className="lx-t-body m-0" lang={lang}>
              {pick(o.why)}
            </p>
          </div>
          {o.signal.length > 0 && (
            <p className="lx-t-meta m-0 text-muted" data-testid="tutor-signal">
              {t('ttXSignal', { words: o.signal.join(', ') })}
            </p>
          )}
          {conf && (
            <p className="lx-t-meta m-0 text-muted" data-testid="tutor-confused">
              {t('ttXConfused', { name: conf.name })}
            </p>
          )}
          {o.example && (
            <div className="flex items-start gap-1" data-testid="tutor-example">
              <div className="min-w-0 flex-1">
                <p className="lx-t-label m-0">{t('ttXExample')}</p>
                <Examples items={[{ en: o.example.en, de: o.example.de, ctx: null }]} open={1} area="trainer" />
              </div>
              <SpeakButton text={o.example.en} testId="tutor-speak" />
            </div>
          )}
          {o.alsoRight && onRight && !rightTapped && (
            <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-gold-text/40 p-2" data-testid="tutor-also">
              <p className="lx-t-meta m-0 flex-1 text-gold-text">{t('ttXAlso')}</p>
              <Button variant="secondary" onClick={right} data-testid="tutor-right">
                {t('ttXRight')}
              </Button>
            </div>
          )}
          <AiMark variant="explain" tpl={TPL} id={taskKey} onReport={onReport} data-testid="tutor-mark" />
          <div className="flex flex-wrap gap-2">
            {onRewrite && (
              <Button variant="primary" onClick={onRewrite} data-testid="tutor-rewrite">
                {t('ttXRewrite')}
              </Button>
            )}
            <Button variant="ghost" icon="sparkle" onClick={more} data-testid="tutor-more">
              {t('ttXAskMore')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="tutor" data-ai="">
      {step === 'guess' && !busy && !ask.error ? (
        <div className="lx-card flex flex-col gap-2 p-3" data-testid="tutor-guessbox">
          <p className="lx-t-label m-0">{t('ttXGuessTitle')}</p>
          <p className="lx-t-meta m-0 text-muted">{t('ttXGuessHint')}</p>
          <input
            type="text"
            className="min-h-11 w-full rounded-[var(--radius-control)] border border-line bg-transparent px-3"
            aria-label={t('ttXGuessLabel')}
            maxLength={160}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void go();
            }}
            data-testid="tutor-guess-input"
          />
          <div>
            <Button variant="primary" onClick={() => void go()} data-testid="tutor-go">
              {t('ttXGo')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {!busy && !ask.error && (
            <Button variant="secondary" icon="sparkle" onClick={() => setStep('guess')} data-testid="tutor-ask">
              {t('ttAsk')}
            </Button>
          )}
          <AiRunPanel phase={ask.phase} error={ask.error} onStop={ask.stop} onRetry={() => void go()} />
        </div>
      )}
      {limited && (
        <p className="m-0 text-sm text-muted" role="status" data-testid="tutor-limit">
          {t('ttLimit')}
        </p>
      )}
    </div>
  );
}
