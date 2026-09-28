import { useEffect, useMemo, useState } from 'react';
import { useNav } from '../../app/nav';
import { StepBoundary } from '../../app/shell/Boundary';
import type { ScreenProps } from '../../app/registry';
import { unitDone } from '../../app/unit/done';
import { inboxFor, themeTextFor } from '../../content/nb/load';
import type { TextQuestion } from '../../content/nb/schemas';
import { normText, phraseCore } from '../../domain/week';
import { useT, type MessageKey } from '../../i18n';
import { speak, stopSpeech, useSpeech } from '../../platform/speech';
import { Button } from '../../ui/Button';
import { toast } from '../../ui/Toast';
import { ExerciseTop, TaskLine } from '../learn/ui';
import { useToday } from '../today/state';
import { useWeekState } from '../week/useWeekState';
import { loadSayTask, rememberInput } from './run';
import { useUnitRun } from './runStore';

// Eigene Ersatzschritte der Tageseinheit (Route `unitStep`), solange die Anbieter der Pakete fehlen
// oder nicht machbar sind – ohne KI erfüllbar (G6, M4):
// - `input` (Block 2): Themen-Text der Woche (P7a) bzw. die Kundenmail, zwei Verstehensfragen mit
//   Belegstelle und Grund (M9), Wendungen merken, drei Sätze nachsprechen (mit Stimme: vorlesen).
// - `again` (Block 5): aus dem Kopf neu formulieren, beide Fassungen nebeneinander; Korrekturen aus
//   Block 3 werden lokal geprüft (S4). Es entstehen KEINE Karten aus ungeprüftem Text (M4c).
// - `check`: Wochen-Check ohne genug Stoff – kurzer Hinweis, der Block zählt.

type T = (k: MessageKey, v?: Record<string, string | number>) => string;

function leave(t: T): void {
  stopSpeech();
  toast(t('nbHeuteSaved'));
  useNav.getState().go({ name: 'today' });
}

function Question({ q, idx, lang }: { q: TextQuestion; idx: number; lang: 'de' | 'en' }) {
  const { t } = useT();
  const [pick, setPick] = useState<number | null>(null);
  const done = pick !== null;
  return (
    <fieldset className="flex flex-col gap-2" data-testid="unit-question" data-answered={done ? 'true' : 'false'}>
      <legend className="mb-1 text-sm font-medium">{q.q[lang]}</legend>
      {q.options.map((o, k) => (
        <button
          key={o}
          type="button"
          disabled={done}
          onClick={() => setPick(k)}
          data-testid={`unit-q${idx}-opt`}
          lang="en"
          className={`min-h-11 rounded-[var(--radius-control)] border px-3 py-2 text-left text-sm ${done && k === q.answer ? 'border-accent bg-accent-soft' : done && k === pick ? 'border-danger' : 'border-line'}`}
        >
          {o}
        </button>
      ))}
      {done && (
        <div className="flex flex-col gap-1 text-sm" data-testid="unit-q-why">
          <p className={pick === q.answer ? 'text-accent-text' : 'text-danger-text'}>{pick === q.answer ? t('nbHeuteInputRight') : t('nbHeuteInputWrong', { answer: q.options[q.answer] ?? '' })}</p>
          <p className="text-muted">{t('nbHeuteInputEvidence', { quote: q.quote })}</p>
          <p className="text-muted">{q.why[lang]}</p>
        </div>
      )}
    </fieldset>
  );
}

function InputStep() {
  const { t, lang } = useT();
  const { pick } = useWeekState();
  const kind = useUnitRun((s) => s.kind);
  const tts = useSpeech((s) => s.status === 'ready');
  const speaking = useSpeech((s) => s.speaking);
  const mail = kind === 'task.inbox' ? inboxFor(pick.id) : null;
  const text = mail ? null : themeTextFor(pick.id);
  const body = mail ? mail.body : (text?.text ?? pick.theme.phrases.map((p) => p.en).join(' '));
  const notice = text?.notice ?? pick.theme.phrases.slice(0, 3).map((p) => p.en);
  const shadow = text?.shadow ?? [];
  const [reveal, setReveal] = useState(false);
  const finish = () => {
    stopSpeech();
    rememberInput(shadow, notice);
    unitDone(2);
  };
  return (
    <section className="flex flex-col gap-5" data-testid="unit-input" data-src={mail ? 'inbox' : 'theme-text'}>
      <TaskLine task={t('nbHeuteInputTask')} purpose={t('nbHeuteInputPurpose')} />
      <article className="lx-glass flex flex-col gap-3 rounded-[var(--radius-card)] p-5">
        {mail ? (
          <p className="text-xs text-muted">{t('nbHeuteInputMail', { from: mail.from, role: mail.role })}</p>
        ) : (
          text && <h2 className="text-lg font-semibold" lang="en">{text.title}</h2>
        )}
        {mail && <p className="font-medium" lang="en">{mail.subject}</p>}
        <p className="whitespace-pre-line text-base leading-relaxed" lang="en" data-testid="unit-text">
          {body}
        </p>
        {tts && (
          <div>
            <Button variant="ghost" icon={speaking ? 'stop' : 'speaker'} onClick={() => (speaking ? stopSpeech() : void speak(body))} data-testid="unit-read-aloud">
              {speaking ? t('nbHeuteInputStop') : t('nbHeuteInputListen')}
            </Button>
          </div>
        )}
      </article>
      {text && (
        <section className="flex flex-col gap-4" aria-label={t('nbHeuteInputQuestions')}>
          <p className="lx-eyebrow">{t('nbHeuteInputQuestions')}</p>
          <Question q={text.core} idx={1} lang={lang} />
          <Question q={text.between} idx={2} lang={lang} />
        </section>
      )}
      {mail && (
        <section className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t('nbHeuteInputMailQ')}</p>
          {reveal ? (
            <div className="flex flex-col gap-1 text-sm" data-testid="unit-mail-hidden">
              <p>{mail.hidden[lang]}</p>
              <p className="text-muted">{t('nbHeuteInputMailMust')}</p>
              <ul className="list-disc pl-5 text-muted">
                {mail.must.map((m) => (
                  <li key={m.en}>{m[lang]}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div>
              <Button variant="ghost" onClick={() => setReveal(true)} data-testid="unit-mail-reveal">
                {t('nbHeuteInputMailReveal')}
              </Button>
            </div>
          )}
        </section>
      )}
      <section className="flex flex-col gap-2">
        <p className="lx-eyebrow">{t('nbHeuteInputNotice')}</p>
        <ul className="flex flex-wrap gap-2" lang="en">
          {notice.map((n) => (
            <li key={n} className="lx-chip">
              {n}
            </li>
          ))}
        </ul>
      </section>
      {shadow.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="lx-eyebrow">{t('nbHeuteInputShadow')}</p>
          <ol className="flex flex-col gap-2" lang="en">
            {shadow.map((s) => (
              <li key={s} className="flex items-start gap-2 text-sm">
                {tts && (
                  <button type="button" onClick={() => void speak(s)} className="inline-flex size-8 flex-none items-center justify-center rounded-full border border-line text-muted" aria-label={t('nbHeuteInputListen')}>
                    ▶
                  </button>
                )}
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <Button variant="primary" size="lg" className="w-full" onClick={finish} data-testid="unit-input-done">
        {t('nbHeuteInputDone')}
      </Button>
    </section>
  );
}

const DRAFT_MAX = 1500;

function AgainStep() {
  const { t } = useT();
  const day = useToday((s) => s.day);
  const task = useUnitRun((s) => (s.day === day ? s.task : null));
  const draft = useUnitRun((s) => s.draft);
  const { targets } = useWeekState();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!task && day) void loadSayTask(day);
  }, [task, day]);
  const text = draft.slice(0, DRAFT_MAX);
  const norm = normText(text);
  const used = useMemo(() => targets.phrases.filter((p) => norm.includes(normText(phraseCore(p)))).length, [targets.phrases, norm]);
  const fixes = (task?.fixes ?? []).slice(0, 3).map((f) => ({ f, ok: norm.includes(normText(f.right)) && !(f.mine && norm.includes(normText(f.mine))) }));
  return (
    <section className="flex flex-col gap-4" data-testid="unit-again">
      <TaskLine task={t('nbHeuteAgainTask')} purpose={t('nbHeuteAgainPurpose')} />
      {!task && <p className="text-sm text-muted">{t('nbHeuteAgainNoFirst')}</p>}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t('nbHeuteAgainLabel')}</span>
        <textarea
          value={draft}
          onChange={(e) => useUnitRun.setState({ draft: e.target.value.slice(0, DRAFT_MAX) })}
          rows={5}
          lang="en"
          data-testid="unit-again-text"
          className="rounded-[var(--radius-control)] border border-line bg-surface p-3 text-base"
        />
      </label>
      <p className="text-xs text-muted" data-testid="unit-again-used">
        {t('nbHeuteAgainUsed', { n: used, total: targets.phrases.length })}
      </p>
      {!shown ? (
        <Button variant="primary" size="lg" className="w-full" disabled={norm.split(' ').filter(Boolean).length < 3} onClick={() => setShown(true)} data-testid="unit-again-compare">
          {t('nbHeuteAgainCompare')}
        </Button>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2" data-testid="unit-again-both">
            {task && (
              <div className="rounded-[var(--radius-control)] border border-line p-3 text-sm" lang="en">
                <p className="mb-1 text-xs text-muted">{t('nbHeuteAgainFirst')}</p>
                {task.text}
              </div>
            )}
            <div className="rounded-[var(--radius-control)] bg-accent-soft p-3 text-sm" lang="en">
              <p className="mb-1 text-xs text-muted">{t('nbHeuteAgainSecond')}</p>
              {text}
            </div>
            {task?.better && (
              <div className="rounded-[var(--radius-control)] border border-line p-3 text-sm sm:col-span-2" lang="en">
                <p className="mb-1 text-xs text-muted">{t('nbHeuteAgainModel')}</p>
                {task.better}
              </div>
            )}
          </div>
          {fixes.length > 0 && (
            <ul className="flex flex-col gap-2 text-sm" aria-label={t('nbHeuteAgainFixes')}>
              {fixes.map(({ f, ok }) => (
                <li key={f.right} data-ok={ok ? 'true' : 'false'}>
                  <span lang="en" className="font-medium">
                    {f.right}
                  </span>{' '}
                  · <span className={ok ? 'text-accent-text' : 'text-gold-text'}>{ok ? t('nbHeuteAgainFixOk') : t('nbHeuteAgainFixOpen')}</span>
                  <span className="block text-muted">{f.why}</span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="primary" size="lg" className="w-full" onClick={() => unitDone(5)} data-testid="unit-again-done">
            {t('nbHeuteAgainDone')}
          </Button>
        </>
      )}
    </section>
  );
}

function CheckEmpty({ block }: { block: number }) {
  const { t } = useT();
  return (
    <section className="flex flex-col gap-4" data-testid="unit-check-empty">
      <p className="text-base">{t('nbHeuteCheckEmpty')}</p>
      <Button variant="primary" size="lg" className="w-full" onClick={() => unitDone(block === 3 ? 3 : 3)} data-testid="unit-check-empty-ok">
        {t('nbHeuteCheckEmptyOk')}
      </Button>
    </section>
  );
}

export function UnitStepScreen({ route }: ScreenProps<'unitStep'>) {
  const { t } = useT();
  const total = useToday((s) => s.duties.total);
  const done = useToday((s) => s.duties.done);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-4 sm:py-8" data-testid="unit-step" data-step={route.step}>
      <ExerciseTop onClose={() => leave(t)} closeLabel={t('nbHeuteClose')} closeTestId="unit-close" progress={total ? { n: Math.min(total, done + 1), total } : null} ctx="duty" />
      <StepBoundary resetKey={`${route.step}-${route.block}`} scope="unitStep" onSkip={() => leave(t)}>
        {route.step === 'input' ? <InputStep /> : route.step === 'again' ? <AgainStep /> : <CheckEmpty block={route.block} />}
      </StepBoundary>
    </div>
  );
}
