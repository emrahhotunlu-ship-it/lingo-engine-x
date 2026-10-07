import { useState } from 'react';
import { trapById } from '../../../content/nb/traps';
import { checkFocus, focusSolution, type FocusTask, type FocusVerdict } from '../../../domain/repair/unit';
import { useT, type MessageKey } from '../../../i18n';
import { ExerciseShell, SentenceInput, type ShellFeedback } from '../../../ui/exercise';
import { alignWords } from '../../../domain/answer/align';
import type { Fix } from '../../../ui/feedback/types';
import type { FocusRow } from './session';

// Eine Fokus-Aufgabe (Block 4, N41/M9): der falsche Satz steht da, darunter ZUERST der Hinweis,
// dann EIN Versuch (der Satz steht zum Verbessern im Feld), dann nach jedem Versuch – richtig oder
// falsch – Lösung und Grund im Einheitsstil (`FeedbackPanel`). Keine Selbstbewertung.

type TrapTask = Exclude<FocusTask, { kind: 'grammar' }>;

type Props = {
  task: TrapTask;
  status: string;
  onDone: (row: FocusRow, missed?: { trapId: string; wrong: string; right: readonly string[] }) => void;
};

const EYEBROW: Record<TrapTask['kind'], MessageKey> = { fix: 'nbLernenFocusFix', own: 'nbLernenFocusOwn', trap: 'nbLernenFocusTrap' };
const KIND_HINT: Record<Fix['kind'], MessageKey> = { meaning: 'nbLernenFocusHintMeaning', trap: 'nbLernenFocusHintTrap', goal: 'nbLernenFocusHintGoal', form: 'nbLernenFocusHintForm' };
const VERDICT: Record<FocusVerdict, ShellFeedback['verdict']> = { ok: 'ok', close: 'near', wrong: 'wrong', unchecked: 'unchecked' };

export function FocusItem({ task, status, onDone }: Props) {
  const { t, lang } = useT();
  const trap = trapById(task.trapId ?? null);
  const wrong = task.kind === 'fix' ? task.mine : task.kind === 'own' ? task.sentence : task.wrong;
  const [text, setText] = useState(wrong);
  const [res, setRes] = useState<{ verdict: FocusVerdict; given: string } | null>(null);

  const hint = trap ? trap.hint[lang] : task.kind === 'fix' ? t(KIND_HINT[task.fixKind]) : '';
  const why = (task.kind === 'fix' && task.why.trim()) || (trap ? trap.why[lang] : '') || t('nbLernenFocusWhyFallback');
  const solution = focusSolution(task);

  const check = (given: string) => {
    if (res) return;
    setRes({ verdict: given.trim() ? checkFocus(task, given) : 'wrong', given: given.trim() });
  };

  const next = () => {
    if (!res) return;
    const ok = res.verdict === 'ok' || res.verdict === 'close' || res.verdict === 'unchecked';
    const missed = task.kind === 'trap' && !ok ? { trapId: task.trapId, wrong: task.wrong, right: task.right } : undefined;
    onDone({ id: task.id, kind: task.kind, ok, verdict: res.verdict, right: solution }, missed);
  };

  const eyebrow = task.kind === 'trap' && task.drill ? t('nbLernenFocusDrill', { n: task.n, total: task.of }) : t(EYEBROW[task.kind]);
  // M9: Lösung UND Grund nach jedem Versuch, auch bei richtiger Antwort: bei „noch nicht“ steht die Lösung im Vergleich, der Grund immer in der Erklär-Karte.
  const fb: ShellFeedback | null = res
    ? {
        verdict: VERDICT[res.verdict],
        sub: res.verdict === 'unchecked' ? t('nbLernenFocusOwnNote') : null,
        comparison: res.verdict === 'wrong' ? { given: res.given, ops: alignWords(res.given, solution) } : null,
        explanation: { lines: [{ k: 'why', text: why }], examples: [], mark: [], ai: false, source: 'fallback' },
        depth: 'full',
        auto: false,
      }
    : null;

  return (
    <div data-testid="focus-item" data-kind={task.kind} data-trap={task.trapId ?? undefined} data-drill={task.kind === 'trap' && task.drill ? '' : undefined} data-state={res ? res.verdict : 'open'}>
      <ExerciseShell
        meta={{ ex: 'focus', id: task.id, kind: task.kind }}
        status={{ area: 'grammar', state: null, kindLabel: trap ? trap.title[lang] : eyebrow, badge: trap ? `${eyebrow} · ${status}` : status }}
        task={{ text: t(task.kind === 'own' ? 'nbLernenFocusTaskOwn' : 'nbLernenFocusTask'), purpose: t('nbLernenFocusPurpose') }}
        prompt={
          <div className="flex flex-col gap-2">
            {/* Der falsche Satz ist bewusst nicht antippbar: er enthält den Fehler. */}
            <p lang="en" data-testid="focus-wrong">
              “{wrong}”
            </p>
            {task.kind === 'trap' && trap && trap.drills.find((d) => d.wrong === task.wrong)?.de && lang === 'de' && (
              <p className="lx-t-support text-muted" lang="de">
                {trap.drills.find((d) => d.wrong === task.wrong)?.de}
              </p>
            )}
          </div>
        }
        answer={<SentenceInput mode="free" value={text} onChange={setText} onSubmit={() => (res ? next() : check(text))} disabled={!!res} testId="focus-input" />}
        hint={hint && !res ? { text: hint, tone: 'hint' } : null}
        secondary={[{ id: 'dontKnow', label: t('grDontKnow'), onClick: () => check(''), testId: 'focus-dont-know' }]}
        primary={res ? { label: t('exNext'), onClick: () => next(), testId: 'next' } : { label: t('trCheck'), onClick: () => check(text), testId: 'focus-check', disabled: !text.trim() }}
        feedback={fb}
      />
    </div>
  );
}
