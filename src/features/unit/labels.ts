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
export function blockWhy(b: Pick<UnitBlock, 'block' | 'kind' | 'opts'>, t: T, reviewTotal = 0): string {
  const o = b.opts;
  if (o.preply === 'before' && b.block === 3) return t('nbHeuteWhy_preply');
  if (o.src === 'preply-import') return t('nbHeuteWhy_inputImport');
  switch (b.kind) {
    case 'review':
      return reviewTotal > 0 ? t('nbHeuteWhy_review', { n: reviewTotal }) : t('nbHeuteWhy_reviewNone');
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
    case 'focus':
    case 'focus.colloc':
      return t('nbHeuteWhy_focus');
    case 'again':
      return t('nbHeuteWhy_again');
  }
}
