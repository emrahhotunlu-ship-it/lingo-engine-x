import { useRef, useState } from 'react';
import { useClock } from '../../app/clock';
import { useAiAvailable } from '../../ai/scope';
import { takeTutorCall } from '../../ai/tutorBudget';
import { useAsk } from '../../ai/useAsk';
import { useLive } from '../../data/live';
import { clinicId, clinicVars, cleanSentence, isRevision, type ClinicRun, type RecentClinic } from '../../domain/tutor/clinic';
import { tutorCtx } from '../../domain/tutor/ctx';
import { readCtx2, SIT_CHIPS } from '../../domain/tutor/ctx2';
import { normWs, ownWords } from '../../domain/tutor/edits';
import { noteQuality } from '../../domain/tutor/quality';
import { useT, type MessageKey } from '../../i18n';
import { sentenceClinic, CLINIC_SENTENCE_MAX, type ClinicOut } from '../../prompts/sentenceClinic';
import { AiMark } from '../../ui/AiMark';
import { AiRunPanel, isBusy } from '../../ui/AiRunPanel';
import { Button } from '../../ui/Button';
import { Disclosure } from '../../ui/Disclosure';
import { EditDetail, MarkedText } from './MarkedText';
import { clinicSitLabel, WorkProfile } from './WorkProfile';
import { reportClinic, saveClinic, type ClinicSaveResult } from './clinicSave';
import { useClinicSheet } from './clinicStore';

// Satz-Klinik (Lernplattform 3.0 P46, KI-Tutor T4): Emrahs eigener Satz aus dem Arbeitsalltag. Nur auf Tipp, ein Aufruf `sentence-clinic@1`
// (Stufe `default`, 24 h zwischengespeichert), nie automatisch wiederholt (A6.3). Ergebnis: Urteil, der Satz mit markierten Stellen (Tipp → Grund und Muster),
// die korrigierte Fassung, eine C1-Fassung und ein Tonhinweis, mit `AiMark` und Melden. Gespeichert wird ergänzend (`out/<Monat>`, höchstens 2 Fehlersätze
// ab morgen, K7-Eintrag); Einfügen oder Übersetzen eines Satzes zählt nie für K7. Die App urteilt nicht neu: Fehlersätze und K7 stützen sich nur auf
// wörtlich belegte Stellen (`keepEdits`).

const TPL = `${sentenceClinic.id}@${sentenceClinic.version}`;

const VERDICT_KEY: Record<ClinicOut['verdict'], MessageKey> = { correct: 'ttClVerdictCorrect', minor: 'ttClVerdictMinor', wrong: 'ttClVerdictWrong' };
const VERDICT_TONE: Record<ClinicOut['verdict'], string> = { correct: 'bg-ok-soft text-ok-text', minor: 'bg-near-soft text-near-text', wrong: 'bg-wrong-soft text-wrong-text' };
const TONE_KEY: Record<ClinicOut['register'], MessageKey> = { formal: 'ttClToneFormal', neutral: 'ttClToneNeutral', informal: 'ttClToneInformal' };

type Shown = { run: ClinicRun; save: ClinicSaveResult | null; id: string };

/** Die letzten Sätze dieser Sitzung (bis zum Neuladen): Überarbeitungen zählen nicht noch einmal für K7. */
const recent: RecentClinic[] = [];
const RECENT_MAX = 6;

function Result({ shown, onAgain, onDone }: { shown: Shown; onAgain: () => void; onDone: () => void }) {
  const { t, lang } = useT();
  const { run, save } = shown;
  const o = run.out;
  const [active, setActive] = useState(0);
  const [reported, setReported] = useState(false);
  if (reported) {
    return (
      <div className="flex flex-col gap-3" data-testid="cl-reported">
        <p className="lx-t-body m-0 text-muted">{t('ttClReported')}</p>
        <Button variant="primary" onClick={onAgain}>
          {t('ttClAgain')}
        </Button>
      </div>
    );
  }
  const edit = o.edits[active] ?? o.edits[0];
  const differs = o.better && normWs(o.better) !== normWs(o.fixed) && normWs(o.better) !== normWs(run.sentence);
  const counted = save && save.prod !== 'ignored' && save.prod !== 'failed' && save.prod !== 'unavailable';
  return (
    <div className="flex flex-col gap-4" data-testid="cl-result" data-verdict={o.verdict}>
      <div className="flex flex-col gap-1.5">
        <p className="lx-t-label m-0 text-subtle">{t('ttClVerdictLabel')}</p>
        <p className={`m-0 w-fit rounded-full px-3 py-1 text-sm font-semibold ${VERDICT_TONE[o.verdict]}`} data-testid="cl-verdict">
          {t(VERDICT_KEY[o.verdict])}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="lx-t-label m-0 text-subtle">{t('ttClYourSentence')}</p>
        <MarkedText text={run.sentence} edits={o.edits} active={active} onPick={setActive} />
        {o.edits.length > 0 && <p className="lx-t-meta m-0 text-muted">{t('ttClMarked')}</p>}
      </div>
      {edit && <EditDetail edit={edit} />}
      {o.verdict === 'correct' && o.edits.length === 0 && (
        <p className="lx-t-body m-0" data-testid="cl-nothing">
          {t('ttClNothing')}
        </p>
      )}
      <div className="flex flex-col gap-1" data-testid="cl-good">
        <p className="lx-t-label m-0 text-subtle">{t('ttClGood')}</p>
        <p className="lx-t-body m-0" lang={lang}>
          {o.good}
        </p>
      </div>
      {o.verdict !== 'correct' && o.fixed && (
        <div className="flex flex-col gap-1" data-testid="cl-fixed">
          <p className="lx-t-label m-0 text-subtle">{t('ttClFixed')}</p>
          <p className="lx-t-body m-0" lang="en">
            {o.fixed}
          </p>
        </div>
      )}
      {differs && (
        <Disclosure label={t('ttClBetter')} testId="cl-better">
          <p className="lx-t-body m-0" lang="en" data-testid="cl-better-text">
            {o.better}
          </p>
        </Disclosure>
      )}
      {(o.note || o.register !== 'neutral') && (
        <p className="lx-t-meta m-0 text-muted" data-testid="cl-tone">
          {t('ttClToneLine', { tone: t(TONE_KEY[o.register]) })}
          {o.note ? ` · ${o.note}` : ''}
        </p>
      )}
      <AiMark
        variant="edit"
        tpl={TPL}
        id={shown.id}
        onReport={() => {
          setReported(true);
          void reportClinic(run, shown.id);
        }}
        data-testid="cl-mark"
      />
      <div className="flex flex-col gap-1" aria-live="polite">
        {save && save.repairs > 0 && (
          <p className="lx-t-meta m-0 text-muted" data-testid="cl-repairs">
            {save.repairs === 1 ? t('ttClRepairs1') : t('ttClRepairsN', { n: save.repairs })}
          </p>
        )}
        {save && counted && !run.pasted && !run.translated && !run.revised && (
          <p className="lx-t-meta m-0 text-subtle" data-testid="cl-counted">
            {t('ttClCounted')}
          </p>
        )}
        {run.revised && !run.pasted && !run.translated && (
          <p className="lx-t-meta m-0 text-subtle" data-testid="cl-revision">
            {t('ttClRevision')}
          </p>
        )}
        {(run.pasted || run.translated) && (
          <p className="lx-t-meta m-0 text-subtle" data-testid="cl-notcounted">
            {t('ttClNotCounted')}
          </p>
        )}
        {save && (!save.out || !save.repairsOk) && (
          <p className="lx-t-meta m-0 text-muted" role="alert" data-testid="cl-savefail">
            {t('ttClSaveFailed')}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={onAgain} data-testid="cl-again">
          {t('ttClAgain')}
        </Button>
        <Button variant="ghost" onClick={onDone} data-testid="cl-done">
          {t('ttClDone')}
        </Button>
      </div>
    </div>
  );
}

/** Der Ablauf im Blatt: Eingabe → Prüfen → Ergebnis. Geschlossen ist nichts im Speicher (jedes Öffnen beginnt neu). */
export function ClinicFlow({ onClose }: { onClose: () => void }) {
  const { t, lang, num } = useT();
  const ai = useAiAvailable();
  const ask = useAsk(sentenceClinic);
  const seed = useClinicSheet((s) => s.seed);
  const profile = useLive((s) => s.docs['app/profile']);
  const ctx2 = readCtx2(profile);
  const [text, setText] = useState(seed.sentence ?? '');
  const [purpose, setPurpose] = useState(seed.purpose ?? '');
  const [pasted, setPasted] = useState(false);
  const [short, setShort] = useState(false);
  const [limited, setLimited] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  const busy = isBusy(ask.phase);
  const runOnce = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const sits = ctx2 && ctx2.sit.length ? ctx2.sit : [...SIT_CHIPS];

  const go = async (): Promise<void> => {
    const sentence = cleanSentence(text);
    if (!sentence) {
      setShort(true);
      return;
    }
    setShort(false);
    if (!takeTutorCall()) {
      setLimited(true);
      return;
    }
    setLimited(false);
    noteQuality(TPL, 'gen');
    const out = await ask.run(clinicVars({ sentence, purpose, ctx: tutorCtx(profile), uiLang: lang }));
    if (!out || runOnce.current) return;
    runOnce.current = true;
    noteQuality(TPL, 'acc');
    const now = Date.now();
    const revised = isRevision(sentence, recent);
    recent.unshift({ sentence, fixed: out.fixed, better: out.better });
    recent.length = Math.min(recent.length, RECENT_MAX);
    const run: ClinicRun = { sentence, purpose, out, now, day: useClock.getState().today, pasted, translated: seed.translated === true, revised };
    const entry: Shown = { run, save: null, id: clinicId(now) };
    setShown(entry);
    const save = await saveClinic(run);
    setShown((cur) => (cur && cur.id === entry.id ? { ...cur, save } : cur));
  };

  const again = (): void => {
    runOnce.current = false;
    setShown(null);
    setText('');
    setPasted(false);
    window.setTimeout(() => input.current?.focus(), 0);
  };

  if (shown) return <Result shown={shown} onAgain={again} onDone={onClose} />;

  return (
    <div className="flex flex-col gap-4" data-testid="cl-flow">
      <p className="lx-t-body m-0 text-muted">{t('ttClLead')}</p>
      {!ai && (
        <p className="lx-t-meta m-0 text-muted" role="status" data-testid="cl-unavailable">
          {t('ttClUnavailable')}
        </p>
      )}
      <div className="flex flex-col gap-2" role="group" aria-label={t('ttClPurposeLabel')} data-testid="cl-purpose">
        <p className="lx-t-label m-0">{t('ttClPurposeLabel')}</p>
        <div className="flex flex-wrap gap-2">
          {sits.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={purpose === s}
              onClick={() => setPurpose(purpose === s ? '' : s)}
              data-value={s}
              className={`lx-hit inline-flex items-center rounded-full px-3 text-sm ${purpose === s ? 'bg-accent-soft font-semibold text-accent-text' : 'bg-surface-strong text-fg hover:bg-surface'}`}
            >
              {clinicSitLabel(s, t)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cl-input" className="lx-t-label">
          {t('ttClSentenceLabel')}
        </label>
        <textarea
          id="cl-input"
          ref={input}
          value={text}
          rows={4}
          maxLength={CLINIC_SENTENCE_MAX}
          lang="en"
          autoCapitalize="sentences"
          spellCheck={false}
          placeholder={t('ttClPlaceholder')}
          disabled={busy || !ai}
          onChange={(e) => {
            setText(e.target.value);
            if (!e.target.value.trim()) setPasted(false);
            setShort(false);
          }}
          onPaste={() => setPasted(true)}
          onDrop={() => setPasted(true)}
          data-testid="cl-input"
          className="lx-glass w-full resize-y rounded-[var(--radius-control)] px-4 py-3 text-base leading-relaxed text-fg placeholder:text-subtle"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="lx-tnum text-xs text-subtle" data-testid="cl-count">
            {t('ttClCount', { n: num(Array.from(text).length), max: num(CLINIC_SENTENCE_MAX) })}
          </span>
          {short && (
            <span className="text-xs text-muted" role="status" data-testid="cl-short">
              {t('ttClTooShort')}
            </span>
          )}
        </div>
      </div>
      {limited && (
        <p className="m-0 text-sm text-muted" role="status" data-testid="cl-limit">
          {t('ttClLimit')}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <AiRunPanel phase={ask.phase} error={ask.error} onStop={ask.stop} onRetry={() => void go()} />
        {!busy && !ask.error && (
          <div>
            <Button variant="primary" onClick={() => void go()} disabled={!ai || ownWords(text) < 1} data-testid="cl-go">
              {t('ttClGo')}
            </Button>
          </div>
        )}
      </div>
      {ai && (
        <Disclosure label={t('ttClProfileOpen')} testId="cl-profile">
          <WorkProfile />
        </Disclosure>
      )}
    </div>
  );
}

