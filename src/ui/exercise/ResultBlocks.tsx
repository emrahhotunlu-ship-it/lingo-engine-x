import type { ReactNode } from 'react';
import type { ExplainLine } from '../../domain/explain/types';
import { EnglishText } from '../../engine/EnglishText';
import type { WordTapArea } from '../../engine/wordTap';
import { useT, type MessageKey } from '../../i18n';
import { ExampleItem } from './Examples';
import { lineLabel } from './lineLabel';
import type { BlockItem, ResultPlan } from './resultPlan';

// Blöcke 2 und 3 der Ergebnis-Karte (UX-Audit U3): „Warum“ und „Merke“ mit festem Namen, ohne Zeilen-Überschriften.
// 8-px-Raster: Block-Abstand 16 px (Gerüst), innen 8 px. Unter „Mehr“ behalten die Zeilen ihren kurzen Namen.

function itemKind(it: BlockItem): ExplainLine['k'] {
  switch (it.t) {
    case 'text':
      return it.k;
    case 'pattern':
      return 'pattern';
    case 'mistake':
      return 'mistake';
    case 'contrast':
      return 'contrast';
    default:
      return 'why';
  }
}

function useItemBody(area: WordTapArea) {
  const { t, lang } = useT();
  const en = (text: string): ReactNode => <EnglishText as="span" text={text} area={area} />;
  return (it: BlockItem): ReactNode => {
    switch (it.t) {
      case 'text':
        return (
          <>
            {it.lead && <span className="mr-1 font-semibold text-fg">{it.lead}:</span>}
            <span lang={lang}>{it.text}</span>
            {it.ai && (
              <span className="lx-t-meta mt-1 block text-muted" data-testid="ai-note">
                {t('exAiNote')}
              </span>
            )}
          </>
        );
      case 'pattern':
        return (
          <span className="flex flex-col items-start gap-2">
            <span className="font-semibold text-fg">{it.name}</span>
            {it.formula && (
              <span className="inline-block rounded-full bg-hint-soft px-3 py-1 text-hint-text" lang="en" data-testid="pattern-formula-chip">
                {it.formula}
              </span>
            )}
          </span>
        );
      case 'main':
        return (
          <span className="lx-t-answer block min-w-0 text-fg" lang={it.en ? 'en' : lang}>
            {it.en ? en(it.text) : it.text}
          </span>
        );
      case 'pair':
        return (
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="lx-t-meta flex-none font-medium text-subtle">{`${it.label}:`}</span>
            <span className="min-w-0 font-semibold text-fg" lang="en">
              {en(it.text)}
            </span>
          </span>
        );
      case 'mistake':
        return (
          <>
            <span>{t('exLineMistakeArrow', { bad: it.bad, good: it.good })}</span>
            {it.cause && (
              <span className="ml-1 text-muted" lang={lang}>
                {it.cause}
              </span>
            )}
          </>
        );
      case 'contrast':
        if (it.meaningOnly)
          return (
            <span className="text-muted" lang={lang}>
              {it.diff}
            </span>
          );
        return (
          <>
            {en(it.a)} <span aria-hidden="true">≠</span> {en(it.b)}
            <span className="ml-1 text-muted" lang={lang}>
              {it.diff}
            </span>
          </>
        );
      case 'chips':
        return (
          <span className="flex flex-wrap items-center gap-2">
            <span className="sr-only">{it.word}</span>
            {it.chips.map((c) => (
              <span key={c} data-chip="" className="lx-t-meta inline-flex min-h-7 items-center rounded-full bg-track px-2.5 font-medium text-muted">
                {c}
              </span>
            ))}
            {it.formula && (
              <span className="lx-t-meta inline-flex min-h-7 items-center rounded-full bg-hint-soft px-2.5 font-semibold text-hint-text" lang="en">
                {it.formula}
              </span>
            )}
          </span>
        );
    }
  };
}

function Item({ it, body, labeled }: { it: BlockItem; body: (it: BlockItem) => ReactNode; labeled: boolean }) {
  const { t } = useT();
  const k = itemKind(it);
  // Unter „Mehr“ heißen Begründungen ebenfalls „Warum“ und Merke-Stücke „Merke“ (ein Name je Sache).
  const key: MessageKey = it.t === 'main' || it.t === 'pair' ? 'exBlockRemember' : k === 'why' ? 'exBlockWhy' : lineLabel(k, undefined);
  const label = labeled && it.t !== 'chips' ? t(key) : null;
  const inner = (
    <>
      {label && <span className="lx-eyebrow block text-subtle">{label}</span>}
      <span className="lx-t-support block min-w-0 text-fg">{body(it)}</span>
    </>
  );
  // „Deine Antwort“ behält ihre Kennung (Tests, Vorleseprogramme): Hülle explanation-yours, Zeile data-line="yours".
  if (it.t === 'text' && it.k === 'yours')
    return (
      <li data-testid="explanation-yours">
        <div className="flex flex-col gap-1" data-line="yours">
          {inner}
        </div>
      </li>
    );
  return (
    <li className="flex flex-col gap-1" data-line={k} data-item={it.t}>
      {inner}
    </li>
  );
}

function Block({ name, title, items, body, before, after }: { name: 'why' | 'remember'; title: string; items: BlockItem[]; body: (it: BlockItem) => ReactNode; before?: ReactNode; after?: ReactNode }) {
  if (!items.length && !before && !after) return null;
  return (
    <section className="-mx-4 flex flex-col gap-2 border-t border-line px-4 pt-4" data-block={name} aria-label={title}>
      <h3 className="lx-eyebrow m-0 text-subtle">{title}</h3>
      {before}
      {items.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((it, i) => (
            <Item key={`${it.t}-${i}`} it={it} body={body} labeled={false} />
          ))}
        </ul>
      )}
      {after}
    </section>
  );
}

/** Blöcke „Warum“ und „Merke“. `before`: eigener Inhalt der Übung oben im Warum-Block (Wörter: „overcame = Vergangenheit von overcome“). */
export function ResultBlocks({ plan, area = 'trainer', before, source, depth, ai = false, testId = 'explanation', whyTitle }: { plan: ResultPlan; area?: WordTapArea; before?: ReactNode; source?: string; depth?: string; ai?: boolean; /** Band (P3): der Merke-Teil im Mehr-Blatt trägt eine eigene Kennung. */ testId?: string; /** Korrekturrunde P3 (Punkt 6): weitere Begründungen im Mehr-Blatt heißen „Nicht verwechseln“, nicht ein zweites „Warum“. */ whyTitle?: string }) {
  const { t } = useT();
  const body = useItemBody(area);
  // Text von Claude ohne eigene Kennzeichnung an der Zeile: die Kennzeichnung steht einmal am Ende des Warum-Blocks.
  const aiNote =
    ai && !plan.why.some((x) => x.t === 'text' && x.ai) ? (
      <p className="lx-t-meta m-0 text-muted" data-testid="ai-note">
        {t('exAiNote')}
      </p>
    ) : null;
  const whyShown = plan.why.length > 0 || !!before;
  const why = <Block name="why" title={whyTitle ?? t('exBlockWhy')} items={plan.why} body={body} before={before} after={whyShown ? aiNote : null} />;
  // Ohne eigenes Merke-Stück: der Beispielsatz (antippbar) ist das, was bleibt.
  const example = plan.example ? (
    <ul className="m-0 flex list-none flex-col gap-2 p-0 lx-t-support" data-testid="examples">
      <ExampleItem ex={plan.example} area={area} />
    </ul>
  ) : null;
  const remember = (
    <Block
      name="remember"
      title={t('exBlockRemember')}
      items={plan.remember}
      body={body}
      after={
        example || (!whyShown && aiNote) ? (
          <>
            {example}
            {!whyShown && aiNote}
          </>
        ) : null
      }
    />
  );
  if (!whyShown && !plan.remember.length && !example) return null;
  return (
    <div className="flex flex-col gap-4" data-testid={testId} data-slot="explanation" data-source={source} data-depth={depth}>
      {why}
      {remember}
    </div>
  );
}

/** Die Zeilen unter „Mehr“: mit ihrem kurzen Namen (Typischer Fehler, Nicht verwechseln, Hinweis …). */
export function MoreItems({ items, area = 'trainer' }: { items: BlockItem[]; area?: WordTapArea }) {
  const body = useItemBody(area);
  if (!items.length) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-4 p-0" data-testid="explanation-folded">
      {items.map((it, i) => (
        <Item key={`${it.t}-${i}`} it={it} body={body} labeled />
      ))}
    </ul>
  );
}
