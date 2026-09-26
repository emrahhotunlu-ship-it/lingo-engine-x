import { LayoutGroup, motion } from 'framer-motion';
import type { KeyboardEvent } from 'react';
import { useT } from '../../i18n';
import { EnglishText } from '../../engine/EnglishText';
import { spring } from '../../ui/motion';

// Satz-Bausteine (Kap. 4.2) für den E-Mail-Refiner: Ein Tipp (oder Ziffer 1–4, Pfeiltasten)
// lässt den gewählten Baustein in den Platz gleiten, die anderen weichen animiert aus
// (gemeinsames Layout-Element). „Original behalten“ ist immer eine Option.
// Hinweis: Sobald `src/engine/tiles` aus Phase 1 vorliegt, kann dieser Baustein darauf umziehen.

export type TileOption = { text: string; register?: string; why?: string };

type Props = {
  seg: number;
  original: string;
  options: readonly TileOption[];
  /** -1 = Original. */
  chosen: number;
  onPick: (opt: number) => void;
};

export function TilePicker({ seg, original, options, chosen, onPick }: Props) {
  const { t } = useT();
  const all: Array<{ k: number; text: string; register?: string; why?: string }> = [{ k: -1, text: original }, ...options.map((o, i) => ({ k: i, ...o }))];
  const current = all.find((o) => o.k === chosen) ?? all[0];
  const tray = all.filter((o) => o.k !== chosen);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= all.length) {
      e.preventDefault();
      onPick((all[n - 1] as { k: number }).k);
      return;
    }
    const i = all.findIndex((o) => o.k === chosen);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      onPick((all[(i + 1) % all.length] as { k: number }).k);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      onPick((all[(i - 1 + all.length) % all.length] as { k: number }).k);
    }
  };

  const regLabel = (r?: string) => (r === 'formal' ? t('regFormal') : r === 'informal' ? t('regInformal') : r === 'neutral' ? t('regNeutral') : null);

  return (
    <LayoutGroup id={`seg-${seg}`}>
      <div role="group" aria-label={t('mailTask')} tabIndex={0} onKeyDown={onKey} className="flex flex-col gap-2 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--lx-accent)]">
        <div data-testid="tile-slot" data-chosen={chosen} className="min-h-12 rounded-2xl border border-dashed border-line p-1.5">
          {current && (
            <motion.div layoutId={`tile-${seg}-${current.k}`} transition={spring} className="rounded-xl bg-surface-strong px-3 py-2.5">
              <EnglishText text={current.text} area="business" className="text-base" />
              {current.k >= 0 && current.why && <p className="mt-1 text-xs text-muted">{current.why}</p>}
            </motion.div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          {tray.map((o) => {
            const label = regLabel(o.register);
            const idx = all.findIndex((x) => x.k === o.k) + 1;
            return (
              <motion.button
                key={o.k}
                type="button"
                layoutId={`tile-${seg}-${o.k}`}
                transition={spring}
                data-testid="tile"
                data-opt={o.k}
                onClick={() => onPick(o.k)}
                className="flex min-h-11 items-start gap-2 rounded-xl border border-line px-3 py-2 text-left text-sm hover:bg-surface"
              >
                <span className="lx-choice-key mt-0.5" aria-hidden="true">
                  {idx}
                </span>
                <span className="min-w-0 flex-1">
                  {o.k === -1 ? <span className="text-muted">{t('mailKeep')}: </span> : null}
                  <span lang="en">{o.text}</span>
                </span>
                {label && <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs text-muted">{label}</span>}
              </motion.button>
            );
          })}
        </div>
      </div>
    </LayoutGroup>
  );
}
