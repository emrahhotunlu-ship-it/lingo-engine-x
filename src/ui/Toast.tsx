import { AnimatePresence, motion } from 'framer-motion';
import { create } from 'zustand';
import { DURATION, EASE_OUT } from './motion';

// Ruhige Meldungen oben (UX M13: unten verdeckten sie „Weiter“ in der Übungsleiste); werden vorgelesen (aria-live). Seit dem K-Abgleich
// (04.11.2026) UNTER der Kopfzeile bzw. Übungsleiste: oben am Rand verdeckten sie am Handy Titel, Zähler und ✕.

type Toast = { id: number; text: string; tone: 'info' | 'error' };
type ToastState = { items: Toast[] };

const useToasts = create<ToastState>(() => ({ items: [] }));
let nextId = 1;

/** Zeigt einen Hinweis für 5 s; liefert seine Kennung (für `dismissToast`), bei einem schon sichtbaren gleichen Hinweis `null`. */
export function toast(text: string, tone: Toast['tone'] = 'info'): number | null {
  // Derselbe Hinweis zweimal zugleich (z. B. ✕ der Übungsleiste und Rückkehr nach Heute melden beide „Gespeichert“, Befund ux 4b Nr. 3): nur einmal.
  if (useToasts.getState().items.some((x) => x.text === text && x.tone === tone)) return null;
  const id = nextId++;
  useToasts.setState((s) => ({ items: [...s.items.slice(-2), { id, text, tone }] }));
  window.setTimeout(() => dismissToast(id), 5000);
  return id;
}

/** Hinweis vorzeitig schließen (z. B. beim Wechsel des Bildschirms, auf dem er erschien). */
export function dismissToast(id: number): void {
  useToasts.setState((s) => (s.items.some((t) => t.id === id) ? { items: s.items.filter((t) => t.id !== id) } : s));
}

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div
      aria-live="polite"
      className="lx-toaster pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`max-w-[min(28rem,100%)] rounded-2xl border border-line bg-surface-solid px-4 py-3 text-sm shadow-xl ${t.tone === 'error' ? 'text-danger-text' : 'text-fg'}`}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
