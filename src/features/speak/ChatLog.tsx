import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { useT } from '../../i18n';
import type { AnalysisSlot, Persona, Turn } from '../../domain/speak/types';
import { EnglishText } from '../../engine/EnglishText';
import { SpeakButton } from '../../engine/SpeakButton';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { VERDICT_KEY } from './AnalysisCard';

// Gesprächsverlauf (Plan §5.2). Figur links, eigene Sätze rechts, unter jedem eigenen Satz ein
// Analyse-Chip mit Status-Punkt. Nichts öffnet sich von selbst. Scrollen: Nur wenn man unten ist
// (≤ 48 px), folgt die Ansicht neuem Text; sonst erscheint die Pille „Neue Antwort ↓“ (Kap. 15:
// „Chat springt beim Lesen nach unten“ darf nicht wiederkommen).

const NEAR_BOTTOM_PX = 48;

function atBottom(): boolean {
  const doc = document.documentElement;
  return window.innerHeight + window.scrollY >= doc.scrollHeight - NEAR_BOTTOM_PX;
}

const DOT: Record<string, string> = {
  pending: 'bg-subtle animate-pulse',
  clean: 'bg-accent',
  minor: 'bg-[var(--lx-gold-text)]',
  errors: 'bg-danger-text',
  failed: 'bg-subtle',
  skipped: 'bg-subtle',
};

export function chipState(slot: AnalysisSlot | undefined): 'pending' | 'clean' | 'minor' | 'errors' | 'failed' | 'skipped' {
  if (!slot) return 'pending';
  if (slot.state === 'done') return slot.data ? slot.data.verdict : 'failed';
  return slot.state;
}

type Props = {
  turns: readonly Turn[];
  analyses: Readonly<Record<number, AnalysisSlot>>;
  persona: Persona;
  sceneId: string;
  sceneTitle: string;
  /** Text der Figur, der gerade einläuft ('' = noch nichts). */
  partial: string;
  phase: 'composing' | 'thinking' | 'streaming' | 'slow' | 'other';
  onStop: () => void;
  openIdx: number | null;
  onChip: (idx: number) => void;
  renderInline: (idx: number) => ReactNode;
};

export function ChatLog({ turns, analyses, persona, sceneId, sceneTitle, partial, phase, onStop, openIdx, onChip, renderInline }: Props) {
  const { t } = useT();
  const count = turns.length + (partial ? 1 : 0);
  // Folgt die Ansicht neuem Text? Nur, wenn man unten ist (Scroll-Ereignis setzt den Zustand).
  const [atEnd, setAtEnd] = useState(true);
  const [seen, setSeen] = useState(count);
  if (atEnd && seen !== count) setSeen(count);
  const newer = !atEnd && count > seen;

  useEffect(() => {
    const onScroll = () => setAtEnd(atBottom());
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Neue Züge oder einlaufender Text: nur folgen, wenn man unten war (Kap. 15).
  useLayoutEffect(() => {
    if (atEnd) window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [count, partial, atEnd]);

  const toBottom = () => {
    setAtEnd(true);
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col gap-4" aria-live="polite" aria-relevant="additions">
      {turns.map((turn, i) =>
        turn.role === 'persona' ? (
          <motion.div
            key={`${i}-${turn.t}`}
            data-testid="rp-turn"
            data-role="persona"
            data-idx={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            className="flex max-w-[44rem] flex-col gap-1 self-start"
          >
            <p className="text-xs font-medium text-muted">
              {persona.name} · {persona.role}
            </p>
            <div className="lx-glass flex items-start gap-1 rounded-2xl rounded-tl-md px-4 py-3">
              <EnglishText text={turn.text} area="speak" source={`scene/${sceneId}`} title={sceneTitle} className="min-w-0 flex-1 text-base leading-relaxed" />
              <SpeakButton text={turn.text} />
            </div>
            {turn.truncated && <p className="text-xs text-subtle">{t('spTruncated')}</p>}
          </motion.div>
        ) : (
          <motion.div
            key={`${i}-${turn.t}`}
            data-testid="rp-turn"
            data-role="me"
            data-idx={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            className="flex max-w-[44rem] flex-col items-end gap-1.5 self-end"
          >
            <div className="rounded-2xl rounded-tr-md bg-surface-strong px-4 py-3">
              <EnglishText text={turn.text} area="speak" source={`scene/${sceneId}`} title={sceneTitle} className="text-base leading-relaxed" />
            </div>
            <AnalysisChip idx={i} slot={analyses[i]} open={openIdx === i} onClick={() => onChip(i)} />
            <AnimatePresence initial={false}>
              {openIdx === i && (
                <motion.div
                  key="inline"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: DURATION.base, ease: EASE_OUT }}
                  className="w-full self-stretch overflow-hidden"
                >
                  <div className="lx-glass mt-1 rounded-2xl p-4">{renderInline(i)}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ),
      )}

      {(phase === 'thinking' || phase === 'slow' || phase === 'streaming') && (
        <div className="flex max-w-[44rem] flex-col gap-1 self-start">
          <p className="text-xs font-medium text-muted">
            {persona.name} · {persona.role}
          </p>
          <div className="lx-glass rounded-2xl rounded-tl-md px-4 py-3" aria-busy={!partial}>
            {partial ? (
              <p lang="en" className="text-base leading-relaxed">
                {partial}
              </p>
            ) : (
              <p data-testid="rp-thinking" className="text-sm text-muted">
                {t('spThinking')}
              </p>
            )}
          </div>
          {phase === 'slow' && (
            <div data-testid="rp-slow" role="status" className="flex flex-wrap items-center gap-3 text-sm text-muted">
              <span>{t('spSlow')}</span>
              <Button icon="stop" onClick={onStop} data-testid="rp-stop">
                {t('spStop')}
              </Button>
            </div>
          )}
          {phase === 'thinking' && (
            <div>
              <Button variant="ghost" icon="stop" onClick={onStop} data-testid="rp-stop">
                {t('spStop')}
              </Button>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {newer && (
          <motion.button
            type="button"
            data-testid="rp-newer"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={toBottom}
            className="fixed bottom-40 left-1/2 z-30 inline-flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-surface-solid px-4 text-sm font-medium shadow-xl"
          >
            {t('spNewer')}
            <Icon name="arrowDown" size={16} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function AnalysisChip({ idx, slot, open, onClick }: { idx: number; slot: AnalysisSlot | undefined; open: boolean; onClick: () => void }) {
  const { t } = useT();
  const st = chipState(slot);
  const label =
    st === 'pending' ? t('anPending') : st === 'failed' ? t('anFailed') : st === 'skipped' ? t('anSkippedShort') : t(VERDICT_KEY[st]);
  return (
    <button
      type="button"
      data-testid="an-chip"
      data-idx={idx}
      data-state={st}
      aria-expanded={open}
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-medium text-muted hover:bg-surface hover:text-fg"
    >
      <span className={`inline-block size-2 rounded-full ${DOT[st] ?? 'bg-subtle'}`} aria-hidden="true" />
      {label}
    </button>
  );
}
