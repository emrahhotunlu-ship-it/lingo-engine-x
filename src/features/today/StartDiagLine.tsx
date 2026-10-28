import { useT } from '../../i18n';
import { startLine } from './startPerf';

// Diagnosezeile „Knopf nach … · erste Aufgabe nach …“ (Relaunch P6, stufe1-plan §8 Tempo). Nur Lesen: Werte dieses Seitenladens, sonst der
// letzte gemerkte Start aus dem Browser (`lx:perf`).

export function StartDiagLine() {
  const { t, num } = useT();
  const { b, f } = startLine();
  const sec = (ms: number | null): string => (ms === null ? t('stDiagNone') : t('stDiagSec', { n: num(Math.round(ms / 100) / 10) }));
  return (
    <p className="lx-tnum m-0 text-sm text-muted" data-testid="diag-start" data-b={b ?? ''} data-f={f ?? ''}>
      {t('stDiag', { b: sec(b), f: sec(f) })}
    </p>
  );
}
