import { useMemo, useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { alignWords } from '../../domain/answer/align';
import type { ExplanationModel, ResultVerdict } from '../../domain/explain/types';
import { patternById } from '../../domain/grammar/patterns';
import { checkB1, type FkB1, type FkB2 } from '../../domain/repair/fk';
import { hash32 } from '../../domain/random';
import { Choices } from '../../engine/Choices';
import { EnglishText } from '../../engine/EnglishText';
import type { WordTapArea } from '../../engine/wordTap';
import { useT } from '../../i18n';
import { repairCheck } from '../../prompts/repairCheck';
import { ExerciseShell, SentenceInput, explainDepth, type ShellSecondary } from '../../ui/exercise';

// Paket FK: die zwei neuen Aufgabenformen von „Fehler korrigieren“.
//  B1 „Sag es richtig“: Lage + deutsche Absicht, Emrah schreibt den englischen Satz. Prüfung lokal gegen Musterlösung und Varianten
//     (`checkB1`); sagt sie nein und die KI ist da, fragt Claude (`quick`) als Zweitmeinung – ein Fehler wird nie automatisch wiederholt.
//  B2 „Welche Fassung schickst du?“: zwei Fassungen, Begründung, danach ein neuer Satz mit zwei Stellen (je zwei Formen zur Wahl).
// Beide laufen im Übungsgerüst (Kap. 2: Was soll ich tun, wozu, was ist richtig, warum), ohne Selbstbewertung; die Note kommt aus der Richtigkeit.

type Common = {
  area: WordTapArea;
  source: string | null;
  onNext: () => void;
  onUnclear?: () => void;
  /** Zusatz in der Statuszeile (z. B. „Satz 2 von 5“). */
  status?: string | null;
};
type Result = { ok: boolean; near: boolean; given: string; ms: number; right: string; wrong: string; why: string };

const VERDICT = { ok: 'ok', close: 'near', no: 'wrong' } as const;
type V = keyof typeof VERDICT;

function patLine(pat: string, lang: 'de' | 'en'): { k: 'pattern'; name: string; formula: null } | null {
  const p = patternById(pat);
  return p ? { k: 'pattern', name: lang === 'de' ? p.name.de : p.name.en, formula: null } : null;
}

// ------------------------------------------------------------------ B1

export function FkB1Item({ task, area, source, status = null, onNext, onUnclear, onResult }: Common & { task: FkB1; onResult: (r: Result) => void }) {
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const ask = useAsk(repairCheck);
  const [text, setText] = useState('');
  const [res, setRes] = useState<{ v: V; note: string | null; given: string } | null>(null);
  const [shownAt] = useState(() => performance.now());
  const busy = ask.phase === 'queued' || ask.phase === 'thinking' || ask.phase === 'slow' || ask.phase === 'streaming';
  const why = task.why[lang];

  const finish = (v: V, note: string | null, given: string) => {
    setRes({ v, note, given });
    onResult({ ok: v !== 'no', near: v === 'close', given, ms: performance.now() - shownAt, right: task.model, wrong: given || task.bad, why });
  };
  const judge = async (given: string) => {
    if (res || busy || !given.trim()) return;
    const local = checkB1(given, task);
    if (local !== 'no' || !ai) {
      finish(local === 'exact' ? 'ok' : local, null, given.trim());
      return;
    }
    const out = await ask.run({ wrong: task.bad, right: task.model, why, given: given.trim(), uiLang: lang });
    // KI nicht erreichbar, abgebrochen oder unlesbar: nicht als falsch werten, „Prüfen“ fragt erneut.
    if (!out) return;
    finish(out.ok ? 'ok' : 'no', out.note ?? null, given.trim());
  };
  const submit = () => void judge(text);

  const model: ExplanationModel | null = res
    ? { lines: [...(patLine(task.pat, lang) ? [patLine(task.pat, lang)!] : []), { k: 'why' as const, text: why }], examples: [], mark: [], ai: false, source: 'task' }
    : null;
  const comparison = res && res.v !== 'ok' ? (res.given ? { given: res.given, ops: alignWords(res.given, task.model) } : null) : null;
  const secondary: ShellSecondary[] = res
    ? []
    : [
        { id: 'dontKnow', label: t('exDontKnow'), onClick: () => finish('no', null, ''), testId: 'repair-dontknow' },
        ...(onUnclear && !busy ? [{ id: 'unclear' as const, label: t('fxRUnclear'), onClick: onUnclear, testId: 'repair-unclear' }] : []),
      ];
  const hint = res ? null : busy ? { text: t('exThinking'), tone: 'hint' as const } : ask.error ? { text: t('exAiError'), tone: 'near' as const } : null;
  const verdict: ResultVerdict | null = res ? VERDICT[res.v] : null;

  return (
    <div data-testid="repair-item" data-id={task.id} data-mode="review" data-form="b1" data-state={res ? res.v : 'open'}>
      <ExerciseShell
        meta={{ ex: 'repair', id: task.id, kind: 'b1' }}
        status={{ area: 'grammar', state: null, kindLabel: t('fxB1Kind'), topic: null, pattern: null, badge: status }}
        task={{ text: t('fxB1Task'), purpose: t('fxB1Purpose') }}
        aid={
          res ? null : (
            <p className="text-sm text-muted" data-testid="fk-hint">
              {t('fxB1Hint', { hint: task.hint[lang] })}
            </p>
          )
        }
        prompt={
          res ? (
            <EnglishText as="p" text={task.model} area={area} source={source} testId="repair-right" />
          ) : (
            <div className="flex flex-col gap-2" data-testid="fk-b1-prompt">
              <p className="lx-t-support text-muted" data-testid="fk-sit">
                {task.sit[lang]}
              </p>
              <p className="lx-t-prompt" lang={lang} data-testid="fk-intent">
                {lang === 'de' ? `„${task.intent.de}“` : task.intent.en}
              </p>
            </div>
          )
        }
        answer={res ? null : <SentenceInput mode="free" value={text} onChange={setText} onSubmit={submit} disabled={busy} testId="repair-input" />}
        hint={hint}
        secondary={secondary}
        primary={res ? { label: t('exNext'), onClick: onNext, testId: 'repair-next' } : { label: t('exCheck'), onClick: submit, testId: 'repair-check', disabled: busy || !text.trim(), busy, busyLabel: t('exChecking') }}
        feedback={res && verdict ? { verdict, sub: res.note, comparison, explanation: model, depth: explainDepth({ verdict, p: null, learning: true }), menu: {} } : null}
      />
    </div>
  );
}

// ------------------------------------------------------------------ B2

const parts = (s: string): [string, string, string] => {
  const a = s.indexOf('{1}');
  const b = s.indexOf('{2}');
  return [s.slice(0, a), s.slice(a + 3, b), s.slice(b + 3)];
};

export function FkB2Item({ task, area, source, status = null, onNext, onUnclear, onResult }: Common & { task: FkB2; onResult: (r: Result) => void }) {
  const { t, lang } = useT();
  // Reihenfolge der Fassungen und der Optionen stehen pro Aufgabe fest (nicht gewürfelt bei jedem Zeichnen).
  const versions = useMemo(() => (hash32(`${task.id}|v`) % 2 === 0 ? [task.good, task.bad] : [task.bad, task.good]), [task.id, task.good, task.bad]);
  const goodIdx = versions.indexOf(task.good);
  const gapOrder = useMemo(() => task.next.gaps.map((_, k) => (hash32(`${task.id}|g${k}`) % 2 === 0 ? [0, 1] : [1, 0])), [task]);
  const [step, setStep] = useState<'pick' | 'gap1' | 'gap2'>('pick');
  const [picked, setPicked] = useState<number | null>(null);
  const [pickShown, setPickShown] = useState(false);
  const [gaps, setGaps] = useState<[number | null, number | null]>([null, null]);
  const [res, setRes] = useState<{ v: V; given: string } | null>(null);
  const [shownAt] = useState(() => performance.now());
  const why = task.why[lang];
  const pickOk = picked === goodIdx;
  const gapIdx = step === 'gap1' ? 0 : 1;
  const [pre, mid, post] = parts(task.next.s);
  const fill = (k: 0 | 1): string => {
    const g = task.next.gaps[k];
    const chosen = gaps[k];
    return chosen === null ? '___' : g.o[chosen]!;
  };
  const rightFill = (k: 0 | 1): string => task.next.gaps[k].o[task.next.gaps[k].ok]!;
  const fullRight = `${pre}${rightFill(0)}${mid}${rightFill(1)}${post}`;

  const finish = (v: V, given: string, final: [number | null, number | null]) => {
    setRes({ v, given });
    onResult({ ok: v !== 'no', near: v === 'close', given, ms: performance.now() - shownAt, right: task.good, wrong: task.bad, why });
    setGaps(final);
  };
  const conclude = (final: [number | null, number | null]) => {
    const allGaps = final[0] === task.next.gaps[0].ok && final[1] === task.next.gaps[1].ok;
    const given = `${pre}${final[0] === null ? '___' : task.next.gaps[0].o[final[0]]}${mid}${final[1] === null ? '___' : task.next.gaps[1].o[final[1]]}${post}`;
    finish(pickOk && allGaps ? 'ok' : pickOk ? 'close' : 'no', given, final);
  };

  const primary = ((): { label: string; onClick: () => void; testId: string; disabled?: boolean } => {
    if (res) return { label: t('exNext'), onClick: onNext, testId: 'repair-next' };
    if (step === 'pick') {
      if (!pickShown) return { label: t('exCheck'), onClick: () => setPickShown(true), testId: 'repair-check', disabled: picked === null };
      return { label: t('exNext'), onClick: () => setStep('gap1'), testId: 'fk-b2-continue' };
    }
    const cur = gaps[gapIdx];
    return {
      label: step === 'gap1' ? t('exNext') : t('exCheck'),
      onClick: () => (step === 'gap1' ? setStep('gap2') : conclude(gaps)),
      testId: step === 'gap1' ? 'fk-b2-gap-next' : 'repair-check',
      disabled: cur === null,
    };
  })();

  const choiceOptions = step === 'pick' ? versions : task.next.gaps[gapIdx].o.map((_, i) => task.next.gaps[gapIdx].o[gapOrder[gapIdx]![i]!]!);
  const chosenIdx = step === 'pick' ? picked : gaps[gapIdx] === null ? null : gapOrder[gapIdx]!.indexOf(gaps[gapIdx]);
  const onPick = (i: number) => {
    if (step === 'pick') {
      if (!pickShown) setPicked(i);
      return;
    }
    const g = [...gaps] as [number | null, number | null];
    g[gapIdx] = gapOrder[gapIdx]![i]!;
    setGaps(g);
  };

  const model: ExplanationModel | null = res
    ? { lines: [...(patLine(task.pat, lang) ? [patLine(task.pat, lang)!] : []), { k: 'why' as const, text: why }], examples: [], mark: [], ai: false, source: 'task' }
    : null;
  const secondary: ShellSecondary[] =
    res || step !== 'pick' || pickShown
      ? []
      : [
          { id: 'dontKnow', label: t('exDontKnow'), onClick: () => finish('no', '', [null, null]), testId: 'repair-dontknow' },
          ...(onUnclear ? [{ id: 'unclear' as const, label: t('fxRUnclear'), onClick: onUnclear, testId: 'repair-unclear' }] : []),
        ];
  const hint = !res && step === 'pick' && pickShown ? { text: why, tone: pickOk ? ('hint' as const) : ('near' as const) } : null;
  const verdict: ResultVerdict | null = res ? VERDICT[res.v] : null;

  let prompt;
  if (res) prompt = <EnglishText as="p" text={task.good} area={area} source={source} testId="repair-right" />;
  else if (step === 'pick')
    prompt = (
      <p className="lx-t-support text-muted" data-testid="fk-sit">
        {task.sit[lang]}
      </p>
    );
  else
    prompt = (
      <p className="lx-t-prompt" lang="en" data-testid="fk-b2-sentence">
        {pre}
        <strong className={step === 'gap1' ? 'text-accent' : ''}>{step === 'gap1' ? '___' : fill(0)}</strong>
        {mid}
        <strong className={step === 'gap2' ? 'text-accent' : ''}>{fill(1)}</strong>
        {post}
      </p>
    );

  return (
    <div data-testid="repair-item" data-id={task.id} data-mode="review" data-form="b2" data-step={step} data-state={res ? res.v : 'open'}>
      <ExerciseShell
        meta={{ ex: 'repair', id: task.id, kind: 'b2' }}
        status={{ area: 'grammar', state: null, kindLabel: t('fxB2Kind'), topic: null, pattern: null, badge: status }}
        task={{ text: step === 'pick' ? t('fxB2Task') : t('fxB2TaskGap', { n: gapIdx + 1 }), purpose: t('fxB2Purpose') }}
        prompt={prompt}
        answer={
          res ? null : (
            <Choices
              key={step}
              options={choiceOptions}
              chosen={chosenIdx}
              correct={step === 'pick' && pickShown ? goodIdx : null}
              revealed={step === 'pick' && pickShown}
              onPick={onPick}
              lang="en"
              label={t('fxB2Group')}
              testId="fk-b2-choices"
            />
          )
        }
        choiceCount={2}
        hint={hint}
        secondary={secondary}
        primary={primary}
        feedback={res && verdict ? { verdict, sub: t('fxB2Sub', { s: fullRight }), comparison: null, explanation: model, depth: explainDepth({ verdict, p: null, learning: true }), menu: {} } : null}
      />
    </div>
  );
}
