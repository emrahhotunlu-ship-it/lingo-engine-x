import { motion, useReducedMotion } from 'framer-motion';
import type { MorphPiece } from '../domain/c1x/kinds/wf';
import { SPRINGS } from '../ui/motion';

// Zerlegung eines Worts nach dem Prüfen (Lernplattform 3.0 P38, Erlebnis-Engine Stufe 3): *un · precedent · ed*. Der Kern steht in der Mitte,
// Vor- und Nachsilbe gleiten aus dem fertigen Wort an ihren Platz. Ein ruhiger Moment (≈ 450 ms, einmal), nie eine Schleife, und außerhalb des
// Lesefensters der Erklärung. Bei reduzierter Bewegung (oder `animate = false`) steht das Ergebnis sofort da. Die Teile sind Text, kein Bild.

export type MorphSplitProps = {
  pieces: readonly MorphPiece[];
  /** Standard: ein. Aus = sofort das Standbild (Stufe „Aus“). */
  animate?: boolean;
  className?: string;
};

export function MorphSplit({ pieces, animate = true, className }: MorphSplitProps) {
  const reduce = useReducedMotion();
  const move = animate && !reduce;
  const mid = pieces.findIndex((p) => p.role === 'core');
  return (
    <p className={`wf-split${className ? ` ${className}` : ''}`} lang="en" data-testid="morph-split" data-pieces={pieces.length} data-motion={move ? 'on' : 'off'}>
      <span className="sr-only">{pieces.map((p) => p.text).join('')}</span>
      {pieces.map((p, i) => {
        const from = i < mid ? 14 : i > mid ? -14 : 0;
        return (
          <motion.span
            key={`${i}:${p.text}`}
            className="wf-piece"
            data-role={p.role}
            data-testid="morph-piece"
            aria-hidden="true"
            initial={move ? { x: from, opacity: p.role === 'core' ? 1 : 0.2 } : false}
            animate={{ x: 0, opacity: 1 }}
            transition={move ? { ...SPRINGS.morph, delay: p.role === 'core' ? 0 : 0.08 } : { duration: 0 }}
          >
            {p.text}
          </motion.span>
        );
      })}
    </p>
  );
}
