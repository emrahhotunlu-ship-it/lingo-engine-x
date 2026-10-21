import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { EnglishText } from '../../engine/EnglishText';
import { SpeakButton } from '../../engine/SpeakButton';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useHotkeys } from '../../engine/useHotkeys';
import { ipaOf } from '../../domain/lexicon/pron';
import { lapsesOf } from '../../domain/srs/lapses';
import { askNeed, canPause, contrastLines, diagnose, partsCoreFirst, readWk } from '../../domain/srs/werkstatt';
import type { TrainCard } from '../../domain/srs/types';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { toast } from '../../ui/Toast';
import { ExerciseShell } from '../../ui/exercise';
import { setHidden } from './list/actions';
import { MNEMO_MAX, isOwnMnemo, storedMnemo } from './mnemonic';
import { continueWerkstatt, pauseWord, useSession, type FirstKind } from './session';
import { requestWkMemos, saveOwnMemo, useWkMemo, type MemoCard } from './werkstattMemo';
import { confusionOf } from './wordCtx';

// Wort-Werkstatt (Wort-Lernen 2, Teil 2, `domain/srs/werkstatt.ts`): Statt der gewöhnlichen Wiederholung wird ein hakendes Wort neu verankert.
// Feste Reihenfolge: Woran es hakt (Diagnose) · Deutsch denkt … → Englisch sagt … · Teile, Kern zuerst (Wendungen) · Satz · Merkhilfe (eigene zuerst,
// dann zwei Vorschläge von Claude) · ggf. „pausieren“ / „Brauchst du dieses Wort wirklich?“ · „Jetzt abrufen“ (gestützter Abruf, danach 2–3 Tage Ruhe).
// Schreibt nur die gewählte bzw. eigene Merkhilfe und – auf Wunsch – `hidden`; die Bewertung macht der Abruf danach.

export function WerkstattCard({ card, onDone }: { card: TrainCard; onDone: (kind: FirstKind) => void }) {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const pool = useSession((s) => s.pool);
  const queue = useSession((s) => s.queue);
  const pos = useSession((s) => s.pos);
  const cards = useSession((s) => s.cards);
  const diag = useMemo(() => diagnose(card, pool, { confusedKey: confusionOf(card.key) }), [card, pool]);
  const lines = contrastLines(diag, card, lang);
  const parts = partsCoreFirst(card);
  const ipa = ipaOf(card.word);
  const [need, setNeed] = useState<'ask' | 'yes'>(askNeed(card.doc) ? 'ask' : 'yes');

  // Alle Werkstatt-Wörter ab hier (höchstens 2 je Tag) in einem Aufruf: dieses zuerst.
  const bundle = useMemo((): MemoCard[] => {
    const keys = [card.key, ...queue.slice(pos + 1).filter((q) => q.phase === 'werkstatt' && q.key !== card.key).map((q) => q.key)];
    return [...new Set(keys)]
      .map((k) => (k === card.key ? card : cards.get(k)))
      .filter((c): c is TrainCard => !!c)
      .map((c) => ({ card: c, diag: c === card ? diag : diagnose(c, pool, { confusedKey: confusionOf(c.key) }) }));
  }, [card, cards, queue, pos, pool, diag]);

  // Beim Erscheinen der Karte (Ereignis, nicht Zeichnen): still Vorschläge holen, wenn erlaubt.
  useEffect(() => {
    requestWkMemos(bundle, lang, 'auto');
    // Nur beim Erscheinen dieser Karte; spätere Änderungen der Runde lösen keinen neuen Aufruf aus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.key]);

  const recall = () => {
    const kind = continueWerkstatt();
    if (kind === 'typed') api.focusNow();
    else api.blur();
    onDone(kind);
  };
  const pause = () => {
    const word = card.word;
    const kind = pauseWord((c) => setHidden(c, true));
    toast(t('pxWwPaused', { word }));
    if (kind === 'typed') api.focusNow();
    else api.blur();
    onDone(kind);
  };
  useHotkeys(need === 'yes' ? { enter: recall } : {}, api.isInput);

  const row = (label: string, body: ReactNode, testId: string) => (
    <div className="flex flex-col gap-1 border-t border-line py-2.5 first:border-t-0 sm:grid sm:grid-cols-[8rem_1fr] sm:items-baseline sm:gap-3" data-testid={testId}>
      <dt className="lx-t-label min-w-0 break-words text-subtle">{label}</dt>
      <dd className="lx-t-support m-0 min-w-0">{body}</dd>
    </div>
  );
  const diagText = t(`pxWwDiag_${diag.kind}` as MessageKey, { other: diag.other?.word ?? '' });
  const lapses = lapsesOf(card.doc);
  const rounds = readWk(card.doc)?.n ?? 0;

  return (
    <div data-testid="werkstatt" data-card={card.id} data-diag={diag.kind}>
      <ExerciseShell
        meta={{ ex: 'werkstatt', id: card.id, kind: card.kind }}
        // eslint-disable-next-line no-restricted-syntax -- Gerüst-Eigenschaft „gestapelt“ (keine Layout-Animation)
        layout="stack"
        keysHint={null}
        status={{ area: 'words', state: null, kindLabel: t('pxWwKind') }}
        task={{ text: t('pxWwTitle'), purpose: t('pxWwPurpose'), open: true }}
        prompt={
          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-2" lang="en" data-testid="werkstatt-word">
              <span className="lx-t-title">{card.word}</span>
              <SpeakButton text={card.word} testId="werkstatt-listen" />
            </p>
            {ipa && (
              <p className="lx-t-meta text-muted" lang="en">
                {ipa}
              </p>
            )}
          </div>
        }
        answer={
          <div className="flex flex-col gap-3">
            <dl className="m-0 flex flex-col">
              {row(
                t('pxWwDiagLabel'),
                <>
                  <span lang={lang} data-testid="werkstatt-diag">
                    {diagText}
                  </span>
                  {diag.kind === 'false_friend' && diag.trap && (
                    <span className="mt-0.5 block text-muted" lang={lang}>
                      {lang === 'de' ? diag.trap.why.de : diag.trap.why.en}
                    </span>
                  )}
                  {diag.wrong && diag.kind !== 'confusion' && (
                    <span className="lx-t-meta mt-0.5 block text-subtle" data-testid="werkstatt-wrong">
                      {t('pxWwWrong', { wrong: diag.wrong })}
                    </span>
                  )}
                </>,
                'werkstatt-row-diag',
              )}
              {lines.length > 0 &&
                row(
                  t('pxWwContrastLabel'),
                  <ul className="m-0 flex list-none flex-col gap-1.5 p-0" data-testid="werkstatt-contrast">
                    {lines.map((l, i) => (
                      <li key={i} className={`flex flex-wrap items-baseline gap-x-2 ${l.mine ? 'text-fg' : 'text-muted'}`} data-mine={l.mine ? '1' : '0'}>
                        <span className="sr-only">{t('pxWwThink')}:</span>
                        <span lang={diag.kind === 'false_friend' ? 'en' : lang}>{l.think}</span>
                        <span aria-hidden="true" className="text-subtle">
                          →
                        </span>
                        <span className="sr-only">{t('pxWwSay')}:</span>
                        <span lang="en" className={l.mine ? 'font-semibold' : undefined}>
                          {l.say}
                        </span>
                      </li>
                    ))}
                  </ul>,
                  'werkstatt-row-contrast',
                )}
              {parts.length > 1 &&
                row(
                  t('pxWwPartsLabel'),
                  <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0" lang="en" data-testid="werkstatt-parts">
                    {parts.map((p, i) => (
                      <li key={i} data-part={p.kind} className={`rounded-full px-2 py-0.5 ${p.kind === 'core' ? 'bg-accent-soft font-semibold text-fg' : 'bg-surface text-muted'}`}>
                        {p.text}
                      </li>
                    ))}
                  </ol>,
                  'werkstatt-row-parts',
                )}
              {card.context &&
                row(
                  t('pxWwSentenceLabel'),
                  <EnglishText as="p" testId="werkstatt-sentence" text={card.context.sentence} area="intro" source={card.path} title={card.word} highlight={[card.context.start, card.context.end]} />,
                  'werkstatt-row-sentence',
                )}
            </dl>
            <MemoPanel card={card} bundle={bundle} />
            {canPause(card.doc) && need === 'yes' && (
              <div className="flex flex-col gap-1 rounded-xl bg-surface p-3" data-testid="werkstatt-pause-box">
                <p className="lx-t-meta text-muted" lang={lang}>
                  {t('pxWwPauseHint', { n: lapses })}
                </p>
                <div>
                  <Button variant="ghost" icon="eyeOff" onClick={pause} data-testid="werkstatt-pause">
                    {t('pxWwPause')}
                  </Button>
                </div>
              </div>
            )}
            {need === 'ask' && (
              <div className="flex flex-col gap-2 rounded-xl bg-surface p-3" role="group" aria-labelledby={`wk-need-${card.id}`} data-testid="werkstatt-need">
                <p id={`wk-need-${card.id}`} className="lx-t-body font-semibold" lang={lang}>
                  {t('pxWwNeedQ')}
                </p>
                <p className="lx-t-meta text-muted" lang={lang}>
                  {t('pxWwNeedHint', { n: rounds })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setNeed('yes')} data-testid="werkstatt-need-yes">
                    {t('pxWwNeedYes')}
                  </Button>
                  <Button variant="ghost" onClick={pause} data-testid="werkstatt-need-no">
                    {t('pxWwNeedNo')}
                  </Button>
                </div>
              </div>
            )}
            <p className="lx-t-meta text-subtle" lang={lang}>
              {t('pxWwRest')}
            </p>
          </div>
        }
        primary={{ label: t('pxWwRecall'), onClick: recall, testId: 'werkstatt-recall', disabled: need === 'ask' }}
      />
    </div>
  );
}

/**
 * Merkhilfe: die eigene zuerst (gespeichert oder neu geschrieben), darunter zwei Vorschläge von Claude zum Auswählen. Vorgeladene Vorschläge bleiben
 * zugeklappt („Vorschläge ansehen“, Lernwissenschaft S6): Die eigene Merkhilfe hat Vorrang; auf Knopfdruck geholte Vorschläge sind gleich offen.
 */
function MemoPanel({ card, bundle }: { card: TrainCard; bundle: readonly MemoCard[] }) {
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const entry = useWkMemo((s) => (s.lang === lang ? s.items[card.key] : undefined));
  const initial = isOwnMnemo(card.doc) ? storedMnemo(card.doc, lang) : null;
  const older = !initial ? storedMnemo(card.doc, lang) : null;
  const [own, setOwn] = useState<string | null>(initial);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const save = async (text: string) => {
    const v = text.trim().slice(0, MNEMO_MAX);
    if (!v || busy) return;
    setBusy(true);
    const ok = await saveOwnMemo(card, v, lang);
    setBusy(false);
    if (ok) {
      setOwn(v);
      setDraft('');
      toast(t('pxWwMemoSaved'));
    } else toast(t('pxWwMemoSaveFailed'), 'error');
  };
  const ask = () => {
    setOpen(true);
    requestWkMemos(bundle, lang, 'user');
  };
  const labels = [t('pxWwMemoKeyword'), t('pxWwMemoScene')] as const;
  const fieldId = `wk-memo-${card.id}`;
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-surface p-3" aria-label={t('pxWwMemoLabel')} data-testid="werkstatt-memo">
      <p className="lx-eyebrow">{t('pxWwMemoLabel')}</p>
      {own && (
        <div className="flex flex-col gap-0.5" data-testid="werkstatt-memo-own">
          <p className="lx-t-meta text-subtle">{t('pxWwMemoOwnLabel')}</p>
          <p className="lx-t-body" lang={lang}>
            {own}
          </p>
        </div>
      )}
      {!own && older && (
        <div className="flex flex-col gap-0.5" data-testid="werkstatt-memo-older">
          <p className="lx-t-meta text-subtle">{t('pxWwMemoCurrent')}</p>
          <p className="lx-t-body" lang={lang}>
            {older}
          </p>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="lx-t-meta text-subtle">
          {t('pxWwMemoOwnLabel')}
        </label>
        <textarea
          id={fieldId}
          className="lx-field min-h-16"
          lang={lang}
          rows={2}
          value={draft}
          maxLength={MNEMO_MAX}
          placeholder={t('pxWwMemoOwnPh')}
          onChange={(e) => setDraft(e.target.value)}
          data-testid="werkstatt-memo-input"
        />
        <div>
          <Button variant="secondary" onClick={() => void save(draft)} disabled={!draft.trim()} busy={busy} data-testid="werkstatt-memo-save">
            {t('pxWwMemoSave')}
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 border-t border-line pt-2" data-testid="werkstatt-memo-ideas" data-phase={entry?.phase ?? (ai ? 'idle' : 'noai')}>
        <p className="lx-t-meta text-subtle">{t('pxWwMemoIdeas')}</p>
        {!ai ? (
          <p className="lx-t-meta text-muted" lang={lang}>
            {t('pxWwMemoNoAi')}
          </p>
        ) : entry?.phase === 'done' && entry.options && !open ? (
          <div>
            <Button variant="ghost" icon="sparkle" onClick={() => setOpen(true)} aria-expanded={false} data-testid="werkstatt-memo-show">
              {t('pxWwMemoShow')}
            </Button>
          </div>
        ) : entry?.phase === 'done' && entry.options ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="werkstatt-memo-list">
            {entry.options.map((o, i) => (
              <li key={i} className="flex flex-col gap-1 rounded-lg border border-line p-2.5" data-testid={`werkstatt-memo-option-${i}`}>
                <span className="lx-t-meta text-subtle">{labels[i]}</span>
                <span className="lx-t-support" lang={lang}>
                  {o}
                </span>
                <div>
                  <Button variant="ghost" onClick={() => void save(o)} disabled={busy || own === o} data-testid={`werkstatt-memo-pick-${i}`}>
                    {own === o ? t('pxWwMemoChosen') : t('pxWwMemoPick')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : entry?.phase === 'loading' ? (
          <p className="lx-t-meta text-muted" role="status" lang={lang}>
            {t('pxWwMemoLoading')}
          </p>
        ) : entry?.phase === 'budget' ? (
          <p className="lx-t-meta text-muted" lang={lang}>
            {t('pxWwMemoBudget')}
          </p>
        ) : (
          <>
            {entry?.phase === 'error' && (
              <p className="lx-t-meta text-danger-text" role="alert" lang={lang}>
                {t('pxWwMemoFailed')}
              </p>
            )}
            <div>
              <Button variant="ghost" icon="sparkle" onClick={ask} data-testid="werkstatt-memo-ask" data-ai="">
                {t('pxWwMemoAsk')}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
