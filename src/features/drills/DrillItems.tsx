import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { maskOf } from '../../domain/answer/mask';
import { checkCloze, type ClozeCheck, type ClozeItem } from '../../domain/drills/cloze';
import { missedWords, scoreDictation, type DictationScore } from '../../domain/drills/dictation';
import { checkOrder, type OrderCheck, type OrderItem } from '../../domain/drills/order';
import { orderExplanation } from '../../domain/drills/orderExplain';
import type { ExplainDepth, ExplanationModel, ResultVerdict } from '../../domain/explain/types';
import { topicById } from '../../domain/content';
import { radarEvent } from '../../domain/grammar/radar';
import { topicState } from '../../domain/grammar/path';
import { learnGrade } from '../../domain/learn/grade';
import type { Ctx, DrillAnswer, Help, RadarEvent, Verdict } from '../../domain/learn/types';
import { cardExamples } from '../../domain/srs/examples';
import { hash32 } from '../../domain/random';
import type { Grade } from '../../domain/srs/types';
import { EnglishText } from '../../engine/EnglishText';
import { useHiddenInput } from '../../engine/HiddenInput';
import { KineticGap, hintOffset } from '../../engine/KineticGap';
import { useSharedTarget } from '../../engine/shared';
import { Tiles } from '../../engine/Tiles';
import { TilesKeyboard } from '../../engine/TilesKeyboard';
import { useHotkeys } from '../../engine/useHotkeys';
import { lookupOpenMs, useLookup } from '../../engine/wordTap';
import { useT } from '../../i18n';
import type { InputProfile } from '../../platform/input';
import { speak, useSpeech } from '../../platform/speech';
import { Button } from '../../ui/Button';
import { ExerciseShell, SentenceInput, explainDepth, type ShellFeedback, type ShellMenuId, type ShellSecondary } from '../../ui/exercise';
import { AlsoRight, CopyOnce } from '../learn/ui';
import { nextT } from '../progress/persist';
import { orderTopic, useDrill } from './session';

// Die drei Übungen mit Einzelaufgaben (phase2-plan §5.4–5.6) im gemeinsamen Übungsgerüst (`ExerciseShell`, Lernplattform 2.0
// §4.2): Status, Aufgabenzeile, Satz, Eingabe, Urteil und Erklär-Karte an fester Stelle – auch bei richtiger Antwort. Die Note
// bestimmt die App. Das Eingabeprofil der Runde (`profile`) ist beim Start eingefroren; jede Antwort trägt es als `dev`.

type Next = 'typed' | 'choice' | null;
type ItemProps<T> = { item: T; ctx: Ctx; day: string; profile: InputProfile; onDone: (a: DrillAnswer, label: string) => Next };

const devOf = (p: InputProfile): 't' | 'k' => (p === 'touch' ? 't' : 'k');

function useTiming() {
  const shownAt = useRef(0);
  const lookupAt = useRef(0);
  const firstKeyAt = useRef<number | null>(null);
  useEffect(() => {
    shownAt.current = performance.now();
    lookupAt.current = lookupOpenMs();
  }, []);
  return {
    elapsed: () => Math.max(0, Math.round(performance.now() - shownAt.current - (lookupOpenMs() - lookupAt.current))),
    firstKey: (from?: number) => (firstKeyAt.current === null ? undefined : Math.max(0, Math.round(firstKeyAt.current - (from ?? shownAt.current)))),
    markKey: () => {
      if (firstKeyAt.current === null) firstKeyAt.current = performance.now();
    },
  };
}

/** Hülle einer Aufgabe: Heldenkarte von Heute gleitet in die erste Aufgabe (Kap. 4.4); die Karte selbst zeichnet das Gerüst. */
function Item({ kind, topic = null, pat = null, children }: { kind: string; topic?: string | null; pat?: string | null; children: ReactNode }) {
  const { ref: sharedRef, shared } = useSharedTarget<HTMLDivElement>('lx-hero');
  return (
    <div ref={sharedRef} data-shared={shared ? '' : undefined} data-testid="drill-item" data-kind={kind} data-topic={topic ?? undefined} data-pat={pat ?? undefined} className="outline-none">
      {children}
    </div>
  );
}

const rvOf = (v: Verdict, override = false): ResultVerdict => (override ? 'ok' : v === 'correct' ? 'ok' : v === 'near' ? 'near' : 'wrong');

// ------------------------------------------------------------------ Diktat

export function DictationItem({ item, ctx, day, profile, onDone }: ItemProps<{ s: string; src: string; ref: string | null }>) {
  const { t, lang } = useT();
  const tts = useSpeech((s) => s.status === 'ready');
  const timing = useTiming();
  const [text, setText] = useState('');
  const plays = useRef(0);
  const [slow, setSlow] = useState(false);
  const [fb, setFb] = useState<{ score: DictationScore; grade: Grade; ms: number; given: string; override: boolean; replays: number } | null>(null);
  const audioEnd = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const play = (rate?: number) => {
    plays.current += 1;
    void speak(item.s, rate ? { rate } : {}).then((o) => {
      if (o === 'done' && audioEnd.current === null) audioEnd.current = performance.now();
    });
  };

  useEffect(() => {
    // Der Satz spielt einmal automatisch (§5.4).
    play();
    root.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim ersten Zeigen
  }, []);

  const check = () => {
    if (fb || !text.trim()) return;
    const replays = Math.max(0, plays.current - 1);
    const help: Help = { level: slow ? 1 : 0, replays };
    const score = scoreDictation(text, item.s, { helpLevel: help.level });
    const ms = timing.elapsed();
    const grade = learnGrade('dictate', score.verdict, { submitMs: ms, firstKeyMs: timing.firstKey(audioEnd.current ?? undefined), replays }, help);
    setFb({ score, grade, ms, given: text, override: false, replays });
  };

  const next = () => {
    if (!fb) return;
    const verdict: Verdict = fb.override ? 'correct' : fb.score.verdict;
    const tNow = nextT();
    const radar: RadarEvent | undefined = fb.score.typo > 0 && item.src === 'card' ? radarEvent('spelling', 'v', tNow, { q: item.s, g: fb.given, a: item.s }) : undefined;
    const a: DrillAnswer = { kind: 'x', t: tNow, day, lang, ctx, type: 'dictate', q: item.s, given: fb.given, ans: item.s, verdict, grade: fb.override ? 3 : fb.grade, ms: fb.ms, dev: devOf(profile), ...(radar ? { radar } : {}), ...(fb.override ? { override: true } : {}) };
    onDone(a, item.s);
  };

  useHotkeys({ enter: () => (useLookup.getState().req ? undefined : fb ? next() : undefined) }, () => false);

  const missed = fb ? missedWords(fb.score.ops) : [];
  const verdict = fb ? rvOf(fb.score.verdict, fb.override) : 'ok';
  const explanation: ExplanationModel | null = fb && missed.length > 0 ? { lines: [{ k: 'note', text: t('drMissed', { words: missed.join(', ') }) }], examples: [], mark: [], ai: false, source: 'fallback' } : null;
  const depth: ExplainDepth = explainDepth({ verdict, learning: false });
  const menu: Partial<Record<ShellMenuId, () => void>> = {};
  if (fb && fb.score.verdict === 'wrong' && !fb.override) menu.override = () => setFb({ ...fb, override: true });
  const feedback: ShellFeedback | null = fb
    ? {
        verdict,
        sub: fb.override ? t('lrOverridden') : null,
        comparison: fb.score.verdict === 'correct' || fb.override ? null : { given: fb.given, ops: fb.score.ops },
        explanation,
        depth,
        menu,
        auto: fb.score.verdict === 'correct' && !slow && fb.replays <= 2 && !fb.override,
      }
    : null;

  const prompt = fb ? (
    <div className="flex flex-col gap-2">
      <EnglishText as="p" text={item.s} area="trainer" source={item.ref} testId="dictate-sentence" />
      {tts && (
        <div>
          <Button variant="ghost" icon="speaker" onClick={() => void speak(item.s)} data-testid="drill-listen-again">
            {t('drListenAgain')}
          </Button>
        </div>
      )}
    </div>
  ) : (
    tts && (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" icon="speaker" onClick={() => play()} data-testid="drill-replay">
          {t('drReplay')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setSlow(true);
            play(0.8);
          }}
          data-testid="drill-slow"
        >
          {t('drSlow')}
        </Button>
      </div>
    )
  );

  return (
    <Item kind="dictate">
      <div ref={root}>
        <ExerciseShell
          meta={{ ex: 'drill_dictate', id: `dictate|${hash32(item.s)}`, kind: 'dictate' }}
          status={{ area: 'words', state: null, kindLabel: t('drDictate') }}
          task={{ text: t('drTaskDictate'), purpose: t('purposeDictate') }}
          prompt={prompt || null}
          answer={<SentenceInput mode="free" value={text} onChange={(v) => { timing.markKey(); setText(v); }} onSubmit={() => (fb ? next() : check())} disabled={!!fb} testId="dictate-input" />}
          primary={fb ? { label: t('exNext'), onClick: next, testId: 'next' } : { label: t('exCheck'), onClick: check, testId: 'check', disabled: !text.trim() }}
          feedback={feedback}
        />
      </div>
    </Item>
  );
}

// ------------------------------------------------------------------ Lückenjagd

export function ClozeItemView({ item, ctx, day, profile, onDone }: ItemProps<ClozeItem>) {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const timing = useTiming();
  const card = useDrill((s) => s.cards.get(item.cardId));
  const allCols = useDrill((s) => s.allCols);
  const [tip, setTip] = useState<0 | 1 | 2>(0);
  const [fb, setFb] = useState<{ res: ClozeCheck; grade: Grade; ms: number; given: string; override: boolean; help: Help } | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const typed = useRef('');
  const mask = tip > 0 ? maskOf(item.gap, { firstLetter: tip >= 2 }) : null;
  const help: Help = { level: tip };

  const check = () => {
    if (fb) return;
    let given = typed.current;
    if (tip >= 2 && mask) {
      const first = mask[0];
      if (first?.kind === 'slot' && first.hint && hintOffset(mask, given) === 1) given = first.hint + given;
    }
    if (!given.trim()) return;
    const res = checkCloze(item, given, { allCols });
    const ms = timing.elapsed();
    const grade = learnGrade('cloze', res.verdict, { submitMs: ms, firstKeyMs: timing.firstKey() }, help);
    setFb({ res, grade, ms, given, override: false, help });
    if (profile === 'touch') api.blur();
  };

  const next = () => {
    if (!fb) return;
    const tNow = nextT();
    const verdict: Verdict = fb.override ? 'correct' : fb.res.verdict;
    const radar = fb.res.kind === 'confusable' && !fb.override ? radarEvent('wordchoice', 'v', tNow, { q: item.sentence.sentence, g: fb.given, a: item.gap }) : undefined;
    const a: DrillAnswer = { kind: 'x', t: tNow, day, lang, ctx, type: 'cloze', q: item.sentence.sentence, given: fb.given, ans: item.gap, verdict, grade: fb.override ? 3 : fb.grade, ms: fb.ms, dev: devOf(profile), ...(radar ? { radar } : {}), ...(fb.override ? { override: true } : {}) };
    const kind = onDone(a, item.phrase);
    if (kind === 'typed') api.focusNow();
    else api.blur();
  };

  useHotkeys({ enter: () => (useLookup.getState().req ? undefined : fb ? next() : check()) }, api.isInput);

  const s = item.sentence;
  const verdict = fb ? rvOf(fb.res.verdict, fb.override) : 'ok';
  const examples = card ? cardExamples(card, s.sentence).map((x) => ({ en: x.en })).slice(0, 2) : [];
  const sub: string | null = !fb
    ? null
    : fb.override
      ? t('lrOverridden')
      : fb.res.us
        ? t('trUsHint', { us: fb.res.us })
        : fb.res.kind === 'uk'
          ? t('trVerdictUk')
          : fb.res.kind === 'form'
            ? t('trVerdictForm')
            : fb.res.kind === 'typo'
              ? t('trVerdictTypo')
              : null;
  const explanation: ExplanationModel | null = fb
    ? {
        lines: fb.res.belongsTo.length > 0 ? [{ k: 'why', text: t('clBelongs', { given: fb.given.trim(), list: fb.res.belongsTo.join(', ') }) }] : [],
        examples,
        mark: [],
        ai: false,
        source: 'card',
      }
    : null;
  const menu: Partial<Record<ShellMenuId, () => void>> = {};
  if (fb && fb.res.verdict === 'wrong' && !fb.override) {
    menu.override = () => setFb({ ...fb, override: true });
    menu.copyOnce = () => setCopyOpen(true);
  }
  const feedback: ShellFeedback | null = fb
    ? { verdict, sub, explanation, depth: explainDepth({ verdict, stage: card?.stage ?? null, learning: false }), menu, auto: fb.res.verdict === 'correct' && fb.help.level === 0 && !fb.override }
    : null;
  const secondary: ShellSecondary[] = !fb && tip < 2 ? [{ id: 'hint', label: tip === 0 ? t('trTip') : t('trTipLetter'), onClick: () => { setTip((v) => (v === 0 ? 1 : 2)); api.focusNow(); }, testId: 'hint' }] : [];
  const gapState = !fb ? 'input' : fb.override ? 'correct' : fb.res.verdict;

  return (
    <Item kind="cloze">
      <ExerciseShell
        meta={{ ex: 'drill_cloze', id: `cloze|${item.cardId}|${hash32(s.sentence)}`, kind: 'cloze' }}
        status={{ area: 'words', state: null, kindLabel: t('drCloze') }}
        task={{ text: t('drTaskCloze'), purpose: t('purposeColloc') }}
        prompt={
          <div className="flex flex-col gap-2">
            <EnglishText
              as="p"
              testId="sentence"
              text={s.sentence}
              area="trainer"
              source={`vocab/${item.cardId}`}
              slot={{
                start: s.start,
                end: s.end,
                node: (
                  <KineticGap
                    label={t('trGapLabel', { sentence: `${s.sentence.slice(0, s.start)}…${s.sentence.slice(s.end)}` })}
                    maxLength={Math.max(30, item.gap.length + 10)}
                    state={gapState}
                    mask={mask}
                    shown={fb ? fb.given : null}
                    reveal={fb && fb.res.verdict === 'wrong' && !fb.override ? { solution: item.gap, given: fb.given.trim() ? fb.given : null } : null}
                    silent
                    onChange={(v, info) => {
                      typed.current = v;
                      if (info.firstKey) timing.markKey();
                    }}
                    onEnter={() => (fb ? next() : check())}
                  />
                ),
              }}
            />
            {item.de && lang === 'de' && (
              <p className="lx-t-support text-muted" data-testid={fb ? 'meaning' : 'cue'} lang="de">
                {fb ? `${item.phrase} – ${item.de}` : t('clCue', { de: item.de })}
              </p>
            )}
          </div>
        }
        answer={fb && copyOpen && fb.res.verdict === 'wrong' ? <CopyOnce solution={item.gap} /> : null}
        secondary={secondary}
        primary={fb ? { label: t('exNext'), onClick: next, testId: 'next' } : { label: t('exCheck'), onClick: check, testId: 'check' }}
        feedback={feedback}
      />
    </Item>
  );
}

// ------------------------------------------------------------------ Satzbau

export function OrderItemView({ item, ctx, day, profile, onDone }: ItemProps<OrderItem>) {
  const { t, lang } = useT();
  const timing = useTiming();
  const now = useClock((s) => s.now);
  const [placed, setPlaced] = useState<number[]>([]);
  const [fb, setFb] = useState<{ res: OrderCheck; grade: Grade; ms: number } | null>(null);
  const topic = orderTopic(item);
  const doc = useLive((s) => (topic ? s.collections.grammar?.get(topic) : undefined));
  const tp = topic ? topicById(topic) : null;
  const topicLabel = tp ? (lang === 'en' ? (tp.name_en ?? tp.name) : tp.name) : null;
  // Die Punkte kommen aus der Beherrschung des Themas des Satzes (nie `null` bei bekanntem Thema, nie ein falsches „Neu“).
  const state = tp && topic ? topicState(topic, doc, now) : null;
  const byId = useMemo(() => new Map(item.tiles.map((x) => [x.id, x])), [item]);
  const slots = item.tiles.filter((x) => !x.distractor).length;
  // Hilfen (Emrah 02.10.2026, nach Beratung Englischlehrer + Lernwissenschaft): Tipp 1 nennt einen guten Anfang
  // (Hilfe 1), Tipp 2 legt die ersten zwei Bausteine nach vorn (Hilfe 2, zweite Information). Die deutsche
  // Bedeutung steht immer da und ist keine Hilfe.
  const [tip, setTip] = useState<0 | 1 | 2>(0);
  const first = item.solution[0] ?? '';
  const second = item.solution[1] ?? '';
  const leadIds = [first, second].map((x) => item.tiles.find((tile) => tile.text === x && !tile.distractor)?.id).filter((id): id is number => id !== undefined);
  const showTip = () => {
    if (tip === 0) setTip(1);
    else {
      setTip(2);
      setPlaced([...leadIds, ...placed.filter((id) => !leadIds.includes(id))]);
    }
  };

  const check = () => {
    if (fb || !placed.length || placed.length < slots) return;
    const res = checkOrder(item, placed);
    const ms = timing.elapsed();
    const grade = learnGrade('order', res.verdict, { submitMs: ms, units: item.tiles.length }, { level: tip });
    setFb({ res, grade, ms });
  };

  const next = () => {
    if (!fb) return;
    const given = placed.map((id) => byId.get(id)?.text ?? '').join(' ');
    const a: DrillAnswer = { kind: 'x', t: nextT(), day, lang, ctx, type: 'order', q: item.sentence, given, ans: item.sentence, verdict: fb.res.verdict, grade: fb.grade, ms: fb.ms, dev: devOf(profile) };
    onDone(a, item.sentence);
  };

  useHotkeys({ enter: () => (useLookup.getState().req ? undefined : fb ? next() : check()) }, () => false);

  const marks: Record<number, 'ok' | 'off' | 'near'> = {};
  if (fb) {
    placed.forEach((id, i) => {
      const tile = byId.get(id);
      marks[id] = tile?.distractor || (fb.res.misplaced.includes(i) && fb.res.verdict === 'wrong') ? 'off' : fb.res.misplaced.includes(i) ? 'near' : 'ok';
    });
    // Der Fallen-Baustein ist auch ungelegt als falsch gekennzeichnet (✕), damit klar ist, warum er nicht dazugehört.
    for (const tile of item.tiles) if (tile.distractor) marks[tile.id] = 'off';
  }
  const verdict: ResultVerdict = fb ? rvOf(fb.res.verdict) : 'ok';
  const usedTrap = !!fb?.res.usedDistractor;
  const model = fb ? orderExplanation({ item, lang, usedTrap, topicName: topicLabel, verdict }) : null;
  // Die Erklärung gehört zum Satz und steht immer da (Warum je Satz): mindestens „kurz“, nie die Einzeile; Satzbau geht nie automatisch weiter.
  const base = explainDepth({ verdict, learning: false });
  const depth: ExplainDepth = verdict !== 'ok' ? 'full' : base === 'min' ? 'short' : base;
  const sub = !fb ? null : fb.res.verdict === 'correct' ? (tip > 0 ? t('drVerdictHelp') : null) : fb.res.verdict === 'near' ? t('drVerdictNear') : null;
  const feedback: ShellFeedback | null = fb && model ? { verdict, sub, explanation: model, depth, auto: false } : null;
  const secondary: ShellSecondary[] = fb
    ? []
    : [
        ...(tip < 2 ? [{ id: 'hint' as const, label: tip === 0 ? t('exHint') : t('drTipFirst'), onClick: showTip, testId: 'hint' }] : []),
        ...(placed.length > 0 ? [{ id: 'reset' as const, label: t('drReset'), onClick: () => setPlaced([]), testId: 'tiles-reset' }] : []),
      ];
  const onTiles = (p: number[]) => {
    timing.markKey();
    setPlaced(p);
  };
  const hint = !fb && tip >= 1 ? { text: tip >= 2 ? t('drTipPlaced', { first, second }) : t('drTipStart', { first }), tone: 'hint' as const } : null;

  return (
    <Item kind="order" topic={topic} pat={item.pat ?? null}>
      <ExerciseShell
        meta={{ ex: 'drill_order', id: item.key, kind: 'order' }}
        status={{ area: 'grammar', state, kindLabel: t('drOrder'), topic: topicLabel }}
        task={{ text: t('fxOTaskOrder'), purpose: t('purposeOrder') }}
        prompt={
          <div className="flex flex-col gap-1" data-testid="order-meaning">
            <p lang="de" data-testid="order-de">
              {item.de}
            </p>
            {item.ai && (
              <p className="lx-t-meta text-muted" data-testid="order-ai">
                {t('drOrderAi')}
              </p>
            )}
          </div>
        }
        answer={
          <div className="flex flex-col gap-3">
            <Tiles
              tiles={item.tiles}
              placed={placed}
              onChange={onTiles}
              locked={!!fb}
              {...(fb ? { marks } : {})}
              labels={{ line: t('drTileLine'), pool: t('drTilePool') }}
              markLabels={{ ok: t('drMarkOk'), near: t('drMarkNear'), off: t('drMarkOff') }}
              slots={slots}
            />
            {!fb && profile === 'keys' && (
              <TilesKeyboard tiles={item.tiles} placed={placed} onChange={onTiles} onSubmit={check} locked={!!fb} mode="words" label={t('trTilesTypeLabel')} hint={t('trTilesTypeHint')} unknown={(tok) => t('trTilesTypeMiss', { word: tok })} />
            )}
            {!fb && item.end && (
              <p className="lx-t-support text-subtle" data-testid="order-end">
                {t('drEnd', { end: item.end.startsWith('?') ? t('drEndQuestion') : item.end.startsWith('!') ? t('drEndExclaim') : t('drEndDot') })}
              </p>
            )}
            {fb && (
              <div className="flex flex-col gap-2" data-testid="order-result">
                <p className="lx-t-support">
                  <span className="text-muted">{t('grCorrect')}: </span>
                  <EnglishText as="span" className="font-semibold" text={item.sentence} area="trainer" source={topic ? `grammar/${topic}` : null} testId="diff-correct" />
                </p>
                <AlsoRight answers={item.alts} notes={[]} />
              </div>
            )}
          </div>
        }
        hint={hint}
        secondary={secondary}
        primary={fb ? { label: t('exNext'), onClick: next, testId: 'next' } : { label: t('exCheck'), onClick: check, testId: 'check', disabled: placed.length < slots }}
        feedback={feedback}
      />
    </Item>
  );
}
