import { useMemo, type ReactNode } from 'react';
import { detectLang } from '../domain/lang/detect';
import { parseMarkdown, type Inline } from '../domain/text/markdown';
import { EnglishText } from './EnglishText';
import type { WordTapArea } from './wordTap';

// Claude-Antworten als schlichtes Markdown (Phase 5 §8.1, E5-08): React-Elemente, kein innerHTML,
// keine Links. Während des Streamens nur Text (keine Wortknöpfe, damit nichts unter dem Finger
// wandert). Fertig: englische Stellen antippbar (Kap. 15 „Wörter nicht antippbar"):
// - Oberfläche Deutsch: **fett**, *kursiv*, `code`, Zitate „…"/"…" und >-Zitate, sofern nicht Deutsch,
// - Oberfläche Englisch: der ganze Text.

type Props = {
  text: string;
  streaming: boolean;
  uiLang: 'de' | 'en';
  area?: WordTapArea;
  source?: string | null;
  className?: string;
};

// „…", "…", “…” – nur Zitate mit mindestens einem Wort.
const QUOTE = /(„[^“”"\n]{2,}[“”"]|"[^"\n]{2,}"|“[^”\n]{2,}”)/g;

const notGerman = (s: string) => detectLang(s) !== 'de' && /[A-Za-z]{2,}/.test(s);

function Plain({ text }: { text: string }) {
  return <>{text}</>;
}

export function Markdown({ text, streaming, uiLang, area = 'companion', source = null, className }: Props) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  const tap = !streaming;

  const eng = (s: string, key: string): ReactNode =>
    tap ? <EnglishText key={key} as="span" text={s} area={area} source={source} /> : <Plain key={key} text={s} />;

  /** Text einer Stelle: in UI=en ganz antippbar, in UI=de nur englische Zitate. */
  const textNode = (s: string, key: string, forceEnglish: boolean): ReactNode => {
    if (!tap) return <Plain key={key} text={s} />;
    if (uiLang === 'en' || forceEnglish) return eng(s, key);
    const parts = s.split(QUOTE);
    return (
      <span key={key}>
        {parts.map((p, i) => {
          if (i % 2 === 1) {
            const inner = p.slice(1, -1);
            return notGerman(inner) ? (
              <span key={i}>
                {p.slice(0, 1)}
                {eng(inner, `q${i}`)}
                {p.slice(-1)}
              </span>
            ) : (
              <Plain key={i} text={p} />
            );
          }
          return <Plain key={i} text={p} />;
        })}
      </span>
    );
  };

  const inline = (nodes: readonly Inline[], key: string, english: boolean): ReactNode[] =>
    nodes.map((n, i) => {
      const k = `${key}.${i}`;
      if (n.type === 'text') return textNode(n.text, k, english);
      if (n.type === 'code')
        return (
          <code key={k} className="rounded bg-surface-strong px-1 py-0.5 text-[0.92em]">
            {tap && (uiLang === 'en' || notGerman(n.text)) ? eng(n.text, `${k}c`) : n.text}
          </code>
        );
      const childEnglish = english || (uiLang === 'de' && notGerman(inlineTextOf(n.children)));
      const kids = inline(n.children, k, childEnglish);
      return n.type === 'strong' ? (
        <strong key={k} className="font-semibold">
          {kids}
        </strong>
      ) : (
        <em key={k}>{kids}</em>
      );
    });

  return (
    <div className={`flex flex-col gap-2.5 ${className ?? ''}`}>
      {blocks.map((b, i) => {
        const key = `b${i}`;
        switch (b.type) {
          case 'p':
            return (
              <p key={key} className="whitespace-pre-line">
                {inline(b.inline, key, false)}
              </p>
            );
          case 'h':
            return (
              <p key={key} className="font-semibold whitespace-pre-line">
                {inline(b.inline, key, false)}
              </p>
            );
          case 'quote':
            return (
              <blockquote key={key} className="border-l-2 border-line pl-3 whitespace-pre-line text-muted">
                {inline(b.inline, key, uiLang === 'de' && notGerman(inlineTextOf(b.inline)))}
              </blockquote>
            );
          case 'ul':
          case 'ol': {
            const Tag = b.type;
            return (
              <Tag key={key} className={`flex flex-col gap-1 pl-5 ${b.type === 'ul' ? 'list-disc' : 'list-decimal'}`}>
                {b.items.map((it, j) => (
                  <li key={j} className="whitespace-pre-line">
                    {inline(it, `${key}.${j}`, false)}
                  </li>
                ))}
              </Tag>
            );
          }
          case 'code':
            return (
              <pre key={key} className="overflow-x-auto rounded-xl bg-surface-strong p-3 text-sm whitespace-pre-wrap">
                <code>{b.text}</code>
              </pre>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

function inlineTextOf(nodes: readonly Inline[]): string {
  return nodes.map((n) => (n.type === 'text' || n.type === 'code' ? n.text : inlineTextOf(n.children))).join('');
}
