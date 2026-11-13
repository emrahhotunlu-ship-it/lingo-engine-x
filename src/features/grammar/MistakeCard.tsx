import { useMemo, useState, type ReactNode } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { sameGapAnswer, type MistakeSpot } from '../../domain/grammar/mistakeSpot';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';
import { mistakeWhy, type MistakeWhyVars } from '../../prompts/mistakeWhy';
import { Button } from '../../ui/Button';

// Die EINE Fehler-Karte der Grammatik (Politur P3, 13.11.2026; vorher Neustart E1 vom 08.11.): für jede Aufgabenart dieselbe, flache Karte.
//   EIN Satz warum – zuerst der geprüfte Text (die hinterlegte Erklärung zu genau dieser Antwort, sonst die Begründung der Lösung)
//   darunter eine ruhige Zeile mit Wegen auf Tipp: „Gleich nochmal“ (neuer Lückensatz aus dem Vorrat) · „Regel ansehen“ · „Claude fragen, warum“
// Die Lösung steht genau einmal: im Satz (Lücke, Auswahl, korrigierter Satz) – die Karte wiederholt sie nicht. Claude fragt nur, wer tippt;
// von selbst läuft nichts (kein Warten, keine springende Karte). Keine Kästen in der Karte: am Außendisplay (375×700) bleibt „Weiter“ im Bild.

/** Links der Wege-Zeile: ohne eigenen negativen Rand (den trägt die Zeile). */
const LINK = { margin: 0 } as const;

/** `hint`: Stichwort der Vorrat-Aufgabe (z. B. „(sign)“), wenn es nicht im Satz steht. `expl`: geprüftes Warum der Vorrat-Aufgabe. */
export type MistakeAgain = { en: string; answer: string; accepted: readonly string[]; hint?: string | null; expl?: { de: string | null; en: string | null } | null };

export type MistakeCardProps = {
  taskKey: string;
  /** Geprüfter Warum-Satz: `catalog` = Erklärung zu genau dieser falschen Antwort, `ok` = Begründung der Lösung. `null`: nichts hinterlegt (dann die Satzvorlage). */
  why: { text: string; src: 'catalog' | 'ok' } | null;
  /** Abweichende Stelle (eigene Antwort → Lösung) für die Satzvorlage und für Claude; `null` ohne eigene Antwort („Weiß ich nicht“, Auswahl). */
  spot: MistakeSpot | null;
  vars: Omit<MistakeWhyVars, 'du' | 'richtig' | 'known' | 'uiLang'>;
  /** Formel des Musters für die Satzvorlage. */
  form: string | null;
  rule: ReactNode;
  /** „Gleich nochmal“: ein anderer Lückensatz zum selben Muster aus dem Vorrat (geprüfter Inhalt, nie von Claude erzeugt). */
  again?: MistakeAgain | null;
  /** Claude fragen erlaubt (nicht im Test ohne Hilfe, nicht wenn schon „Claude fragen, ob deine Antwort auch stimmt“ dasteht). */
  ai?: boolean;
  /** Leiser Weg „Aufgabe war unfair?“ in derselben Zeile. */
  onUnfair?: (() => void) | null;
};

export function MistakeCard({ taskKey, why, spot, vars, form, rule, again = null, ai: aiAllowed = true, onUnfair = null }: MistakeCardProps) {
  const { t, lang } = useT();
  const aiOn = useAiAvailable() && aiAllowed;
  const ask = useAsk(mistakeWhy);
  const [open, setOpen] = useState<null | 'again' | 'rule'>(null);
  const [asked, setAsked] = useState(false);
  const full: MistakeWhyVars = useMemo(
    () => ({ ...vars, du: spot?.du ?? '', richtig: spot?.richtig ?? vars.answer, known: why?.text ?? null, uiLang: lang }),
    // Eine Anfrage je Aufgabe und Antwort (Schlüssel), nicht je Zeichnen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [taskKey, lang],
  );
  const askNow = (): void => {
    if (asked) return;
    setAsked(true);
    void ask.run(full);
  };

  const data = ask.data;
  const richtig = spot?.richtig ?? vars.answer;
  const fallback = !spot?.du
    ? form
      ? t('dxFallbackSolForm', { richtig, form })
      : t('dxFallbackSol', { richtig })
    : form
      ? t('dxFallbackForm', { du: spot.du, richtig, form })
      : t('dxFallback', { du: spot.du, richtig });
  const waiting = asked && !data && (ask.phase === 'queued' || ask.phase === 'thinking' || ask.phase === 'streaming' || ask.phase === 'slow');
  const failed = asked && !data && !waiting;

  return (
    <div className="flex flex-col gap-2" data-testid="mistake-card">
      <p className="lx-t-body m-0" lang={lang} data-testid="mistake-why" data-src={why ? why.src : 'fallback'}>
        {why ? why.text : fallback}
      </p>
      {waiting && (
        <p className="lx-t-support m-0 text-muted" role="status" data-testid="mistake-thinking">
          {t('dxThinking')}
        </p>
      )}
      {data && (
        <p className="lx-t-support m-0" lang={lang} data-testid="mistake-ai" data-also={data.alsoOk ? '1' : undefined}>
          {data.alsoOk && <span className="font-semibold">{t('dxAlsoOk')} </span>}
          {data.warum[lang]} <span className="text-muted">· {t('exAiNote')}</span>
        </p>
      )}
      {failed && (
        <p className="lx-t-support m-0 text-muted" role="status" data-testid="mistake-ai-failed">
          {t('dxAskFailed')}
        </p>
      )}
      {/* Die Links tragen 44 px Tippfläche mit negativem Rand (`.lx-vu-link`); beim Umbruch (Außendisplay) überlappten die Zeilen. Deshalb sitzt
          der negative Rand an der Zeile, die Links selbst haben keinen: eine Zeile bleibt so flach wie bisher, umbrochene Zeilen überlappen nicht. */}
      <div className="flex flex-wrap items-center gap-x-5" style={{ margin: '-8px 0 -10px' }} data-testid="mistake-actions">
        {again && (
          <button type="button" className="lx-vu-link" style={LINK} aria-expanded={open === 'again'} onClick={() => setOpen(open === 'again' ? null : 'again')} data-testid="mistake-again-open">
            {t('dxAgain')}
          </button>
        )}
        {rule && (
          <button type="button" className="lx-vu-link" style={LINK} aria-expanded={open === 'rule'} onClick={() => setOpen(open === 'rule' ? null : 'rule')} data-testid="mistake-rule">
            {open === 'rule' ? t('dxRuleHide') : t('dxRule')}
          </button>
        )}
        {aiOn && !asked && (
          <button type="button" className="lx-vu-link" style={LINK} onClick={askNow} data-testid="mistake-ask">
            {t('dxAskClaude')}
          </button>
        )}
        {onUnfair && (
          <button type="button" className="lx-vu-link text-muted" style={LINK} onClick={onUnfair} data-testid="gm-unfair">
            {t('gmUnfairLink')}
          </button>
        )}
      </div>
      {open === 'again' && again && <AgainGap key={`${taskKey}:${again.en}`} en={again.en} answer={again.answer} accepted={again.accepted} hint={again.hint ?? null} expl={again.expl ?? null} />}
      {open === 'rule' && rule}
    </div>
  );
}

/** „Gleich nochmal“: der neue Satz mit einem Eingabefeld in der Lücke; geprüft wird nur hier, gebucht wird nichts. */
function AgainGap({ en, answer, accepted, hint, expl }: MistakeAgain) {
  const { t, lang } = useT();
  // Warum nach dem Prüfen (bei richtig und falsch, Kap. 2 Nr. 4): die geprüfte Erklärung der Vorrat-Aufgabe in der Sprache der Oberfläche.
  const why = expl?.[lang] ?? null;
  const [value, setValue] = useState('');
  const [done, setDone] = useState<null | boolean>(null);
  const m = /_{3,}(\s*\([^)]*\))?/.exec(en);
  const before = m ? en.slice(0, m.index) : en;
  const own = m?.[1]?.trim() ?? '';
  // Stichwort aus der Aufgabe (eigenes Feld `hint`), in Klammern wie im Satz.
  const cue = own || (hint ? (hint.startsWith('(') ? hint : `(${hint})`) : '');
  const after = m ? en.slice(m.index + m[0].length) : '';
  const check = (): void => {
    if (done === null && value.trim()) setDone(sameGapAnswer(value, answer, accepted));
  };
  return (
    <section className="flex flex-col gap-2" data-testid="mistake-again" aria-label={t('dxAgain')}>
      <p className="lx-t-meta m-0 text-muted">{t('dxAgainLead')}</p>
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
        {cue && <span className="text-muted">{cue} </span>}
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
        <>
          <p className={`lx-t-support m-0 ${done ? 'text-ok-text' : 'text-wrong-text'}`} role="status" data-testid="mistake-again-result" data-ok={done ? '1' : '0'}>
            {done ? t('dxAgainOk') : t('dxAgainNo', { a: answer })}
          </p>
          {why && (
            <p className="lx-t-support m-0" lang={lang} data-testid="mistake-again-why">
              {why}
            </p>
          )}
        </>
      )}
    </section>
  );
}
