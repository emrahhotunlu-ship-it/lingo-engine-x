import { useMemo, useState } from 'react';
import { EnglishText } from '../../engine/EnglishText';
import { Choices } from '../../engine/Choices';
import { SpeakButton } from '../../engine/SpeakButton';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useHotkeys } from '../../engine/useHotkeys';
import { packExtraOf } from '../../domain/c1pack/packFields';
import { ipaOf } from '../../domain/lexicon/pron';
import { meaningOf, shortMeaning } from '../../domain/srs/cards';
import { buildExercise } from '../../domain/srs/exercise';
import { reportViolations } from '../../domain/srs/guard';
import { supports } from '../../domain/srs/modes';
import { posKey } from '../../domain/srs/explain';
import { registerOf } from '../../domain/srs/explainWord';
import { chunkParts, chunkWhy } from '../../domain/srs/chunkCards';
import { trapForCard } from '../../domain/srs/traps';
import type { TrainCard } from '../../domain/srs/types';
import { useT, type MessageKey } from '../../i18n';
import { ExerciseShell, type ShellSecondary } from '../../ui/exercise';
import { continueIntro, startKnownProbe, useSession, type FirstKind } from './session';

// Einführung einer neuen Karte (Lernplattform 2.0 §5.6): 0) „Was heißt das hier?“ (`ctx_mc`) vorab, ohne Planung – das Gehirn sucht schon,
// bevor die Antwort kommt (Pretesting). 1) Feste Zeilen: Wort ▶ mit US-Lautschrift · Bedeutung im Satz · So benutzt man es (Wortpartner) ·
// Register · Vorsicht (Deutsch-Falle, nur wenn es eine gibt) · Wortfamilie. „Kenne ich“ startet keine Behauptung, sondern eine Prüffrage.
// Schreibt nichts: die Karte wird erst bei der ersten Antwort geplant.

/** Bedeutung eines Platzhalters der Wendung: jemand, etwas oder ein Besitzwort (sein/ihr). */
const slotKey = (w: string): MessageKey => (/^someone's$/i.test(w) ? 'wxSlotPersonPoss' : /^one's$/i.test(w) ? 'wxSlotPoss' : /^(sth|something)$/i.test(w) ? 'wxSlotThing' : 'wxSlotPerson');

export function IntroCard({ card, onDone }: { card: TrainCard; onDone: (kind: FirstKind) => void }) {
  const pool = useSession((s) => s.pool);
  const lang0 = useSession((s) => s.lang);
  const day0 = useSession((s) => s.day);
  // Wächter (Q1): Vorab-Frage nur, wenn die Aufgabe R1–R12 besteht (sonst gleich zur Karte).
  const ask = useMemo(() => supports(card, 'ctx_mc', lang0, pool.length - 1) && reportViolations(buildExercise(card, 'ctx_mc', lang0, pool, `${day0}|intro`), card, lang0).length === 0, [card, lang0, pool, day0]);
  const [step, setStep] = useState<'ask' | 'learn'>(ask ? 'ask' : 'learn');
  return step === 'ask' ? <Ask card={card} onNext={() => setStep('learn')} /> : <Learn card={card} onDone={onDone} />;
}

/** Vorab-Frage: drei deutsche Optionen oder „Weiß ich nicht“, etwa 5 Sekunden, ohne FSRS-Buchung. */
function Ask({ card, onNext }: { card: TrainCard; onNext: () => void }) {
  const { t, lang } = useT();
  const pool = useSession((s) => s.pool);
  const day = useSession((s) => s.day);
  const e = useMemo(() => buildExercise(card, 'ctx_mc', lang, pool, `${day}|intro`), [card, lang, pool, day]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<'ok' | 'wrong' | 'dontKnow' | null>(null);
  const correct = e.options.findIndex((o) => o.correct);
  const reveal = (kind: 'ok' | 'wrong' | 'dontKnow') => setRevealed(kind);
  const check = () => {
    if (chosen === null) return;
    reveal(e.options[chosen]?.correct ? 'ok' : 'wrong');
  };
  const sentence = e.sentence;
  const secondary: ShellSecondary[] = revealed ? [] : [{ id: 'dontKnow', label: t('exDontKnow'), onClick: () => reveal('dontKnow'), testId: 'intro-ask-dontknow' }];
  return (
    <ExerciseShell
      meta={{ ex: 'ctx_mc', id: `${card.id}:intro`, kind: card.kind }}
      status={{ area: 'words', state: null, kindLabel: t('wxIntroAskKind') }}
      task={{ text: t('task_ctx_mc'), purpose: t('introPurpose') }}
      prompt={
        sentence ? (
          <EnglishText as="p" testId="sentence" text={sentence.sentence} area="intro" source={card.path} title={card.word} highlight={[sentence.start, sentence.end]} exclude={revealed ? null : [sentence.start, sentence.end]} />
        ) : null
      }
      answer={<Choices options={e.options.map((o) => o.label)} langs={e.options.map((o) => o.lang)} chosen={chosen} correct={correct >= 0 ? correct : null} revealed={revealed !== null} onPick={(i) => revealed === null && setChosen(i)} lang={lang} collapse={false} label={t('trChoicesLabel')} testId="choices" />}
      secondary={secondary}
      primary={revealed ? { label: t('wxIntroNext'), onClick: onNext, testId: 'intro-ask-next' } : { label: t('exCheck'), onClick: check, testId: 'check', disabled: chosen === null }}
      feedback={
        revealed
          ? { verdict: revealed === 'ok' ? 'ok' : revealed === 'dontKnow' ? 'dontKnow' : 'wrong', depth: 'min', explanation: null }
          : null
      }
    />
  );
}

function Learn({ card, onDone }: { card: TrainCard; onDone: (kind: FirstKind) => void }) {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const meaning = meaningOf(card, lang);
  const extra = packExtraOf(card);
  const reg = registerOf(card);
  const trap = trapForCard(card);
  const ipa = ipaOf(card.word);
  const pk = posKey(card.pos);
  const col = extra?.col?.[0]?.en ?? card.col.find((c) => c.p)?.p ?? null;
  const parts = card.kind === 'chunk' ? chunkParts(card.word, { cat: extra?.cat }) : [];
  const fixedPhrase = parts.length > 1 && parts.every((p) => p.kind === 'fixed' || p.kind === 'slot');
  const chunkReason = card.kind === 'chunk' ? chunkWhy(card, lang) : null;
  const fam = extra?.fam ? Object.entries(extra.fam).filter(([, w]) => !!w) : [];
  const go = () => {
    const kind = continueIntro();
    if (kind === 'typed') api.focusNow();
    else api.blur();
    onDone(kind);
  };
  const known = () => {
    const kind = startKnownProbe();
    if (kind === 'typed') api.focusNow();
    else api.blur();
    onDone(kind);
  };
  useHotkeys({ enter: go }, api.isInput);
  const meanings = (meaning ?? '').split(/\s*;\s*/).filter(Boolean);
  const row = (label: string, body: React.ReactNode, testId: string) => (
    <div className="flex flex-col gap-1 border-t border-line py-2.5 first:border-t-0 sm:grid sm:grid-cols-[8rem_1fr] sm:items-baseline sm:gap-3" data-testid={testId}>
      <dt className="lx-t-label min-w-0 break-words text-subtle">{label}</dt>
      <dd className="lx-t-support m-0 min-w-0">{body}</dd>
    </div>
  );
  const secondary: ShellSecondary[] = card.kind === 'vocab' ? [{ id: 'skip', label: t('wxIntroKnown'), onClick: known, testId: 'intro-known' }] : [];
  return (
    <div data-testid="intro" data-card={card.id}>
      <ExerciseShell
        meta={{ ex: 'intro', id: card.id, stage: 0, kind: card.kind }}
        status={{ area: 'words', state: 'new', kindLabel: t('wxIntroKind') }}
        task={{ text: t('wxIntroTitle'), purpose: t('introPurpose') }}
        prompt={
          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-2" lang="en" data-testid="intro-word">
              <span className="lx-t-title">{card.word}</span>
              <SpeakButton text={card.word} testId="intro-listen" />
            </p>
            {ipa && (
              <p className="lx-t-meta text-muted" lang="en" data-testid="intro-ipa">
                {ipa}
              </p>
            )}
          </div>
        }
        answer={
          <dl className="m-0 flex flex-col">
            {meanings.length > 0 &&
              row(
                t('wxIntroMeaning'),
                <>
                  <span lang={lang} className="lx-t-body" data-testid="intro-meaning">
                    {meanings.map((m) => shortMeaning(m, lang)).join(' · ')}
                    {pk && <span className="text-muted"> · {t(pk as MessageKey)}</span>}
                  </span>
                  {card.context && (
                    <EnglishText
                      as="p"
                      className="mt-1"
                      testId="origin-sentence"
                      text={card.context.sentence}
                      area="intro"
                      source={card.path}
                      title={card.word}
                      highlight={[card.context.start, card.context.end]}
                    />
                  )}
                  {card.doc.exMark === 'atlas' && (
                    <span className="lx-t-meta mt-0.5 block text-subtle" data-testid="intro-atlas-note">
                      {t('wxExFromAtlas')}
                    </span>
                  )}
                </>,
                'intro-row-meaning',
              )}
            {parts.length > 1 &&
              row(
                t('wxIntroParts'),
                <>
                  <span lang="en" className="lx-t-body" data-testid="intro-parts">
                    {parts.map((p, i) => (
                      <span key={i} data-part={p.kind} className={p.kind === 'core' ? 'font-semibold text-fg' : p.kind === 'frame' ? 'text-muted' : p.kind === 'fixed' ? 'text-fg' : 'italic text-subtle'}>
                        {i > 0 ? ' ' : ''}
                        {p.text}
                      </span>
                    ))}
                  </span>
                  <span className="lx-t-meta mt-0.5 block text-subtle" lang={lang} data-testid="intro-parts-legend">
                    {(fixedPhrase
                      ? [t('wxIntroFixed')]
                      : [
                          t('wxIntroCore', { words: parts.filter((p) => p.kind === 'core').map((p) => p.text).join(', ') }),
                          parts.some((p) => p.kind === 'frame') ? t('wxIntroFrame', { words: parts.filter((p) => p.kind === 'frame').map((p) => p.text).join(', ') }) : null,
                        ]
                    )
                      .concat(parts.filter((p) => p.kind === 'slot').map((p) => `${p.text} = ${t(slotKey(p.text))}`))
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </>,
                'intro-row-parts',
              )}
            {chunkReason && row(t('wxIntroWhy'), <span lang={lang}>{chunkReason}</span>, 'intro-row-why')}
            {col &&
              row(
                t('wxIntroUse'),
                <span lang="en" className="font-medium">
                  {col}
                </span>,
                'intro-row-use',
              )}
            {reg && row(t('wxIntroReg'), <span className="inline-block rounded-full bg-surface px-2 py-0.5">{t(`wxReg_${reg}` as MessageKey)}</span>, 'intro-row-register')}
            {trap &&
              row(
                t('wxIntroCare'),
                <span lang={lang}>
                  {lang === 'de' ? trap.why.de : trap.why.en}
                  <span className="mt-0.5 block text-muted" lang="en">
                    ✕ {trap.wrong} → ✓ {trap.right}
                  </span>
                </span>,
                'intro-row-care',
              )}
            {fam.length > 1 &&
              row(
                t('wxIntroFam'),
                <span lang="en">
                  {fam.map(([k, w], i) => (
                    <span key={k}>
                      {i > 0 && <span className="text-subtle"> · </span>}
                      {w}
                    </span>
                  ))}
                </span>,
                'intro-row-family',
              )}
          </dl>
        }
        secondary={secondary}
        primary={{ label: t('introContinue'), onClick: go, testId: 'intro-continue' }}
      />
    </div>
  );
}
