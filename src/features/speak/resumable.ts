import { create } from 'zustand';
import type { Resumable } from '../../app/resume';
import type { Route } from '../../app/router/types';
import type { Place } from '../../app/shell/tabs';
import type { MessageKey } from '../../i18n';

// Fortsetzen nach Neuladen für die Übungen von P5 (Neubau G3, architektur.md §3.2): Jede Übung
// legt ihren Schritt (Entwürfe liegen schon in `lx:draft:*`) in einem kleinen Speicher ab; der
// Rahmen (WP0b) sichert ihn als `lx:resume:<id>` und ruft beim Fortsetzen SYNCHRON `restore`.
// Die Übung holt die hergestellte Momentaufnahme beim Einhängen einmal ab (`take`).
// Nie Antworten, nie db-Schreiben – nur Positionen (Kap. 3.1).

type Box<S> = { snap: S | null; pending: S | null };

export type StepResumable<S> = Resumable<S> & {
  /** Aktuellen Schritt melden (bei jedem Schrittwechsel). */
  set(s: S): void;
  /** Reguläres Ende: nichts mehr fortzusetzen. */
  clear(): void;
  /** Beim Einhängen: hergestellte Momentaufnahme einmal abholen (sonst `null`). */
  take(): S | null;
};

export function stepResumable<S>(def: {
  id: string;
  version: number;
  origin: Place;
  valid: (s: unknown) => s is S;
  route: (s: S) => Route;
  label: MessageKey;
}): StepResumable<S> {
  const box = create<Box<S>>(() => ({ snap: null, pending: null }));
  return {
    id: def.id,
    version: def.version,
    origin: def.origin,
    snapshot: () => box.getState().snap,
    subscribe: (cb) => box.subscribe(cb),
    restore(s) {
      if (!def.valid(s)) return false;
      box.setState({ snap: s, pending: s });
      return true;
    },
    route: (s) => def.route(s),
    label: (_s, t) => t(def.label),
    set: (s) => box.setState({ snap: s }),
    clear: () => box.setState({ snap: null, pending: null }),
    take() {
      const p = box.getState().pending;
      if (p) box.setState({ pending: null });
      return p;
    },
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const optUnit = (v: unknown) => v === undefined || (typeof v === 'number' && v >= 1 && v <= 5);

// ---------------------------------------------------------------- Verträge je Übung

/** `a1`/`fb1`: erste Fassung und Rückmeldung, damit der zweite Durchgang nach dem Neuladen nichts verliert. */
export type SaySnap = { phase: 'aloud' | 'write1' | 'write2'; sit: string; t0: number; unit?: number; a1?: string; fb1?: unknown };
export const sayResume = stepResumable<SaySnap>({
  id: 'say',
  version: 1,
  origin: 'write',
  valid: (s): s is SaySnap => isObj(s) && (s.phase === 'aloud' || s.phase === 'write1' || s.phase === 'write2') && typeof s.sit === 'string' && typeof s.t0 === 'number' && optUnit(s.unit),
  route: (s) => (s.unit ? { name: 'say', unit: s.unit } : { name: 'say' }),
  label: 'nbSprechenResumeSay',
});

/** `rounds`: bereits gesprochene Runden (Text + Kennzahlen, ≤ 3 × 1.500 Zeichen). */
export type FluencySnap = { q: string; round: number; t0: number; rounds: Array<Record<string, unknown>>; unit?: number };
export const fluencyResume = stepResumable<FluencySnap>({
  id: 'fluency',
  version: 1,
  origin: 'speak',
  valid: (s): s is FluencySnap =>
    isObj(s) && typeof s.q === 'string' && (s.round === 0 || s.round === 1 || s.round === 2) && typeof s.t0 === 'number' && Array.isArray(s.rounds) && s.rounds.length <= 3 && s.rounds.every(isObj) && optUnit(s.unit),
  route: (s) => (s.unit ? { name: 'fluency', unit: s.unit } : { name: 'fluency' }),
  label: 'nbSprechenResumeFluency',
});

export type TonesSnap = { msg: string; step: number; unit?: number };
export const tonesResume = stepResumable<TonesSnap>({
  id: 'tones',
  version: 1,
  origin: 'write',
  valid: (s): s is TonesSnap => isObj(s) && typeof s.msg === 'string' && typeof s.step === 'number' && optUnit(s.unit),
  route: (s) => (s.unit ? { name: 'tones', unit: s.unit } : { name: 'tones' }),
  label: 'nbSprechenResumeTones',
});

export type MailSnap = { step: 'write' | 'pick'; text: string };
export const mailResume = stepResumable<MailSnap>({
  id: 'mail',
  version: 1,
  origin: 'write',
  valid: (s): s is MailSnap => isObj(s) && (s.step === 'write' || s.step === 'pick') && typeof s.text === 'string' && s.text.length <= 4000,
  route: () => ({ name: 'mail' }),
  label: 'nbSprechenResumeMail',
});

export type PitchSnap = { step: string; text: string };
export const pitchResume = stepResumable<PitchSnap>({
  id: 'pitch',
  version: 1,
  origin: 'speak',
  valid: (s): s is PitchSnap => isObj(s) && typeof s.step === 'string' && typeof s.text === 'string' && s.text.length <= 4000,
  route: () => ({ name: 'pitch' }),
  label: 'nbSprechenResumePitch',
});

/** Rollenspiel: Hülle um die vorhandene Kopie (`speak/resume.ts`, `lx:roleplay:<szene>`). */
export type RoleplaySnap = { sceneId: string; unit?: number };
export const roleplayResume = stepResumable<RoleplaySnap>({
  id: 'roleplay',
  version: 1,
  origin: 'speak',
  valid: (s): s is RoleplaySnap => isObj(s) && typeof s.sceneId === 'string' && !!s.sceneId && optUnit(s.unit),
  route: (s) => ({ name: 'roleplay', sceneId: s.sceneId, resume: true, ...(s.unit ? { unit: s.unit } : {}) }),
  label: 'nbSprechenResumeRoleplay',
});

export const P5_RESUMABLES = [sayResume, fluencyResume, tonesResume, mailResume, pitchResume, roleplayResume] as const;
