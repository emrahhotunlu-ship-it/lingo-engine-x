import { useState } from 'react';
import { MEMORY_MAX } from '../../domain/memory/memory';
import { useT } from '../../i18n';
import { useCapabilities } from '../../platform/capabilities';
import { IconButton } from '../../ui/Button';
import { toast } from '../../ui/Toast';
import { forgetFact, useMemoryFacts } from '../companion/memory';

// „Claude merkt sich“ (Backlog B5) in den Einstellungen, Gruppe „Mein Kontext“: alle gemerkten
// Fakten (neueste oben), jeder einzeln löschbar (ein transform je Tipp, domain/memory).

export function MemorySection() {
  const { t, num } = useT();
  const db = useCapabilities((s) => s.db);
  const facts = useMemoryFacts();
  const [busy, setBusy] = useState<string | null>(null);
  if (db !== 'ready') return null;
  const shown = [...facts].sort((a, b) => b.t - a.t);
  const forget = async (id: string) => {
    setBusy(id);
    const ok = await forgetFact(id);
    setBusy(null);
    if (!ok) toast(t('nbProfilMemDeleteFailed'));
  };
  return (
    <section className="flex flex-col gap-3" data-testid="memory-section" data-n={facts.length}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="lx-eyebrow">{t('nbProfilMemTitle')}</h3>
        <span className="lx-tnum text-xs text-subtle">{t('nbProfilMemCount', { n: num(facts.length), max: num(MEMORY_MAX) })}</span>
      </div>
      <p className="text-sm text-muted">{t('nbProfilMemLead')}</p>
      {shown.length === 0 ? (
        <p className="text-sm text-subtle" data-testid="memory-empty">
          {t('nbProfilMemEmpty')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-control)] border border-line" data-testid="memory-list">
          {shown.map((f) => (
            <li key={f.id} className="flex items-center gap-2 py-1 pr-1 pl-4" data-testid="memory-fact" data-id={f.id}>
              <span className="min-w-0 flex-1 py-2 text-sm leading-snug break-words" lang={f.lang}>
                {f.text}
              </span>
              <IconButton icon="close" label={t('nbProfilMemDelete', { text: f.text })} onClick={() => void forget(f.id)} disabled={busy === f.id} data-testid="memory-forget" className="flex-none" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
