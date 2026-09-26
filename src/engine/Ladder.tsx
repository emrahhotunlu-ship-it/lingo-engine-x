import { motion } from 'framer-motion';
import { DURATION, EASE_OUT } from '../ui/motion';

// Sichtbare Leiter: fünf Stufen, die aktuelle mit Namen (Kap. 5, Architektur-Entwurf §6.5).

export function Ladder({ stage, label }: { stage: number; label: string }) {
  return (
    <div className="flex items-center gap-3" data-testid="ladder" data-stage={stage}>
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((s) => (
          <motion.span
            key={s}
            className="h-1.5 w-6 rounded-full"
            initial={false}
            animate={{ backgroundColor: s <= stage ? 'var(--lx-accent)' : 'var(--lx-track)' }}
            transition={{ duration: DURATION.slow, ease: EASE_OUT }}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-muted">{label}</span>
    </div>
  );
}
