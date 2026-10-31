import type { ReactNode } from 'react';
import { VDot, type VChannel } from './VDot';

// D1 V-BAU: Kachel (`.tile`, Vorschau style.css:403–414; H14 screens.js:963–971). Große Zahl ist immer der echte Wert; ohne Belege
// zeigt der Bildschirm „–“ und „noch zu wenig Belege“ (H14 `thin`, stufe1c-plan.md §0). Keine erfundenen Zahlen.

type Props = {
  ch?: VChannel;
  head: ReactNode;
  /** Trend rechts im Kopf (Symbol mit Beschriftung). */
  trend?: ReactNode;
  big: ReactNode;
  /** Kleine Einheit hinter der Zahl („%“, „Min.“). */
  unit?: ReactNode;
  /** Zweite Zeile unter der Zahl („auf dem Weg: 41“). */
  way?: ReactNode;
  /** Balken unter der Zeile (frei gestaltet vom Bildschirm). */
  bar?: ReactNode;
  /** Unterste Zeile. */
  line?: ReactNode;
  onClick?: () => void;
  id?: string;
  'data-testid'?: string;
};

export function VTile({ ch, head, trend, big, unit, way, bar, line, onClick, id, ...rest }: Props) {
  const inner = (
    <>
      <span className="lx-v-tile-h">
        {ch && <VDot ch={ch} />}
        <span>{head}</span>
        {trend && <span className="lx-v-tile-tr">{trend}</span>}
      </span>
      <span className="lx-v-tile-big lx-v-disp lx-v-num">
        {big}
        {unit && <small>{unit}</small>}
      </span>
      {way && <span className="lx-v-tile-way lx-v-num">{way}</span>}
      {bar}
      {line && <span className="lx-v-tile-one">{line}</span>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" id={id} className="lx-v-tile" onClick={onClick} data-testid={rest['data-testid']}>
        {inner}
      </button>
    );
  }
  return (
    <div id={id} className="lx-v-tile" data-testid={rest['data-testid']}>
      {inner}
    </div>
  );
}

export function VTiles({ children }: { children: ReactNode }) {
  return <div className="lx-v-tiles">{children}</div>;
}

export type VTileBarPart = { /** Start in Prozent. */ from: number; /** Breite in Prozent. */ width: number; /** voll = gefestigt, halb = auf dem Weg. */ kind: 'full' | 'half' };

/** Balken unter der Zahl (`.wbar`, Vorschau style.css:410–413): Umriss = alles, halbtonig = auf dem Weg, voll = gefestigt. Die
 * Bedeutung steht als `label` (Tooltip und Screenreader) daneben, nie nur in der Farbe. */
export function VTileBar({ parts, label }: { parts: readonly VTileBarPart[]; label: string }) {
  return (
    <span className="lx-v-tile-bar" role="img" aria-label={label} title={label}>
      {parts.map((p, i) => (
        <i key={i} data-kind={p.kind} style={{ left: `${p.from}%`, width: `${p.width}%` }} />
      ))}
    </span>
  );
}
