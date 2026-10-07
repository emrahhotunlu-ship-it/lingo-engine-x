import type { PartId, PartResult } from '../../domain/c1x/types';
import { useT, type MessageKey } from '../../i18n';

// Teilpunkte (Lernplattform 3.0 §3.1, P14): ein Segment je Teil mit Zeichen ✓/✕ und Wort („Teil 1 ✓ · Teil 2 ✕“). Farbe nie allein.

function labelKey(id: PartId): { key: MessageKey; n?: number } {
  if (id === 'a') return { key: 'cxPartA' };
  if (id === 'b') return { key: 'cxPartB' };
  if (id === 'loc') return { key: 'cxPartLoc' };
  if (id === 'fix') return { key: 'cxPartFix' };
  if (id === 'meaning') return { key: 'cxPartMeaning' };
  if (id === 'form') return { key: 'cxPartForm' };
  if (id === 'transfer') return { key: 'cxPartTransfer' };
  if (id.startsWith('seg')) return { key: 'cxPartSeg', n: Number(id.slice(3)) + 1 };
  return { key: 'cxPartLink', n: Number(id.slice(4)) + 1 };
}

export function PartBar({ parts }: { parts: readonly PartResult[] }) {
  const { t } = useT();
  if (parts.length < 2) return null;
  return (
    <ol className="cx-parts" aria-label={t('cxParts')} data-testid="part-bar">
      {parts.map((p) => {
        const l = labelKey(p.id);
        return (
          <li key={p.id} className="cx-part" data-part={p.id} data-ok={p.ok ? 'true' : 'false'}>
            <span aria-hidden="true" className="cx-part-mark">
              {p.ok ? '✓' : '✕'}
            </span>
            <span>{l.n !== undefined ? t(l.key, { n: l.n }) : t(l.key)}</span>
            <span className="sr-only"> — {p.ok ? t('cxPartOk') : t('cxPartNo')}</span>
          </li>
        );
      })}
    </ol>
  );
}
