import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import { Button } from '../ui/Button';
import { ExerciseBar } from '../ui/ExerciseBar';
import { useClock } from '../app/clock';
import { go, setAskContext } from '../app/route';
import { emptyDay, saveDay, useCoach } from '../coach/store';
import { distractors, viewOf, type CardView } from '../coach/cardView';
import { hash32, mulberry32, shuffle } from '../domain/random';
import { StepHead } from './Exercise';

// Blitzrunde (docs/neustart.md §5, Säule Flüssigkeit): 60 Sekunden lang sichere Wörter so schnell wie
// möglich erkennen. Ändert keine Wiederholungsplanung, merkt sich nur den Tagesbestwert.

const SECONDS = 60;

type Q = { view: CardView; options: string[]; answer: string };

function questions(day: string): Q[] {
  const cards = useCoach.getState().cards;
  const rng = mulberry32(hash32(`blitz-${day}-${cards.size}`));
  const ids = shuffle(
    [...cards].filter(([, c]) => c.lv >= 2 || c.known === 1).map(([id]) => id),
    rng,
  ).slice(0, 80);
  const out: Q[] = [];
  for (const id of ids) {
    const view = viewOf(id, cards.get(id));
    if (!view?.de) continue;
    const answer = view.de.split(', ')[0] ?? view.de;
    const wrong = distractors(view);
    if (wrong.length < 3) continue;
    out.push({ view, answer, options: shuffle([answer, ...wrong], rng) });
  }
  return out;
}

export function BlitzScreen() {
  const { t } = useT();
  const today = useClock((s) => s.today);
  const [qs] = useState(() => questions(today));
  const [phase, setPhase] = useState<'ready' | 'run' | 'done'>('ready');
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(SECONDS);
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null);
  const scoreRef = useRef(0);
  const best = useCoach((s) => s.days[today]?.bz ?? 0);
  useEffect(() => setAskContext(''), []);

  useEffect(() => {
    if (phase !== 'run') return;
    const started = Date.now();
    const id = window.setInterval(() => {
      const rest = Math.max(0, SECONDS - Math.floor((Date.now() - started) / 1000));
      setLeft(rest);
      if (rest === 0) {
        window.clearInterval(id);
        setPhase('done');
        const cur = useCoach.getState().days[today] ?? emptyDay();
        if (scoreRef.current > (cur.bz ?? 0)) void saveDay(today, { ...cur, bz: scoreRef.current });
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, today]);

  const q = qs[i % Math.max(1, qs.length)];
  const answer = (o: string) => {
    if (!q || phase !== 'run') return;
    const ok = o === q.answer;
    if (ok) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
    }
    setFlash(ok ? 'ok' : 'bad');
    window.setTimeout(() => setFlash(null), 180);
    setI((n) => n + 1);
  };

  const ring = useMemo(() => (flash === 'ok' ? 'ring-2 ring-accent' : flash === 'bad' ? 'ring-2 ring-danger-text/60' : ''), [flash]);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3 lg:max-w-3xl lg:pt-8" data-testid="blitz">
      <ExerciseBar onClose={() => go({ name: 'home' })} closeLabel={t('cSessQuit')} closeTestId="blitz-quit" progress={phase === 'run' ? { n: SECONDS - left, total: SECONDS } : null} progressLabel={t('cBlitzLeft', { n: left })} />
      <div className={`lx-glass mt-3 rounded-[var(--radius-card)] p-5 transition-shadow sm:p-7 ${ring}`}>
        <StepHead kind="choose" lv={null} />
        {phase === 'ready' && (
          <div>
            <h1 className="text-xl font-semibold">{t('cBlitzTitle')}</h1>
            <p className="mt-2 text-sm text-muted">{qs.length >= 10 ? t('cBlitzWhy') : t('cBlitzFew')}</p>
            {best > 0 && <p className="mt-2 text-sm">{t('cBlitzBest', { n: best })}</p>}
            {qs.length >= 10 && (
              <div className="mt-6">
                <Button variant="primary" size="lg" onClick={() => setPhase('run')} data-testid="blitz-go">
                  {t('cBlitzGo')}
                </Button>
              </div>
            )}
          </div>
        )}
        {phase === 'run' && q && (
          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-3xl font-semibold tracking-tight" lang="en" data-testid="blitz-word">
                {q.view.word}
              </p>
              <span className="lx-tnum text-sm text-muted">{left} s</span>
            </div>
            <div className="mt-6 grid gap-2 sm:grid-cols-2" data-testid="blitz-options">
              {q.options.map((o) => (
                <Button key={`${i}-${o}`} variant="secondary" className="justify-start text-left" onClick={() => answer(o)}>
                  {o}
                </Button>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted lx-tnum">{score}</p>
          </div>
        )}
        {phase === 'done' && (
          <div data-testid="blitz-done">
            <h1 className="text-xl font-semibold">{t('cBlitzScore', { n: score })}</h1>
            <p className="mt-2 text-sm text-muted">{t('cBlitzBest', { n: Math.max(best, score) })}</p>
            <div className="mt-6">
              <Button variant="primary" onClick={() => go({ name: 'home' })} data-testid="to-home">
                {t('cToHome')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
