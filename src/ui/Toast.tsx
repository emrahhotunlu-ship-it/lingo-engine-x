import { AnimatePresence, motion } from 'framer-motion';
import { create } from 'zustand';
import { DURATION, EASE_OUT } from './motion';

// Ruhige Meldungen unten am Rand; werden vorgelesen (aria-live).

type Toast = { id: number; text: string; tone: 'info' | 'error' };
type ToastState = { items: Toast[] };

const useToasts = create<ToastState>(() => ({ items: [] }));
let nextId = 1;

export function toast(text: string, tone: Toast['tone'] = 'info'): void {
  const id = nextId++;
  useToasts.setState((s) => ({ items: [...s.items.slice(-2), { id, text, tone }] }));
  window.setTimeout(() => useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) })), 5000);
}

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
    >
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto max-w-md rounded-2xl border border-line bg-surface-solid px-4 py-3 text-sm shadow-xl ${t.tone === 'error' ? 'text-danger-text' : 'text-fg'}`}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
