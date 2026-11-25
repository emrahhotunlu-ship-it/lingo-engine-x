import { local } from './storage';

// Einfache Sperre im Browser-Speicher (Wörter-Pflege, 25.11.2026): höchstens EINE lange Hintergrundarbeit gleichzeitig, auch bei zwei Tabs
// derselben Seite. Eintrag `lx:<name>` = `{h: Halter, u: gültig bis (ms)}`; eine abgelaufene Sperre (Tab geschlossen, abgestürzt) gilt als frei.
// Kein Ersatz für Idempotenz: zwei Geräte teilen keinen Browser-Speicher, die Arbeit selbst muss einen zweiten Lauf vertragen.
// Ohne Browser-Speicher (privates Fenster, gesperrt) gibt es keine Sperre; die Arbeit läuft dann wie ohne zweiten Tab.

type Entry = { h: string; u: number };
const isEntry = (v: unknown): v is Entry => !!v && typeof v === 'object' && typeof (v as Entry).h === 'string' && typeof (v as Entry).u === 'number';

export type TabLock = {
  /** Sperre verlängern; `false` = ein anderer Tab hat sie inzwischen (dann aufhören). */
  renew: () => boolean;
  /** Sperre freigeben, nur wenn sie noch diesem Halter gehört. */
  release: () => void;
};

let seq = 0;

export function tryTabLock(name: string, ttlMs: number, now: () => number = Date.now): TabLock | null {
  const key = `lx:${name}`;
  const holder = `${now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${++seq}`;
  const take = (): boolean => {
    const cur = local.getJson<unknown>(key);
    if (isEntry(cur) && cur.h !== holder && cur.u > now()) return false;
    if (!local.set(key, JSON.stringify({ h: holder, u: now() + ttlMs }))) return true;
    // Gegenprobe: hat ein zweiter Tab im selben Augenblick geschrieben, gewinnt der zuletzt geschriebene Eintrag.
    const back = local.getJson<unknown>(key);
    return !isEntry(back) || back.h === holder;
  };
  if (!take()) return null;
  return {
    renew: take,
    release: () => {
      const cur = local.getJson<unknown>(key);
      if (isEntry(cur) && cur.h === holder) local.remove(key);
    },
  };
}
