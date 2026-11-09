import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { sameGapAnswer, type MistakeSpot } from '../../domain/grammar/mistakeSpot';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';
import { mistakeWhy, type MistakeWhyVars } from '../../prompts/mistakeWhy';
import { Button } from '../../ui/Button';

// Neustart E1 (Emrah 08.11.2026: „selbst wenn ich alles lese, checke ich meinen Fehler nicht, weil du ihn nicht erklärst, sondern mir generelle
// Regeln gibst“). Bei einer falschen Antwort steht oben genau das:
//   Du: will sign → richtig: signs
//   EIN Satz, warum genau diese Form hier nicht passt (hinterlegte Erklärung zu genau dieser Antwort, sonst Claude `mistake-why@1`)
//   „Gleich nochmal“: ein neuer Lückensatz zum selben Punkt, sofort selbst prüfbar (zählt nicht)
// Die Regel steht nur auf Tipp („Regel ansehen“). Ohne KI bleibt eine kurze Satzvorlage mit der Form des Musters.

export type MistakeCardProps = {
  taskKey: string;
  spot: MistakeSpot;
  /** Hinterlegte Erklärung zu genau dieser falschen Antwort (Regel mit Bedingung), sonst null. */
  known: { de: string; en: string } | null;
  vars: Omit<MistakeWhyVars, 'du' | 'richtig' | 'known' | 'uiLang'>;
  /** Formel des Musters für die Satzvorlage ohne KI. */
  form: string | null;
  /** Aufgabeneigene Begründung der Lösung („usually“ und „on Fridays“ nennen eine Regel …): besser als die Formel, wenn es sie gibt. */
  okWhy?: string | null;
  rule: ReactNode;
  /** Claude fragen (nicht im Test ohne Hilfe). */
  ai?: boolean;
};

export function MistakeCard({ taskKey, spot, known, vars, form, okWhy = null, rule, ai: aiAllowed = true }: MistakeCardProps) {
  const { t, lang } = useT();
  const aiOn = useAiAvailable() && aiAllowed;
  const ask = useAsk(mistakeWhy);
  const [ruleOpen, setRuleOpen] = useState(false);
  const full: MistakeWhyVars = useMemo(
    () => ({ ...vars, du: spot.du, richtig: spot.richtig, known: known?.de ?? null, uiLang: lang }),
    // Eine Anfrage je Aufgabe und Antwort (Schlüssel), nicht je Zeichnen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [taskKey, lang],
  );
  const run = ask.run;
  useEffect(() => {
    if (aiOn) void run(full);
  }, [aiOn, full, run]);

  const ai = ask.data;
  const warum = known ? known[lang] : ai ? ai.warum[lang] : null;
  const base = t('dxFallback', { du: spot.du || t('dxMissing'), richtig: spot.richtig });
  const fallback = okWhy ? `${base} ${okWhy}` : form ? t('dxFallbackForm', { du: spot.du || t('dxMissing'), richtig: spot.richtig, form }) : t('dxFallback', { du: spot.du || t('dxMissing'), richtig: spot.richtig });
  const waiting = !known && aiOn && (ask.phase === 'queued' || ask.phase === 'thinking' || ask.phase === 'streaming' || ask.phase === 'slow');

  return (
    <div className="flex flex-col gap-3" data-testid="mistake-card">
      <p className="lx-t-body m-0" data-testid="mistake-spot">
        <span className="text-muted">{t('dxYou')}: </span>
        {spot.du ? (
          <del lang="en" className="text-wrong-text">
            {spot.du}
          </del>
        ) : (
          <span className="text-muted">{t('dxMissing')}</span>
        )}
        <span aria-hidden="true" className="text-muted">
          {' → '}
        </span>
        <span className="text-muted">{t('dxRight')}: </span>
        <ins lang="en" className="font-semibold text-ok-text no-underline">
          {spot.richtig}
        </ins>
      </p>
      {waiting ? (
        <p className="lx-t-support m-0 text-muted" role="status" data-testid="mistake-thinking">
          {t('dxThinking')}
        </p>
      ) : (
        <p className="lx-t-support m-0" lang={lang} data-testid="mistake-why" data-src={known ? 'catalog' : ai ? 'ai' : 'fallback'} data-also={!known && ai?.alsoOk ? '1' : undefined}>
          {!known && ai?.alsoOk && <span className="font-semibold">{t('dxAlsoOk')} </span>}
          {warum ?? fallback}
        </p>
      )}
      {ai && !known && (
        <p className="lx-t-meta m-0 text-muted" data-testid="mistake-ai-note">
          {t('exAiNote')}
        </p>
      )}
      {ai?.nochmal && <AgainGap key={`${taskKey}:${ai.nochmal.en}`} en={ai.nochmal.en} answer={ai.nochmal.answer} accepted={ai.nochmal.accepted} />}
      {rule && (
        <div className="flex flex-col gap-2">
          <button type="button" className="lx-vu-link self-start" aria-expanded={ruleOpen} onClick={() => setRuleOpen(!ruleOpen)} data-testid="mistake-rule">
            {ruleOpen ? t('dxRuleHide') : t('dxRule')}
          </button>
          {ruleOpen && rule}
        </div>
      )}
    </div>
  );
}

/** „Gleich nochmal“: der neue Satz mit einem Eingabefeld in der Lücke; geprüft wird nur hier, gebucht wird nichts. */
function AgainGap({ en, answer, accepted }: { en: string; answer: string; accepted: readonly string[] }) {
  const { t } = useT();
  const [value, setValue] = useState('');
  const [done, setDone] = useState<null | boolean>(null);
  const m = /_{3,}/.exec(en);
  const before = m ? en.slice(0, m.index) : en;
  const after = m ? en.slice(m.index + m[0].length) : '';
  const check = (): void => {
    if (done === null && value.trim()) setDone(sameGapAnswer(value, answer, accepted));
  };
  return (
    <section className="flex flex-col gap-2" data-testid="mistake-again" aria-label={t('dxAgain')}>
      <p className="lx-t-support m-0 font-semibold">
        {t('dxAgain')} <span className="font-normal text-muted">· {t('dxAgainLead')}</span>
      </p>
      <p className="lx-t-body m-0" lang="en">
        {before && <EnglishText as="span" text={before} area="trainer" />}
        {/* UX-Prüfung 09.11.2026 K4: eine Linie wie die Lücke der Aufgabe, kein Kasten (Inline-Stil, kein neues CSS). */}
        <input
          className="mx-1 inline-block w-36 align-baseline"
          style={{
            border: 0,
            borderBottom: `2px solid ${done === null ? 'var(--line-2)' : done ? 'var(--ok)' : 'var(--bad)'}`,
            background: 'transparent',
            padding: '0 4px',
            font: 'inherit',
            color: 'inherit',
            outline: 'none',
            borderRadius: 0,
          }}
          lang="en"
          aria-label={t('dxAgainLabel')}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          readOnly={done !== null}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              check();
              e.currentTarget.blur();
            }
          }}
          data-testid="mistake-again-input"
          data-state={done === null ? undefined : done ? 'correct' : 'wrong'}
        />
        {after && <EnglishText as="span" text={after} area="trainer" />}
      </p>
      {done === null ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={check} disabled={!value.trim()} data-testid="mistake-again-check">
            {t('dxAgainCheck')}
          </Button>
          <span className="lx-t-meta text-muted">{t('dxAgainNote')}</span>
        </div>
      ) : (
        <p className={`lx-t-support m-0 ${done ? 'text-ok-text' : 'text-wrong-text'}`} role="status" data-testid="mistake-again-result" data-ok={done ? '1' : '0'}>
          {done ? t('dxAgainOk') : t('dxAgainNo', { a: answer })}
        </p>
      )}
    </section>
  );
}
