// D1 V-BAU: Kanalpunkt (`.dot w|g|l|s`, Vorschau style.css:124–125). Rein schmückend: die Bedeutung steht immer auch als Text daneben.

export type VChannel = 'w' | 'g' | 'l' | 's';

export function VDot({ ch }: { ch?: VChannel }) {
  return <span className="lx-v-dot" data-ch={ch} aria-hidden="true" />;
}
