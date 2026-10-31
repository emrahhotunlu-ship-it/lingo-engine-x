import { ruleOf } from '../../domain/grammar/rules';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';

// Karte „Regel“ in der Laptop-Spalte der Grammatik-Übung (Relaunch Teil 1c, D3 V-UEBUNG; Vorschau desk.js `ruleCard`, L3).
// Nur Darstellung vorhandener Felder (`ruleOf`: Kernsatz, typischer Fehler, Signalwörter) und „Ganze Erklärung“ (das Themenblatt).
// Steht erst NACH dem Prüfen da: vorher verriete sie die Lösung (UX-Prüfung W1/W4, GrammarItem `aid={null}`).

/** Gibt es für das Thema etwas zu zeigen? (Sonst bleibt die Spalte bei „Wozu?“.) */
export function hasRule(topic: string, lang: 'de' | 'en'): boolean {
  const rule = ruleOf(topic, lang);
  return !!rule && (!!rule.core || rule.traps.length > 0);
}

export function RuleSide({ topic, onWhole }: { topic: string; onWhole: () => void }) {
  const { t, lang } = useT();
  const rule = ruleOf(topic, lang);
  if (!rule || (!rule.core && !rule.traps.length)) return null;
  const trap = rule.traps[0] ?? null;
  const signals = rule.signals.slice(0, 5).map((s) => s.signal);
  return (
    <div className="lx-vu-card" data-testid="rule-side">
      {rule.core && (
        <p className="m-0 font-semibold" lang={lang}>
          {rule.core}
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
