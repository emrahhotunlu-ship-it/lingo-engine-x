import { motion } from 'framer-motion';
import { useState } from 'react';
import { useT } from '../../i18n';
import { useCollection } from '../../data/watch';
import { chunkId, chunkPresence, type NewChunkInput } from '../../domain/chunks/newChunk';
import { Icon } from '../../ui/Icon';
import { DURATION } from '../../ui/motion';
import { restoreChunk, takeChunk } from './persist';

// „Mitnehmen“ (Plan §5.3, D6): idle → saving → taken („In deinen Wendungen ✓“, KEIN Knopf mehr –
// Kap. 2.2), `exists` → Zustand, `hidden` → „Wieder aufnehmen“, Fehler → Rückrollen mit Hinweis.
// Den Bestand liest ein ansichtsgebundenes Abo auf `chunk` (ein Abo für alle Knöpfe).

type LocalState = 'idle' | 'saving' | 'taken' | 'error' | 'restoring';

/** Eingabe ohne Zeitstempel – der entsteht erst beim Tippen (nie im Render). */
export type TakeInput = Omit<NewChunkInput, 'nowMs'>;

type Props = { input: TakeInput; onTaken?: (en: string) => void; compact?: boolean };

export function TakeChunkButton({ input, onTaken, compact }: Props) {
  const { t } = useT();
  const chunks = useCollection('chunk');
  const [local, setLocal] = useState<LocalState>('idle');
  const id = chunkId(input.en);
  const presence = id ? chunkPresence(chunks?.get(id)) : 'absent';

  const state: 'idle' | 'saving' | 'taken' | 'exists' | 'hidden' | 'error' =
    local === 'taken' ? 'taken' : local === 'saving' || local === 'restoring' ? 'saving' : presence === 'present' ? 'exists' : presence === 'hidden' ? 'hidden' : local === 'error' ? 'error' : 'idle';

  const take = async () => {
    setLocal('saving');
    const r = await takeChunk({ ...input, nowMs: Date.now() });
    if (r === 'taken') {
      setLocal('taken');
      onTaken?.(input.en);
    } else if (r === 'exists' || r === 'hidden') setLocal('idle');
    else setLocal('error');
  };

  const restore = async () => {
    if (!id) return;
    setLocal('restoring');
    const ok = await restoreChunk(id);
    setLocal(ok ? 'taken' : 'error');
    if (ok) onTaken?.(input.en);
  };

  if (!id) return null;
  const base = `inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm ${compact ? '' : 'font-medium'}`;

  if (state === 'taken' || state === 'exists') {
    return (
      <motion.span
        data-testid="take-chunk"
        data-state={state}
        initial={state === 'taken' ? { scale: 0.96, opacity: 0.6 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: DURATION.base }}
        className={`${base} text-accent-text`}
        role="status"
      >
        <Icon name="check" size={16} />
        {state === 'taken' ? t('takeTaken') : t('takeExists')}
      </motion.span>
    );
  }
  return (
    <span data-testid="take-chunk" data-state={state} className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void (state === 'hidden' ? restore() : take())}
        disabled={state === 'saving'}
        aria-busy={state === 'saving' || undefined}
        className={`${base} lx-glass text-fg hover:bg-surface-strong disabled:opacity-60`}
      >
        <Icon name="bookmarkPlus" size={16} />
        {state === 'hidden' ? t('takeRestore') : t('takeIdle')}
      </button>
      {state === 'error' && (
        <span role="alert" className="text-xs text-danger-text">
          {t('takeError')}
        </span>
      )}
    </span>
  );
}
