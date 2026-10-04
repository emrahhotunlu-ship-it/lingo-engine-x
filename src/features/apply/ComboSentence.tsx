import { motion } from 'framer-motion';
import { useId, useMemo, useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { pickPairs, type ComboPair } from '../../domain/apply/combo';
import { topicById, TOPICS } from '../../domain/content';
import { errorsOf } from '../../domain/grammar/errors';
import { normText } from '../../domain/text/normText';
import { usesChunk } from '../../domain/text/chunkMatch';
import { EnglishText } from '../../engine/EnglishText';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT } from '../../i18n';
import { comboCheck, type ComboCheckOut } from '../../prompts/comboCheck';
import { AiRunPanel } from '../../ui/AiRunPanel';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { SessionEnd } from '../../ui/SessionEnd';
import { ExerciseTop, TaskLine } from '../learn/ui';
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

/** Paare für die Runde: aus den Live-Daten, fest je Lerntag. */
export function useComboPairs(): ComboPair[] {
  const cards = useVocabCards();
  const grammar = useLive((s) => s.collections.grammar);
  const today = useClock((s) => s.today);
  return useMemo(() => {
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const words = cards
      .filter((c) => !c.hidden && !c.isNew && c.stage >= 1 && c.word.trim() && c.word.trim().split(/\s+/).length <= 2)
      .map((c) => ({ word: c.word.trim(), lapses: num(c.doc.lapses), stage: c.stage }));
    const errorTopics = [...(grammar ?? new Map<string, Record<string, unknown>>()).entries()].filter(([, d]) => errorsOf(d).some((e) => e.done !== true)).map(([id]) => id);
    return pickPairs(words, TOPICS, errorTopics, today);
  }, [cards, grammar, today]);
}

export function ComboSentenceScreen() {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const back = useNav((s) => s.back);
  const ai = useAiAvailable();
  const live = useComboPairs();
  const [fixed] = useState<ComboPair[]>(() => live);
  const ask = useAsk(comboCheck);
  const [pos, setPos] = useState(0);
  const [text, setText] = useState('');
  const [res, setRes] = useState<(Done & { out: ComboCheckOut | null }) | null>(null);
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
      setRes({ word: false, rule: null, correct: null, out: null });
      return;
    }
    const out = await ask.run({ word: cur.word, topic: topic.name_en ?? topic.name, rule: topic.rule ?? '', sentence: given, uiLang: lang });
    // KI nicht erreichbar oder unlesbar: nicht als falsch werten, „Prüfen“ fragt erneut (Lernwissenschaft 27.09.).
    if (!out) return;
    const done: Done = { word: true, rule: out.ruleOk, correct: out.correct };
    setRes({ ...done, out });
    setResults((l) => [...l, done]);
    // Ein falscher Satz wird zum Reparatur-Satz (nur mit belegter Korrektur, nie als Rückstand).
    if (willRepair(out, given)) void saveRepairs([{ wrong: given, right: out.fixed.trim(), why: out.why, src: 'write' }]);
  };
  const retry = () => {
    setRes(null);
  };
  const next = () => {
    // Nur echte Versuche zählen: übersprungene Sätze nie; ein fehlendes Wort zählt als Versuch (einmal, beim Weiter).
    if (res && res.out === null) setResults((l) => [...l, { word: res.word, rule: res.rule, correct: res.correct }]);
    setPos((p) => p + 1);
    setText('');
    setRes(null);
    setEndedAt(performance.now());
  };
  const right = results.filter((r) => r.word && r.rule && r.correct).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="combo" data-state={finished ? 'done' : 'open'}>
      <ExerciseTop onClose={close} progress={fixed.length && !finished ? { n: pos + 1, total: fixed.length } : null} ctx="xtra" />
      {!ai || !fixed.length ? (
        <p className="lx-glass rounded-[var(--radius-card)] p-5 text-sm text-muted" data-testid="combo-unavailable">
          {t('apComboUnavailable')}
        </p>
      ) : finished ? (
        <SessionEnd right={right} total={Math.max(1, results.length)} ms={Math.max(1, endedAt - startedAt)} next={{ label: t('lrBackToApply'), run: close }} />
      ) : (
        cur && (
          <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="combo-item" data-word={cur.word} data-topic={cur.topicId}>
            <header className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <TaskLine task={t('apComboTask', { word: cur.word, topic: topicName })} purpose={t('apComboPurpose')} />
                </div>
              </div>
              {topic?.rule && (
                <>
                  <button type="button" className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-accent-text" aria-expanded={info} aria-controls={infoId} onClick={() => setInfo((v) => !v)} data-testid="combo-rule-toggle">
                    <Icon name="info" size={16} />
                    {t('apComboRule')}
                  </button>
                  {info && (
                    <p id={infoId} className="rounded-xl bg-surface px-3 py-2 text-sm text-muted" data-testid="combo-rule">
                      {topic.rule}
                    </p>
                  )}
                </>
              )}
            </header>
            <textarea
              className="lx-field min-h-24 text-base"
              lang="en"
              rows={3}
              value={text}
              readOnly={!!res && res.out !== null}
              onChange={(ev) => setText(ev.target.value)}
              aria-label={t('apComboInput')}
              placeholder={t('apComboInput')}
              autoCapitalize="sentences"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-testid="combo-input"
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' && !ev.shiftKey && !ev.nativeEvent.isComposing) {
                  ev.preventDefault();
                  void check();
                }
              }}
            />
            {busy && <AiRunPanel phase={ask.phase} error={null} onStop={ask.stop} skeleton={false} />}
            {!busy && !res && ask.error && <AiRunPanel phase="error" error={ask.error} onRetry={() => void check()} skeleton={false} />}
            {!res && (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" disabled={!text.trim() || busy} onClick={() => void check()} data-testid="combo-check">
                  {t('rxCheck')}
                </Button>
                <Button variant="ghost" disabled={busy} onClick={next} data-testid="combo-skip">
                  {t('rxSkip')}
                </Button>
              </div>
            )}
            {res && (
              <motion.section initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.base, ease: EASE_OUT }} className="flex flex-col gap-3 border-t border-line pt-4" data-testid="combo-result">
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
                {!res.word && (
                  <p className="text-sm text-muted" data-testid="combo-word-missing">
                    {t('apComboWordMissing', { word: cur.word })}
                  </p>
                )}
                {res.out && (
                  <>
                    {!res.out.correct && res.out.fixed.trim() && (
                      <div className="flex flex-col gap-1 rounded-xl bg-surface px-3 py-2">
                        <p className="text-sm text-muted">{t('rxBetter')}</p>
                        <EnglishText text={res.out.fixed.trim()} area="trainer" source={null} className="text-base font-medium leading-relaxed" testId="combo-fixed" />
                      </div>
                    )}
                    <p className="text-sm text-muted" data-testid="combo-why">
                      {t('rxWhy')}: {res.out.why}
                    </p>
                    {willRepair(res.out, text) && (
                      <p className="text-sm text-muted" data-testid="combo-repair-note">
                        {t('apComboRepairNote')}
                      </p>
                    )}
                    <p className="text-xs text-subtle">{t('apComboNotice')}</p>
                  </>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  {!res.out && (
                    <Button variant="secondary" icon="refresh" onClick={retry} data-testid="combo-retry">
                      {t('apComboRetry')}
                    </Button>
                  )}
                  <Button variant="primary" iconAfter="arrowRight" onClick={next} data-testid="combo-next">
                    {t('rxNext')}
                  </Button>
                </div>
              </motion.section>
            )}
          </article>
        )
      )}
    </div>
  );
}
