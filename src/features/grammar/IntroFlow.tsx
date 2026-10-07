import { useState, type ReactNode } from 'react';
import { patternsOf } from '../../domain/grammar/patterns';
import type { Pattern, TopicPatterns } from '../../domain/grammar/patternTypes';
import { examplesFor, ruleOf } from '../../domain/grammar/rules';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';
import { useSplitLayout } from '../../platform/input';
import { ActionBar, PrimaryAction } from '../../ui/ActionBar';
import { Eyebrow } from '../../ui/Eyebrow';
import { useSwipeLeft } from '../../engine/swipe';
import { topicName } from './topicUi';

// Einführung eines neuen Musters (Lernplattform 2.0 §5.3, Schritt 2): kurze Karten vor den Aufgaben. Handy: je Muster drei wischbare
// Karten mit höchstens 35 Wörtern – ① Alltag und Verständnisfrage (CCQ) zum Antippen, ② Formel und „So entscheidest du“, ③ typischer
// Fehler mit deutscher Ursache. Laptop: eine zweispaltige Karte je Muster. Die Schrittleiste ①–⑤ entfällt. Schreibt nichts: Eingeführt ist
// ein Muster ab der ersten Antwort (`pats[id].i`). Themen ohne Musterdatei zeigen wie bisher eine einzelne Regelkarte.

type CardKind = 'context' | 'formula' | 'trap';
type Card = { pat: Pattern; kind: CardKind; first: boolean };

function cardsFor(tp: TopicPatterns, ids: readonly string[], split: boolean): Card[] {
  const pats = ids.map((id) => tp.patterns.find((p) => p.id === id)).filter((p): p is Pattern => !!p);
  const out: Card[] = [];
  pats.forEach((pat, i) => {
    if (split) out.push({ pat, kind: 'context', first: i === 0 });
    else for (const kind of ['context', 'formula', 'trap'] as const) out.push({ pat, kind, first: i === 0 });
  });
  return out;
}

export function IntroFlow({ topic, pats, fresh, onGo, kurzMiss = false }: { topic: string; pats: readonly string[]; fresh: boolean; onGo: () => void; kurzMiss?: boolean }) {
  const { t, lang } = useT();
  const split = useSplitLayout();
  const tp = patternsOf(topic);
  const [idx, setIdx] = useState(0);
  const cards = tp && pats.length ? cardsFor(tp, pats, split) : [];
  const total = cards.length;
  const last = idx >= total - 1;
  // Wischen nach links = weiter (nur Finger, Knopf und Tastatur bleiben der Hauptweg).
  useSwipeLeft(() => (last ? undefined : setIdx((i) => i + 1)), !split && !last && total > 0);
  if (!tp || !cards.length) return <LegacyCard topic={topic} onGo={onGo} />;
  const card = cards[Math.min(idx, total - 1)] as Card;
  const step = Math.max(1, tp.introPlan.findIndex((s) => s.length === pats.length && s.every((x) => pats.includes(x))) + 1);
  const go = () => (last ? onGo() : setIdx((i) => i + 1));
  const pick = (b: { de: string; en: string }): string => (lang === 'de' ? b.de : b.en);
  const eyebrow = t(fresh ? 'gxIntroEyebrowNew' : 'gxIntroEyebrowNext', { n: step, total: tp.introPlan.length });

  return (
    <article className="lx-glass lx-exercise flex flex-col gap-4" data-testid="intro-flow" data-topic={topic} data-card={idx}>
      <header className="flex flex-col gap-2">
        <Eyebrow tone="accent">{eyebrow}</Eyebrow>
        <h2 className="lx-t-task" data-testid="task">
          {topicName(topic, lang)}
        </h2>
        <p className="lx-t-support text-muted">{t('gxIntroTask')}</p>
        {kurzMiss && (
          <p className="lx-t-support" data-testid="intro-kurz-miss">
            {t('pxPlSkipMiss')}
          </p>
        )}
      </header>
      {split ? <SplitCard pat={card.pat} tp={tp} first={card.first} pick={pick} /> : <OneCard card={card} tp={tp} pick={pick} />}
      <div className="flex items-center justify-between gap-3">
        <span className="lx-dots" role="img" aria-label={t('gxIntroCardOf', { n: idx + 1, total })}>
          {cards.map((_, i) => (
            <span key={i} className="lx-dot" data-on={i === idx || undefined} />
          ))}
        </span>
        <span className="lx-t-meta text-muted">{t('gxIntroCardOf', { n: idx + 1, total })}</span>
      </div>
      <ActionBar stateKey={`intro-${idx}`}>
        <PrimaryAction iconAfter="arrowRight" onClick={go} testId={last ? 'mini-go' : 'intro-next'}>
          {t(last ? 'gxIntroGo' : 'gxIntroNext')}
        </PrimaryAction>
      </ActionBar>
    </article>
  );
}

const src = (topic: string) => ({ area: 'trainer' as const, source: `grammar/${topic}` });

/** Verständnisfrage (CCQ): die Antwort bleibt verdeckt, bis Emrah „Ja“ oder „Nein“ antippt. */
function Ccq({ q, s, a, topic }: { q: { de: string; en: string }; s: string; a: boolean; topic: string }) {
  const { t, lang } = useT();
  const [pick, setPick] = useState<boolean | null>(null);
  return (
    <div className="lx-inset flex flex-col gap-2" data-testid="intro-ccq">
      <EnglishText as="p" className="lx-t-support" text={s} {...src(topic)} />
      <p className="lx-t-support font-semibold" lang={lang}>
        {lang === 'de' ? q.de : q.en}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {([true, false] as const).map((v) => (
          <button
            key={String(v)}
            type="button"
            className="lx-choice min-h-11 min-w-20 justify-center"
            data-state={pick === null ? 'idle' : v === a ? 'correct' : v === pick ? 'wrong' : 'dim'}
            disabled={pick !== null}
            onClick={() => setPick(v)}
            data-testid="intro-ccq-answer"
          >
            {t(v ? 'gxIntroYes' : 'gxIntroNo')}
          </button>
        ))}
        {pick !== null && (
          <span className="lx-t-support" role="status" data-testid="intro-ccq-result">
            {pick === a ? t('gxIntroRight') : t('gxIntroWrong')}
          </span>
        )}
      </div>
    </div>
  );
}

function ContextBlock({ pat, tp, pick }: { pat: Pattern; tp: TopicPatterns; pick: (b: { de: string; en: string }) => string }) {
  const { t, lang } = useT();
  const ex = pat.ex.find((e) => e.ctx === 'mail' || e.ctx === 'meeting') ?? pat.ex[0];
  return (
    <div className="flex flex-col gap-3" data-testid="intro-context">
      <p className="lx-t-meta text-muted">{t('gxIntroContext')}</p>
      <p className="lx-t-prompt">
        <span className="font-semibold">{pick(pat.name)}</span>
      </p>
      {ex && (
        <div className="flex flex-col gap-0.5">
          <EnglishText as="p" className="lx-t-prompt" text={ex.en} {...src(tp.topic)} highlight={markIn(ex.en, pat.signals)} />
          {ex.de && (
            <span className="lx-t-meta text-muted" lang="de">
              {ex.de}
            </span>
          )}
        </div>
      )}
      {pat.ccq.slice(0, 2).map((c) => (
        <Ccq key={c.s + c.q.de} q={c.q} s={c.s} a={c.a} topic={tp.topic} />
      ))}
      <span lang={lang} className="sr-only">
        {pick(pat.use)}
      </span>
    </div>
  );
}

const markIn = (text: string, signals: readonly string[]): [number, number] | null => {
  const low = text.toLowerCase();
  for (const s of signals) {
    const i = low.indexOf(s.toLowerCase());
    if (i >= 0) return [i, i + s.length];
  }
  return null;
};

function FormulaBlock({ pat, tp, first, pick }: { pat: Pattern; tp: TopicPatterns; first: boolean; pick: (b: { de: string; en: string }) => string }) {
  const { t, lang } = useT();
  const decide = lang === 'de' ? tp.decide.de : tp.decide.en;
  return (
    <div className="flex flex-col gap-3" data-testid="intro-formula">
      <p className="lx-t-meta text-muted">{t('gxIntroFormula')}</p>
      <p>
        <span className="rounded-[var(--radius-inline)] bg-hint-soft px-2 py-1 lx-t-prompt text-hint-text" lang="en" data-testid="pattern-formula">
          {pick(pat.form)}
        </span>
      </p>
      <p className="lx-t-support" lang={lang}>
        {pick(pat.use)}
      </p>
      {first && decide.length > 0 && (
        <div className="flex flex-col gap-1" data-testid="intro-decide">
          <p className="lx-t-meta text-muted">{t('gxIntroDecide')}</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 lx-t-support" lang={lang}>
            {decide.slice(0, 2).map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TrapBlock({ pat, tp, pick }: { pat: Pattern; tp: TopicPatterns; pick: (b: { de: string; en: string }) => string }) {
  const { t, lang } = useT();
  return (
    <div className="flex flex-col gap-3" data-testid="intro-trap">
      <p className="lx-t-meta text-muted">{t('gxIntroTrap')}</p>
      <p className="lx-t-prompt flex flex-col gap-1" lang="en">
        <span className="lx-diff-off">✕ {pat.trap.bad}</span>
        <EnglishText as="span" className="font-semibold text-ok-text" text={`✓ ${pat.trap.good}`} {...src(tp.topic)} />
      </p>
      <p className="lx-t-support text-muted" lang={lang}>
        {pick(pat.trap.cause)}
      </p>
    </div>
  );
}

function OneCard({ card, tp, pick }: { card: Card; tp: TopicPatterns; pick: (b: { de: string; en: string }) => string }) {
  const body: ReactNode = card.kind === 'context' ? <ContextBlock pat={card.pat} tp={tp} pick={pick} /> : card.kind === 'formula' ? <FormulaBlock pat={card.pat} tp={tp} first={card.first} pick={pick} /> : <TrapBlock pat={card.pat} tp={tp} pick={pick} />;
  return (
    <section className="lx-inset flex flex-col gap-3" data-testid="intro-card" data-kind={card.kind}>
      {body}
    </section>
  );
}

function SplitCard({ pat, tp, first, pick }: { pat: Pattern; tp: TopicPatterns; first: boolean; pick: (b: { de: string; en: string }) => string }) {
  return (
    <section className="lx-inset grid grid-cols-2 gap-6" data-testid="intro-card" data-kind="split">
      <div className="flex flex-col gap-4">
        <ContextBlock pat={pat} tp={tp} pick={pick} />
        <FormulaBlock pat={pat} tp={tp} first={first} pick={pick} />
      </div>
      <TrapBlock pat={pat} tp={tp} pick={pick} />
    </section>
  );
}

/** Thema ohne Musterdatei: eine Regelkarte wie bisher (Regel, Kontrast, Beispiele, Falle). */
function LegacyCard({ topic, onGo }: { topic: string; onGo: () => void }) {
  const { t, lang } = useT();
  const rule = ruleOf(topic, lang);
  const trap = rule?.traps[0] ?? null;
  const examples = examplesFor(topic, { max: 3 });
  const why = trap?.why || rule?.why || '';
  return (
    <article className="lx-glass lx-exercise flex flex-col gap-4" data-testid="intro-flow" data-topic={topic} data-legacy="">
      <header className="flex flex-col gap-2">
        <Eyebrow tone="accent">{t('nbLernenMiniEyebrow')}</Eyebrow>
        <h2 className="lx-t-task" data-testid="task">
          {topicName(topic, lang)}
        </h2>
        <p className="lx-t-support text-muted">{t('gxIntroTask')}</p>
      </header>
      <section className="lx-inset flex flex-col gap-3" data-testid="intro-card">
        {rule?.core && (
          <p className="lx-t-prompt" lang={lang}>
            {rule.core}
          </p>
        )}
        {rule?.contrast && (
          <p className="lx-t-support text-muted" lang={lang}>
            {rule.contrast}
          </p>
        )}
        {examples.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {examples.map((ex) => (
              <li key={ex}>
                <EnglishText as="span" className="lx-t-support" text={ex} {...src(topic)} />
              </li>
            ))}
          </ul>
        )}
        {trap && (
          <p className="lx-t-support flex flex-col gap-0.5" data-testid="mini-trap">
            <span className="lx-diff-off" lang="en">
              ✕ {trap.bad}
            </span>
            <EnglishText as="span" className="font-semibold" text={`✓ ${trap.good}`} {...src(topic)} />
            {why && (
              <span className="text-muted" lang={lang} data-testid="mini-why">
                {why}
              </span>
            )}
          </p>
        )}
      </section>
      <ActionBar stateKey="intro-legacy">
        <PrimaryAction iconAfter="arrowRight" onClick={onGo} testId="mini-go">
          {t('gxIntroGo')}
        </PrimaryAction>
      </ActionBar>
    </article>
  );
}
