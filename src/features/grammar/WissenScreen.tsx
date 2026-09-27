import { motion } from 'framer-motion';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useNav } from '../../app/nav';
import { TOPICS } from '../../domain/content';
import { ruleOf } from '../../domain/grammar/rules';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { ScreenHeader } from '../learn/ui';
import { TopicSheet, topicName } from './GrammarScreen';
import { useCompanionSee } from '../companion/seeing';

// Nachschlagewerk „Wissen" (Funktionsabgleich M8): Suche über alle 16 Regelblätter (Name,
// Signalwörter, Formen, Beispiele – in beiden Sprachen) und die Übersicht „Deutsch → Englisch:
// typische Fallen" (Kontrast + typische Fehler je Thema), jede mit Beispiel und Sprung zum Thema.

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};

/** Suchtext je Thema: Namen, Regel, Formen, Signalwörter, Beispiele und Fallen – Deutsch und Englisch. */
export function searchIndex(): Array<{ topic: string; text: string }> {
  return TOPICS.map((tp) => {
    const de = ruleOf(tp.id, 'de');
    const en = ruleOf(tp.id, 'en');
    const parts = [tp.name, tp.name_en ?? '', ...(tp.ex ?? [])];
    for (const r of [de, en]) {
      if (!r) continue;
      parts.push(r.core, r.why, r.contrast, ...r.steps, ...r.forms.flatMap((f) => [f.name, f.pattern, f.ex]), ...r.signals.flatMap((s) => [s.signal, s.meaning]), ...r.traps.flatMap((x) => [x.bad, x.good, x.why]));
    }
    return { topic: tp.id, text: parts.join(' \n ').toLowerCase() };
  });
}

export function searchRules(query: string, index = searchIndex()): string[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return index.filter((x) => words.every((w) => x.text.includes(w))).map((x) => x.topic);
}

/**
 * „Typische Fallen" (UX-Beratung Nr. 9): Die Suche über alle Regelblätter steht jetzt oben in
 * Grammatik (`RuleSearch`); hier bleibt die Übersicht „Deutsch → Englisch: typische Fallen" als
 * Unterseite von Grammatik.
 */
export function WissenScreen() {
  const { t, lang } = useT();
  const back = useNav((s) => s.back);
  useCompanionSee({ area: 'grammar', label: t('wsTraps'), phase: 'idle' });
  const [open, setOpen] = useState<string | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const traps = useMemo(
    () =>
      TOPICS.map((tp) => ({ id: tp.id, rule: ruleOf(tp.id, lang) }))
        .filter((x) => x.rule && (x.rule.contrast || x.rule.traps.length))
        .map((x) => ({ id: x.id, contrast: x.rule?.contrast ?? '', trap: x.rule?.traps[0] ?? null })),
    [lang],
  );

  return (
    <motion.div className="flex flex-col gap-6 py-6 sm:py-10" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.03 } } }} data-testid="wissen">
      <motion.div variants={item}>
        <ScreenHeader eyebrow={t('lhGrammar')} title={t('wsTraps')} back={back} />
      </motion.div>
      <motion.ul variants={item} className="flex flex-col divide-y divide-line" data-testid="wissen-traps" aria-label={t('wsTraps')}>
        {traps.map((x) => (
          <li key={x.id} className="flex flex-col gap-2 py-4" data-testid="wissen-trap" data-topic={x.id}>
            <p className="font-medium">{topicName(x.id, lang)}</p>
            {x.contrast && (
              <p className="text-sm text-muted" lang={lang}>
                {x.contrast}
              </p>
            )}
            {x.trap && (
              <p className="flex flex-col text-sm">
                <span className="lx-diff-off" lang="en">
                  {x.trap.bad}
                </span>
                <EnglishText as="span" className="font-medium" text={x.trap.good} area="trainer" source={`grammar/${x.id}`} />
              </p>
            )}
            <div>
              <Button variant="ghost" iconAfter="arrowRight" className="-ml-4" onClick={() => setOpen(x.id)} data-testid="wissen-open">
                {t('wsToTopic')}
              </Button>
            </div>
          </li>
        ))}
      </motion.ul>
      <TopicSheet topic={open} onClose={close} />
    </motion.div>
  );
}

/** Suche „Regel oder Falle suchen" oben in Grammatik (bisher im eigenen Bereich „Wissen"). */
export function RuleSearch({ onOpen }: { onOpen: (topic: string) => void }) {
  const { t, lang } = useT();
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query);
  const index = useMemo(() => searchIndex(), []);
  const hits = useMemo(() => searchRules(q, index), [q, index]);
  return (
    <div className="flex flex-col gap-2">
      <label className="relative block">
        <span className="sr-only">{t('grLookup')}</span>
        <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle" />
        <input type="search" className="lx-field pl-10" value={query} placeholder={t('grLookup')} onChange={(e) => setQuery(e.target.value)} data-testid="wissen-search" autoComplete="off" spellCheck={false} />
      </label>
      {q.trim() && (
        <section className="flex flex-col" aria-live="polite" data-testid="wissen-results">
          {hits.length === 0 ? (
            <p className="py-2 text-base text-muted">{t('wsNothing')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {hits.map((id) => (
                <li key={id}>
                  <button type="button" className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left" onClick={() => onOpen(id)} data-testid="wissen-hit" data-topic={id}>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">{topicName(id, lang)}</span>
                      <span className="truncate text-sm text-muted" lang={lang}>
                        {ruleOf(id, lang)?.core}
                      </span>
                    </span>
                    <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
