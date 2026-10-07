import { useRef, useState, type ReactNode } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { alignWords } from '../../domain/answer/align';
import { normText } from '../../domain/text/normText';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';
import { patternCheck, type PatternCheckOut } from '../../prompts/patternCheck';
import { AiRunPanel, isBusy } from '../../ui/AiRunPanel';
import { ExerciseShell, SentenceInput, type ShellFeedback } from '../../ui/exercise';

// Neuer Satz im Kurzdrill einer Deutsch-Falle (Lernberatung 27.09., V3): Aufgabe (Englisch,
// antippbar) → eigener Satz → pattern-check@1 → Urteil, bessere Fassung, Grund → „Weiter“.
// Keine Selbstbewertung. Ohne Claude lässt sich der Satz nicht prüfen: dann nur „Überspringen“.
// Seit Lernplattform 2.0 im Übungsgerüst (`ExerciseShell`): Aufgabe (Titel), Zweck (Info-Symbol),
// Was hatte ich / was ist richtig (Vergleich), Warum (Erklärzeile).

type Props = {
  task: string;
  pattern: string;
  example: string;
  status?: ReactNode;
  onResult: (ok: boolean) => void;
  onNext: () => void;
};

const VERDICT: Record<PatternCheckOut['verdict'], ShellFeedback['verdict']> = { correct: 'ok', minor: 'near', wrong: 'wrong' };

export function FreeItem({ task, pattern, example, status, onResult, onNext }: Props) {
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const ask = useAsk(patternCheck);
  const [text, setText] = useState('');
  const [res, setRes] = useState<{ out: PatternCheckOut; given: string } | null>(null);
  const busy = isBusy(ask.phase);
  const box = useRef<HTMLDivElement>(null);

  const check = async () => {
    const given = text.trim();
    if (res || busy || !given || !ai) return;
    box.current?.querySelector('textarea')?.blur();
    const out = await ask.run({ pattern, example, task, sentence: given, uiLang: lang });
    // Nicht erreichbar oder unlesbar: nicht als falsch werten, „Prüfen“ fragt erneut.
    if (!out) return;
    setRes({ out, given });
    onResult(out.verdict !== 'wrong');
  };

  const fixed = res?.out.fixed.trim() ?? '';
  const fb: ShellFeedback | null = res
    ? {
        verdict: VERDICT[res.out.verdict],
        comparison: fixed && normText(fixed) !== normText(res.given) ? { given: res.given, ops: alignWords(res.given, fixed) } : null,
        explanation: { lines: [{ k: 'why', text: res.out.why }], examples: [], mark: [], ai: true, source: 'fallback' },
        depth: 'full',
        auto: false,
      }
    : null;

  return (
    <div ref={box} data-testid="pattern-free" data-state={res ? res.out.verdict : 'open'}>
      <ExerciseShell
        meta={{ ex: 'pattern_free', id: pattern, kind: 'produce' }}
        status={{ area: 'grammar', state: null, kindLabel: t('ptFreeKind'), badge: typeof status === 'string' ? status : null }}
        task={{ text: t('ptFreeTask'), purpose: t('ptFreePurpose') }}
        prompt={<EnglishText as="p" text={task} area="lesson" source="app/patterns" testId="pattern-free-task" />}
        answer={
          <div className="flex flex-col gap-3">
            <SentenceInput mode="free" value={text} onChange={setText} onSubmit={() => (res ? onNext() : void check())} disabled={!!res || busy} testId="pattern-free-input" />
            {busy && <AiRunPanel phase={ask.phase} error={null} onStop={ask.stop} skeleton={false} />}
            {!busy && !res && ask.error && <AiRunPanel phase="error" error={ask.error} onRetry={() => void check()} skeleton={false} />}
          </div>
        }
        hint={!ai && !res ? { text: t('ptFreeNoAi'), tone: 'hint' } : null}
        secondary={ai && !res ? [{ id: 'skip', label: t('ptSkip'), onClick: onNext, testId: 'pattern-free-skip', disabled: busy }] : []}
        primary={
          res
            ? { label: t('ptNext'), onClick: onNext, testId: 'pattern-free-next' }
            : ai
              ? { label: t('ptCheck'), onClick: () => void check(), testId: 'pattern-free-check', disabled: !text.trim() || busy, busy, busyLabel: t('exChecking') }
              : { label: t('ptSkip'), onClick: onNext, testId: 'pattern-free-skip' }
        }
        feedback={fb}
      />
    </div>
  );
}
