import { useMemo } from 'react';
import { paragraphs } from '../../domain/input/textStats';
import type { ArticleItem } from '../../domain/input/types';
import { EnglishText } from '../../engine/EnglishText';

// Der Lesetext (Plan §4.1 Nr. 2): Absätze, Lesebreite ≤ 68 Zeichen, jedes Wort antippbar.

export function ArticleView({ item, badge }: { item: ArticleItem; badge?: string | null }) {
  const paras = useMemo(() => paragraphs(item.text), [item.text]);
  return (
    <article lang="en" className="flex max-w-[68ch] flex-col gap-4" data-testid="article" data-id={item.id}>
      <header className="flex flex-col gap-2">
        {badge && <p className="lx-eyebrow">{badge}</p>}
        <h2 className="text-2xl font-semibold tracking-tight">
          <EnglishText text={item.title} area="read" source={item.ref} title={item.title} as="span" />
        </h2>
        {item.teaser && <EnglishText text={item.teaser} area="read" source={item.ref} title={item.title} className="text-base text-muted" />}
      </header>
      {paras.map((p, i) => (
        <EnglishText key={i} text={p} area="read" source={item.ref} title={item.title} className="text-[1.0625rem] leading-[1.75]" />
      ))}
    </article>
  );
}
