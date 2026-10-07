import { useId, useMemo, useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { pickPairs, type ComboPair } from '../../domain/apply/combo';
import { topicById, TOPICS } from '../../domain/content';
import { laptopDeepen } from '../../domain/metrics';
import { errorsOf } from '../../domain/grammar/errors';
import { alignWords } from '../../domain/answer/align';
import { normText } from '../../domain/text/normText';
import { usesChunk } from '../../domain/text/chunkMatch';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT } from '../../i18n';
import { useInputProfile } from '../../platform/input';
import { comboCheck, type ComboCheckOut } from '../../prompts/comboCheck';
import { AiRunPanel } from '../../ui/AiRunPanel';
import { Icon } from '../../ui/Icon';
import { SessionEnd } from '../../ui/SessionEnd';
import { ExerciseShell, SentenceInput, type ShellFeedback } from '../../ui/exercise';
import { ExerciseTop } from '../learn/ui';
import { saveRepairs } from '../repair/store';
import { useVocabCards } from '../vocab/hub/data';

// „Eigener Satz“ im Reiter Anwenden (Stufe 2, Übung 2 Teil B; Plan docs/umbau/anwenden-plan.md): Emrah schreibt einen
// Satz mit einem Wort aus seinem Wortschatz und einer Grammatikregel. Das Wort prüft die App selbst, Regel und Satz prüft
// Claude – zwei getrennte Urteile. Freiwillig: kein FSRS-Termin, keine Beherrschungs-Buchung. Ein falscher Satz wird als
// Reparatur-Satz gespeichert (kommt in „Fehler korrigieren“ wieder, nie als Rückstand). Von Claude geprüft, kann Fehler
// enthalten: gekennzeichnet.

/** Nur ein belegt besserer, anderer Satz wird zum Reparatur-Satz (kommt morgen in „Fehler korrigieren“). */
export function willRepair(out: ComboCheckOut, given: string): boolean {
  const fixed = out.fixed.trim();
  return !out.correct && !!fixed && normText(fixed) !== normText(given);
}

type Done = { word: boolean; rule: boolean | null; correct: boolean | null };

/** Wörter aus „Am Laptop vertiefen“ sortieren `pickPairs` (nach Fehlern) vor alle anderen. */
const DEEPEN_BOOST = 1000;

/** Paare für die Runde: aus den Live-Daten, fest je Lerntag. */
export function useComboPairs(): ComboPair[] {
  const cards = useVocabCards();
  const grammar = useLive((s) => s.collections.grammar);
  const today = useClock((s) => s.today);
  const log = useLive((s) => s.day?.doc);
  return useMemo(() => {
    // „Am Laptop vertiefen“ (Matrix §6): Wörter, die heute am Handy geübt wurden und fest sitzen, kommen zuerst.
    const deepen = new Set(laptopDeepen({ log, cards, today }).map((w) => w.toLowerCase()));
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const words = cards
      .filter((c) => !c.hidden && !c.isNew && c.stage >= 1 && c.word.trim() && c.word.trim().split(/\s+/).length <= 2)
      .map((c) => ({ word: c.word.trim(), lapses: num(c.doc.lapses) + (deepen.has(c.word.trim().toLowerCase()) ? DEEPEN_BOOST : 0), stage: c.stage }));
    const errorTopics = [...(grammar ?? new Map<string, Record<string, unknown>>()).entries()].filter(([, d]) => errorsOf(d).some((e) => e.done !== true)).map(([id]) => id);
    return pickPairs(words, TOPICS, errorTopics, today);
  }, [cards, grammar, today, log]);
}

export function ComboSentenceScreen() {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const back = useNav((s) => s.back);
  const ai = useAiAvailable();
  const live = useComboPairs();
  const liveProfile = useInputProfile();
  // Das Eingabeprofil gilt für die ganze Runde (§4.1): am Handy ein kurzer Satz (höchstens 8 Wörter), am Laptop ein freier Satz.
  const [profile] = useState(() => liveProfile);
  const touch = profile === 'touch';
  // Paare erst einfrieren, sobald sie erstmals nicht leer sind (die Daten können nach dem Öffnen eintreffen; Prüfbefund S10).
  const [fixed, setFixed] = useState<ComboPair[]>(() => live);
  if (!fixed.length && live.length) setFixed(live);
  const ask = useAsk(comboCheck);
  const [pos, setPos] = useState(0);
  const [text, setText] = useState('');
  const [miss, setMiss] = useState(false);
  const [res, setRes] = useState<(Done & { out: ComboCheckOut; given: string }) | null>(null);
  const [results, setResults] = useState<Done[]>([]);
  const [info, setInfo] = useState(false);
  const infoId = useId();
  const [startedAt] = useState(() => performance.now());
  const [endedAt, setEndedAt] = useState(0);

  const cur = fixed[pos] ?? null;
  const topic = cur ? topicById(cur.topicId) : undefined;
  const topicName = topic ? (lang === 'en' ? (topic.name_en ?? topic.name) : topic.name) : '';
  const finished = pos >= fixed.length;
  const busy = ask.phase === 'queued' || ask.phase === 'thinking' || ask.phase === 'slow' || ask.phase === 'streaming';

  const close = () => {
    api.blur();
    back();
  };

  const check = async () => {
    const given = text.trim();
    if (!cur || !topic || !given || res || busy) return;
    api.blur();
    // Wort zuerst lokal: fehlt es, braucht es keine KI und keinen Verbrauch.
    if (!usesChunk(given, cur.word)) {
      setMiss(true);
      return;
    }
    setMiss(false);
    const out = await ask.run({ word: cur.word, topic: topic.name_en ?? topic.name, rule: topic.rule ?? '', sentence: given, uiLang: lang });
    // KI nicht erreichbar oder unlesbar: nicht als falsch werten, „Prüfen“ fragt erneut (Lernwissenschaft 27.09.).
    if (!out) return;
    const done: Done = { word: true, rule: out.ruleOk, correct: out.correct };
    setRes({ ...done, out, given });
    setResults((l) => [...l, done]);
    // Ein falscher Satz wird zum Reparatur-Satz (nur mit belegter Korrektur, nie als Rückstand).
    if (willRepair(out, given)) void saveRepairs([{ wrong: given, right: out.fixed.trim(), why: out.why, src: 'write' }]);
  };
  const next = () => {
    // Nur echte Versuche zählen: übersprungene Sätze nie; ein fehlendes Wort zählt als Versuch (einmal, beim Überspringen).
    if (!res && miss) setResults((l) => [...l, { word: false, rule: null, correct: null }]);
    setPos((p) => p + 1);
    setText('');
    setMiss(false);
    setRes(null);
    setEndedAt(performance.now());
  };
  const right = results.filter((r) => r.word && r.rule && r.correct).length;

  const fb: ShellFeedback | null =
    res && cur
      ? {
          verdict: res.out.correct && res.out.ruleOk ? 'ok' : res.word && res.out.correct ? 'near' : 'wrong',
          comparison: willRepair(res.out, res.given) ? { given: res.given, ops: alignWords(res.given, res.out.fixed.trim()) } : null,
          explanation: { lines: [{ k: 'why', text: res.out.why }], examples: [], mark: [], ai: true, source: 'fallback' },
          nextIn: willRepair(res.out, res.given) ? t('apComboRepairNote') : null,
          depth: 'full',
          auto: false,
        }
      : null;

  const marks = res && cur && (
    <ul className="flex flex-wrap gap-2" aria-label={t('rxResultLabel')}>
      <li className="lx-chip" data-testid="combo-word-mark" data-ok={res.word ? 'true' : 'false'}>
        <Icon name={res.word ? 'check' : 'close'} size={14} /> {t('apComboWordMark', { word: cur.word })}
      </li>
      {res.rule !== null && (
        <li className="lx-chip" data-testid="combo-rule-mark" data-ok={res.rule ? 'true' : 'false'}>
          <Icon name={res.rule ? 'check' : 'close'} size={14} /> {t('apComboRuleMark')}
        </li>
      )}
    </ul>
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="combo" data-state={finished ? 'done' : 'open'}>
      <ExerciseTop onClose={close} progress={fixed.length && !finished ? { n: pos + 1, total: fixed.length } : null} ctx="xtra" />
      {!ai || !fixed.length ? (
        <p className="lx-glass rounded-[var(--radius-card)] p-5 lx-t-support text-muted" data-testid="combo-unavailable">
          {t('apComboUnavailable')}
        </p>
      ) : finished ? (
        <SessionEnd right={right} total={Math.max(1, results.length)} ms={Math.max(1, endedAt - startedAt)} next={{ label: t('lrBackToApply'), run: close }} />
      ) : (
        cur && (
          <div data-testid="combo-item" data-word={cur.word} data-topic={cur.topicId} data-profile={profile}>
            <ExerciseShell
              meta={{ ex: 'combo', id: `${cur.word}|${cur.topicId}`, kind: touch ? 'complete' : 'produce' }}
              status={{ area: 'words', state: null, kindLabel: t('fxLKindOwn'), badge: topicName }}
              task={{ text: t(touch ? 'fxLComboTaskShort' : 'apComboTask', { word: cur.word, topic: topicName }), purpose: t('apComboPurpose') }}
              aid={
                topic?.rule ? (
                  <div className="flex flex-col gap-1">
                    <button type="button" className="inline-flex min-h-11 items-center gap-1 self-start lx-t-support font-medium text-accent-text" aria-expanded={info} aria-controls={infoId} onClick={() => setInfo((v) => !v)} data-testid="combo-rule-toggle">
                      <Icon name="info" size={16} />
                      {t('apComboRule')}
                    </button>
                    {info && (
                      <p id={infoId} className="lx-t-support lx-inset text-muted" data-testid="combo-rule">
                        {topic.rule}
                      </p>
                    )}
                  </div>
                ) : null
              }
              prompt={
                <span lang="en" data-testid="combo-prompt">
                  {cur.word}
                </span>
              }
              answer={
                <div className="flex flex-col gap-3">
                  <SentenceInput mode="free" value={text} onChange={setText} onSubmit={() => (res ? next() : void check())} disabled={!!res} maxWords={touch ? COMBO_PHONE_WORDS : undefined} testId="combo-input" />
                  {busy && <AiRunPanel phase={ask.phase} error={null} onStop={ask.stop} skeleton={false} />}
                  {!busy && !res && ask.error && <AiRunPanel phase="error" error={ask.error} onRetry={() => void check()} skeleton={false} />}
                  {marks}
                </div>
              }
              hint={!res && miss ? { text: t('apComboWordMissing', { word: cur.word }), tone: 'near' } : null}
              state={!res && miss ? 'retry' : undefined}
              secondary={[{ id: 'skip', label: t('rxSkip'), onClick: next, testId: 'combo-skip', disabled: busy }]}
              primary={res ? { label: t('rxNext'), onClick: next, testId: 'combo-next' } : { label: t('rxCheck'), onClick: () => void check(), testId: 'combo-check', disabled: !text.trim() || busy, busy, busyLabel: t('exChecking') }}
              feedback={fb}
            />
          </div>
        )
      )}
    </div>
  );
}

/** Am Handy ein kurzer Satz (Ersatz `complete`, Matrix §6). */
export const COMBO_PHONE_WORDS = 8;
