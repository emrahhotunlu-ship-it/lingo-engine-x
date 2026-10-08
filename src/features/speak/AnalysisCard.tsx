import { useMemo, type ReactNode } from 'react';
import { useT, type MessageKey } from '../../i18n';
import { answerDiff } from '../../domain/answer/diff';
import { TOPICS } from '../../domain/content';
import { usSpelling } from '../../domain/text/lemma';
import { tokenize } from '../../domain/text/tokenize';
import type { AnalysisSlot, AnalysisView, ChunkSuggestion } from '../../domain/speak/types';
import { EnglishText } from '../../engine/EnglishText';
import type { WordTapArea } from '../../engine/wordTap';
import { SpeakButton } from '../../engine/SpeakButton';
import { Button } from '../../ui/Button';
import { Skeleton } from '../../ui/Skeleton';
import { TakeChunkButton, type TakeInput } from './TakeChunkButton';

// Analysekarte mit drei Schichten (Plan §5.3), auch im Präsentations-Coach genutzt:
// 1. Korrektheit (Status, je Fehler „falsch → richtig“ mit Markierung, Kategorie, ein Satz),
// 2. C1-Fassung mit Änderungen, 3. „Landet besser, weil …“ – plus bis zu 3 Wendungen zum
// Mitnehmen. Britische Formen sind nie Fehler, sondern ein Hinweis „US-Form“ (A7.3).
// Vor der Analyse steht keine Lösung im DOM.

const EXTRA_KEYS: Record<string, MessageKey> = {
  vocab: 'cat_vocab',
  collocation: 'cat_collocation',
  register: 'cat_register',
  'word-order': 'cat_wordOrder',
  spelling: 'cat_spelling',
  other: 'cat_misc',
};

export function useCatLabel(): (cat: string) => string {
  const { t, lang } = useT();
  return (cat: string) => {
    const topic = TOPICS.find((x) => x.id === cat);
    if (topic) return lang === 'de' ? topic.name : (topic.name_en ?? topic.name);
    const k = EXTRA_KEYS[cat];
    return k ? t(k) : cat;
  };
}

/** Britische Schreibweisen im eigenen Satz → US-Form (nur als Hinweis). */
export function usHints(sentence: string): Array<{ uk: string; us: string }> {
  const out: Array<{ uk: string; us: string }> = [];
  for (const tok of tokenize(sentence)) {
    if (tok.kind !== 'word') continue;
    const us = usSpelling(tok.text);
    if (us && us !== tok.text.toLowerCase() && !out.some((o) => o.us === us)) out.push({ uk: tok.text, us });
  }
  return out.slice(0, 3);
}

export const VERDICT_KEY: Record<AnalysisView['verdict'], MessageKey> = { clean: 'anClean', minor: 'anMinor', errors: 'anErrors' };
const VERDICT_TONE: Record<AnalysisView['verdict'], string> = {
  clean: 'bg-accent-soft text-accent-text',
  minor: 'bg-gold-soft text-gold-text',
  errors: 'bg-danger-soft text-danger-text',
};

type Props = {
  idx: number;
  slot: AnalysisSlot | undefined;
  sentence: string;
  area: WordTapArea;
  source?: string | null;
  title?: string | null;
  onRetry?: () => void;
  /** Baut die Eingabe für „Mitnehmen“ aus einem Vorschlag (Ursprungssatz, Quelle). */
  takeInput: (c: ChunkSuggestion, upgraded: string) => TakeInput;
  onTaken?: (en: string) => void;
  testId?: string;
  /** „Sag’s nochmal“ (LP3 P51): steht unter dem Urteil. */
  retry?: ReactNode;
  /** Verdeckt die Korrektur (Fehler, C1-Fassung, Begründung), solange „Sag’s nochmal“ offen ist. */
  hideFix?: boolean;
};

export function AnalysisCard({ idx, slot, sentence, area, source = null, title = null, onRetry, takeInput, onTaken, testId = 'analysis', retry = null, hideFix = false }: Props) {
  const { t } = useT();
  const cat = useCatLabel();
  const hints = useMemo(() => usHints(sentence), [sentence]);

  if (!slot || slot.state === 'pending') {
    return (
      <div data-testid={testId} data-idx={idx} data-state="pending" className="flex flex-col gap-2" role="status" aria-label={t('anPending')}>
        <p className="text-xs text-muted">{t('anPending')}</p>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }
  if (slot.state === 'skipped') {
    return (
      <p data-testid={testId} data-idx={idx} data-state="skipped" className="text-sm text-muted">
        {t('anSkipped')}
      </p>
    );
  }
  if (slot.state === 'failed' || !slot.data) {
    return (
      <div data-testid={testId} data-idx={idx} data-state="failed" className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted">{t('anFailed')}</p>
        {onRetry && (
          <Button icon="refresh" onClick={onRetry} data-ai="" data-testid="an-retry">
            {t('anRetry')}
          </Button>
        )}
      </div>
    );
  }
  const a = slot.data;
  if (hideFix) {
    return (
      <div data-testid={testId} data-idx={idx} data-state={a.verdict} data-hidden="" className="flex flex-col gap-3">
        <p className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${VERDICT_TONE[a.verdict]}`}>{t(VERDICT_KEY[a.verdict])}</span>
        </p>
        {retry}
      </div>
    );
  }
  return (
    <div data-testid={testId} data-idx={idx} data-state={a.verdict} className="flex flex-col gap-4">
      {/* 1. Korrektheit */}
      <section className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-2">
          {a.english ? (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${VERDICT_TONE[a.verdict]}`}>{t(VERDICT_KEY[a.verdict])}</span>
          ) : (
            <span className="rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger-text">{t('anNotEnglish')}</span>
          )}
        </p>
        {a.errors.map((e, k) => (
          <div key={k} data-testid="an-error" className="flex flex-col gap-1 text-sm">
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span lang="en" className="text-muted line-through decoration-danger-text/70">
                {answerDiff(e.wrong, e.right).map((p, j) => (
                  <span key={j} className={p.ok ? undefined : 'lx-diff-off'}>
                    {p.text}
                  </span>
                ))}
              </span>
              <span aria-hidden="true" className="text-subtle">
                →
              </span>
              <EnglishText as="span" text={e.right} area={area} source={source} title={title} className="font-medium" />
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">{cat(e.cat)}</span>
            </p>
            <p className="text-muted">{e.why}</p>
          </div>
        ))}
        {hints.map((h) => (
          <p key={h.us} className="text-sm text-cyan-text" data-testid="an-us">
            {t('anUsHint', { us: h.us })}
          </p>
        ))}
        {retry}
      </section>

      {/* 2. C1-Fassung */}
      <section className="flex flex-col gap-2">
        <p className="lx-eyebrow">{a.english ? t('anC1') : t('anNotEnglish')}</p>
        <div className="flex items-start gap-1">
          <EnglishText text={a.upgraded} area={area} source={source} title={title} className="min-w-0 flex-1 text-base leading-relaxed" testId="an-upgraded" />
          <SpeakButton text={a.upgraded} />
        </div>
        {a.changes.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {a.changes.map((c, k) => (
              <li key={k} data-testid="an-change" className="text-sm">
                <span lang="en" className="text-muted">
                  {c.from}
                </span>
                <span aria-hidden="true" className="px-1.5 text-subtle">
                  →
                </span>
                <span lang="en" className="font-medium">
                  {c.to}
                </span>
                <span className="block text-muted">{c.why}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3. Landet besser, weil … */}
      <p data-testid="an-lands" className="text-sm">
        <span className="font-semibold">{t('anLands')}</span> {a.lands}
      </p>

      {a.chunks.length > 0 && (
        <section className="flex flex-col gap-2 border-t border-line pt-3">
          {a.chunks.map((c) => (
            <div key={c.en} className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <EnglishText as="span" text={c.en} area={area} source={source} title={title} className="font-medium" />
                <span className="block text-xs text-muted">{c.de}</span>
              </div>
              <TakeChunkButton input={takeInput(c, a.upgraded)} {...(onTaken ? { onTaken } : {})} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
