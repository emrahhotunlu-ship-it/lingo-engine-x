import { useEffect, useId, useMemo, useRef } from 'react';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { paragraphs } from '../../domain/input/textStats';
import { statusCss, statusIndex, textCardKeys, textStatus, type StatusCard, type TextCard } from '../../domain/input/wordStatus';
import { EnglishText } from '../../engine/EnglishText';
import { useHiddenInput } from '../../engine/HiddenInput';
import type { WordTapArea } from '../../engine/wordTap';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { startSession } from '../vocab/session';

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
};

export function ReaderText({ text, title, sourceRef, area, practice = true, className, onPara, startPara = null }: Props) {
  const { t } = useT();
  const scope = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const vocab = useLive((s) => s.collections.vocab);
  const go = useNav((s) => s.go);
  const api = useHiddenInput();
  const cards = useMemo(() => cardsOf(vocab), [vocab]);
  const index = useMemo(() => statusIndex(cards.status), [cards]);
  const css = useMemo(() => statusCss(scope, textStatus(text, index)), [scope, text, index]);
  const keys = useMemo(() => textCardKeys(text, sourceRef, cards.text), [text, sourceRef, cards]);
  const paras = useMemo(() => paragraphs(text), [text]);

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
  }, [paras]);
  // Nach dem Fortsetzen einmal an den gemerkten Absatz springen.
  useEffect(() => {
    if (startPara === null || startPara <= 0) return;
    const el = box.current?.querySelector(`[data-para="${startPara}"]`);
    if (el instanceof HTMLElement) el.scrollIntoView({ block: 'start' });
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
      <div ref={box} lang="en" className={`flex max-w-[68ch] flex-col gap-4 ${className ?? ''}`}>
        {paras.map((p, i) => (
          <div key={i} data-para={i}>
            <EnglishText text={p} area={area} source={sourceRef} title={title} className="text-[1.0625rem] leading-[1.75]" />
          </div>
        ))}
      </div>
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
