import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useT } from '../i18n';
import { EnglishText } from './EnglishText';
import type { WordTapArea } from './wordTap';

// Stelle im Satz antippen (Lernplattform 2.0 §4.4, Leitsatz 9): VOR dem Prüfen wählt Antippen ein Wort (`one`) oder einen
// zusammenhängenden Bereich (`span`: erster Tipp = Start, zweiter = Ende, dritter beginnt neu). NACH dem Prüfen (`locked`)
// öffnet jedes Wort das Nachschlagen (`EnglishText`). Gewählt ist neutral (`data-selected`), nie „richtig“; Ergebnisfarben
// kommen nur über `marks` und tragen zusätzlich ✓/✕ und einen Text für Screenreader.

export type Span = readonly [number, number];
export type SpotMark = { span: Span; tone: 'ok' | 'wrong' };

export type SpotSentenceProps = {
  words: string[];
  pick: 'one' | 'span';
  selected: [number, number] | null;
  onSelect: (s: [number, number] | null) => void;
  locked?: boolean;
  marks?: SpotMark[];
  testId?: string;
  /** Zugänglicher Name der Gruppe. */
  label?: string;
  /** Nachschlagen nach dem Prüfen (nur mit `locked`). */
  area?: WordTapArea;
  source?: string | null;
};

const inSpan = (i: number, s: Span | null | undefined): boolean => !!s && i >= s[0] && i <= s[1];

export function SpotSentence({ words, pick, selected, onSelect, locked = false, marks, testId = 'spot-sentence', label, area = 'trainer', source = null }: SpotSentenceProps) {
  const { t } = useT();
  const root = useRef<HTMLSpanElement>(null);
  // Bei `span`: Start gesetzt, Ende fehlt noch.
  const [start, setAnchor] = useState<number | null>(null);
  const [rove, setRove] = useState(0);
  // Der Start gilt nur, solange die Auswahl noch genau dieses eine Wort ist (setzt der Aufrufer zurück, beginnt es neu).
  const anchor = start !== null && selected && selected[0] === start && selected[1] === start ? start : null;
  const markOf = (i: number): SpotMark | undefined => marks?.find((m) => inSpan(i, m.span));

  const tap = (i: number): void => {
    if (locked) return;
    setRove(i);
    if (pick === 'one') {
      onSelect(selected && selected[0] === i && selected[1] === i ? null : [i, i]);
      return;
    }
    if (anchor === null) {
      setAnchor(i);
      onSelect([i, i]);
    } else {
      setAnchor(null);
      onSelect([Math.min(anchor, i), Math.max(anchor, i)]);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>): void => {
    const target = e.target as HTMLElement;
    if (!target.hasAttribute('data-spot') || !root.current) return;
    const all = Array.from(root.current.querySelectorAll<HTMLButtonElement>('button[data-spot]'));
    const i = all.indexOf(target as HTMLButtonElement);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(all.length - 1, i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = all.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setRove(next);
    all[next]?.focus();
  };

  const glyph = (m: SpotMark): ReactNode => (
    <span className="lx-spot-glyph" data-mark={m.tone === 'ok' ? 'correct' : 'wrong'}>
      <span aria-hidden="true">{m.tone === 'ok' ? '✓' : '✕'}</span>
    </span>
  );
  const srMark = (m: SpotMark): ReactNode => <span className="sr-only">{m.tone === 'ok' ? t('chMarkRight') : t('chMarkWrong')}: </span>;

  let body: ReactNode;
  if (locked) {
    // Nachschlagen statt Auswahl. Ohne Markierung ein ganzer Satz (bester Kontext), sonst Stücke je Markierung.
    const sorted = [...(marks ?? [])].sort((a, b) => a.span[0] - b.span[0]);
    if (!sorted.length) {
      body = <EnglishText as="span" text={words.join(' ')} area={area} source={source} />;
    } else {
      const parts: ReactNode[] = [];
      let pos = 0;
      const plain = (from: number, to: number): void => {
        if (to < from) return;
        if (parts.length) parts.push(' ');
        parts.push(<EnglishText key={`p${from}`} as="span" text={words.slice(from, to + 1).join(' ')} area={area} source={source} />);
      };
      for (const m of sorted) {
        if (m.span[0] < pos) continue;
        plain(pos, m.span[0] - 1);
        if (parts.length) parts.push(' ');
        parts.push(
          <span key={`m${m.span[0]}`} className="lx-spot" data-state={m.tone === 'ok' ? 'correct' : 'wrong'} data-testid="spot-mark">
            {srMark(m)}
            <EnglishText as="span" text={words.slice(m.span[0], m.span[1] + 1).join(' ')} area={area} source={source} />
            {glyph(m)}
          </span>,
        );
        pos = m.span[1] + 1;
      }
      plain(pos, words.length - 1);
      body = parts;
    }
  } else {
    body = words.map((w, i) => {
      const m = markOf(i);
      const sel = inSpan(i, selected);
      const last = m && i === m.span[1];
      return (
        <span key={i}>
          {i > 0 && ' '}
          <button
            type="button"
            data-spot={i}
            data-testid="spot-word"
            data-selected={sel || undefined}
            data-state={m ? (m.tone === 'ok' ? 'correct' : 'wrong') : undefined}
            aria-pressed={sel}
            tabIndex={i === rove ? 0 : -1}
            lang="en"
            className="lx-spot lx-hit inline-flex items-center rounded px-0.5"
            onClick={() => tap(i)}
          >
            {m && i === m.span[0] && srMark(m)}
            {w}
            {m && last && glyph(m)}
          </button>
        </span>
      );
    });
  }

  return (
    <span ref={root} role="group" aria-label={label ?? t('exSpotLabel')} className="lx-t-prompt" data-testid={testId} data-locked={locked || undefined} onKeyDown={onKeyDown}>
      {body}
    </span>
  );
}
