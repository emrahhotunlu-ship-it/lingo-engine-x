import { chapterById } from '../../../domain/c1/chapters';
import { GateScreen } from './GateScreen';
import { useGateSheet } from './store';

/** Einzige Stelle, an der das Blatt der Kapitelprüfung erscheint (in der Shell eingehängt). */
export function GateHost() {
  const n = useGateSheet((s) => s.chapter);
  const close = useGateSheet((s) => s.close);
  return <GateScreen open={n !== null} chapter={n !== null ? chapterById(n) : null} onClose={close} />;
}
