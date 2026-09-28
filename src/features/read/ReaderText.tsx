import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { paragraphs, sentenceSplit } from '../../domain/input/textStats';
import { statusCss, statusIndex, textCardKeys, textStatus, type StatusCard, type TextCard } from '../../domain/input/wordStatus';
import { EnglishText } from '../../engine/EnglishText';
import { useHiddenInput } from '../../engine/HiddenInput';
import type { WordTapArea } from '../../engine/wordTap';
import { useT } from '../../i18n';
import { Button, IconButton } from '../../ui/Button';
import { startSession } from '../vocab/session';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { textLevel } from '../../prompts/nb/p4/textLevel';
import { AiRunPanel, isBusy } from '../input/AiRunPanel';

// Lesetext im LingQ-Stil (Neubau N51, N52): jedes Wort antippbar (Wort-Popover mit „+ Wortschatz“,
// Ursprungssatz = der Satz im Text), Wörter aus dem eigenen Wortschatz dezent markiert, darunter
// „Wörter aus diesem Text üben (n)“. Die Markierung kommt als CSS auf die vorhandenen Wort-Knöpfe
// (`data-lookup`), der Text wird dafür nicht neu zerlegt. Absätze tragen `data-para` (Fortsetzen).

type Doc = Readonly<Record<string, unknown>>;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

function cardsOf(vocab: ReadonlyMap<string, Doc> | undefined): { status: StatusCard[]; text: TextCard[] } {
  const status: StatusCard[] = [];
  const text: TextCard[] = [];
  for (const [id, d] of vocab ?? new Map<string, Doc>()) {
    const word = str(d.word);
    if (!word) continue;
    const hidden = d.hidden === true || d.suspended === true;
    const stage = typeof d.stage === 'number' ? d.stage : 0;
    status.push({ word, stage, hidden });
    const origin = d.origin && typeof d.origin === 'object' ? (d.origin as Doc) : null;
    text.push({ key: `vocab/${id}`, word, hidden, originRef: origin ? str(origin.ref) || null : null });
  }
  return { status, text };
}

type Props = {
  text: string;
  title: string;
  /** Herkunft gespeicherter Wörter (`origin.ref`), z. B. `theme:t01` oder `articles/<id>`. */
  sourceRef: string;
  area: WordTapArea;
  /** „Wörter aus diesem Text üben“ anbieten. */
  practice?: boolean;
  className?: string;
  /** Oberster sichtbarer Absatz (Fortsetzen: Leseposition). */
  onPara?: (i: number) => void;
  /** Absatz, zu dem beim ersten Zeichnen gesprungen wird (Fortsetzen). */
  startPara?: number | null;
  /** „Leichter“ / „Näher an C1“ anbieten (N59, nur mit KI). */
  levels?: boolean;
};

export function ReaderText({ text: original, title, sourceRef, area, practice = true, className, onPara, startPara = null, levels = false }: Props) {
  const { t } = useT();
  const ai = useAiAvailable();
  const gen = useAsk(textLevel);
  const [variant, setVariant] = useState<{ dir: 'easier' | 'harder'; text: string } | null>(null);
  const text = variant?.text ?? original;
  const rewrite = async (dir: 'easier' | 'harder') => {
    const out = await gen.run({ text: original, direction: dir });
    if (out?.text) setVariant({ dir, text: out.text });
  };
  const scope = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const vocab = useLive((s) => s.collections.vocab);
  const go = useNav((s) => s.go);
  const api = useHiddenInput();
  const cards = useMemo(() => cardsOf(vocab), [vocab]);
  const index = useMemo(() => statusIndex(cards.status), [cards]);
  const css = useMemo(() => statusCss(scope, textStatus(text, index)), [scope, text, index]);
  const keys = useMemo(() => textCardKeys(text, sourceRef, cards.text), [text, sourceRef, cards]);
  const paras = useMemo(() => paragraphs(text), [text]);
  // Satzmodus (N56, LingQ 5): ein Satz im Blick, ‹ › blättern.
  const [sentMode, setSentMode] = useState(false);
  const sentences = useMemo(() => sentenceSplit(text).map((s) => s.text), [text]);
  const [si, setSi] = useState(0);

  const box = useRef<HTMLDivElement>(null);
  const report = useRef(onPara);
  useEffect(() => {
    report.current = onPara;
  });
  // Leseposition: oberster sichtbarer Absatz (nur melden, nie neu zeichnen).
  useEffect(() => {
    const root = box.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const seen = new Set<number>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const i = Number((e.target as HTMLElement).dataset.para);
        if (e.isIntersecting) seen.add(i);
        else seen.delete(i);
      }
      if (seen.size) report.current?.(Math.min(...seen));
    });
    root.querySelectorAll('[data-para]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [paras, sentMode]);
  // Nach dem Fortsetzen einmal an den gemerkten Absatz springen.
  useEffect(() => {
    if (startPara === null || startPara <= 0) return;
    // Nach dem Einblenden der Übungsebene springen (der Rahmen setzt den Bildlauf beim Öffnen zurück).
    const id = window.setTimeout(() => {
      const el = box.current?.querySelector(`[data-para="${startPara}"]`);
      if (el instanceof HTMLElement) el.scrollIntoView({ block: 'start' });
    }, 350);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    const first = startSession('extra', { only: keys });
    if (first === 'typed') api.focusNow();
    go({ name: 'trainer', round: 'extra' });
  };

  return (
    <div className="flex flex-col gap-4" data-reader={scope} data-testid="reader-text">
      {css && <style>{css}</style>}
      {levels && ai && (
        <div className="flex flex-col gap-2" data-testid="text-level" data-variant={variant?.dir ?? 'original'}>
          <div className="flex flex-wrap gap-2">
            {variant ? (
              <Button variant="ghost" onClick={() => setVariant(null)} data-testid="level-original">
                {t('nbLesenLevelOriginal')}
              </Button>
            ) : (
              !isBusy(gen.phase) && (
                <>
                  <Button variant="ghost" onClick={() => void rewrite('easier')} data-testid="level-easier" data-ai="">
                    {t('nbLesenLevelEasier')}
                  </Button>
                  <Button variant="ghost" onClick={() => void rewrite('harder')} data-testid="level-harder" data-ai="">
                    {t('nbLesenLevelHarder')}
                  </Button>
                </>
              )
            )}
          </div>
          <AiRunPanel phase={gen.phase} error={gen.error} onStop={gen.stop} onRetry={() => void rewrite('easier')} skeleton={false} />
        </div>
      )}
      {sentences.length > 2 && (
        <div className="flex">
          <button type="button" className="text-sm font-medium text-accent-text" aria-pressed={sentMode} onClick={() => setSentMode((v) => !v)} data-testid="sentence-mode">
            {sentMode ? t('nbLesenPageMode') : t('nbLesenSentenceMode')}
          </button>
        </div>
      )}
      {sentMode ? (
        <div lang="en" className="flex max-w-[68ch] flex-col gap-3" data-testid="sentence-view" data-i={si}>
          <p className="lx-tnum text-xs text-muted">{t('nbLesenSentenceOf', { i: si + 1, n: sentences.length })}</p>
          <EnglishText text={sentences[si] ?? ''} area={area} source={sourceRef} title={title} className="min-h-24 text-xl leading-relaxed" />
          <div className="flex gap-2">
            <IconButton icon="arrowLeft" label={t('nbLesenPrev')} disabled={si === 0} onClick={() => setSi((i) => Math.max(0, i - 1))} data-testid="sentence-prev" />
            <IconButton icon="arrowRight" label={t('nbLesenNext')} disabled={si >= sentences.length - 1} onClick={() => setSi((i) => Math.min(sentences.length - 1, i + 1))} data-testid="sentence-next" />
          </div>
        </div>
      ) : (
        <div ref={box} lang="en" className={`flex max-w-[68ch] flex-col gap-4 ${className ?? ''}`}>
          {paras.map((p, i) => (
            <div key={i} data-para={i}>
              <EnglishText text={p} area={area} source={sourceRef} title={title} className="text-[1.0625rem] leading-[1.75]" />
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-subtle" data-testid="reader-legend">
        {t('nbLesenLegend')}
      </p>
      {practice && keys.length > 0 && (
        <div>
          <Button variant="secondary" icon="cards" onClick={start} data-testid="practice-text" data-n={keys.length}>
            {t('nbLesenPractice', { n: keys.length })}
          </Button>
        </div>
      )}
    </div>
  );
}
