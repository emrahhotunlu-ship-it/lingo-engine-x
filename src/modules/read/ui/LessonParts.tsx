import { useEffect, useRef, useState } from 'react';
import { AiRunPanel, Button, EnglishText, Icon, KineticGap, isBusy, useAiAvailable, useAiScope, useT } from '../sharedUi';
import type { AiMessageKey, AiPhase } from '../shared';
import { checkApplyWithClaude } from '../applyCheck';
import type { ReadApplyOut } from '../prompt';
import { checkApply, phraseUsed } from '../domain/apply';
import type { ApplyProblem } from '../domain/apply';
import { courseDef } from '../domain/courses';
import type { Lesson } from '../domain/lesson';
import type { WarmupItem } from '../domain/warmup';
import { warmupRight } from '../domain/warmup';
import { WARMUP_GAP } from '../domain/warmup';
import { normKey } from '../domain/text';

// Bausteine einer Kurslektion (Paket L8): Ziel, Aufwärmen, Sprachtipp, Anwenden mit „Claude prüfen“, Fortschrittszeilen.
// Der Text, die Ansichten, das Antippen der Wörter und die Prüffragen kommen vom Leser (ReaderView); hier steht nur, was eine Lektion zusätzlich hat.
// Sprachtreue (Kap. 10, Kap. 15): Ziel, Lage und Begründungen stehen in der Sprache der Oberfläche, wenn die Lektion sie so mitbringt (`*_en`), sonst auf Deutsch.

const CARD = 'lx-card flex flex-col gap-3 p-4';
const H2 = 'm-0 text-base font-semibold text-fg';

/** Text in der Oberflächensprache, mit Rückfall auf die deutsche Fassung. */
const pickLang = (lang: 'de' | 'en', de: string, en: string | undefined): { text: string; lang: 'de' | 'en' } => (lang === 'en' && en ? { text: en, lang: 'en' } : { text: de, lang: 'de' });

/**
 * Solange ein Eingabefeld Fokus hat, steht die Reiterleiste am Handy nicht davor (`html[data-field-focus]`, index.css). Die Lektion hat keine Aktionsleiste,
 * die das übernähme; ohne das verschwindet das Feld hinter der Leiste (UX-Prüfung 14.10.2026).
 */
export function useFieldFocusFlag(): void {
  useEffect(() => {
    const root = document.documentElement;
    const on = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) root.setAttribute('data-field-focus', '');
    };
    const off = () => root.removeAttribute('data-field-focus');
    document.addEventListener('focusin', on);
    document.addEventListener('focusout', off);
    return () => {
      document.removeEventListener('focusin', on);
      document.removeEventListener('focusout', off);
      off();
    };
  }, []);
}

// ---------------------------------------------------------------- Ziel und Wendungen

export function GoalCard({ lesson }: { lesson: Lesson }) {
  const { t, lang } = useT();
  const goal = pickLang(lang, lesson.goal, lesson.goalEn);
  return (
    <section className={CARD} aria-labelledby="lsn-goal-h" data-testid="lsn-goal">
      <div className="flex flex-col gap-1">
        <h2 id="lsn-goal-h" className="m-0 text-2xs font-semibold uppercase tracking-wide text-subtle">
          {t('rdcGoalLabel')}
        </h2>
        <p className="m-0 text-base leading-6 text-fg" lang={goal.lang} data-testid="lsn-goal-text">
          {goal.text}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="m-0 text-2xs font-semibold uppercase tracking-wide text-subtle">{t('rdcPhrasesLabel')}</p>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" data-testid="lsn-phrases">
          {lesson.phrases.map((p) => (
            <li key={p.w} className="rounded-full bg-surface-strong px-3 py-1 text-sm text-fg" lang="en" data-testid="lsn-phrase">
              {p.w}
            </li>
          ))}
        </ul>
        <p className="m-0 text-xs text-muted">{t('rdcPhrasesHint')}</p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Aufwärmen

type WarmResult = { value: string; right: boolean };

/**
 * Aufwärmen: eine Lücke nach der anderen, getippt wird IN die Lücke (kinetische Lücke wie im Trainer, Kap. 4.1). Richtig = grün, falsch = rot mit der eigenen
 * Eingabe durchgestrichen und der Lösung daneben. Dazu immer das Warum: was die Wendung heißt und aus welcher Lektion sie stammt. Freiwillig, zählt nicht.
 */
export function WarmupCard({ items }: { items: readonly WarmupItem[] }) {
  const { t } = useT();
  const [open, setOpen] = useState(true);
  const [results, setResults] = useState<Record<string, WarmResult>>({});
  const typed = useRef('');
  if (items.length === 0) return null;
  const activeIdx = items.findIndex((it) => !results[it.id]);
  const shown = activeIdx === -1 ? items : items.slice(0, activeIdx + 1);
  const check = (it: WarmupItem): void => {
    const value = typed.current.trim();
    if (results[it.id] || !value) return;
    typed.current = '';
    setResults((r) => ({ ...r, [it.id]: { value, right: warmupRight(it, value) } }));
  };
  return (
    <section className={CARD} aria-labelledby="lsn-warm-h" data-testid="lsn-warmup">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id="lsn-warm-h" className={H2}>
            {t('rdcWarmTitle')}
          </h2>
          <p className="m-0 text-xs text-muted">{t('rdcWarmHint')}</p>
        </div>
        <Button variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open} data-testid="lsn-warm-toggle" className="shrink-0">
          {open ? t('rdcWarmSkip') : t('rdcWarmShow')}
        </Button>
      </div>
      {open
        ? shown.map((it, i) => {
            const res = results[it.id];
            const parts = it.gap.split(WARMUP_GAP);
            const state = res ? (res.right ? 'correct' : 'wrong') : 'input';
            return (
              <form
                key={it.id}
                className="flex flex-col gap-2"
                data-testid="lsn-warm-item"
                data-state={res ? (res.right ? 'right' : 'wrong') : 'open'}
                onSubmit={(e) => {
                  e.preventDefault();
                  check(it);
                }}
              >
                <p className="m-0 text-2xs uppercase tracking-wide text-subtle">{t('rdcWarmN', { n: i + 1 })}</p>
                <p className="m-0 text-base leading-7 text-fg" lang="en" data-testid="lsn-warm-gap">
                  {parts[0]}
                  <KineticGap
                    label={t('rdcWarmN', { n: i + 1 })}
                    maxLength={Math.max(40, it.answer.length + 10)}
                    state={state}
                    shown={res ? res.value : null}
                    reveal={res && !res.right ? { solution: it.answer, given: res.value } : null}
                    silent
                    onChange={(v) => {
                      typed.current = v;
                    }}
                    onEnter={() => check(it)}
                  />
                  {parts[1]}
                </p>
                {it.de ? <p className="m-0 text-xs text-muted">{t('rdcWarmMeaning', { de: it.de })}</p> : null}
                {res ? (
                  <div className="flex flex-col gap-1" data-testid="lsn-warm-result">
                    <p className={`m-0 flex items-center gap-1.5 text-sm font-medium ${res.right ? 'text-ok-text' : 'text-wrong-text'}`} role="status">
                      <Icon name={res.right ? 'check' : 'close'} size={16} />
                      {res.right ? t('rdcWarmRight') : t('rdcWarmWrong', { answer: it.answer })}
                    </p>
                    <p className="m-0 text-xs text-muted" data-testid="lsn-warm-why">
                      {t('rdcWarmWhy', { w: it.w, de: it.de || it.w, n: it.fromN })}
                    </p>
                  </div>
                ) : (
                  <div>
                    <Button type="submit" variant="secondary" data-testid="lsn-warm-check">
                      {t('rdcWarmCheck')}
                    </Button>
                  </div>
                )}
              </form>
            );
          })
        : null}
    </section>
  );
}

// ---------------------------------------------------------------- Sprachtipp

/**
 * Sprachtipp als Mini-Aufgabe (Lernwissenschaft M6): erst der falsche Satz mit „Wo steckt der Fehler?“ und einem Feld für die richtige Fassung, dann aufdecken
 * (häufiger Fehler / richtig / warum). Freiwillig: Aufdecken geht auch ohne Eingabe, nichts davon zählt für „fertig“.
 */
export function TipCard({ lesson }: { lesson: Lesson }) {
  const { t, lang } = useT();
  const { wrong, right } = lesson.tip;
  const why = pickLang(lang, lesson.tip.why, lesson.tip.whyEn);
  const [value, setValue] = useState('');
  const [revealed, setRevealed] = useState(false);
  const mine = value.trim();
  const ok = !!mine && normKey(mine) === normKey(right);
  return (
    <section className={CARD} aria-labelledby="lsn-tip-h" data-testid="lsn-tip" data-revealed={revealed || undefined}>
      <h2 id="lsn-tip-h" className={H2}>
        {t('rdcTipTitle')}
      </h2>
      {!revealed ? (
        <form
          className="flex flex-col gap-2"
          data-testid="lsn-tip-find"
          onSubmit={(e) => {
            e.preventDefault();
            setRevealed(true);
          }}
        >
          <p className="m-0 text-sm font-semibold text-fg">{t('rdcTipFind')}</p>
          <p className="m-0 text-base leading-6 text-fg" lang="en" data-testid="lsn-tip-sentence">
            {wrong}
          </p>
          <p className="m-0 text-xs text-muted">{t('rdcTipFindHint')}</p>
          <div className="flex gap-2">
            <input
              className="lx-field min-w-0 flex-1 scroll-mb-40"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('rdcTipPlaceholder')}
              aria-label={t('rdcTipFind')}
              lang="en"
              autoComplete="off"
              autoCapitalize="sentences"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              data-testid="lsn-tip-input"
            />
            <Button type="submit" variant="secondary" data-testid="lsn-tip-reveal">
              {t('rdcTipReveal')}
            </Button>
          </div>
        </form>
      ) : (
        <dl className="m-0 flex flex-col gap-2 text-sm" data-testid="lsn-tip-answer">
          {mine ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-2xs font-semibold uppercase tracking-wide text-subtle">{t('rdcTipYours')}</dt>
              <dd className={`m-0 flex items-start gap-1.5 ${ok ? 'text-ok-text' : 'text-fg'}`} data-testid="lsn-tip-mine">
                {ok ? <Icon name="check" size={16} className="mt-1 flex-none" /> : null}
                <span lang="en">{mine}</span>
              </dd>
            </div>
          ) : null}
          <div className="flex flex-col gap-0.5">
            <dt className="text-2xs font-semibold uppercase tracking-wide text-subtle">{t('rdcTipWrong')}</dt>
            <dd className="m-0 flex items-start gap-1.5 text-wrong-text" data-testid="lsn-tip-wrong">
              <Icon name="close" size={16} className="mt-1 flex-none" />
              <span lang="en" className="line-through decoration-1">
                {wrong}
              </span>
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-2xs font-semibold uppercase tracking-wide text-subtle">{t('rdcTipRight')}</dt>
            <dd className="m-0 flex items-start gap-1.5 text-ok-text" data-testid="lsn-tip-right">
              <Icon name="check" size={16} className="mt-1 flex-none" />
              <EnglishText as="span" text={right} area="read" source={lesson.id} title={lesson.title} className="font-medium" />
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-2xs font-semibold uppercase tracking-wide text-subtle">{t('rdcTipWhy')}</dt>
            <dd className="m-0 text-fg" lang={why.lang} data-testid="lsn-tip-why">
              {why.text}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Anwenden

const PROBLEM_KEY: Record<ApplyProblem, 'rdcApplyEmpty' | 'rdcApplyShort' | 'rdcApplyNotEnglish' | 'rdcApplyLong'> = {
  empty: 'rdcApplyEmpty',
  tooShort: 'rdcApplyShort',
  notEnglish: 'rdcApplyNotEnglish',
  tooLong: 'rdcApplyLong',
};

type ClaudeState = { phase: AiPhase | 'idle'; error: AiMessageKey | null; data: ReadApplyOut | null };

export type ApplyCardProps = {
  lesson: Lesson;
  /** Der abgeschickte Text (aus dem Fortschritt) oder `null`. */
  submitted: string | null;
  /** Der Text wird abgeschickt (lokal geprüft, mindestens zwei Sätze). Darf asynchron speichern. */
  onSubmit: (text: string) => void;
};

/** Der Satz der Musterlösung, in dem die Wendung steht (für „So benutzt die Musterlösung …“). */
const modelSentenceFor = (model: readonly string[], phrase: string): string | null => model.find((s) => phraseUsed(s, phrase)) ?? null;

export function ApplyCard({ lesson, submitted, onSubmit }: ApplyCardProps) {
  const { t, lang } = useT();
  const aiOn = useAiAvailable();
  const scope = useAiScope();
  const ctl = useRef<AbortController | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<ApplyProblem | null>(null);
  const [claude, setClaude] = useState<ClaudeState>({ phase: 'idle', error: null, data: null });
  const sent = submitted !== null;
  const text = sent ? submitted : draft;
  const local = checkApply(text, lesson.apply.targets);
  const situation = pickLang(lang, lesson.apply.situation, lesson.apply.situationEn);
  // Die letzte Lektion eines Kurses ist der Abschluss (Pitch bzw. Kundentext, bis zu sechs Sätze).
  const long = lesson.n === (courseDef(lesson.course)?.lessons ?? -1);

  // Nach dem Abschicken wächst das Feld auf die Höhe des Textes (kein innerer Bildlauf, die erste Zeile bleibt sichtbar).
  useEffect(() => {
    const el = area.current;
    if (!el || !sent) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [sent, text]);

  const send = () => {
    const c = checkApply(draft, lesson.apply.targets);
    if (!c.ok) {
      setProblem(c.problem);
      return;
    }
    setProblem(null);
    onSubmit(draft.trim());
  };

  const runClaude = (retry = false) => {
    if (ctl.current || !sent) return;
    const c = scope.controller();
    ctl.current = c;
    setClaude({ phase: 'queued', error: null, data: null });
    void checkApplyWithClaude({ situation: situation.text, targets: lesson.apply.targets, model: lesson.apply.model, text: submitted, uiLang: lang }, c.signal, (p) => setClaude((s) => (s.phase === 'idle' ? s : { ...s, phase: p })), retry).then((res) => {
      ctl.current = null;
      if (res.ok) setClaude({ phase: 'idle', error: null, data: res.data });
      else setClaude({ phase: 'idle', error: res.cancelled ? null : (res.key ?? 'aiFailed'), data: null });
    });
  };
  const stop = () => ctl.current?.abort();

  const missing = lesson.apply.targets.filter((_, i) => !local.hits[i]);
  return (
    <section className={CARD} aria-labelledby="lsn-apply-h" data-testid="lsn-apply" data-sent={sent || undefined}>
      <div className="flex flex-col gap-1">
        <h2 id="lsn-apply-h" className={H2}>
          {t('rdcApplyTitle')}
        </h2>
        <p className="m-0 text-xs text-muted">{t(long ? 'rdcApplyHintLong' : 'rdcApplyHint')}</p>
      </div>
      <p className="m-0 text-base leading-6 text-fg" lang={situation.lang} data-testid="lsn-apply-situation">
        {situation.text}
      </p>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label={t('rdcApplyTargets')} data-testid="lsn-apply-targets">
        {lesson.apply.targets.map((w, i) => {
          const hit = sent && local.hits[i] === true;
          const miss = sent && local.hits[i] === false;
          return (
            <li key={w} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${hit ? 'bg-ok-soft text-fg' : miss ? 'bg-surface-strong text-muted' : 'bg-accent-soft text-accent-text'}`} lang="en" data-testid="lsn-apply-target" data-state={hit ? 'used' : miss ? 'missing' : undefined}>
              {hit ? <Icon name="check" size={14} /> : null}
              <span>{w}</span>
              {hit ? <span className="sr-only">{t('rdcApplyUsed')}</span> : miss ? <span className="sr-only">{t('rdcApplyMissing')}</span> : null}
            </li>
          );
        })}
      </ul>
      <textarea
        ref={area}
        className={`lx-field w-full scroll-mb-40 text-base leading-6 ${sent ? 'resize-none overflow-hidden' : 'min-h-28 resize-y'}`}
        value={text}
        readOnly={sent}
        maxLength={700}
        onChange={(e) => {
          setDraft(e.target.value);
          if (problem) setProblem(null);
        }}
        placeholder={t('rdcApplyPlaceholder')}
        aria-label={t('rdcApplyTitle')}
        lang="en"
        autoCapitalize="sentences"
        autoCorrect="off"
        spellCheck={false}
        data-testid="lsn-apply-input"
      />
      {problem ? (
        <p className="m-0 text-sm text-muted" role="status" data-testid="lsn-apply-problem" data-problem={problem}>
          {t(PROBLEM_KEY[problem])}
        </p>
      ) : null}
      {sent ? (
        <div className="flex flex-col gap-3" data-testid="lsn-apply-feedback">
          <p className="m-0 inline-flex items-center gap-1.5 text-sm font-medium text-ok-text" role="status">
            <Icon name="check" size={16} />
            {t('rdcApplySent')}
          </p>
          {missing.length > 0 ? (
            <div className="flex flex-col gap-1" data-testid="lsn-apply-missing">
              <p className="m-0 text-sm text-muted">{t('rdcApplyMissingList', { list: missing.join(' · ') })}</p>
              {/* Auch ohne Claude steht das Warum da: wie die Musterlösung die fehlende Wendung benutzt. */}
              {missing.map((w) => {
                const s = modelSentenceFor(lesson.apply.model, w);
                return s ? (
                  <p key={w} className="m-0 text-sm text-fg" data-testid="lsn-apply-modeluse" lang={lang}>
                    {t('rdcApplyModelUse', { w, sentence: s })}
                  </p>
                ) : null;
              })}
            </div>
          ) : (
            <p className="m-0 text-sm text-ok-text" data-testid="lsn-apply-allused">
              {t('rdcApplyAllUsed')}
            </p>
          )}
          <div className="flex flex-col gap-1.5 border-l-2 border-line-strong pl-3" data-testid="lsn-model">
            <p className="m-0 text-2xs font-semibold uppercase tracking-wide text-subtle">{t('rdcModelTitle')}</p>
            <EnglishText as="p" text={lesson.apply.model.join(' ')} area="read" source={lesson.id} title={lesson.title} className="m-0 text-base leading-7 text-fg" />
            <p className="m-0 text-xs text-muted">{t('rdcModelHint')}</p>
          </div>
          {aiOn ? (
            <div className="flex flex-col gap-2" data-testid="lsn-claude">
              {claude.data ? null : isBusy(claude.phase) ? null : (
                <div>
                  <Button variant="secondary" icon="sparkle" onClick={() => runClaude(false)} data-testid="lsn-claude-go" data-ai="">
                    {t('rdcClaude')}
                  </Button>
                </div>
              )}
              <AiRunPanel phase={claude.phase} error={claude.error} onStop={stop} onRetry={() => runClaude(true)} skeleton={false} />
              {claude.data ? <ClaudeReply data={claude.data} lang={lang} mine={submitted} model={lesson.apply.model.join(' ')} /> : null}
            </div>
          ) : (
            <p className="m-0 text-xs text-muted" data-testid="lsn-claude-off">
              {t('rdcClaudeOff')}
            </p>
          )}
        </div>
      ) : (
        <div>
          <Button variant="primary" onClick={send} data-testid="lsn-apply-send">
            {t('rdcApplySend')}
          </Button>
        </div>
      )}
    </section>
  );
}

const sameText = (a: string, b: string): boolean => normKey(a) === normKey(b);

function ClaudeReply({ data, lang, mine, model }: { data: ReadApplyOut; lang: 'de' | 'en'; mine: string; model: string }) {
  const { t } = useT();
  const verdict = data.verdict === 'right' ? t('rdcClaudeRight') : data.verdict === 'almost' ? t('rdcClaudeAlmost') : t('rdcClaudeWrong');
  // Nichts doppelt auf einem Bildschirm (Kap. 15): Ist „Korrigiert“ der eigene Text, steht „Keine Korrektur nötig“; ist die natürlichere Fassung die Musterlösung
  // (oder die korrigierte), entfällt sie.
  const noFix = sameText(data.fixed, mine);
  const showC1 = !sameText(data.c1, model) && !sameText(data.c1, data.fixed);
  return (
    <div className="flex flex-col gap-2 text-sm" role="status" data-testid="lsn-claude-reply" data-verdict={data.verdict} data-lang={lang}>
      <p className={`m-0 flex items-center gap-1.5 font-semibold ${data.verdict === 'right' ? 'text-ok-text' : 'text-fg'}`}>
        <Icon name={data.verdict === 'right' ? 'check' : 'sparkle'} size={16} />
        {verdict}
      </p>
      {noFix ? (
        <p className="m-0 text-muted" data-testid="lsn-claude-nofix">
          {t('rdcClaudeNoFix')}
        </p>
      ) : (
        <p className="m-0 text-muted">
          <span className="font-semibold">{t('rdcClaudeFixed')}:</span> <span lang="en" data-testid="lsn-claude-fixed">{data.fixed}</span>
        </p>
      )}
      {showC1 ? (
        <p className="m-0 text-muted">
          <span className="font-semibold">{t('rdcClaudeC1')}:</span> <span lang="en" data-testid="lsn-claude-c1">{data.c1}</span>
        </p>
      ) : null}
      <p className="m-0 text-fg">
        <span className="font-semibold">{t('rdcClaudeWhy')}:</span> <span lang={lang} data-testid="lsn-claude-why">{data.why}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Stand der Lektion (Zustand, kein Knopf)

export type StepState = { read: boolean; questions: number; applied: boolean; done: boolean };

/**
 * Stand der Lektion. „Fertig“ ist ein Zustand. Wurde die Lektion heute fertig (`restToday`), gibt es keine Aufforderung zur nächsten (Tempo 3–4 Lektionen
 * je Woche, Kap. 7): Hauptknopf „Fertig für heute“ (zurück zu „Lesen“), „Lektion n schon jetzt“ nur leiser (Lernwissenschaft N3, UX-Prüfung).
 */
export function StepsCard({ steps, onToCourse, onNext, restToday = false, onHome, nextN }: { steps: StepState; onToCourse: () => void; onNext: (() => void) | null; restToday?: boolean; onHome?: () => void; nextN?: number | null }) {
  const { t } = useT();
  const row = (ok: boolean, label: string, id: string) => (
    <li key={id} className={`flex items-center gap-2 text-sm ${ok ? 'text-ok-text' : 'text-muted'}`} data-testid="lsn-step" data-step={id} data-state={ok ? 'done' : 'open'}>
      {ok ? <Icon name="check" size={16} /> : <span aria-hidden="true" className="inline-block size-4 flex-none rounded-full border border-line-strong" />}
      <span>{label}</span>
    </li>
  );
  const rest = steps.done && restToday;
  return (
    <section className={CARD} aria-labelledby="lsn-steps-h" data-testid="lsn-steps" data-done={steps.done || undefined} data-rest={rest || undefined}>
      <h2 id="lsn-steps-h" className={H2}>
        {steps.done ? t('rdcDoneTitle') : t('rdcStepsTitle')}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {row(steps.read, t('rdcStepRead'), 'read')}
        {row(steps.questions >= 3, t('rdcStepQuestions', { n: Math.min(3, steps.questions) }), 'questions')}
        {row(steps.applied, t('rdcStepApply'), 'apply')}
      </ul>
      {rest ? (
        <div className="flex flex-col gap-2 [&>*]:w-full">
          <p className="m-0 text-sm text-muted" data-testid="lsn-rest" role="status">
            {t('rdcRestToday')}
          </p>
          <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={onHome ?? onToCourse} data-testid="lsn-end" data-kind="rest">
            {t('rdcDoneForToday')}
          </Button>
          {onNext && nextN ? (
            <Button variant="ghost" onClick={onNext} data-testid="lsn-next-now" data-kind="next">
              {t('rdcNextNow', { n: nextN })}
            </Button>
          ) : null}
        </div>
      ) : steps.done ? (
        <div className="flex flex-col gap-2 [&>*]:w-full">
          <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={onNext ?? onToCourse} data-testid="lsn-end" data-kind={onNext ? 'next' : 'course'}>
            {onNext ? t('rdcNextLesson') : t('rdcToCourse')}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
