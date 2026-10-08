import { useEffect, useMemo, useRef, useState } from 'react';
import { useClock } from '../../../app/clock';
import { loadPacked } from '../../../content/store';
import { invalidIdsOf, useLive } from '../../../data/live';
import { readC1 } from '../../../domain/c1/c1doc';
import { liveTopics } from '../../../domain/c1/chapters';
import { gateOutcome, gateEntry, nextTryAfter, type GateTally } from '../../../domain/c1/gate/score';
import { saveGate } from '../../../domain/c1/gate/save';
import { correctSentence, gateRound } from '../../../domain/c1/gate/select';
import { attemptsOf } from '../../../domain/c1/gate/trigger';
import { chapterWords, type GateWord } from '../../../domain/c1/gate/words';
import type { ProgramChapter } from '../../../domain/c1/programTypes';
import type { C1Item } from '../../../domain/c1x/types';
import { introDay } from '../../../domain/grammar/path';
import { buildTrainCards } from '../../../domain/metrics';
import { buildChunkCards } from '../../../domain/srs/chunkCards';
import { useT } from '../../../i18n';
import { logWarn } from '../../../platform/diagnostics';
import { ActionBar, PrimaryAction } from '../../../ui/ActionBar';
import { Button } from '../../../ui/Button';
import { Sheet } from '../../../ui/Sheet';
import { offerLevelUp } from '../../../ui/moments/store';
import { levelUpFor } from '../../../domain/moments/detect';
import { claimMilestone } from '../../today/milestoneClaim';
import { PlacementItem } from '../PlacementItem';
import { GateResult, type GateResultData } from './GateResult';
import { GateWordItem } from './GateWordItem';

// Kapitelprüfung (Lernplattform 3.0 §4.4, P42): ein Blatt mit zwei Teilen. Teil 1 Grammatik (2 ungesehene freie Aufgaben je Thema aus dem Vorrat
// `c1x-gate`), Teil 2 acht Kapitelwörter frei getippt. Keine Tipps, keine Rückmeldung während der Prüfung, nichts wird gebucht (weder Muster noch
// Karten). Abbrechen speichert nichts. Am Ende wird genau ein Versuch in `app/c1.gates` angehängt (`saveGate`); bei Bestehen wird der Meilenstein
// `ch<n>` beansprucht (einmal über alle Geräte) und der Aufstieg gezeigt. Bestehen ändert weder Serie noch Pflicht.

type Phase = 'intro' | 'loading' | 'grammar' | 'words' | 'result' | 'empty';
type GAnswer = { id: string; topic: string; ok: boolean; sentence: string | null };
type WAnswer = { key: string; ok: boolean; sentence: string };

const EMPTY = new Map<string, Record<string, unknown>>();

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-strong" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}

function Flow({ chapter, onClose }: { chapter: ProgramChapter; onClose: () => void }) {
  const { t, lang } = useT();
  const today = useClock((s) => s.today);
  const now = useClock((s) => s.now);
  const grammarDocs = useLive((s) => s.collections.grammar) ?? EMPTY;
  const vocab = useLive((s) => s.collections.vocab) ?? EMPTY;
  const chunk = useLive((s) => s.collections.chunk) ?? EMPTY;
  const c1Raw = useLive((s) => s.docs['app/c1']);
  const profile = useLive((s) => s.docs['app/profile']);
  const attempt = useMemo(() => attemptsOf(readC1(c1Raw).gates, chapter.n).length, [c1Raw, chapter.n]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [items, setItems] = useState<C1Item[]>([]);
  const [words, setWords] = useState<GateWord[]>([]);
  const [gi, setGi] = useState(0);
  const [wi, setWi] = useState(0);
  const [gAns, setGAns] = useState<GAnswer[]>([]);
  const [wAns, setWAns] = useState<WAnswer[]>([]);
  const [result, setResult] = useState<GateResultData | null>(null);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'failed'>('saving');
  const alive = useRef(true);
  const saved = useRef(false);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const live = useMemo(() => liveTopics(chapter), [chapter]);

  const start = (): void => {
    setPhase('loading');
    // Der Prüfungsvorrat ist ein eigenes Bündel (`c1x-gate`); er gelangt nie in den Speicher des Trainings (`preload`).
    void loadPacked<C1Item>('c1x-gate')
      .catch((err: unknown) => {
        logWarn('gate:load', err);
        return null;
      })
      .then((doc) => {
        if (!alive.current) return;
        const round = gateRound(doc?.items ?? [], chapter, attempt, live);
        if (!round.length) {
          setPhase('empty');
          return;
        }
        try {
          const live2 = useLive.getState();
          const cards = [...buildTrainCards(vocab, now, invalidIdsOf(live2.invalid, 'vocab')), ...buildChunkCards(chunk, now, invalidIdsOf(live2.invalid, 'chunk'))];
          const since = live.map((tp) => introDay(grammarDocs.get(tp))).filter((d): d is string => d !== null).sort()[0] ?? null;
          setWords(chapterWords({ cards, since, seed: `${chapter.id}:${attempt}:${today}` }));
        } catch (err) {
          logWarn('gate:words', err);
          setWords([]);
        }
        setItems(round);
        setGi(0);
        setPhase('grammar');
      });
  };

  const finish = (g: GAnswer[], w: WAnswer[]): void => {
    const byTopic = new Map<string, { right: number; total: number }>();
    for (const a of g) {
      const cur = byTopic.get(a.topic) ?? { right: 0, total: 0 };
      cur.total++;
      if (a.ok) cur.right++;
      byTopic.set(a.topic, cur);
    }
    const tally: GateTally = {
      chapter: chapter.n,
      g: [g.filter((a) => a.ok).length, g.length],
      w: [w.filter((a) => a.ok).length, w.length],
      topics: [...byTopic].map(([topic, v]) => ({ topic, ...v })),
    };
    const outcome = gateOutcome(tally);
    const proofs = [...g.filter((a) => a.ok).map((a) => a.sentence), ...w.filter((a) => a.ok).map((a) => a.sentence)].filter((s): s is string => !!s);
    const entry = gateEntry(tally, today);
    const prev = readC1(c1Raw).gates;
    setResult({ tally, outcome, proofs: proofs.slice(0, 3), retry: outcome.ok ? null : nextTryAfter(prev, entry) });
    setPhase('result');
    // Genau ein Versuch wird gespeichert; ein zweites Auslösen (erneutes Zeichnen) schreibt nichts.
    if (saved.current) return;
    saved.current = true;
    void persist(entry, outcome.ok);
  };

  const persist = async (entry: ReturnType<typeof gateEntry>, ok: boolean): Promise<void> => {
    setSaveState('saving');
    const r = await saveGate(entry);
    if (!alive.current) return;
    if (r === 'failed' || r === 'unavailable') {
      saved.current = false;
      setSaveState('failed');
      return;
    }
    setSaveState('saved');
    if (!ok) return;
    // Bestanden: der Meilenstein `ch<n>` (einmal über alle Geräte). Der Aufstieg läuft nur, wenn dieses Gerät ihn anlegt.
    const got = await claimMilestone([{ id: `ch${chapter.n}` as `ch${1 | 2 | 3 | 4 | 5 | 6 | 7}`, n: chapter.n }], profile?.ms as Record<string, unknown> | undefined, today);
    if (got && levelUpFor(got.id)) offerLevelUp([got.id], got.n);
  };

  const retrySave = (): void => {
    if (!result) return;
    saved.current = true;
    void persist(gateEntry(result.tally, today), result.outcome.ok);
  };

  const answerGrammar = (ok: boolean): void => {
    const it = items[gi];
    if (!it) return;
    const next = [...gAns, { id: it.id, topic: it.topic ?? '', ok, sentence: ok ? correctSentence(it) : null }];
    setGAns(next);
    if (gi + 1 < items.length) setGi(gi + 1);
    else if (words.length > 0) {
      setWi(0);
      setPhase('words');
    } else finish(next, []);
  };

  const answerWord = (ok: boolean): void => {
    const w = words[wi];
    if (!w) return;
    const next = [...wAns, { key: w.key, ok, sentence: w.sentence }];
    setWAns(next);
    if (wi + 1 < words.length) setWi(wi + 1);
    else finish(gAns, next);
  };

  const total = items.length + words.length;
  const done = phase === 'grammar' ? gi : phase === 'words' ? items.length + wi : 0;
  const item = items[gi];
  const word = words[wi];

  return (
    <div className="flex flex-col gap-5 pb-2" data-testid="gate" data-phase={phase} data-chapter={chapter.id}>
      {(phase === 'grammar' || phase === 'words' || phase === 'loading') && (
        <header className="flex flex-col gap-2">
          <p className="lx-eyebrow" data-testid="gate-part">
            {t('pxGtPart', { n: phase === 'words' ? 2 : 1, m: words.length > 0 || phase === 'loading' ? 2 : 1, name: phase === 'words' ? t('pxGtPartWords') : t('pxGtPartGrammar') })}
          </p>
          <Bar value={total > 0 ? done / total : 0} label={t('pxPlProgress')} />
        </header>
      )}

      {phase === 'intro' && (
        <section className="flex flex-col gap-3" data-testid="gate-intro">
          <p className="leading-relaxed">{t('pxGtIntroLead', { n: chapter.n, name: chapter.name[lang] })}</p>
          <p className="leading-relaxed text-muted">{t('pxGtIntroRules')}</p>
          <p className="leading-relaxed text-muted">{t('pxGtIntroNothing')}</p>
          <ActionBar placement="column" stateKey="gate-intro">
            <PrimaryAction iconAfter="arrowRight" onClick={start} testId="gate-go">
              {t('pxGtStart')}
            </PrimaryAction>
          </ActionBar>
        </section>
      )}

      {phase === 'loading' && (
        <p className="text-muted" role="status" data-testid="gate-loading">
          {t('pxPlLoading')}
        </p>
      )}

      {phase === 'empty' && (
        <p className="text-muted" role="status" data-testid="gate-empty">
          {t('pxGtEmpty')}
        </p>
      )}

      {phase === 'grammar' && item && <PlacementItem key={item.id} item={item} onAnswer={answerGrammar} />}
      {phase === 'words' && word && <GateWordItem key={word.key} word={word} onAnswer={(ok) => answerWord(ok)} />}

      {phase === 'result' && result && <GateResult chapter={chapter} data={result} saveState={saveState} onRetrySave={retrySave} onClose={onClose} />}

      {phase !== 'result' && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={onClose} data-testid="gate-cancel">
            {t('pxGtCancel')}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Das Blatt. Geschlossen ist nichts im Speicher: jedes Öffnen beginnt von vorn (Abbrechen speichert nichts). */
export function GateScreen({ open, chapter, onClose }: { open: boolean; chapter: ProgramChapter | null; onClose: () => void }) {
  const { t, lang } = useT();
  return (
    <Sheet open={open && !!chapter} onClose={onClose} title={chapter ? t('pxGtTitle', { n: chapter.n, name: chapter.name[lang] }) : ''} closeLabel={t('pxGtClose')}>
      {open && chapter && <Flow chapter={chapter} onClose={onClose} />}
    </Sheet>
  );
}
