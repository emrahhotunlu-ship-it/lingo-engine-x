import { local } from '../sharedUi';

// Gerätekennung des Wörter-Moduls (zufällig, einmal je Browser): Verlaufsschlüssel der Lernrunde und Kennung der Sperre beim Einschalten.

const DEVICE_KEY = 'lx:vm-dev';

// Ohne Browser-Speicher (privates Fenster) bleibt die Kennung wenigstens für diesen Start gleich, sonst hielte der eigene Tab seine Sperre nicht.
let memo: string | null = null;

export function deviceId(): string {
  const cur = local.get(DEVICE_KEY);
  if (cur && /^[a-z0-9]{6,16}$/.test(cur)) return cur;
  const id = memo ?? `d${Math.random().toString(36).slice(2, 10)}`;
  memo = id;
  local.set(DEVICE_KEY, id);
  return id;
}
