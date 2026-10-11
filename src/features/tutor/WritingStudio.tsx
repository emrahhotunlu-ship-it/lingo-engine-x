import { useMemo, useRef, useState } from 'react';
import { useClock } from '../../app/clock';
import { useAiAvailable } from '../../ai/scope';
import { takeTutorCall } from '../../ai/tutorBudget';
import { useAsk } from '../../ai/useAsk';
import { useLive } from '../../data/live';
import { useChosenChapter } from '../c1/chosen';
import { isoWeek } from '../../domain/date';
import { patternById } from '../../domain/grammar/patterns';
import { chapterState } from '../../domain/c1/state';
import { tutorCtx } from '../../domain/tutor/ctx';
import { readCtx2 } from '../../domain/tutor/ctx2';
import { MAIL_GOAL_WORDS, MAIL_MAX_CHECKS, MAIL_MIN_WORDS, mailGuard, mailVars, newMailId, pickSituation, seenPatterns, seenPhrases, type MailRun } from '../../domain/tutor/mail';
import { noteQuality } from '../../domain/tutor/quality';
import { useT } from '../../i18n';
import { c1Mail, MAIL_TEXT_MAX } from '../../prompts/c1Mail';
import { AiRunPanel, isBusy } from '../../ui/AiRunPanel';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { MailResult, type MailShown } from './MailResult';
import { saveMail } from './mailSave';

// Schreibwerkstatt (Lernplattform 3.0 P47, KI-Tutor T6), nur am Laptop: eine Situation aus dem aktuellen Kapitel (und „Mein Arbeitsalltag“), ein Editor mit
// Wortzähler (Ziel 120 bis 180), eine Checkliste (3 Kapitelmuster, 4 Wendungen, lokal abgehakt beim Tippen) und `c1-mail@1` auf Tipp. Der Text darf höchstens
// 1.800 Zeichen haben (länger ist nicht absendbar). Bis zu drei Prüfungen je Text; nur die erste zählt für K7 und legt Fehlersätze an. Eingefügte Texte zählen
// nie für K7 (Einfügen wird am Editor erkannt). Geschlossen ist nichts im Speicher.

const TPL = `${c1Mail.id}@${c1Mail.version}`;
const EMPTY = new Map<string, Record<string, unknown>>();

export function WritingStudio({ onClose }: { onClose: () => void }) {
  const { t, lang, num } = useT();
  const ai = useAiAvailable();
  const ask = useAsk(c1Mail);
  const today = useClock((s) => s.today);
  const nowMs = useClock((s) => s.now);
  const profile = useLive((s) => s.docs['app/profile']);
  const grammar = useLive((s) => s.collections.grammar) ?? EMPTY;
  const chosen = useChosenChapter();
  const [shift, setShift] = useState(0);
  const [text, setText] = useState('');
  const [pasted, setPasted] = useState(false);
  const [checks, setChecks] = useState(0);
  const [limited, setLimited] = useState(false);
  const [shown, setShown] = useState<MailShown | null>(null);
  const textId = useRef<string | null>(null);
  const busy = isBusy(ask.phase);

  const chapter = useMemo(() => {
    const cur = chapterState({ docs: grammar, today, nowMs, chosen }).current;
    return cur >= 0 ? cur + 1 : null;
  }, [grammar, today, nowMs, chosen]);
  const ctx2 = readCtx2(profile);
  const situation = useMemo(() => pickSituation({ chapter, sit: ctx2?.sit ?? [], week: isoWeek(today), shift }), [chapter, ctx2?.sit, today, shift]);
  const guard = mailGuard(text);
  const patterns = useMemo(() => (situation ? seenPatterns(text, situation) : []), [situation, text]);
  const phrases = useMemo(() => (situation ? seenPhrases(text, situation) : []), [situation, text]);
  if (!situation) return null;

  const go = async (): Promise<void> => {
    if (guard.tooLong || guard.tooShort || checks >= MAIL_MAX_CHECKS) return;
    if (!takeTutorCall()) {
      setLimited(true);
      return;
    }
    setLimited(false);
    noteQuality(TPL, 'gen');
    const out = await ask.run(mailVars({ situation, text, ctx: tutorCtx(profile), uiLang: lang }));
    if (!out) return;
    noteQuality(TPL, 'acc');
    const now = Date.now();
    const check = checks + 1;
    const id = textId.current ?? newMailId(now);
    textId.current = id;
    setChecks(check);
    const run: MailRun = { situation, text: text.trim(), out, now, day: useClock.getState().today, pasted, id, check };
    setShown({ run, save: null });
    const save = await saveMail(run);
    setShown((cur) => (cur && cur.run === run ? { ...cur, save } : cur));
  };

  const reset = (): void => {
    textId.current = null;
    setShown(null);
    setText('');
    setPasted(false);
    setChecks(0);
    setShift((s) => s + 1);
  };

  const names = (id: string): string => patternById(id)?.name[lang] ?? id;
  const wordsOk = guard.words >= MAIL_GOAL_WORDS[0] && guard.words <= MAIL_GOAL_WORDS[1];

  return (
    <div className="grid gap-6 lg:grid-cols-2" data-testid="ws-flow" data-situation={situation.id}>
      <div className="flex min-w-0 flex-col gap-4">
        <section className="lx-card flex flex-col gap-2 p-4" aria-labelledby="ws-brief-h" data-testid="ws-brief">
          <p id="ws-brief-h" className="lx-t-label m-0 text-subtle">
            {t('ttWsBriefLabel')}
          </p>
          <p className="lx-t-body m-0" lang="en">
            {situation.brief.en}
          </p>
          <p className="lx-t-meta m-0 text-muted" lang="de" data-testid="ws-brief-de">
            {lang === 'de' ? situation.brief.de : ''}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="lx-t-meta text-subtle">{t('ttWsReader', { to: situation.to })}</span>
            {checks === 0 && !busy && (
              <Button variant="ghost" onClick={() => setShift((s) => s + 1)} data-testid="ws-other">
                {t('ttWsOther')}
              </Button>
            )}
          </div>
        </section>
        {!ai && (
          <p className="lx-t-meta m-0 text-muted" role="status" data-testid="ws-unavailable">
            {t('ttWsUnavailable')}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ws-input" className="lx-t-label">
            {t('ttWsEditorLabel')}
          </label>
          <textarea
            id="ws-input"
            value={text}
            rows={12}
            lang="en"
            autoCapitalize="sentences"
            spellCheck={false}
            placeholder={t('ttWsPlaceholder')}
            disabled={busy || !ai}
            onChange={(e) => {
              setText(e.target.value);
              if (!e.target.value.trim()) setPasted(false);
            }}
            onPaste={() => setPasted(true)}
            onDrop={() => setPasted(true)}
            data-testid="ws-input"
            className="lx-glass w-full resize-y rounded-[var(--radius-control)] px-4 py-3 text-base leading-relaxed text-fg placeholder:text-subtle"
          />
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className={`lx-tnum text-xs ${wordsOk ? 'text-ok-text' : 'text-subtle'}`} data-testid="ws-count" data-words={guard.words}>
              {t('ttWsCount', { n: num(guard.words), min: MAIL_GOAL_WORDS[0], max: MAIL_GOAL_WORDS[1] })}
            </span>
            {guard.tooLong ? (
              <span className="text-xs text-wrong-text" role="status" data-testid="ws-toolong">
                {t('ttWsTooLong', { chars: num(guard.chars), max: num(MAIL_TEXT_MAX) })}
              </span>
            ) : (
              guard.tooShort &&
              guard.words > 0 && (
                <span className="text-xs text-muted" role="status" data-testid="ws-tooshort">
                  {t('ttWsTooShort', { n: MAIL_MIN_WORDS })}
                </span>
              )
            )}
          </div>
        </div>
        <section className="flex flex-col gap-2" aria-labelledby="ws-check-h" data-testid="ws-checklist">
          <h3 id="ws-check-h" className="lx-t-label m-0">
            {t('ttWsChecklist')}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <p className="lx-t-meta m-0 text-subtle">{t('ttWsChecklistPatterns')}</p>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {patterns.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm" data-testid={`ws-pat-${p.id}`} data-ok={p.ok}>
                    <Tick ok={p.ok} />
                    <span className={p.ok ? 'text-fg' : 'text-muted'}>{names(p.id)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-1">
              <p className="lx-t-meta m-0 text-subtle">{t('ttWsChecklistPhrases')}</p>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {phrases.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm" data-testid={`ws-phrase-${p.id.replace(/\s+/g, '-')}`} data-ok={p.ok}>
                    <Tick ok={p.ok} />
                    <span className={p.ok ? 'text-fg' : 'text-muted'} lang="en">
                      {p.id}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="lx-t-meta m-0 text-subtle">{t('ttWsChecklistHint')}</p>
        </section>
        {limited && (
          <p className="m-0 text-sm text-muted" role="status" data-testid="ws-limit">
            {t('ttWsLimit')}
          </p>
        )}
        <div className="flex flex-col gap-3">
          <AiRunPanel phase={ask.phase} error={ask.error} onStop={ask.stop} onRetry={() => void go()} />
          {!busy && !ask.error && !shown && (
            <div>
              <Button variant="primary" onClick={() => void go()} disabled={!ai || guard.tooLong || guard.tooShort || checks >= MAIL_MAX_CHECKS} data-testid="ws-go">
                {t('ttWsGo')}
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="min-w-0">
        {shown && <MailResult shown={shown} onRevise={() => setShown(null)} onNew={reset} onDone={onClose} />}
      </div>
    </div>
  );
}

/** Haken beim Tippen: gefüllt = gefunden. Die Bedeutung steht auch in Worten (Screenreader), nicht nur in der Form. */
function Tick({ ok }: { ok: boolean }) {
  const { t } = useT();
  return (
    <>
      <span className={`flex size-5 flex-none items-center justify-center rounded-full ${ok ? 'bg-ok-soft text-ok-text' : 'bg-surface-strong text-subtle'}`} aria-hidden="true">
        {ok && <Icon name="check" size={14} />}
      </span>
      <span className="sr-only">{ok ? t('ttWsTicked') : t('ttWsOpen')}</span>
    </>
  );
}
