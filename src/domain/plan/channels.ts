import { addDays, daysBetween, isDayKey } from '../date';
import type { DutyChannel, ExecChannel } from '../learn/types';
import { hash32 } from '../random';
import type { WhyKey } from './types';

// Kanäle des Tagesplans (phase2-plan §6.1, Portierung von `channelNeed`, today.js:198).
// Punktzahl je Kanal: liegen geblieben, Fokus der Einschätzung, dünne Datenlage, schwächster
// Bereich, fällige Fehler; abzüglich wie oft er diese Woche schon dran war. Begründungen nur
// mit den Schlüsseln der alten App (D14), damit der Rückweg sie übersetzen kann.

type Doc = Record<string, unknown>;

export type EmaChannel = 'recog' | 'write' | 'listen' | 'colloc' | 'all';

/** Fertigkeit der Einschätzung, zu der ein Kanal gehört (Phase 6, Plan §5.1). */
export type SkillId = 'grammar' | 'vocabulary' | 'reading' | 'listening' | 'writing' | 'speaking';

export type ChannelDef = {
  id: ExecChannel;
  /** Schlüssel in `app/profile.act[tag]` (alte App). */
  act: string;
  ema: EmaChannel;
  /** Minuten je Runde (Pflicht-Rundengröße). */
  min: number;
  skill: SkillId;
};

export const CHANNELS: readonly ChannelDef[] = [
  { id: 'gram', act: 'gram', ema: 'write', min: 5, skill: 'grammar' },
  { id: 'cloze', act: 'cloze', ema: 'colloc', min: 5, skill: 'vocabulary' },
  { id: 'order', act: 'order', ema: 'write', min: 5, skill: 'grammar' },
  { id: 'dictate', act: 'dictate', ema: 'listen', min: 6, skill: 'listening' },
  { id: 'sprint', act: 'sprint', ema: 'all', min: 2, skill: 'vocabulary' },
  { id: 'vocab', act: 'cards', ema: 'recog', min: 10, skill: 'vocabulary' },
];

/** Kanäle, die diese Ausbaustufe ausführen kann (Kennungen der alten App, D19). */
export const PHASE2_EXECUTABLE: readonly ExecChannel[] = ['gram', 'vocab', 'sprint', 'dictate', 'cloze', 'order'];
/** Pflichtkanäle: ohne KI und ohne Sprachausgabe erfüllbar (D3). */
export const DUTY_CHANNELS: readonly DutyChannel[] = ['gram', 'cloze', 'order'];
export const isDutyChannel = (id: string): id is DutyChannel => (DUTY_CHANNELS as readonly string[]).includes(id);

/** Rundengröße im Pflichtkanal (D20). */
export const DUTY_ROUND: Readonly<Record<DutyChannel, number>> = { gram: 6, cloze: 8, order: 6 };
/** Minuten der Pflicht (D4): Wiederholen ≈ 10, Lektion 12, Kanal ≈ 5. */
export const DUTY_MINUTES = { review: 10, lesson: 12 } as const;

export const channelDef = (id: string): ChannelDef | undefined => CHANNELS.find((c) => c.id === id);

export type FeasibleData = {
  /** Kollokationen mit Kontextsatz (Lückenjagd ab 8). */
  cloze: number;
  /** Satzbau-Sätze (ab 6). */
  order: number;
  /** Bekannte Elemente für den Sprint (ab 20). */
  sprint: number;
  /** Karten, die überhaupt abgefragt werden können. */
  vocab: number;
};
export type FeasibleEnv = { tts: boolean };

export function feasible(id: ExecChannel, data: FeasibleData, env: FeasibleEnv): boolean {
  switch (id) {
    case 'gram':
      return true;
    case 'cloze':
      return data.cloze >= 8;
    case 'order':
      return data.order >= 6;
    case 'sprint':
      return data.sprint >= 20;
    case 'dictate':
      return env.tts;
    case 'vocab':
      return data.vocab > 0;
  }
}

const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Lerntage seit dem letzten Tag mit `act[tag][act]` oder `act~` (auch angefangen zählt); `null` = nie. */
export function daysSinceAct(act: unknown, key: string, today: string): number | null {
  let last: string | null = null;
  for (const [d, v] of Object.entries(obj(act))) {
    if (!isDayKey(d) || d > today) continue;
    const day = obj(v);
    if (num(day[key]) > 0 || num(day[`${key}~`]) > 0) if (!last || d > last) last = d;
  }
  return last === null ? null : daysBetween(last, today);
}

/** An wie vielen der letzten 7 Lerntage (einschließlich heute) wurde der Kanal erledigt? */
export function weekCount(act: unknown, key: string, today: string): number {
  const a = obj(act);
  let n = 0;
  for (let k = 0; k < 7; k++) if (num(obj(a[addDays(today, -k)])[key]) > 0) n++;
  return n;
}

/**
 * Was die Einschätzung zum Tagesplan beiträgt (Phase 6, Plan §5.2). Nur die Kennungen, keine
 * Texte – deshalb unabhängig von der Sprache der gespeicherten Einschätzung.
 */
export type AssessPlanInput = {
  /** Fokus gilt noch (`d + focus.days > heute`). */
  focusValid: boolean;
  /** Kanäle des Fokus (`focus.channels` bzw. `focusChannels(action)`). */
  focusChannels: readonly string[];
  /** Kennung für die Begründung, z. B. `grammar:mixed-cond`. */
  focusRef: string | null;
  /** Stufe und Belastbarkeit je Fertigkeit (fehlt = dünn). */
  dims: Partial<Record<SkillId, { rank: number; confidence: 'thin' | 'fair' | 'good' }>>;
};

export type RankInput = {
  today: string;
  profile: Readonly<Doc>;
  /** `app/assess` Fokus-Aktion (nur bei passender Sprache), z. B. `grammar:passive` oder `colloc`. */
  focus: string | null;
  /** Phase 6: Einschätzung (Fokus-Kanäle, Belastbarkeit, schwächste Fertigkeit); fehlt = Regeln aus Phase 2. */
  assess?: AssessPlanInput | null;
  dueErrors: number;
  dueCards: number;
  data: FeasibleData;
  env: FeasibleEnv;
};

export type RankedChannel = { id: ExecChannel; score: number; why: WhyKey[]; days: number | null };

function focusHits(focus: string | null, c: ChannelDef): boolean {
  if (!focus) return false;
  return focus === c.id || focus === c.act || (/^grammar:/.test(focus) && c.id === 'gram') || (focus === 'colloc' && (c.id === 'vocab' || c.id === 'cloze'));
}

export function channelScore(c: ChannelDef, i: RankInput): RankedChannel {
  const act = i.profile.act;
  const days = daysSinceAct(act, c.act, i.today);
  const why: WhyKey[] = [];
  let score = 0;
  const d = days === null ? 14 : days;
  score += Math.min(d, 10) * 3;
  if (d >= 2) why.push(days === null ? ['agoNever'] : ['agoDaysN', d]);
  const a = i.assess ?? null;
  if (a?.focusValid && a.focusChannels.includes(c.id)) {
    score += 30;
    why.unshift(a.focusRef ? ['whyFocus', 0, a.focusRef] : ['whyFocus']);
  } else if (!a?.focusValid && focusHits(i.focus, c)) {
    score += 30;
    why.unshift(['whyFocus']);
  }
  if (a && Object.keys(a.dims).length) {
    // Phase 6: dünne Datenlage und schwächster Bereich aus der Einschätzung (Plan §5.2).
    const mine = a.dims[c.skill];
    if (!mine || mine.confidence === 'thin') {
      score += 14;
      why.push(['whyThin']);
    }
    const ranks = Object.values(a.dims)
      .filter((d) => d.confidence !== 'thin' && d.rank >= 0)
      .map((d) => d.rank);
    if (mine && mine.confidence !== 'thin' && ranks.length > 1 && mine.rank <= Math.min(...ranks)) {
      score += 12;
      why.push(['whyWeakest']);
    }
  } else {
    const n = obj(i.profile.n);
    const nCh = c.ema === 'all' ? Object.values(n).reduce<number>((acc, v) => acc + num(v), 0) : num(n[c.ema]);
    if (nCh < 20) {
      score += 14;
      why.push(['whyThin']);
    }
    const ema = obj(i.profile.ema);
    const vals = (['recog', 'write', 'listen', 'colloc'] as const).map((k) => (typeof ema[k] === 'number' ? ema[k] : null)).filter((v): v is number => v !== null);
    const mine = typeof ema[c.ema] === 'number' ? (ema[c.ema] as number) : null;
    if (mine !== null && vals.length && mine <= Math.min(...vals) + 0.02) {
      score += 12;
      why.push(['whyWeakest']);
    }
  }
  if (c.id === 'gram' && i.dueErrors >= 3) {
    score += 10;
    // Phase 6: auch dieser Faktor nennt seinen Grund (Kap. 6.1). Schlüssel der alten App (D14),
    // additiv mit Kennung `gram` (Plan E10), damit die Anzeige „Fehlersätze" statt „Karten" sagt.
    why.push(['whyDue', i.dueErrors, 'gram']);
  }
  if (c.id === 'vocab' && i.dueCards >= 10) {
    score += 10;
    why.push(['whyDue', i.dueCards]);
  }
  const week = weekCount(act, c.act, i.today);
  score -= week * 6;
  // Jede Zeile nennt einen Grund (P-02); ohne besonderen Anlass „turnusmäßig dran" (Schlüssel der alten App).
  // Höchstens zwei Gründe, der Fokus zuerst (Plan E9).
  return { id: c.id, score, why: why.length ? why.slice(0, 2) : [['whyRotation']], days };
}

/** Machbare Kanäle nach Punktzahl; Gleichstand entscheidet `hash32(tag|id)` (nie neu gewürfelt). */
export function rankChannels(i: RankInput): RankedChannel[] {
  return CHANNELS.filter((c) => feasible(c.id, i.data, i.env))
    .map((c) => channelScore(c, i))
    .sort((a, b) => b.score - a.score || hash32(`${i.today}|${a.id}`) - hash32(`${i.today}|${b.id}`));
}
