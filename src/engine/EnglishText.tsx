import { useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { tokenize } from '../domain/text/tokenize';
import type { Token } from '../domain/text/types';
import { openLookup, useLookup, type WordTapArea } from './wordTap';

// Englischer Text mit antippbaren Wörtern (Kap. 6.11, Plan §5.6). Jedes Wort ist ein Knopf
// `button.lx-word`; ein Tippen öffnet das Nachschlage-Fenster. `exclude` (die Lösung während
// der Frage) und `slot` (die Lücke) sind nicht antippbar. Genau ein Wort je Text ist per Tab
// erreichbar, ←/→ wandern weiter.

type Span = readonly [number, number];

export type EnglishTextProps = {
  text: string;
  area: WordTapArea;
  source?: string | null;
  title?: string | null;
  exclude?: Span | null;
  highlight?: Span | null;
  slot?: { start: number; end: number; node: ReactNode } | null;
  as?: 'p' | 'span' | 'div';
  className?: string;
  testId?: string;
};

type Piece = ({ kind: 'tokens'; from: number; to: number; plain?: boolean; mark?: boolean } | { kind: 'slot'; node: ReactNode }) & { tail?: string };

/** Satzzeichen direkt hinter einer Stelle („.", „)," …) – sie bleiben mit dem Wort in einer Zeile (H6). */
const TAIL = /^[^\s\p{L}\p{N}]+/u;

export function EnglishText({ text, area, source = null, title = null, exclude = null, highlight = null, slot = null, as = 'p', className, testId }: EnglishTextProps) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const active = useLookup((s) => s.req);
  const root = useRef<HTMLElement>(null);
  // Fokus VOR dem Antippen (pointerdown kommt vor dem Fokuswechsel auf den Knopf).
  const focusBefore = useRef<HTMLElement | null>(null);

  const pieces: Piece[] = [];
  const cuts: Array<{ start: number; end: number; piece: Piece }> = [];
  if (slot) cuts.push({ start: slot.start, end: slot.end, piece: { kind: 'slot', node: slot.node } });
  if (exclude) cuts.push({ start: exclude[0], end: exclude[1], piece: { kind: 'tokens', from: exclude[0], to: exclude[1], plain: true, mark: !!highlight && highlight[0] === exclude[0] } });
  else if (highlight) cuts.push({ start: highlight[0], end: highlight[1], piece: { kind: 'tokens', from: highlight[0], to: highlight[1], mark: true } });
  cuts.sort((a, b) => a.start - b.start);
  let pos = 0;
  for (const c of cuts) {
    if (c.start < pos) continue;
    if (c.start > pos) pieces.push({ kind: 'tokens', from: pos, to: c.start });
    const tail = TAIL.exec(text.slice(c.end))?.[0] ?? '';
    pieces.push(tail ? { ...c.piece, tail } : c.piece);
    pos = c.end + tail.length;
  }
  if (pos < text.length) pieces.push({ kind: 'tokens', from: pos, to: text.length });

  let first = true;
  const renderTokens = (from: number, to: number, plain: boolean): ReactNode[] => {
    const seg = text.slice(from, to);
    // Eigene Zerlegung je Teilstück: Lücke oder Ausschluss mitten im Wort bleibt korrekt.
    const nodes = tokenize(seg).map((t: Token, i) => {
      const start = from + t.start;
      const end = from + t.end;
      if (plain || t.kind !== 'word') return <span key={`${start}-${i}`}>{t.text}</span>;
      const index = tokens.findIndex((x) => x.start === start && x.end === end);
      const isActive = !!active && active.text === text && active.start === start;
      const tab = first ? 0 : -1;
      first = false;
      return (
        <button
          key={`${start}-${i}`}
          type="button"
          className="lx-word"
          data-word={t.text}
          data-lookup={t.text.toLowerCase()}
          data-active={isActive || undefined}
          tabIndex={tab}
          onPointerDown={() => {
            const a = document.activeElement;
            focusBefore.current = a instanceof HTMLElement && a !== document.body ? a : null;
          }}
          onClick={(e) => {
            const before = focusBefore.current;
            focusBefore.current = null;
            const returnFocus = before && before !== e.currentTarget && !before.classList.contains('lx-word') ? before : null;
            openLookup({ surface: t.text, text, start, end, tokens, index: index < 0 ? 0 : index, area, source, title, anchor: e.currentTarget, returnFocus });
          }}
        >
          {t.text}
        </button>
      );
    });
    // Wort und angrenzende Satzzeichen ohne Leerraum dazwischen bilden eine untrennbare Gruppe:
    // sonst bricht die Zeile vor dem Punkt (der Knopf erlaubt einen Umbruch hinter sich).
    const toks = tokenize(seg);
    const out: ReactNode[] = [];
    let group: ReactNode[] = [];
    let gk = '';
    const close = () => {
      if (group.length > 1)
        out.push(
          <span key={`g${gk}`} className="whitespace-nowrap">
            {group}
          </span>,
        );
      else out.push(...group);
      group = [];
    };
    toks.forEach((t, i) => {
      if (t.kind === 'space') {
        close();
        out.push(nodes[i]);
        return;
      }
      if (!group.length) gk = `${from + t.start}`;
      group.push(nodes[i]);
    });
    close();
    return out;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('lx-word') || !root.current) return;
    const all = Array.from(root.current.querySelectorAll<HTMLButtonElement>('button.lx-word'));
    const i = all.indexOf(target as HTMLButtonElement);
    let next = -1;
    if (e.key === 'ArrowRight') next = Math.min(all.length - 1, i + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = all.length - 1;
    if (next < 0) return;
    e.preventDefault();
    all.forEach((b, k) => (b.tabIndex = k === next ? 0 : -1));
    all[next]?.focus();
  };

  const children = pieces.map((p, k) => {
    const node =
      p.kind === 'slot' ? (
        <span key={`slot-${k}`}>{p.node}</span>
      ) : p.mark ? (
        <mark key={`m-${k}`} className="lx-mark text-fg">
          {renderTokens(p.from, p.to, !!p.plain)}
        </mark>
      ) : (
        <span key={`t-${k}`}>{renderTokens(p.from, p.to, !!p.plain)}</span>
      );
    if (!p.tail) return node;
    // Mehrwortige Stellen dürfen weiter umbrechen; nur Einzelwort bzw. Lücke plus Satzzeichen bleiben zusammen.
    if (p.kind === 'tokens' && /\s/.test(text.slice(p.from, p.to)))
      return (
        <span key={`w-${k}`}>
          {node}
          {p.tail}
        </span>
      );
    return (
      <span key={`w-${k}`} className="whitespace-nowrap">
        {node}
        {p.tail}
      </span>
    );
  });
  const Tag = as;
  return (
    <Tag ref={root as never} lang="en" className={className} data-testid={testId} onKeyDown={onKeyDown}>
      {children}
    </Tag>
  );
}
