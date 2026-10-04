import { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n';
import { Button } from '../ui/Button';
import { useClock } from '../app/clock';
import { go, setAskContext } from '../app/route';
import { monthOf, saveCheck, saveProfile, useCoach } from '../coach/store';
import {
  buildGrammarCheck,
  buildVocabTest,
  cefrFromGrammar,
  cefrFromVocab,
  overallCefr,
  scoreGrammar,
  scoreVocab,
  seedFor,
  verifyThis,
  type VocabAnswer,
} from '../coach/placement';
import { topicById, type GrammarTask } from '../coach/grammar';
import { GrammarItem } from './GrammarTask';
import type { Placement } from '../coach/types';
import { TEST_BUILD } from '../app/testBuild';
import { TestSkipButton } from './TestTools';

// Einstufung (docs/neustart.md §6): Wortschatz Ja/Nein mit Kontrollwörtern und Stichproben,
// danach eine Grammatikaufgabe je Thema, am Ende der Startpunkt mit Niveau.

type Phase = 'intro' | 'vocab' | 'grammar' | 'result';

function ProgressLine({ i, n }: { i: number; n: number }) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(i / n) * 100}%` }} />
      </div>
      <span className="text-2xs text-muted lx-tnum">{t('cPlCount', { i: Math.min(i + 1, n), n })}</span>
    </div>
  );
}

export function PlacementScreen({ mode = 'placement' }: { mode?: 'placement' | 'check' }) {
  const { t, lang, num } = useT();
  const today = useClock((s) => s.today);
  const profile = useCoach((s) => s.profile);
  const check = mode === 'check';
  const checks = useCoach((s) => s.checks);
  const seed = seedFor(`${mode}-${check ? monthOf(today) : today}`);
  const vocabItems = useMemo(() => buildVocabTest(seed), [seed]);
  const grammarItems = useMemo(() => buildGrammarCheck(seed), [seed]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [vi, setVi] = useState(0);
  const [answers, setAnswers] = useState<VocabAnswer[]>([]);
  const [verify, setVerify] = useState<VocabAnswer | null>(null);
  const [gi, setGi] = useState(0);
  const [gResults, setGResults] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => setAskContext(''), []);

  const yesCount = answers.filter((a) => a.item.kind === 'real' && a.yes).length;

  function answerVocab(yes: boolean) {
    const item = vocabItems[vi];
    if (!item) return;
    const a: VocabAnswer = { item, yes };
    if (yes && item.kind === 'real' && verifyThis(yesCount + 1)) {
      setVerify(a);
      return;
    }
    pushVocab(a);
  }

  function pushVocab(a: VocabAnswer) {
    const next = [...answers, a];
    setAnswers(next);
    setVerify(null);
    if (vi + 1 >= vocabItems.length) setPhase('grammar');
    else setVi(vi + 1);
  }

  function answerGrammar(task: GrammarTask, ok: boolean) {
    setGResults((r) => ({ ...r, [task.topic]: ok }));
    if (gi + 1 >= grammarItems.length) setPhase('result');
    else setGi(gi + 1);
  }

  const result = useMemo(() => {
    if (phase !== 'result') return null;
    const v = scoreVocab(answers);
    const grammar = scoreGrammar(gResults, check ? {} : (profile?.imported?.grammar ?? {}));
    const vl = cefrFromVocab(v.xlex);
    const gl = cefrFromGrammar(grammar);
    const placement: Placement = { at: 0, size: v.size, bands: v.bands, falseAlarm: v.falseAlarm, grammar, level: overallCefr(vl, gl) };
    return { placement, vl, gl };
  }, [phase, answers, gResults, profile, check]);

  async function finish() {
    if (!result) return;
    setSaving(true);
    if (check) {
      const gOk = Object.values(gResults).filter(Boolean).length;
      await saveCheck(monthOf(today), { at: Date.now(), size: result.placement.size, level: result.placement.level, gOk, gN: grammarItems.length });
      go({ name: 'plan' });
      return;
    }
    await saveProfile({ placement: { ...result.placement, at: Date.now() }, planStart: profile?.planStart ?? today });
    go({ name: 'home' });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 lg:max-w-3xl lg:pt-10" data-testid={check ? 'check' : 'placement'}>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{check ? t('cCkTitle') : t('cPlTitle')}</h1>
        <Button variant="ghost" onClick={() => go({ name: check ? 'plan' : 'home' })} data-testid="placement-close">
          {t('cClose')}
        </Button>
      </div>

      {phase === 'intro' && (
        <section className="lx-glass rounded-[var(--radius-card)] p-6">
          <p className="text-base leading-relaxed">{check ? t('cCkIntro', { n: grammarItems.length }) : t('cPlIntro', { n: grammarItems.length })}</p>
          <div className="mt-6">
            <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => setPhase('vocab')} data-testid="placement-start">
              {t('cPlStart')}
            </Button>
          </div>
          {TEST_BUILD && !check && (
            <div className="mt-3">
              <TestSkipButton />
            </div>
          )}
        </section>
      )}

      {phase === 'vocab' && vocabItems[vi] && (
        <section data-testid="vocab-test">
          <p className="lx-eyebrow mb-2 text-muted">{t('cPlVocabTitle')}</p>
          <ProgressLine i={vi} n={vocabItems.length} />
          <div className="lx-glass mt-6 rounded-[var(--radius-card)] p-8 text-center">
            <p className="text-3xl font-semibold tracking-tight" lang="en" data-testid="vocab-word">
              {vocabItems[vi].w}
            </p>
            {!verify ? (
              <>
                <p className="mt-3 text-sm text-muted">{t('cPlVocabQ')}</p>
                <div className="mt-8 grid grid-cols-2 gap-3">
                  <Button variant="secondary" size="lg" onClick={() => answerVocab(false)} data-testid="vocab-no">
                    {t('cPlNo')}
                  </Button>
                  <Button variant="primary" size="lg" onClick={() => answerVocab(true)} data-testid="vocab-yes">
                    {t('cPlYes')}
                  </Button>
                </div>
              </>
            ) : (
              verify.item.kind === 'real' && (
                <>
                  <p className="mt-3 text-sm text-muted">{t('cPlVerifyQ', { w: verify.item.w })}</p>
                  <div className="mt-6 grid gap-2" data-testid="vocab-verify">
                    {verify.item.options.map((o) => (
                      <Button key={o} variant="secondary" onClick={() => pushVocab({ ...verify, verified: verify.item.kind === 'real' && o === verify.item.de })}>
                        {o}
                      </Button>
                    ))}
                    <Button variant="ghost" onClick={() => pushVocab({ ...verify, verified: false })}>
                      {t('cPlVerifyNone')}
                    </Button>
                  </div>
                </>
              )
            )}
          </div>
        </section>
      )}

      {phase === 'grammar' && grammarItems[gi] && (
        <section data-testid="grammar-test">
          <p className="lx-eyebrow mb-2 text-muted">{t('cPlGrammarTitle')}</p>
          <ProgressLine i={gi} n={grammarItems.length} />
          <GrammarItem key={gi} task={grammarItems[gi]} onDone={(ok) => answerGrammar(grammarItems[gi]!, ok)} />
        </section>
      )}

      {phase === 'result' && result && (
        <section className="lx-glass rounded-[var(--radius-card)] p-6" data-testid="placement-result">
          <h2 className="text-lg font-semibold">{check ? t('cCkResultTitle') : t('cPlResultTitle')}</h2>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-accent-text" data-testid="placement-level">
            {result.placement.level}
          </p>
          <ul className="mt-4 space-y-1.5 text-sm">
            <li>{t('cPlVocabSize', { n: num(result.placement.size) })}</li>
            <li className="text-muted">{t('cPlVocabLevel', { level: result.vl })}</li>
            <li className="text-muted">{t('cPlGrammarLevel', { level: result.gl })}</li>
          </ul>
          {check && <CheckDelta size={result.placement.size} prev={previousSize(checks, profile?.placement?.size, monthOf(today))} />}
          <TopicLists grammar={result.placement.grammar} lang={lang} />
          {result.placement.falseAlarm >= 0.15 && <p className="mt-4 text-xs text-muted">{t('cPlFalseAlarm', { pct: Math.round(result.placement.falseAlarm * 100) })}</p>}
          <div className="mt-6">
            <Button variant="primary" size="lg" busy={saving} busyLabel={t('cPlSaving')} onClick={() => void finish()} data-testid="placement-done">
              {check ? t('cCkDone') : t('cPlDone')}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

/** Größe der letzten Messung vor diesem Monat (Check oder Einstufung). */
function previousSize(checks: Readonly<Record<string, { size: number }>>, start: number | undefined, month: string): number | null {
  const prev = Object.keys(checks).filter((k) => k < month).sort().pop();
  return prev ? checks[prev]!.size : (start ?? null);
}

function CheckDelta({ size, prev }: { size: number; prev: number | null }) {
  const { t, num } = useT();
  if (prev === null) return null;
  const diff = size - prev;
  return (
    <p className="mt-3 text-sm" data-testid="check-delta">
      {t(diff >= 0 ? 'cCkUp' : 'cCkDown', { n: num(Math.abs(diff)) })}
    </p>
  );
}

function TopicLists({ grammar, lang }: { grammar: Readonly<Record<string, number>>; lang: 'de' | 'en' }) {
  const { t } = useT();
  const name = (id: string) => {
    const tp = topicById(id);
    return tp ? (lang === 'de' ? tp.name : tp.name_en) : id;
  };
  const strong = Object.entries(grammar).filter(([, v]) => v >= 0.8).map(([id]) => name(id));
  const weak = Object.entries(grammar)
    .filter(([, v]) => v < 0.6)
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => name(id));
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      {strong.length > 0 && (
        <div>
          <h3 className="lx-eyebrow text-muted">{t('cPlStrong')}</h3>
          <p className="mt-1 text-sm">{strong.join(' · ')}</p>
        </div>
      )}
      {weak.length > 0 && (
        <div>
          <h3 className="lx-eyebrow text-muted">{t('cPlWeak')}</h3>
          <p className="mt-1 text-sm">{weak.join(' · ')}</p>
        </div>
      )}
    </div>
  );
}
