import { useClock } from '../../app/clock';
import { loadResume, type Resumable } from '../../app/resume';

// Kleine Hilfen für die Fortsetz-Verträge von P2 (architektur.md §3.2, plan.md G3): `ensure` der
// Übungen stellt synchron aus `lx:resume:<id>` her (gleicher Lerntag, gleiche Version) und
// startet sonst neu. Die Hülle schreibt und liest der Rahmen (`app/resume.ts`).

/** Momentaufnahme dieses Vertrags vom heutigen Lerntag (oder `null`). */
export function freshSnapshot<S>(r: Pick<Resumable<S>, 'id' | 'version'>): S | null {
  const env = loadResume(r.id);
  if (!env || env.v !== r.version || env.day !== useClock.getState().today) return null;
  return env.data as S;
}

/**
 * `ScreenDef.ensure`: Sitzung aktiv? Sonst aus dem Fortsetz-Speicher herstellen, sonst `start()`
 * (liefert `false`, wenn nichts zu tun ist).
 */
export function ensureWith<S>(r: Pick<Resumable<S>, 'id' | 'version' | 'restore'>, active: () => boolean, start: () => boolean): boolean {
  if (active()) return true;
  const snap = freshSnapshot<S>(r);
  if (snap !== null && r.restore(snap)) return true;
  return start();
}
