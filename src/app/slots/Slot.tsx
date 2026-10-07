import { Fragment } from 'react';
import { logWarn } from '../../platform/diagnostics';
import { SLOT_NAMES, slotEntries, type SlotName, type SlotProps } from './registry';

/**
 * Eine Stelle im Hub, an der Pakete etwas einhängen (P11). Ohne Anmeldung (oder wenn alle `enabled() = false`) kommt `null`:
 * kein Wrapper, keine Höhe, kein Layoutsprung.
 */
export function Slot({ name, props }: { name: SlotName; props?: SlotProps }) {
  if (!(SLOT_NAMES as readonly string[]).includes(name)) {
    logWarn('slots:render', { message: `Unbekannter Slot "${String(name)}".` });
    return null;
  }
  const list = slotEntries(name);
  if (list.length === 0) return null;
  return (
    <>
      {list.map((e, i) => (
        <Fragment key={`${name}:${e.order}:${i}`}>{e.render(props ?? {})}</Fragment>
      ))}
    </>
  );
}
