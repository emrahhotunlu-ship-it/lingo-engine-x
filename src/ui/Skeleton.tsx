// Lade-Skelette statt Spinner (Kap. 3.4).

export function Skeleton({ className }: { className?: string }) {
  return <div className={`lx-skeleton ${className ?? ''}`} aria-hidden="true" />;
}
