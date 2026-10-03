import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { useClock } from '../app/clock';
import { go, setAskContext } from '../app/route';
import { saveProfile, useCoach } from '../coach/store';
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
import { TYPE_INSTR, topicById, type GrammarTask } from '../coach/grammar';
import { checkTyped } from '../domain/answer/check';
import type { Placement } from '../coach/types';

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

export function PlacementScreen() {
  const { t, lang, num } = useT();
  const today = useClock((s) => s.today);
  const profile = useCoach((s) => s.profile);
  const seed = seedFor(`placement-${today}`);
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
    const grammar = scoreGrammar(gResults, profile?.imported?.grammar ?? {});
    const vl = cefrFromVocab(v.xlex);
    const gl = cefrFromGrammar(grammar);
    const placement: Placement = { at: 0, size: v.size, bands: v.bands, falseAlarm: v.falseAlarm, grammar, level: overallCefr(vl, gl) };
    return { placement, vl, gl };
  }, [phase, answers, gResults, profile]);

  async function finish() {
    if (!result) return;
    setSaving(true);
    await saveProfile({ placement: { ...result.placement, at: Date.now() }, planStart: profile?.planStart ?? today });
    go({ name: 'home' });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6" data-testid="placement">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t('cPlTitle')}</h1>
        <Button variant="ghost" onClick={() => go({ name: 'home' })} data-testid="placement-close">
          {t('cClose')}
        </Button>
      </div>

      {phase === 'intro' && (
        <section className="lx-glass rounded-[var(--radius-card)] p-6">
          <p className="text-base leading-relaxed">{t('cPlIntro', { n: grammarItems.length })}</p>
          <div className="mt-6">
            <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => setPhase('vocab')} data-testid="placement-start">
              {t('cPlStart')}
            </Button>
          </div>
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
          <h2 className="text-lg font-semibold">{t('cPlResultTitle')}</h2>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-accent-text" data-testid="placement-level">
            {result.placement.level}
          </p>
          <ul className="mt-4 space-y-1.5 text-sm">
            <li>{t('cPlVocabSize', { n: num(result.placement.size) })}</li>
            <li className="text-muted">{t('cPlVocabLevel', { level: result.vl })}</li>
            <li className="text-muted">{t('cPlGrammarLevel', { level: result.gl })}</li>
          </ul>
          <TopicLists grammar={result.placement.grammar} lang={lang} />
          {result.placement.falseAlarm >= 0.15 && <p className="mt-4 text-xs text-muted">{t('cPlFalseAlarm', { pct: Math.round(result.placement.falseAlarm * 100) })}</p>}
          <div className="mt-6">
            <Button variant="primary" size="lg" busy={saving} busyLabel={t('cPlSaving')} onClick={() => void finish()} data-testid="placement-done">
              {t('cPlDone')}
            </Button>
          </div>
        </section>
      )}
    </div>
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

function GrammarItem({ task, onDone }: { task: GrammarTask; onDone: (ok: boolean) => void }) {
  const { t, lang } = useT();
  const [value, setValue] = useState('');
  const [verdict, setVerdict] = useState<null | boolean>(null);
  const input = useRef<HTMLInputElement>(null);
  const accepted = [task.answer, ...(task.accepted ?? [])];
  const topic = topicById(task.topic);

  function check(given: string) {
    const r = checkTyped(given, accepted, { lemma: '' });
    setVerdict(r.verdict !== 'wrong');
  }

  return (
    <div className="lx-glass mt-6 rounded-[var(--radius-card)] p-6">
      <p className="text-2xs text-muted">
        {topic ? (lang === 'de' ? topic.name : topic.name_en) : ''} · {TYPE_INSTR[lang][task.type]}
      </p>
      <p className="mt-3 text-lg leading-relaxed" lang="en" data-testid="grammar-prompt">
        {task.prompt}
        {task.hint ? <span className="ml-2 text-muted">{task.hint}</span> : null}
      </p>
      {task.type === 'mc' && task.options ? (
        <div className="mt-5 grid gap-2" data-testid="grammar-options">
          {task.options.map((o) => {
            const isAnswer = o === task.answer;
            const tone = verdict === null ? '' : isAnswer ? 'ring-2 ring-accent' : '';
            return (
              <Button key={o} variant="secondary" className={tone} disabled={verdict !== null} onClick={() => setVerdict(isAnswer)}>
                <span lang="en">{o}</span>
              </Button>
            );
          })}
        </div>
      ) : (
        <form
          className="mt-5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (verdict === null && value.trim()) check(value);
          }}
        >
          <input
            ref={input}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={verdict !== null}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            lang="en"
            aria-label={TYPE_INSTR[lang][task.type]}
            className="min-h-11 flex-1 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-base text-fg outline-none focus:border-accent"
            data-testid="grammar-input"
          />
          {verdict === null && (
            <Button type="submit" variant="primary" disabled={!value.trim()}>
              {t('cCheck')}
            </Button>
          )}
        </form>
      )}
      {verdict !== null && (
        <div className="mt-4 text-sm" data-testid="grammar-feedback">
          <p className={`flex items-center gap-2 font-semibold ${verdict ? 'text-accent-text' : 'text-gold-text'}`}>
            <Icon name={verdict ? 'check' : 'info'} size={16} />
            {verdict ? t('cFbRight') : `${t('cFbWrong')}: `}
            {!verdict && <span lang="en">{task.answer}</span>}
          </p>
          <p className="mt-1.5 text-muted">{lang === 'de' ? task.expl : task.expl_en}</p>
        </div>
      )}
      <div className="mt-5 flex gap-2">
        {verdict === null ? (
          <Button variant="ghost" onClick={() => onDone(false)} data-testid="grammar-skip">
            {t('cPlDontKnow')}
          </Button>
        ) : (
          <Button variant="primary" iconAfter="arrowRight" onClick={() => onDone(verdict)} data-testid="grammar-next">
            {t('cNext')}
          </Button>
        )}
      </div>
    </div>
  );
}
