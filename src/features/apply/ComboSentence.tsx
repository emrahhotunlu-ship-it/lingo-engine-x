import { useEffect, useId, useMemo, useState } from 'react';
import { KEY_PREFIX, local } from '../../platform/storage';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { unitDone } from '../../app/unit/done';
import { unitBlockOf } from '../speak/unit';
import { startDrill } from '../drills/session';
import { useLive } from '../../data/live';
import { pickPairs, type ComboPair } from '../../domain/apply/combo';
import { topicById, TOPICS } from '../../domain/content';
import { laptopDeepen, practicedToday } from '../../domain/metrics';
import { useTodayPlan } from '../today/store';
import { errorsOf } from '../../domain/grammar/errors';
import { alignWords } from '../../domain/answer/align';
import { normText } from '../../domain/text/normText';
import { usesChunk } from '../../domain/text/chunkMatch';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT } from '../../i18n';
import { useInputProfile } from '../../platform/input';
import { comboCheck, type ComboCheckOut } from '../../prompts/comboCheck';
import { AiRunPanel } from '../../ui/AiRunPanel';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { SessionEnd } from '../../ui/SessionEnd';
import { ExerciseShell, SentenceInput, type ShellFeedback } from '../../ui/exercise';
import { ExerciseTop } from '../learn/ui';
import { saveRepairs } from '../repair/store';
import { useVocabCards } from '../vocab/hub/data';
import { lapsesOf } from '../../domain/srs/lapses';

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

/** Gespeicherter Stand einer Anwenden-Runde (nur dieser Lerntag); Ungültiges wird verworfen. */
function readCombo(key: string): { fixed: ComboPair[]; pos: number; results: Done[] } | null {
  const v = local.getJson<{ fixed?: unknown; pos?: unknown; results?: unknown }>(key);
  if (!v || !Array.isArray(v.fixed) || !v.fixed.length || typeof v.pos !== 'number' || v.pos < 0 || v.pos >= v.fixed.length || !Array.isArray(v.results)) return null;
  return { fixed: v.fixed as ComboPair[], pos: v.pos, results: v.results as Done[] };
}

/** Wörter aus „Am Laptop vertiefen“ sortieren `pickPairs` (nach Fehlern) vor alle anderen, danach die heute geübten Wörter. */
const DEEPEN_BOOST = 1000;
const TODAY_BOOST = 500;

/** Paare für die Runde: aus den Live-Daten, fest je Lerntag. */
export function useComboPairs(): ComboPair[] {
  const cards = useVocabCards();
  const grammar = useLive((s) => s.collections.grammar);
  const today = useClock((s) => s.today);
  const log = useLive((s) => s.day?.doc);
  // Thema des Tages aus dem eingefrorenen Plan (`u.gt`), nur wenn der Plan von heute ist.
  const gtTopics = useTodayPlan((s) => (s.plan && s.plan.d === today ? s.plan.u?.gt?.topics : undefined));
  return useMemo(() => {
    // „Am Laptop vertiefen“ (Matrix §6): Wörter, die heute am Handy geübt wurden und fest sitzen, kommen zuerst; danach die heute geübten.
    const deepen = new Set(laptopDeepen({ log, cards, today }).map((w) => w.toLowerCase()));
    const practiced = new Set(practicedToday({ log, cards, today }).map((w) => w.toLowerCase()));
    const boost = (w: string): number => (deepen.has(w) ? DEEPEN_BOOST : practiced.has(w) ? TODAY_BOOST : 0);
    const words = cards
      .filter((c) => !c.hidden && !c.isNew && c.stage >= 1 && c.word.trim() && c.word.trim().split(/\s+/).length <= 2)
      .map((c) => ({ word: c.word.trim(), lapses: lapsesOf(c.doc) + boost(c.word.trim().toLowerCase()), stage: c.stage }));
    const errorTopics = [...(grammar ?? new Map<string, Record<string, unknown>>()).entries()].filter(([, d]) => errorsOf(d).some((e) => e.done !== true)).map(([id]) => id);
    return pickPairs(words, TOPICS, errorTopics, today, undefined, gtTopics ?? []);
  }, [cards, grammar, today, log, gtTopics]);
}

export function ComboSentenceScreen() {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const back = useNav((s) => s.back);
  const go = useNav((s) => s.go);
  // Tagesweg Schritt 3 (Anwenden): die Blocknummer kommt mit der Route; ohne sie ist es freies Üben.
  const unitBlock = useNav((s) => (s.route.name === 'comboSentence' ? unitBlockOf(s.route.unit) : null));
  const [unit] = useState(() => unitBlock);
  // Kurzer Tag (F3, Nachtrag learning-scientist Muss 4): der Tagesweg startet den eigenen Satz mit nur einem Satz (`n = 1`).
  const routeN = useNav((s) => (s.route.name === 'comboSentence' ? s.route.n : undefined));
  const [limit] = useState(() => comboLimitOf(routeN));
  const today = useClock((s) => s.today);
  const ai = useAiAvailable();
  const live = useComboPairs();
  const liveProfile = useInputProfile();
  // Das Eingabeprofil gilt für die ganze Runde (§4.1): am Handy ein kurzer Satz (höchstens 8 Wörter), am Laptop ein freier Satz.
  const [profile] = useState(() => liveProfile);
  const touch = profile === 'touch';
  // Wiedereinstieg (Emrah 04.11.2026: „rausgehen, wieder rein – von vorne“): Sätze, Position und Ergebnisse dieses Lerntags stehen im
  // Browser-Speicher (Bequemlichkeit; Reparatur-Sätze und „Schritt erledigt“ stehen ohnehin in der Datenbank) und werden beim Öffnen übernommen.
  const saveKey = `${KEY_PREFIX}combo:${today}:${unit ?? 'free'}${limit ? `:${limit}` : ''}`;
  const [saved] = useState(() => readCombo(saveKey));
  // Paare erst einfrieren, sobald sie erstmals nicht leer sind (die Daten können nach dem Öffnen eintreffen; Prüfbefund S10).
  const [fixed, setFixed] = useState<ComboPair[]>(() => saved?.fixed ?? (limit ? live.slice(0, limit) : live));
  if (!fixed.length && live.length) setFixed(limit ? live.slice(0, limit) : live);
  const ask = useAsk(comboCheck);
  const [pos, setPos] = useState(() => saved?.pos ?? 0);
  const [text, setText] = useState('');
  const [miss, setMiss] = useState(false);
  const [res, setRes] = useState<(Done & { out: ComboCheckOut; given: string }) | null>(null);
  const [results, setResults] = useState<Done[]>(() => saved?.results ?? []);
  const [info, setInfo] = useState(false);
  const infoId = useId();
  const [startedAt] = useState(() => performance.now());
  const [endedAt, setEndedAt] = useState(0);

  useEffect(() => {
    if (!fixed.length) return;
    if (pos >= fixed.length) local.remove(saveKey);
    else local.set(saveKey, JSON.stringify({ fixed, pos, results }));
  }, [saveKey, fixed, pos, results]);

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
    // Tagesweg: nach dem letzten Satz ist Schritt 3 erledigt; die Einheit führt zur Abschlusskarte (zählt zum Tagesziel, Kap. 2.6).
    if (unit && pos + 1 >= fixed.length) {
      api.blur();
      // Fokus 2.0 F3 (Prüfbefund L2): Nur wenn der eigene Satz die Disziplin des Tages ist (`u.ap`, ältere Pläne ohne `ap` laufen als eigener Satz) und
      // mindestens ein Satz geprüft wurde, ist sie erledigt; als Ersatz für eine Mail oder Zusammenfassung zählt er nicht (die Disziplin wandert weiter).
      const plan = useTodayPlan.getState().plan;
      const ap = plan && plan.d === today ? plan.u?.ap : undefined;
      const checked = !!res || results.some((r) => r.correct !== null);
      unitDone(unit, undefined, { apDone: (ap === undefined || ap === 'combo') && checked });
    }
  };
  const right = results.filter((r) => r.word && r.rule && r.correct).length;
  // Ohne Claude oder ohne passende Wörter: im Tagesweg geht es mit Satzbau weiter (ohne KI erfüllbar).
  const orderInstead = () => {
    if (!unit) return;
    api.blur();
    if (startDrill('order', today, unit) !== null) go({ name: 'drill', kind: 'order', ctx: 'duty' });
  };

  const fb: ShellFeedback | null =
    res && cur
      ? {
          verdict: res.out.correct && res.out.ruleOk ? 'ok' : res.word && res.out.correct ? 'near' : 'wrong',
          comparison: willRepair(res.out, res.given) ? { given: res.given, ops: alignWords(res.given, res.out.fixed.trim()) } : null,
          explanation: { lines: [{ k: 'why', text: res.out.why }], examples: [], mark: [], ai: true, source: 'fallback' },
          nextIn: willRepair(res.out, res.given) ? t('apComboRepairNote') : null,
          sub: res.out.fixedUnsure ? t('awFixUnsure') : null,
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
      <ExerciseTop onClose={close} progress={fixed.length && !finished ? { n: pos + 1, total: fixed.length } : null} ctx={unit ? 'duty' : 'xtra'} />
      {!ai || !fixed.length ? (
        <div className="lx-glass flex flex-col gap-3 rounded-[var(--radius-card)] p-5" data-testid="combo-unavailable">
          <p className="lx-t-support text-muted">{t('apComboUnavailable')}</p>
          {unit && (
            <Button variant="primary" className="self-start" onClick={orderInstead} data-testid="combo-order-instead">
              {t('apComboOrderInstead')}
            </Button>
          )}
        </div>
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

/** Satzzahl aus der Route (1 bis 3), sonst `null` (alle Paare der Runde). */
export function comboLimitOf(v: unknown): number | null {
  return v === 1 || v === 2 || v === 3 ? v : null;
}

/** Am Handy ein kurzer Satz (Ersatz `complete`, Matrix §6). */
export const COMBO_PHONE_WORDS = 8;
