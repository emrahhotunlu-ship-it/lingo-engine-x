import { dayKey } from '../domain/date';
import { local } from '../platform/storage';
import { useCapabilities } from '../platform/capabilities';

// Ein Hintergrund-Budget für alle (Lernplattform 3.0 §5.2, K-9, P25). Gezählt werden nur Hintergrundaufrufe von Vorlagen mit `budget`;
// Nutzeraufrufe sind nie gedeckelt (sie haben nur das Tor: 20 je 60 s). Tageswechsel um 04:00 (`dayKey`).
//
// - `lx:ai-day` = `{d, bg, n: {<vorlage>: zahl}}` je Gerät in `localStorage`: nur Bequemlichkeit.
// - Zusätzlich gilt ein Zähler im Arbeitsspeicher als Untergrenze: ist `storage` nicht schreibbar (privates Fenster), gilt das Budget je Ansicht.
// - Höchstens 6 Hintergrundaufrufe je Tag; ein Platz davon ist für `diagnose` reserviert (die übrigen Vorlagen dürfen zusammen höchstens 5).
// - Ohne beantworteten Nutzeraufruf in dieser Ansicht (`sampleConfirmed`) wird nichts gesendet; nach `not_granted` und `rate_limited`
//   ruhen alle Hintergrundaufrufe für den Rest der Ansicht (`backgroundPaused`).
// Auslöser sind nur Rundenstart und Rundenende, nie Render, Timer oder Snapshot-Rückruf; das garantieren die Aufrufer.

export const BG_PER_DAY = 6;
/** Vorlage, für die ein Platz reserviert bleibt (Wochen-Diagnose, P49). */
export const BG_RESERVED_ID = 'diagnose';
const KEY = 'lx:ai-day';

type Day = { d: string; bg: number; n: Record<string, number> };

/** Untergrenze im Arbeitsspeicher (überlebt nur diese Ansicht). */
let mem: Day = { d: '', bg: 0, n: {} };

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

function stored(d: string): Day {
  const v = local.getJson<Partial<Day>>(KEY);
  if (!v || v.d !== d) return { d, bg: 0, n: {} };
  const n: Record<string, number> = {};
  if (v.n && typeof v.n === 'object') for (const [k, x] of Object.entries(v.n)) if (count(x)) n[k] = count(x);
  return { d, bg: count(v.bg), n };
}

/** Stand von heute: je Feld das Größere aus Speicher und Arbeitsspeicher. */
export function aiDay(now: number = Date.now()): Day {
  const d = dayKey(now);
  const s = stored(d);
  const m = mem.d === d ? mem : { d, bg: 0, n: {} as Record<string, number> };
  const n: Record<string, number> = { ...s.n };
  for (const [k, x] of Object.entries(m.n)) n[k] = Math.max(n[k] ?? 0, x);
  return { d, bg: Math.max(s.bg, m.bg), n };
}

/** Hintergrundaufrufe heute (alle Vorlagen). */
export const bgUsedToday = (now: number = Date.now()): number => aiDay(now).bg;

export type BgVerdict = 'budget' | 'no_consent_yet' | 'bg_paused';

/**
 * Darf diese Vorlage jetzt im Hintergrund fragen? `null` = ja. Prüft Zustimmung, Pause, Tagesdeckel der Vorlage und die Summe (mit dem
 * reservierten Platz für `diagnose`).
 */
export function bgVerdict(templateId: string, bgPerDay: number, now: number = Date.now()): BgVerdict | null {
  const cap = useCapabilities.getState();
  if (cap.backgroundPaused) return 'bg_paused';
  if (!cap.sampleConfirmed) return 'no_consent_yet';
  const day = aiDay(now);
  if ((day.n[templateId] ?? 0) >= Math.max(0, bgPerDay)) return 'budget';
  if (templateId === BG_RESERVED_ID) return day.bg >= BG_PER_DAY ? 'budget' : null;
  const others = day.bg - (day.n[BG_RESERVED_ID] ?? 0);
  return others >= BG_PER_DAY - 1 ? 'budget' : null;
}

/** Zählt einen gesendeten Hintergrundaufruf (auch ein späterer Fehler gibt ihn nicht zurück: sonst wäre „Erneut“ eine Hintertür). */
export function bgTake(templateId: string, now: number = Date.now()): void {
  const day = aiDay(now);
  const next: Day = { d: day.d, bg: day.bg + 1, n: { ...day.n, [templateId]: (day.n[templateId] ?? 0) + 1 } };
  mem = next;
  local.set(KEY, JSON.stringify(next));
}

/** Nur für Tests: Arbeitsspeicher-Zähler leeren. */
export function resetAiBudget(): void {
  mem = { d: '', bg: 0, n: {} };
}
