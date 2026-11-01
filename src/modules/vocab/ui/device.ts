import { local } from '../sharedUi';

// Gerätekennung des Wörter-Moduls (zufällig, einmal je Browser): Verlaufsschlüssel der Lernrunde und Kennung der Sperre beim Einschalten.

const DEVICE_KEY = 'lx:vm-dev';

export function deviceId(): string {
  const cur = local.get(DEVICE_KEY);
  if (cur && /^[a-z0-9]{6,16}$/.test(cur)) return cur;
  const id = `d${Math.random().toString(36).slice(2, 10)}`;
  local.set(DEVICE_KEY, id);
  return id;
}
