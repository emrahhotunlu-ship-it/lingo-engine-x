import { Component, createRef, type ReactNode } from 'react';
import { effectiveLevel, getFxState } from '../engine/fx/level';
import { playFx } from '../platform/sound';
import { STACK } from './motion';

// Kartenstapel (Lernplattform 3.0 P54, Erlebnis-Engine B10): Beim Wechsel steht die neue Karte sofort da (nie ein Leerbild) und rückt aus dem Stapel
// nach vorn (scale .96 → 1, y 6 → 0, Deckkraft ab 0,6, Feder `settle`); die alte verlässt ihn als stilles Abbild nach links (x −28 px, −1,5°, 140 ms)
// bzw. in Wischrichtung, wenn sie weggewischt wurde (`data-exit`). Das Abbild ist eine tote Kopie (`inert`, ohne Test-IDs und IDs): kein zweiter
// Bewerten-Pfad, keine doppelten Tastenkürzel, keine doppelten Texte für Vorleseprogramme. Stufe „Aus“: kein Abbild, keine Bewegung (Endzustand);
// reduzierte Bewegung: nur Überblenden ≤ 150 ms. Dahinter zeigen höchstens zwei Kartenkanten, was noch kommt (`StackBehind`).

type Props = {
  /** Wechselt mit jeder Karte (z. B. `step-3`). */
  stackKey: string;
  children: ReactNode;
  className?: string;
  /** Kartenwechsel-Klang (nur Stufe „Voll“). */
  sound?: boolean;
  /** `data-*`-Merkmale der aktuellen Karte (z. B. `{ 'data-step': '3' }`); die tote Kopie trägt sie nicht. */
  data?: Record<`data-${string}`, string | number | undefined>;
};

/** Merkmale, die die tote Kopie verliert (Tests und Kennungen sehen nur die echte Karte). */
const STRIP = ['id', 'data-testid', 'data-step', 'data-card', 'for', 'aria-labelledby', 'aria-describedby'];

type Snap = { clone: HTMLElement; top: number; left: number; width: number; exit: 'left' | 'right' | null } | null;

function deadCopy(el: HTMLElement): HTMLElement {
  const c = el.cloneNode(true) as HTMLElement;
  for (const n of [c, ...Array.from(c.querySelectorAll<HTMLElement>('*'))]) {
    for (const a of STRIP) n.removeAttribute(a);
  }
  c.setAttribute('aria-hidden', 'true');
  c.setAttribute('inert', '');
  c.dataset.stackGhost = '';
  return c;
}

export class CardStack extends Component<Props> {
  private root = createRef<HTMLDivElement>();
  private card = createRef<HTMLDivElement>();
  private ghosts = new Set<HTMLElement>();

  override getSnapshotBeforeUpdate(prev: Props): Snap {
    if (prev.stackKey === this.props.stackKey) return null;
    const el = this.card.current;
    const root = this.root.current;
    if (!el || !root || effectiveLevel() === 'off') return null;
    const exitEl = el.querySelector<HTMLElement>('[data-exit]');
    const exit = (exitEl?.dataset.exit as 'left' | 'right' | undefined) ?? null;
    return { clone: deadCopy(el), top: el.offsetTop, left: el.offsetLeft, width: el.offsetWidth, exit };
  }

  override componentDidUpdate(prev: Props, _s: unknown, snap: Snap): void {
    if (prev.stackKey === this.props.stackKey) return;
    const el = this.card.current;
    const root = this.root.current;
    if (!el || !root) return;
    const reduced = getFxState().reduced;
    if (reduced) {
      el.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: STACK.fadeMs, easing: 'ease-out' });
      return;
    }
    if (!snap) return;
    const { clone } = snap;
    Object.assign(clone.style, { position: 'absolute', top: `${snap.top}px`, left: `${snap.left}px`, width: `${snap.width}px`, pointerEvents: 'none', zIndex: '1', margin: '0' });
    root.appendChild(clone);
    this.ghosts.add(clone);
    const inner = snap.exit ? clone.querySelector<HTMLElement>('[data-exit]') : null;
    const from = inner?.style.transform || 'none';
    const target = inner ?? clone;
    const to = snap.exit === 'left' ? 'translateX(-120%) rotate(-8deg)' : snap.exit === 'right' ? 'translateX(120%) rotate(8deg)' : `translateX(${STACK.exitX}px) rotate(${STACK.exitRot}deg)`;
    const out = target.animate([{ transform: from, opacity: 1 }, { transform: to, opacity: 0 }], { duration: snap.exit ? STACK.flyMs : STACK.exitMs, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' });
    const drop = (): void => {
      clone.remove();
      this.ghosts.delete(clone);
    };
    out.onfinish = drop;
    out.oncancel = drop;
    el.animate(
      [
        { opacity: STACK.enterOpacity, transform: `translateY(${STACK.enterY}px) scale(${STACK.enterScale})` },
        { opacity: 1, transform: 'none' },
      ],
      { duration: STACK.enterMs, easing: STACK.enterEase },
    );
    if (this.props.sound !== false && effectiveLevel() === 'full') playFx('card');
  }

  override componentWillUnmount(): void {
    for (const g of this.ghosts) g.remove();
    this.ghosts.clear();
  }

  override render(): ReactNode {
    return (
      <div ref={this.root} className={`lx-stack ${this.props.className ?? ''}`} data-stack-key={this.props.stackKey}>
        <div ref={this.card} key={this.props.stackKey} className="lx-stack-card" {...this.props.data}>
          {this.props.children}
        </div>
      </div>
    );
  }
}

/** Kanten der nächsten Karten hinter der aktuellen (höchstens zwei; y +6/+12, scale .96/.92, Deckkraft .55/.25). Rein dekorativ. */
export function StackBehind({ n }: { n: number }) {
  const k = Math.max(0, Math.min(2, Math.floor(n)));
  if (k === 0) return null;
  return (
    <span className="lx-stack-behind" aria-hidden="true" data-n={k}>
      {Array.from({ length: k }, (_, i) => (
        <span key={i} className="lx-stack-edge" data-depth={i + 1} />
      ))}
    </span>
  );
}
