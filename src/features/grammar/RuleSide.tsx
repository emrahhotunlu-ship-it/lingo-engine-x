import type { ReactNode } from 'react';
import type { ExplainExample } from '../../domain/explain/types';
import type { Pattern } from '../../domain/grammar/patternTypes';
import { ruleOf } from '../../domain/grammar/rules';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';
import { Examples } from '../../ui/exercise/Examples';

// Karte „Regel“ in der Laptop-Spalte der Grammatik-Übung (Relaunch Teil 1c, D3 V-UEBUNG; Vorschau desk.js `ruleCard`, L3).
// Nur Darstellung vorhandener Felder (`ruleOf`: Kernsatz, typischer Fehler, Signalwörter) und „Ganze Erklärung“ (das Themenblatt).
// Steht erst NACH dem Prüfen da: vorher verriete sie die Lösung (UX-Prüfung W1/W4, GrammarItem `aid={null}`).

/** Gibt es für das Thema etwas zu zeigen? (Sonst bleibt die Spalte bei „Wozu?“.) */
export function hasRule(topic: string, lang: 'de' | 'en'): boolean {
  const rule = ruleOf(topic, lang);
  return !!rule && (!!rule.core || rule.traps.length > 0);
}

export function RuleSide({ topic, pattern = null, onWhole }: { topic: string; pattern?: Pattern | null; onWhole: () => void }) {
  const { t, lang } = useT();
  const rule = ruleOf(topic, lang);
  if (!pattern && (!rule || (!rule.core && !rule.traps.length))) return null;
  // Emrah 08.11.2026 („Passt die Erläuterung zu dieser Übung“): bei „said … will → would“ stand die erste Falle des ganzen Themas
  // (*the film had already started*). Hat die Aufgabe ein Muster, zeigt die Karte dessen Regel, Falle und Signalwörter.
  const core = pattern ? pattern.use[lang] : (rule?.core ?? '');
  const trap = pattern ? pattern.trap : (rule?.traps[0] ?? null);
  const signals = (pattern ? pattern.signals : (rule?.signals ?? []).map((s) => s.signal)).slice(0, 5);
  return (
    <div className="lx-vu-card" data-testid="rule-side">
      {pattern && (
        <p className="lx-t-support m-0 font-semibold" data-testid="rule-side-pattern">
          {pattern.name[lang]}
          <span className="font-normal text-muted"> · {pattern.form[lang]}</span>
        </p>
      )}
      {core && (
        <p className="lx-t-support m-0" lang={lang}>
          {core}
        </p>
      )}
      {trap && (
        <div className="lx-vu-contrast" lang="en">
          <span className="lx-vu-contrast-k" data-k="ok" aria-hidden="true">
            ✓
          </span>
          <span className="font-semibold">
            <span className="sr-only">{t('exCmpExpected')}: </span>
            <EnglishText as="span" text={trap.good} area="trainer" source={`grammar/${topic}`} />
          </span>
          <span className="lx-vu-contrast-k" data-k="bad" aria-hidden="true">
            ✕
          </span>
          <span className="lx-vu-contrast-no">
            <span className="sr-only">{t('exVerdictWrong')}: </span>
            {trap.bad}
          </span>
        </div>
      )}
      {signals.length > 0 && (
        <p className="lx-t-support m-0 text-muted" lang="en">
          {signals.join(' · ')}
        </p>
      )}
      <button type="button" className="lx-vu-link" onClick={onWhole} data-testid="rule-side-whole">
        {t('vuRuleWhole')}
      </button>
    </div>
  );
}

export type RuleStepsProps = {
  topic: string;
  /** Nummer des ersten Abschnitts hier (2, wenn links schon „1 · Was war falsch“ steht). */
  start: number;
  /** Muster der Aufgabe (Name und Formel), sonst nur der Kernsatz der Regel. */
  pattern: { name: string; formula: string | null } | null;
  /** Begründung der Aufgabe (warum die Lösung so ist); sonst der Kernsatz der Regel. */
  why: string | null;
  /** Typischer Fehler der Aufgabe; sonst die erste Falle der Regel. */
  mistake: { bad: string; good: string; cause: string | null } | null;
  example: ExplainExample | null;
  /** Signalwörter des Musters (genauer als die des ganzen Themas, das bei „A vs. B“ beide Zeiten mischt). */
  signals?: readonly string[] | null;
  onWhole: () => void;
};

/**
 * Kern (Emrah 03.11.2026, Vorschau 9pdpfT8E „Handy-Grammatik-Falsch“/„Monitor-Grammatik“): die Erklärung bei Fehler in fester Reihenfolge
 * – (1 · Was war falsch steht links) · Die Regel · Die Falle · Noch ein Beispiel · „Ganze Regel ansehen“. Nur vorhandene Inhalte, nichts erfunden.
 */
/** Name des Musters ohne doppelten Anfang: beginnt die Formel mit dem ersten Teil des Namens („Past Simple · …“ / „Past Simple + …“), entfällt er
 *  im Namen (Lehrer-Prüfung 03.11.2026: „Past Simple“ stand zweimal in einer Zeile). */
function patternHead(p: { name: string; formula?: string | null }): string {
  const [head, ...rest] = p.name.split(' · ');
  return head && rest.length > 0 && p.formula?.trim().startsWith(head.trim()) ? rest.join(' · ') : p.name;
}

export function RuleSteps({ topic, start, pattern, why, mistake, example, signals: own = null, onWhole }: RuleStepsProps) {
  const { t, lang } = useT();
  const rule = ruleOf(topic, lang);
  const ruleText = (why ?? '').trim() || rule?.core || '';
  // Höchstens vier Signalwörter; die Themenliste nur, wenn das Muster keine eigenen hat (Einträge können „a, b, c“ bündeln).
  const signals = [
    ...new Set(
      (own && own.length ? own : (rule?.signals ?? []).map((s) => s.signal))
        .flatMap((x) => x.split(','))
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ].slice(0, 4);
  const ruleTrap = rule?.traps[0] ?? null;
  const trap = mistake ?? (ruleTrap ? { bad: ruleTrap.bad, good: ruleTrap.good, cause: ruleTrap.why || null } : null);
  // Das Beispiel soll nicht der Satz aus der Falle sein (sonst stünde er zweimal da).
  const ex = example && (!trap || example.en.trim() !== trap.good.trim()) ? example : null;
  const sections: Array<{ id: 'rule' | 'trap' | 'example'; label: string; body: ReactNode }> = [];
  if (pattern || ruleText) {
    sections.push({
      id: 'rule',
      label: t('kernStepRule'),
      body: (
        <>
          {pattern && (
            <p className="lx-t-support m-0 font-semibold" data-testid="rule-step-pattern">
              {patternHead(pattern)}
              {pattern.formula ? <span className="font-normal text-muted"> · {pattern.formula}</span> : null}
            </p>
          )}
          {ruleText && (
            <p className="lx-t-support m-0" lang={lang}>
              {ruleText}
            </p>
          )}
          {signals.length > 0 && (
            <p className="lx-t-support m-0 text-muted">
              {/* Die Signalwörter sind Englisch (Sprachausgabe, Sprachtreue): eigene Spanne mit lang="en". */}
              {t('kernSignals', { words: '\u0000' }).split('\u0000')[0]}
              <span lang="en">{signals.join(', ')}</span>
              {t('kernSignals', { words: '\u0000' }).split('\u0000')[1]}
            </p>
          )}
        </>
      ),
    });
  }
  if (trap) {
    sections.push({
      id: 'trap',
      label: t('kernStepTrap'),
      body: (
        <>
          {trap.cause && (
            <p className="lx-t-support m-0" lang={lang}>
              {trap.cause}
            </p>
          )}
          <div className="lx-vu-contrast" lang="en">
            <span className="lx-vu-contrast-k" data-k="ok" aria-hidden="true">
              ✓
            </span>
            <span className="font-semibold">
              <span className="sr-only">{t('exCmpExpected')}: </span>
              <EnglishText as="span" text={trap.good} area="trainer" source={`grammar/${topic}`} />
            </span>
            <span className="lx-vu-contrast-k" data-k="bad" aria-hidden="true">
              ✕
            </span>
            <span className="lx-vu-contrast-no">
              <span className="sr-only">{t('kernTrapNot')}: </span>
              {trap.bad}
            </span>
          </div>
        </>
      ),
    });
  }
  if (ex) {
    sections.push({ id: 'example', label: t('kernStepExample'), body: <Examples items={[ex]} open={1} area="trainer" label={false} /> });
  }
  // Emrah 05.11.2026 („kurze Erläuterung ok, aber nicht lange – evtl. zum Aufklappen“): offen steht nur die Regel; Falle und Beispiel
  // stehen unter „Falle und Beispiel“ zum Aufklappen (dieselbe Nummerierung).
  const step = (sec: (typeof sections)[number], i: number) => (
    <section key={sec.id} className="flex flex-col gap-1.5" data-step={sec.id} aria-label={sec.label}>
      <h3 className="lx-eyebrow m-0 text-muted">{t('kernStep', { n: start + i, label: sec.label })}</h3>
      {sec.body}
    </section>
  );
  const first = sections[0]?.id === 'rule' ? 1 : 0;
  const more = sections.slice(first);
  return (
    <div className="lx-vu-card lx-ksteps" data-testid="rule-steps">
      {sections.slice(0, first).map(step)}
      {more.length > 0 &&
        (first ? (
          <details className="lx-ksteps-more" data-testid="rule-steps-more">
            <summary className="lx-vu-link cursor-pointer">{t('kernStepsMore')}</summary>
            <div className="mt-3 flex flex-col gap-4">{more.map((sec, i) => step(sec, i + first))}</div>
          </details>
        ) : (
          more.map((sec, i) => step(sec, i))
        ))}
      <button type="button" className="lx-vu-link" onClick={onWhole} data-testid="rule-side-whole">
        {t('kernRuleWhole')}
      </button>
    </div>
  );
}
