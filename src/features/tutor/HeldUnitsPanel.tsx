import { useState } from 'react';
import type { HeldUnitRow } from '../../domain/lexicon/unitHeld';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Disclosure } from '../../ui/Disclosure';
import { toast } from '../../ui/Toast';
import { releaseHeldUnit } from './heldUnits';

// Kartenqualität (26.10.2026, docs/umbau/card-quality.md): ruhende Lesekarten (Wortgruppe ohne feste Einheit) in der Lehrer-Liste.
// Nichts wird gelöscht; „Doch lernen“ ergänzt nur `lu` an der Karte, danach kommt sie wieder ins Training.

export function HeldUnitsPanel({ rows }: { rows: readonly HeldUnitRow[] }) {
  const { t } = useT();
  const [state, setState] = useState<Record<string, 'busy' | 'done' | 'failed'>>({});
  if (!rows.length) return null;
  const release = async (path: string) => {
    setState((s) => ({ ...s, [path]: 'busy' }));
    const ok = await releaseHeldUnit(path);
    setState((s) => ({ ...s, [path]: ok ? 'done' : 'failed' }));
    // Die Zeile verschwindet mit dem nächsten Live-Stand; die Bestätigung bleibt als Meldung sichtbar.
    if (ok) toast(t('ttCqReleased'));
  };
  return (
    <Disclosure label={t('ttCqHeldList')} testId="ai-held-units-toggle">
      <div className="flex flex-col gap-2" data-testid="ai-held-units">
        <p className="m-0 text-xs text-muted">{t('ttCqHeldHint')}</p>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {rows.map((r) => {
            const st = state[r.path];
            return (
              <li key={r.path} className="flex flex-col gap-1" data-testid="ai-held-unit" data-w={r.word}>
                <p className="m-0 text-sm">
                  <span className="font-semibold text-fg" lang="en">
                    {r.word}
                  </span>
                  {r.de ? <span className="text-muted"> · {r.de}</span> : null}
                </p>
                {r.better ? (
                  <p className="m-0 text-xs text-muted">
                    {t('ttCqBetterLabel')}{' '}
                    <span className="font-medium text-fg" lang="en">
                      {r.better}
                    </span>
                  </p>
                ) : null}
                {st === 'done' ? (
                  <p className="m-0 text-xs font-medium text-ok-text" role="status" data-testid="ai-held-unit-released">
                    {t('ttCqReleased')}
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" busy={st === 'busy'} aria-label={t('ttCqReleaseAria', { word: r.word })} onClick={() => void release(r.path)} data-testid="ai-held-unit-release">
                      {t('ttCqRelease')}
                    </Button>
                    {st === 'failed' ? (
                      <p className="m-0 text-xs text-danger-text" role="status">
                        {t('ttCqReleaseFailed')}
                      </p>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Disclosure>
  );
}
