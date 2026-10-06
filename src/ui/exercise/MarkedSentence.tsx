import { Fragment, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { tokenize } from '../../domain/text/tokenize';
import type { Token } from '../../domain/text/types';
import { EnglishText } from '../../engine/EnglishText';
import { openLookup, type WordTapArea, type WordTapRequest } from '../../engine/wordTap';

// Übungssatz mit hervorgehobenen Signalwörtern (§4.3). `EnglishText` kennt nur EINE Hervorhebung; hier können
// es mehrere (auch mehrwortige) sein. Jedes Wort bleibt ein antippbarer `button.lx-word`; ohne Signalwörter
// übernimmt `EnglishText` unverändert.

type Props = {
  text: string;
  mark: readonly string[];
  lang: 'en';
  area?: WordTapArea;
  source?: string | null;
  className?: string;
  testId?: string;
};

type Span = readonly [number, number];

const isWordChar = (c: string | undefined): boolean => !!c && /[\p{L}\p{N}']/u.test(c);

/** Stellen im Satz, an denen ein Signalwort (ganze Wörter, Groß-/Kleinschreibung egal) steht. */
export function markSpans(text: string, mark: readonly string[]): Span[] {
  const hay = text.toLowerCase();
  const spans: Span[] = [];
  for (const raw of mark) {
    const m = raw.trim().toLowerCase();
    if (!m) continue;
    let from = 0;
    for (;;) {
      const i = hay.indexOf(m, from);
      if (i < 0) break;
      const j = i + m.length;
      if (!isWordChar(hay[i - 1]) && !isWordChar(hay[j])) spans.push([i, j]);
      from = i + 1;
    }
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged: Span[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) merged[merged.length - 1] = [last[0], Math.max(last[1], s[1])];
    else merged.push(s);
  }
  return merged;
}

export function MarkedSentence({ text, mark, area = 'trainer', source = null, className, testId }: Props) {
  const spans = useMemo(() => markSpans(text, mark), [text, mark]);
  const tokens = useMemo(() => tokenize(text), [text]);
  const root = useRef<HTMLParagraphElement>(null);
  if (!spans.length) return <EnglishText as="p" text={text} area={area} source={source} {...(className ? { className } : {})} {...(testId ? { testId } : {})} />;

  const spanOf = (t: Token): number => spans.findIndex((s) => t.start >= s[0] && t.end <= s[1]);
  const onKeyDown = (e: KeyboardEvent<HTMLElement>): void => {
    const el = e.target as HTMLElement;
    if (!el.classList.contains('lx-word') || !root.current) return;
    const all = Array.from(root.current.querySelectorAll<HTMLButtonElement>('button.lx-word'));
    const i = all.indexOf(el as HTMLButtonElement);
    const next = e.key === 'ArrowRight' ? Math.min(all.length - 1, i + 1) : e.key === 'ArrowLeft' ? Math.max(0, i - 1) : -1;
    if (next < 0) return;
    e.preventDefault();
    all.forEach((b, k) => (b.tabIndex = k === next ? 0 : -1));
    all[next]?.focus();
  };

  let first = true;
  const node = (t: Token, index: number): ReactNode => {
    if (t.kind !== 'word') return <span key={t.start}>{t.text}</span>;
    const tab = first ? 0 : -1;
    first = false;
    return (
      <button
        key={t.start}
        type="button"
        className="lx-word"
        data-word={t.text}
        data-lookup={t.text.toLowerCase()}
        tabIndex={tab}
        onClick={(e) => {
          const req: WordTapRequest = { surface: t.text, text, start: t.start, end: t.end, tokens, index, area, source, title: null, anchor: e.currentTarget, returnFocus: null };
          openLookup(req);
        }}
      >
        {t.text}
      </button>
    );
  };

  // Aufeinanderfolgende Wörter derselben Stelle stehen in EINEM <mark>.
  const out: ReactNode[] = [];
  let i = 0;
  while (i < tokens.length) {
    const tk = tokens[i] as Token;
    const s = spanOf(tk);
    if (s < 0) {
      out.push(<Fragment key={`t${tk.start}`}>{node(tk, i)}</Fragment>);
      i += 1;
      continue;
    }
    const group: ReactNode[] = [];
    while (i < tokens.length && spanOf(tokens[i] as Token) === s) {
      group.push(node(tokens[i] as Token, i));
      i += 1;
    }
    out.push(
      <mark key={`m${tk.start}`} className="lx-mark text-fg" data-testid="mark">
        {group}
      </mark>,
    );
  }
  return (
    <p ref={root} lang="en" className={className} data-testid={testId} onKeyDown={onKeyDown}>
      {out}
    </p>
  );
}
