import type { WhyCat, WhyRule } from '../../domain/explain/types';
import type { C1Item } from '../../domain/c1x/types';
import type { MessageKey } from '../../i18n';
import { useT } from '../../i18n';

// „Warum nicht …?“ (Lernplattform 3.0 §3.5, P14): je falscher Option (bzw. getroffener Falle) eine Zeile mit Kategorie. Gilt auch bei richtiger
// Antwort: das Warum der anderen Optionen festigt den Unterschied. Die Zeile der eigenen Wahl steht fett.

const CAT: Record<WhyCat, MessageKey> = {
  calque: 'cxCat_calque',
  partner: 'cxCat_partner',
  grammar: 'cxCat_grammar',
  meaning: 'cxCat_meaning',
  register: 'cxCat_register',
};

export function WhyList({ item, matched }: { item: C1Item; matched: WhyRule | null }) {
  const { t, lang } = useT();
  // Auswahlarten: alle falschen Optionen (Regeln mit `opt`); sonst nur die getroffene Regel (Falle bzw. falsch angetippter Satzteil).
  const own = item.why.wrong.filter((r) => r.opt !== undefined);
  const rows: WhyRule[] = own.length ? own : matched ? [matched] : [];
  if (!rows.length) return null;
  const text = (r: WhyRule): string => (lang === 'de' ? r.de : r.en);
  return (
    <section className="mt-3 flex flex-col gap-2" aria-label={t('cxWhyTitle')} data-testid="why-list">
      <h3 className="lx-t-meta font-medium text-muted">{t('cxWhyTitle')}</h3>
      <ul className="cx-why">
        {rows.map((r, i) => (
          <li key={`${r.opt ?? r.de}:${i}`} className="cx-why-row lx-t-support" data-mine={matched === r ? 'true' : undefined}>
            {r.opt && <span lang="en">{t('cxWhyOne', { opt: r.opt })} </span>}
            {r.cat && <span className="text-muted">{t(CAT[r.cat])}: </span>}
            <span lang={lang}>{text(r)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
