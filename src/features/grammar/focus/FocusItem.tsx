import { useRef, useState } from 'react';
import { trapById } from '../../../content/nb/traps';
import { checkFocus, focusSolution, type FocusTask, type FocusVerdict } from '../../../domain/repair/unit';
import { useT, type MessageKey } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { FeedbackPanel } from '../../../ui/FeedbackPanel';
import type { Feedback, Fix } from '../../../ui/feedback/types';
import { Icon } from '../../../ui/Icon';
import { TaskLine } from '../../learn/ui';
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
const VERDICT: Record<FocusVerdict, Feedback['verdict']> = { ok: 'ok', close: 'close', wrong: 'wrong', unchecked: 'unchecked' };

export function FocusItem({ task, status, onDone }: Props) {
  const { t, lang } = useT();
  const trap = trapById(task.trapId ?? null);
  const wrong = task.kind === 'fix' ? task.mine : task.kind === 'own' ? task.sentence : task.wrong;
  const [text, setText] = useState(wrong);
  const [res, setRes] = useState<{ verdict: FocusVerdict; given: string } | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  const hint = trap ? trap.hint[lang] : task.kind === 'fix' ? t(KIND_HINT[task.fixKind]) : '';
  const why = (task.kind === 'fix' && task.why.trim()) || (trap ? trap.why[lang] : '') || t('nbLernenFocusWhyFallback');
  const solution = focusSolution(task);

  const check = (given: string) => {
    if (res) return;
    field.current?.blur();
    setRes({ verdict: given.trim() ? checkFocus(task, given) : 'wrong', given: given.trim() });
  };

  const next = () => {
    if (!res) return;
    const ok = res.verdict === 'ok' || res.verdict === 'close' || res.verdict === 'unchecked';
    const missed = task.kind === 'trap' && !ok ? { trapId: task.trapId, wrong: task.wrong, right: task.right } : undefined;
    onDone({ id: task.id, kind: task.kind, ok, verdict: res.verdict, right: solution }, missed);
  };

  const eyebrow = task.kind === 'trap' && task.drill ? t('nbLernenFocusDrill', { n: task.n, total: task.of }) : t(EYEBROW[task.kind]);
  const fb: Feedback | null = res
    ? {
        verdict: VERDICT[res.verdict],
        ...(res.verdict === 'unchecked' ? { effect: t('nbLernenFocusOwnNote') } : {}),
        ...(res.given ? { mine: res.given } : {}),
        solution,
        // M9: Lösung UND Grund nach jedem Versuch, auch bei richtiger Antwort.
        fixes: [{ kind: trap ? 'trap' : task.kind === 'fix' ? task.fixKind : 'form', mine: res.verdict === 'ok' ? solution : wrong, right: solution, why, ...(trap ? { trapId: trap.id } : {}) }],
      }
    : null;

  return (
    <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="focus-item" data-kind={task.kind} data-trap={task.trapId ?? undefined} data-drill={task.kind === 'trap' && task.drill ? '' : undefined} data-state={res ? res.verdict : 'open'}>
      <header className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted">
          <span className="inline-flex items-center gap-1" data-testid="focus-eyebrow">
            <Icon name={trap ? 'target' : 'refresh'} size={14} />
            {eyebrow}
          </span>
          {trap && (
            <>
              <span aria-hidden="true">·</span>
              <span data-testid="focus-trap">{trap.title[lang]}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span className="lx-tnum">{status}</span>
        </p>
        <TaskLine task={t(task.kind === 'own' ? 'nbLernenFocusTaskOwn' : 'nbLernenFocusTask')} purpose={t('nbLernenFocusPurpose')} />
      </header>

      <div className="flex flex-col gap-3">
        {/* Der falsche Satz ist bewusst nicht antippbar: er enthält den Fehler. */}
        <p lang="en" className="text-lg leading-relaxed" data-testid="focus-wrong">
          “{wrong}”
        </p>
        {task.kind === 'trap' && trap && trap.drills.find((d) => d.wrong === task.wrong)?.de && lang === 'de' && (
          <p className="text-sm text-muted" lang="de">
            {trap.drills.find((d) => d.wrong === task.wrong)?.de}
          </p>
        )}
        {hint && !res && (
          <p className="flex items-start gap-2 text-sm text-gold-text" data-testid="focus-hint">
            <Icon name="lightbulb" size={16} className="mt-0.5 flex-none" />
            <span>{hint}</span>
          </p>
        )}
        <textarea
          ref={field}
          className="lx-field min-h-24 text-base"
          lang="en"
          rows={3}
          value={text}
          readOnly={!!res}
          onChange={(ev) => setText(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' && !ev.shiftKey) {
              ev.preventDefault();
              if (res) next();
              else check(text);
            }
          }}
          aria-label={t('nbLernenFocusInput')}
          autoCapitalize="sentences"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          data-testid="focus-input"
        />
      </div>

      {!res && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled={!text.trim()} onClick={() => check(text)} data-testid="focus-check">
            {t('trCheck')}
          </Button>
          <Button variant="ghost" onClick={() => check('')} data-testid="focus-dont-know">
            {t('grDontKnow')}
          </Button>
        </div>
      )}
      {fb && <FeedbackPanel fb={fb} onNext={next} />}
    </article>
  );
}
