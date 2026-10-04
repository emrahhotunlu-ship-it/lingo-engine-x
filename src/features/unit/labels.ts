import type { MessageKey } from '../../i18n';
import { blockNameKey } from '../../domain/unit/rows';
import type { UnitBlock, UnitBlockKind } from '../../domain/week/types';

// Namen und Gründe der Blöcke (Tageskarte, Zwischenkarte, Zeile unter dem Balken). Eine Stelle,
// damit alle Orte dasselbe sagen (Kap. 2.2).

type T = (k: MessageKey, v?: Record<string, string | number>) => string;

export function blockName(kind: UnitBlockKind, block: number, t: T): string {
  return t(`nbHeuteBlock_${blockNameKey(kind, block)}` as MessageKey);
}

/** Kurzer Grund eines Blocks (eine Zeile). `reviewTotal` = Umfang von Block 1. */
/** `behind` = Block 1 ist wegen Rückstand länger geplant als sonst (`domain/unit/backlog.ts`): die Zeile nennt den Grund. */
export function blockWhy(b: Pick<UnitBlock, 'block' | 'kind' | 'opts'>, t: T, reviewTotal = 0, behind = false): string {
  const o = b.opts;
  switch (b.kind) {
    case 'review':
      return reviewTotal > 0 ? t(behind ? 'nbHeuteWhy_reviewBehind' : 'nbHeuteWhy_review', { n: reviewTotal }) : t('nbHeuteWhy_reviewNone');
    case 'input.read':
      return t('nbHeuteWhy_inputRead');
    case 'input.listen':
      return t('nbHeuteWhy_inputListen');
    case 'pron.shadow':
      return t('nbHeuteWhy_shadow');
    case 'task.say':
      return t('nbHeuteWhy_say');
    case 'task.fluency':
      return o.compare ? t('nbHeuteWhy_fluencyTue') : t('nbHeuteWhy_fluency');
    case 'task.tones':
      return t('nbHeuteWhy_tones');
    case 'task.inbox':
      return o.part === 'read' ? t('nbHeuteWhy_inputMail') : t('nbHeuteWhy_inbox');
    case 'task.objection':
      return t('nbHeuteWhy_objection');
    case 'task.meeting':
      return t('nbHeuteWhy_meeting');
    case 'task.roleplay':
      return t('nbHeuteWhy_roleplay');
    case 'task.check':
      return t('nbHeuteWhy_check');
    case 'focus.colloc':
      return b.block === 3 ? t('nbHeuteWhy_colloc') : t('nbHeuteWhy_focus');
    case 'focus':
      return b.block === 2 ? t('nbHeuteWhy_grammar') : t('nbHeuteWhy_focus');
    case 'task.order':
      return t('nbHeuteWhy_order');
    case 'again':
      return t('nbHeuteWhy_again');
  }
}
