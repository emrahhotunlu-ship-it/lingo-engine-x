import type { ArticleItem } from '../../domain/input/types';
import { EnglishText } from '../../engine/EnglishText';
import { ReaderText } from './ReaderText';

// Der Lesetext (Plan §4.1 Nr. 2, Neubau N51/N52): Absätze, Lesebreite ≤ 68 Zeichen, jedes Wort
// antippbar, Wortstatus dezent, darunter „Wörter aus diesem Text üben (n)“.

export function ArticleView({ item, badge, practice = false, onPara, startPara }: { item: ArticleItem; badge?: string | null; practice?: boolean; onPara?: (i: number) => void; startPara?: number | null }) {
  return (
    <article lang="en" className="flex max-w-[68ch] flex-col gap-4" data-testid="article" data-id={item.id}>
      <header className="flex flex-col gap-2">
        {badge && <p className="lx-eyebrow">{badge}</p>}
        <h2 className="text-2xl font-semibold tracking-tight">
          <EnglishText text={item.title} area="read" source={item.ref} title={item.title} as="span" />
        </h2>
        {item.teaser && <EnglishText text={item.teaser} area="read" source={item.ref} title={item.title} className="text-base text-muted" />}
      </header>
      <ReaderText text={item.text} title={item.title} sourceRef={item.ref} area="read" practice={practice} levels={practice} onPara={onPara} startPara={startPara ?? null} />
    </article>
  );
}
