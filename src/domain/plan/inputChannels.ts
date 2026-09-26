import { daysBetween } from '../date';

// Kanäle Lesen, Hören, Schreiben, Entdecken für Tagesplan und Heute (Phase 4, Plan §4.6, F5).
// „Erledigt" hat genau EINE Ableitung: `act[tag][schlüssel] ≥ 1` (gespeichert ⊕ Puffer).
// Statuszeile, Häkchen, Angebotszeile und Klickziel stützen sich nur darauf (Kap. 2.2).
// Welcher Kanal Pflicht ist, entscheiden Phase 2 bzw. 6 – hier nur die Schnittstelle.

export type InputChannelId = 'read' | 'listen' | 'write' | 'discover';

export type InputChannelDef = { id: InputChannelId; actKey: InputChannelId; skill: 're' | 'li' | 'wr'; minutes: number };

export const INPUT_CHANNELS: readonly InputChannelDef[] = [
  { id: 'read', actKey: 'read', skill: 're', minutes: 10 },
  { id: 'listen', actKey: 'listen', skill: 'li', minutes: 10 },
  { id: 'write', actKey: 'write', skill: 'wr', minutes: 15 },
  { id: 'discover', actKey: 'discover', skill: 're', minutes: 15 },
];

export const isInputChannel = (id: string): id is InputChannelId => INPUT_CHANNELS.some((c) => c.id === id);

type Doc = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Anzahl abgeschlossener Einheiten eines Kanals am Lerntag (gespeichert + Puffer). */
export function channelCount(id: InputChannelId, day: string, profile: unknown, pendingAct: Readonly<Record<string, number>> | undefined): number {
  const act = obj(obj(obj(profile).act)[day]);
  return num(act[id]) + num(pendingAct?.[id]);
}

/** Die eine Ableitung „erledigt" (F5). Begonnene Einheiten (`read~`) zählen nie. */
export function channelDone(id: InputChannelId, day: string, profile: unknown, pendingAct?: Readonly<Record<string, number>>): boolean {
  return channelCount(id, day, profile, pendingAct) >= 1;
}

export type TtsStatus = 'loading' | 'ready' | 'novoice' | 'unsupported';

export type ChannelEnv = {
  tts: TtsStatus;
  ai: boolean;
  /** Gibt es ungelesene/ungehörte Inhalte (Datenbank oder Startbestand)? */
  lib: { read: boolean; listen: boolean };
  /** Unerledigte Beiträge der letzten 7 Lerntage. */
  feedOpen: number;
};

/** Kann der Kanal heute ausgeführt werden (vor dem Einfrieren eines Plans, R10)? */
export function channelExecutable(id: InputChannelId, env: ChannelEnv): boolean {
  switch (id) {
    case 'read':
      return env.lib.read || env.ai;
    case 'listen':
      // Ohne Stimme läuft Hören als Lesetext weiter (F14) – als Pflicht wird es dann nicht geplant.
      return env.tts !== 'unsupported' && env.tts !== 'novoice' && (env.lib.listen || env.ai);
    case 'write':
      return true;
    case 'discover':
      return env.feedOpen > 0;
  }
}

/**
 * Vor wie vielen Lerntagen der Kanal zuletzt abgeschlossen wurde (0 = heute), `null` = nie.
 * Grundlage für „zuletzt vor 4 Tagen" bzw. „noch nie geübt".
 */
export function lastDoneDaysAgo(id: InputChannelId, profile: unknown, today: string): number | null {
  const act = obj(obj(profile).act);
  let best: number | null = null;
  for (const [day, rec] of Object.entries(act)) {
    if (num(obj(rec)[id]) < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const ago = daysBetween(day, today);
    if (ago < 0) continue;
    if (best === null || ago < best) best = ago;
  }
  return best;
}
