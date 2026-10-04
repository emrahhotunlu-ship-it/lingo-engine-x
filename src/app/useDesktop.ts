import { useSyncExternalStore } from 'react';

// Desktop-Layout ab 1024 px Breite (wie `lg:` in Tailwind). Dort steht die Navigation oben in der
// Kopfleiste statt unten am Rand. Nur EINE Navigation ist im Dokument (nie zwei mit denselben Knöpfen).

const QUERY = '(min-width: 1024px)';

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

const snapshot = (): boolean => window.matchMedia(QUERY).matches;

export function useDesktop(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
