import { useMemo } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useClock } from '../../app/clock';
import { useDocWatch } from '../../data/watch';
import { patternById } from '../../domain/grammar/patterns';
import { newMappedErrors, parseContrast, type Pair } from '../../domain/tutor/confusion';
import { diagState, doneOf, lastDone, readDiag, weekOf, type DiagEntry } from '../../domain/tutor/diag';
import { useT } from '../../i18n';
import { AiMark } from '../../ui/AiMark';
import { AiRunPanel } from '../../ui/AiRunPanel';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Eyebrow } from '../../ui/Eyebrow';
import { Skeleton } from '../../ui/Skeleton';
import { ContrastButton, PatternPracticeButton } from './ContrastRound';
import { PATTERNS_PATH, reportFinding, runDiagnose, stopDiagnose, useConfusion, useDiagRun } from './diagnoseStore';

// Fortschritt › Grammatik: „Häufigste Verwechslungen · 28 Tage“ (Lernplattform 3.0 P49, KI-Tutor T5). Die Karte mit den Paaren ist deterministisch
// und ohne Claude immer da (bis zu 3 Paare, Zahl, vier Wochenbalken, „Kontrast-Runde“). Darüber steht, nur mit nutzbarem `sample`, der Block
// „Diagnose von Claude“ (einmal je ISO-Woche, geräteübergreifend). Ohne `sample` fehlt nur dieser Block.

function Bars({ weeks, label }: { weeks: Pair['weeks']; label: string }) {
  const max = Math.max(1, ...weeks);
  return (
    <span role="img" aria-label={label} className="flex h-6 items-end gap-1" data-testid="dx-bars">
      {weeks.map((n, k) => (
        <span key={k} className={`w-2.5 rounded-sm ${k === 3 ? 'bg-accent' : 'bg-track'}`} style={{ height: `${Math.max(12, Math.round((n / max) * 100))}%` }} data-n={n} />
      ))}
    </span>
  );
}

function PairRow({ pair, nameOf }: { pair: Pair; nameOf: (id: string) => string }) {
  const { t, num } = useT();
  const a = nameOf(pair.a);
  const b = nameOf(pair.b);
  return (
    <li className="flex flex-col gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0" data-testid="dx-pair" data-pair={`${pair.a}|${pair.b}`} data-confirmed={pair.confirmed ? '1' : '0'} data-n={pair.n}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="m-0 flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium" aria-label={t('ttDxPairAria', { a, b, n: pair.n })}>
          <span className="rounded-full bg-surface-strong px-2.5 py-1">{a}</span>
          <span aria-hidden="true" className="text-subtle">
            ↔
          </span>
          <span className="rounded-full bg-surface-strong px-2.5 py-1">{b}</span>
        </p>
        <span className="flex items-center gap-3">
          <span className="lx-tnum text-base font-semibold" data-testid="dx-count">
            {t('ttDxCount', { n: num(pair.n) })}
          </span>
          <Bars weeks={pair.weeks} label={t('ttDxBars', { w1: pair.weeks[0], w2: pair.weeks[1], w3: pair.weeks[2], w4: pair.weeks[3] })} />
        </span>
      </div>
      <p className="m-0 text-xs text-subtle">{pair.confirmed ? t('ttDxConfirmed') : t('ttDxDeclared', { n: pair.n })}</p>
      <div>
        <ContrastButton a={pair.a} b={pair.b} nameA={a} nameB={b} />
      </div>
    </li>
  );
}

function ClaudeResult({ entry, nameOf }: { entry: DiagEntry; nameOf: (id: string) => string }) {
  const { t } = useT();
  const out = entry.out;
  if (!out) return null;
  // Keine Befunde: ehrlich sagen, dass die Evidenz noch dünn ist (die Schwelle wird nie gesenkt).
  if (out.findings.length === 0) {
    return (
      <div className="flex flex-col gap-2" data-testid="dx-none" data-week={entry.w}>
        <Eyebrow as="h3">{t('ttDxClaudeTitle')}</Eyebrow>
        <p className="m-0 text-base font-medium" data-testid="dx-headline">
          {out.headline}
        </p>
        <p className="m-0 text-sm text-muted">{t('ttDxNone')}</p>
        {out.next && (
          <p className="m-0 text-sm" data-testid="dx-next">
            <span className="text-muted">{t('ttDxNext')}: </span>
            {out.next}
          </p>
        )}
        <AiMark variant="diag" tpl="diagnose@1" />
      </div>
    );
  }
  const shown = out.findings.map((f, i) => ({ f, i })).filter(({ i }) => !entry.bad.includes(i));
  if (!shown.length) {
    return (
      <p className="m-0 text-sm text-muted" data-testid="dx-gone">
        {t('ttDxGone')}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3" data-testid="dx-claude" data-week={entry.w}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Eyebrow as="h3">{t('ttDxClaudeTitle')}</Eyebrow>
        <span className="text-xs text-subtle">{t('ttDxWeek', { w: Number(entry.w.slice(6)) })}</span>
      </div>
      <p className="m-0 text-base font-medium" data-testid="dx-headline">
        {out.headline}
      </p>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {shown.map(({ f, i }) => {
          const c = parseContrast(f.action);
          const pat = f.action.startsWith('pattern:') ? f.action.slice(8) : '';
          return (
            <li key={i} className="flex flex-col gap-1.5 rounded-[var(--radius-control)] bg-surface p-3" data-testid="dx-finding" data-action={f.action}>
              <p className="m-0 text-sm font-semibold">{f.title}</p>
              <p className="m-0 text-sm text-muted">{f.why}</p>
              <p className="m-0 text-sm">
                <span className="text-muted">{t('ttDxRule')}: </span>
                {f.rule}
              </p>
              <div className="pt-1">
                {c && patternById(c.a) && patternById(c.b) ? <ContrastButton a={c.a} b={c.b} nameA={nameOf(c.a)} nameB={nameOf(c.b)} testId="dx-finding-contrast" /> : null}
                {pat && patternById(pat) ? <PatternPracticeButton pat={pat} name={nameOf(pat)} testId="dx-finding-practice" /> : null}
              </div>
            </li>
          );
        })}
      </ul>
      {out.better && (
        <p className="m-0 text-sm" data-testid="dx-better">
          <span className="text-subtle">{t('ttDxBetter')}: </span>
          {out.better.text}
        </p>
      )}
      {out.next && (
        <p className="m-0 text-sm" data-testid="dx-next">
          <span className="text-subtle">{t('ttDxNext')}: </span>
          {out.next}
        </p>
      )}
      <AiMark
        variant="diag"
        tpl="diagnose@1"
        id={entry.w}
        onReport={() => {
          for (const { i } of shown) void reportFinding(entry.w, i);
        }}
      />
    </div>
  );
}

export function DiagnoseCard() {
  const { t, lang } = useT();
  const today = useClock((s) => s.today);
  const now = useClock((s) => s.now);
  const ai = useAiAvailable();
  const { status, confusion, sources } = useConfusion(true);
  const watch = useDocWatch(PATTERNS_PATH);
  const run = useDiagRun();
  const entries = useMemo(() => readDiag(watch.data), [watch.data]);
  const nameOf = (id: string): string => patternById(id)?.name[lang] ?? id;
  const w = weekOf(today);
  const done = doneOf(entries, w);
  const last = lastDone(entries);
  const state = useMemo(() => diagState(entries, today, now, sources ? newMappedErrors(sources, today, last?.t ?? 0) : 0), [entries, today, now, sources, last?.t]);
  const working = run.phase !== 'idle' && run.phase !== 'error';
  const aiPhase = run.phase === 'queued' || run.phase === 'thinking' || run.phase === 'streaming' || run.phase === 'slow' ? run.phase : 'thinking';
  const ask = (): void => void runDiagnose({ trigger: 'manual' });

  return (
    <Card channel="grammar" className="flex flex-col gap-4" aria-labelledby="dx-title" data-testid="dx-card" data-state={status}>
      <h2 id="dx-title" className="m-0 text-lg font-semibold">
        {t('ttDxTitle')}
      </h2>

      {ai && watch.status === 'ready' && (
        <div className="flex flex-col gap-3" data-testid="dx-claude-area">
          {done ? (
            <>
              <ClaudeResult entry={done} nameOf={nameOf} />
              <p className="m-0 text-xs text-subtle">{t('ttDxDoneNote')}</p>
            </>
          ) : working ? (
            <AiRunPanel phase={aiPhase} error={null} onStop={stopDiagnose} />
          ) : run.phase === 'error' && run.error ? (
            <AiRunPanel phase="idle" error={run.error} onRetry={ask} />
          ) : state.kind === 'pending' ? (
            <p className="m-0 text-sm text-muted" role="status" data-testid="dx-pending">
              {t('ttDxPending')}
            </p>
          ) : state.kind === 'due' ? (
            <div className="flex flex-col gap-2" data-testid="dx-ask-area">
              <p className="m-0 text-sm text-muted">{t('ttDxAskSub')}</p>
              <div>
                <Button variant="primary" icon="sparkle" onClick={ask} data-ai="" data-testid="dx-ask">
                  {t('ttDxAsk')}
                </Button>
              </div>
            </div>
          ) : state.kind === 'few' ? (
            <p className="m-0 text-sm text-muted" data-testid="dx-few" data-have={state.have} data-need={state.need}>
              {t('ttDxFew', { need: state.need, have: state.have })}
            </p>
          ) : null}
        </div>
      )}

      {status === 'loading' ? (
        <div className="flex flex-col gap-2" role="status" aria-label={t('ttDxLoading')} data-testid="dx-loading">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </div>
      ) : status === 'error' ? (
        <p className="m-0 text-sm text-muted" role="status" data-testid="dx-error">
          {t('ttDxError')}
        </p>
      ) : confusion && confusion.pairs.length > 0 ? (
        <>
          <p className="m-0 text-sm text-muted">{t('ttDxLead')}</p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label={t('ttDxPairs')} data-testid="dx-pairs">
            {confusion.pairs.map((p) => (
              <PairRow key={`${p.a}|${p.b}`} pair={p} nameOf={nameOf} />
            ))}
          </ul>
        </>
      ) : (
        <p className="m-0 text-sm text-muted" data-testid="dx-empty">
          {t('ttDxEmpty')}
        </p>
      )}
    </Card>
  );
}
