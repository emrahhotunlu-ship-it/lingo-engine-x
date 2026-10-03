import { z } from 'zod';
import { create } from 'zustand';
import { fsrsSchema } from '../data/schemas';
import { createWriter, type Writer } from '../data/writer';
import { hash32 } from '../domain/random';
import { logError, logWarn } from '../platform/diagnostics';
import type { Db } from '../platform/types';
import { CARD_SHARDS, DEFAULT_NEW_PER_DAY, type CardRec, type DayRec, type ProfileDoc } from './types';

// Datenzugang des Trainers: EIN Abo auf die Sammlung `coach` (wenige Dokumente), ein Schreibpfad
// über den bestehenden Writer (Warteschlange je Dokument, schreibt nur bei Änderung, löscht nie).
// Geschrieben wird optimistisch: erst der lokale Zustand, dann die Datenbank.

const num = z.number().finite();
const cardSchema = z.looseObject({
  src: z.enum(['bank', 'legacy', 'user']),
  w: z.string().optional(),
  de: z.string().optional(),
  ex: z.string().optional(),
  f: fsrsSchema,
  lv: num,
  add: num,
  known: z.union([z.literal(0), z.literal(1)]).optional(),
  ok: num.optional(),
  bad: num.optional(),
});
const dayRecSchema = z.looseObject({ min: num, ans: num, ok: num, nw: num, kn: num.optional(), core: z.union([z.literal(0), z.literal(1)]).optional(), ai: num.optional() });
const profileSchema = z.looseObject({ v: z.literal(1), created: num, newPerDay: num });

export type CoachStatus = 'loading' | 'ready' | 'nodb' | 'error';

type CoachState = {
  status: CoachStatus;
  profile: ProfileDoc | null;
  cards: ReadonlyMap<string, CardRec>;
  days: Readonly<Record<string, DayRec>>;
  /** Dokumente mit unerwartetem Aufbau (werden nie überschrieben). */
  invalid: readonly string[];
};

export const useCoach = create<CoachState>(() => ({ status: 'loading', profile: null, cards: new Map(), days: {}, invalid: [] }));

let writer: Writer | null = null;
/** Stand je Dokument, wie zuletzt gelesen oder geschrieben (Hinweis für „ändert sich nichts"). */
const docs = new Map<string, Record<string, unknown>>();

export const shardOf = (id: string): string => `coach/cards-${hash32(id) % CARD_SHARDS}`;
export const daysDocOf = (day: string): string => `coach/days-${day.slice(0, 4)}`;

function parseAll(all: ReadonlyMap<string, Record<string, unknown>>): Omit<CoachState, 'status'> {
  const cards = new Map<string, CardRec>();
  const days: Record<string, DayRec> = {};
  const invalid: string[] = [];
  let profile: ProfileDoc | null = null;
  for (const [path, data] of all) {
    const id = path.slice('coach/'.length);
    if (id === 'profile') {
      const p = profileSchema.safeParse(data);
      if (p.success) profile = p.data;
      else invalid.push(path);
    } else if (id.startsWith('cards-')) {
      const c = data.c;
      if (!c || typeof c !== 'object') continue;
      for (const [cid, raw] of Object.entries(c as Record<string, unknown>)) {
        const r = cardSchema.safeParse(raw);
        if (r.success) cards.set(cid, r.data);
        else invalid.push(`${path}#${cid}`);
      }
    } else if (id.startsWith('days-')) {
      const d = data.d;
      if (!d || typeof d !== 'object') continue;
      for (const [day, raw] of Object.entries(d as Record<string, unknown>)) {
        const r = dayRecSchema.safeParse(raw);
        if (r.success) days[day] = r.data;
      }
    }
  }
  return { profile, cards, days, invalid };
}

/** Abo starten (einmal je Ansicht). Liefert das Abmelden. */
export function startCoach(db: Db): () => void {
  writer = createWriter(db);
  let stop: (() => void) | null = null;
  const subscribe = () => {
    stop = db.collection('coach').onSnapshot(
      (snap) => {
        docs.clear();
        for (const d of snap.docs) {
          const data = d.exists ? d.data() : undefined;
          if (data) docs.set(`coach/${d.id}`, data);
        }
        const parsed = parseAll(docs);
        if (parsed.invalid.length) logWarn('coach:read', { code: 'invalid', message: parsed.invalid.slice(0, 5).join(', ') });
        useCoach.setState({ status: 'ready', ...parsed });
      },
      (err) => {
        logError('coach:live', err);
        // Toter Bridge-Kanal: genau ein neues Abo (db.d.ts), sonst Fehlerzustand.
        if (err.code === 'unavailable') {
          stop = null;
          setTimeout(subscribe, 1500);
        } else useCoach.setState({ status: 'error' });
      },
    );
  };
  subscribe();
  return () => stop?.();
}

export function markNoDb(): void {
  useCoach.setState({ status: 'nodb' });
}

/** Für Tests: Zustand direkt setzen. */
export function resetCoach(state?: Partial<CoachState>): void {
  docs.clear();
  writer = null;
  useCoach.setState({ status: 'loading', profile: null, cards: new Map(), days: {}, invalid: [], ...state });
}

export function setWriterForTests(w: Writer | null): void {
  writer = w;
}

async function patchDoc(path: string, patch: Record<string, unknown>): Promise<void> {
  if (!writer) return;
  try {
    await writer.patch(path, patch, docs.get(path) ?? null);
  } catch (err) {
    logError('coach:write', err, path);
  }
}

/** Karten speichern (lokal sofort, dann je Teilstück ein Schreibvorgang). */
export async function saveCards(entries: ReadonlyArray<readonly [string, CardRec]>): Promise<void> {
  if (!entries.length) return;
  const next = new Map(useCoach.getState().cards);
  const byShard = new Map<string, Record<string, CardRec>>();
  for (const [id, rec] of entries) {
    next.set(id, rec);
    const shard = shardOf(id);
    const bucket = byShard.get(shard) ?? {};
    bucket[id] = rec;
    byShard.set(shard, bucket);
  }
  useCoach.setState({ cards: next });
  await Promise.all([...byShard].map(([path, c]) => patchDoc(path, { c })));
}

/** Tageswerte eines Lerntags ersetzen (lokal sofort). */
export async function saveDay(day: string, rec: DayRec): Promise<void> {
  useCoach.setState((s) => ({ days: { ...s.days, [day]: rec } }));
  await patchDoc(daysDocOf(day), { d: { [day]: rec } });
}

/** Profil ergänzen (verschachtelte Objekte werden verschmolzen). */
export async function saveProfile(patch: Partial<ProfileDoc>): Promise<void> {
  const cur = useCoach.getState().profile;
  const base: ProfileDoc = cur ?? { v: 1, created: Date.now(), newPerDay: DEFAULT_NEW_PER_DAY };
  const full = { ...base, ...patch, v: 1 as const };
  useCoach.setState({ profile: full });
  await patchDoc('coach/profile', cur ? patch : full);
}

export const emptyDay = (): DayRec => ({ min: 0, ans: 0, ok: 0, nw: 0 });
