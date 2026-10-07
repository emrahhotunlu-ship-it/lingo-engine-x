import type { MessageKey } from '../../i18n';
import { blockNameKey } from '../../domain/unit/rows';
import { FORMAT_N } from '../../domain/c1/checkSchedule';
import type { Step3Fmt } from '../../domain/plan/types';
import type { UnitBlock, UnitBlockKind } from '../../domain/unit/types';

// Namen und Gründe der Blöcke (Tageskarte, Zwischenkarte, Zeile unter dem Balken). Eine Stelle,
// damit alle Orte dasselbe sagen (Kap. 2.2).

type T = (k: MessageKey, v?: Record<string, string | number>) => string;

/** `fmt` = Format-Tag (P23): Schritt 3 heißt dann wie die Aufgabenart („Kleines Wort“), sonst „Satzbau“. */
export function blockName(kind: UnitBlockKind, block: number, t: T, fmt?: Step3Fmt): string {
  if (fmt && block === 3 && kind === 'task.order') return t(`cxKindName_${fmt}` as MessageKey);
  return t(`nbHeuteBlock_${blockNameKey(kind, block)}` as MessageKey);
}

/** Kurzer Grund eines Blocks (eine Zeile). `reviewTotal` = Umfang von Block 1. */
/** `behind` = Block 1 ist wegen Rückstand länger geplant als sonst (`domain/unit/backlog.ts`): die Zeile nennt den Grund. */
export function blockWhy(b: Pick<UnitBlock, 'block' | 'kind' | 'opts'> & { args?: UnitBlock['args'] }, t: T, reviewTotal = 0, behind = false): string {
  switch (b.kind) {
    case 'review':
      return reviewTotal > 0 ? t(behind ? 'nbHeuteWhy_reviewBehind' : 'nbHeuteWhy_review', { n: reviewTotal }) : t('nbHeuteWhy_reviewNone');
    case 'task.check':
      return t('nbHeuteWhy_check');
    case 'focus':
      return b.block === 2 ? t('nbHeuteWhy_grammar') : t('nbHeuteWhy_focus');
    case 'grammar':
      return t('nbHeuteWhy_grammar');
    case 'task.order':
      if (b.args?.mode === 'format' && b.args.fmt) return t('cxFormatWhy', { n: FORMAT_N[b.args.fmt] });
      return t('nbHeuteWhy_order');
    case 'again':
      return t('nbHeuteWhy_again');
    default:
      // Blöcke entfallener Bereiche (Lesen, Hören, Sprechen, Schreiben …): kein Text, sie werden nicht mehr angezeigt (`domain/plan/retire`).
      return '';
  }
}
