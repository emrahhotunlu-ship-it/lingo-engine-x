import { useT } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { rememberConversation, useRemember } from './memory';
import { useCompanion } from './store';

// „Merken“ im Begleiter (Backlog B5): Claude zieht bis zu 5 Fakten aus dem Gespräch. Nach dem
// Merken ist der Knopf ein Zustand („✓ 2 Dinge gemerkt“), bis eine neue Antwort kommt.

export function RememberChip() {
  const { t, tn, lang } = useT();
  const r = useRemember();
  const finished = useCompanion((s) => s.finished);
  const doneHere = r.status === 'done' && r.at === finished;
  if (doneHere) {
    return (
      <span className="inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted" role="status" data-testid="chat-remembered" data-n={r.added}>
        <Icon name="check" size={16} />
        {r.added ? tn('nbProfilMemDone', r.added) : t('nbProfilMemNone')}
      </span>
    );
  }
  const running = r.status === 'running';
  return (
    <button
      type="button"
      onClick={() => void rememberConversation(lang, finished)}
      disabled={running}
      className="inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full bg-accent-soft px-4 text-sm font-semibold text-accent-text disabled:opacity-60"
      data-testid="chat-action"
      data-action="remember"
      data-state={r.status}
      data-ai=""
    >
      <Icon name="sparkle" size={16} />
      {running ? t('nbProfilMemRunning') : r.status === 'error' && r.at === finished ? t('nbProfilMemFailed') : t('nbProfilMemOffer')}
    </button>
  );
}
