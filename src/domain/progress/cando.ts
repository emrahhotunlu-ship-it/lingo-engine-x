import cefr from '../../content/legacy/cefr.json';
import { LESSONS } from '../content';
import { levelRank } from '../assessment/types';

// Weg nach C1 (Plan §7.2, E16): Status je Can-Do-Punkt aus `cefr.json`. Die Belegart steht in
// `item.evidence`. `reached` = belegt, `self` = von Emrah markiert (`profile.canDo[<id>]`),
// `open` = Daten da, aber noch nicht erreicht, `thin` = zu wenig Daten für ein Urteil.
// Neubau N92 (lehrer.md X2): Ein C1-Punkt gilt erst mit ZWEI echten Belegen als erreicht
// (`canDoEvidence`). Die Selbstmarkierung bleibt sichtbar getrennt („selbst eingeschätzt“) und
// zählt in der Zusammenfassung nicht mit.

export type CanDoItem = { id: string; level: string; dim: string; de: string; en: string; tip_de: string; tip_en: string; evidence: string };
export type CanDoStatus = 'reached' | 'self' | 'open' | 'thin';

export const CANDO_ITEMS = cefr.items as CanDoItem[];
export const CANDO_DIMS = cefr.dims as Array<{ id: string; de: string; en: string }>;

export type CanDoEnv = {
  /** Beherrschung je Grammatikthema (mit Anzeige-Verfall) und Antworten. */
  grammar: ReadonlyMap<string, { p: number; n: number }>;
  vtest: { passive: number; active: number } | null;
  /** Alle Wortschatztests (für C1: zwei Tests über der Schwelle = zwei Belege). Fehlt = nur `vtest`. */
  vtests?: ReadonlyArray<{ passive: number; active: number }>;
  colloc: { ema: number | null; n: number };
  radar: { n30: number; nPrev30: number };
  /** Korrigierte Texte, neueste zuerst. */
  writing: ReadonlyArray<{ cefr: string; register: number | null }>;
  /** Hörergebnisse mit Stufe. */
  listening: ReadonlyArray<{ level: string; n: number; ok: number }>;
  /** Sprechstufe der Einschätzung, nur bei Belastbarkeit ≠ thin. */
  speaking: string | null;
  /** Belastbarkeit der Sprechstufe (`good` = zwei Belege, sonst einer). */
  speakingConf?: 'fair' | 'good' | null;
  /** `profile.canDo` (Selbstmarkierungen; Lektions-Kennungen der alten App werden ignoriert). */
  self: Readonly<Record<string, unknown>>;
};

/** Stufen einer Lektion, die für ein Can-Do-Niveau zählen: B2 → Lektionen bis B2, C1 → B2+. */
function lessonTopics(level: string): string[] {
  const want = level === 'C1' ? ['B2+'] : ['B1+', 'B2'];
  return [...new Set(LESSONS.filter((l) => want.includes(l.level)).map((l) => l.grammar))];
}

const levelAtLeast = (have: string, want: string): boolean => levelRank(have) >= 0 && levelRank(have) >= levelRank(want);

function evidenceStatus(item: CanDoItem, env: CanDoEnv): Exclude<CanDoStatus, 'self'> {
  const c1 = item.level === 'C1';
  switch (item.evidence) {
    case 'grammar': {
      const ts = lessonTopics(item.level).map((t) => env.grammar.get(t));
      const n = ts.reduce((a, x) => a + (x?.n ?? 0), 0);
      if (n < 20) return 'thin';
      const mean = ts.reduce((a, x) => a + (x?.p ?? 0), 0) / Math.max(1, ts.length);
      return mean >= 0.75 ? 'reached' : 'open';
    }
    case 'vocab_passive':
      if (!env.vtest) return 'thin';
      return env.vtest.passive >= (c1 ? 8000 : 6000) ? 'reached' : 'open';
    case 'vocab_active':
      if (!env.vtest) return 'thin';
      return env.vtest.active >= (c1 ? 6000 : 4000) ? 'reached' : 'open';
    case 'colloc':
      if (env.colloc.ema === null || env.colloc.n < 100) return 'thin';
      return env.colloc.ema >= 0.75 ? 'reached' : 'open';
    case 'errors':
      if (env.radar.n30 + env.radar.nPrev30 === 0) return 'thin';
      return env.radar.n30 <= 0.5 * env.radar.nPrev30 && env.radar.n30 <= 20 ? 'reached' : 'open';
    case 'writing': {
      const last = env.writing.slice(0, 3);
      if (last.length < 3) return 'thin';
      return last.every((w) => levelAtLeast(w.cefr, item.level)) ? 'reached' : 'open';
    }
    case 'writing_register': {
      const rs = env.writing.map((w) => w.register).filter((r): r is number => r !== null);
      if (rs.length < 3) return 'thin';
      return rs.reduce((a, b) => a + b, 0) / rs.length >= 4 ? 'reached' : 'open';
    }
    case 'listening': {
      const at = env.listening.filter((l) => levelAtLeast(l.level, item.level));
      if (at.length < 3) return 'thin';
      const n = at.reduce((a, l) => a + l.n, 0);
      const ok = at.reduce((a, l) => a + l.ok, 0);
      return n > 0 && ok / n >= 0.8 ? 'reached' : 'open';
    }
    case 'fluency':
      if (!env.speaking) return 'thin';
      return levelAtLeast(env.speaking, item.level) ? 'reached' : 'open';
    default:
      return 'thin';
  }
}

/** Belege für C1 (N92). */
export const C1_MIN_EVIDENCE = 2;

/**
 * Zahl der echten Belege, die einen Punkt auf seiner Stufe tragen (lehrer.md X2). Einzelne
 * Leistungen zählen einzeln (Texte, Hörergebnisse, Tests, beherrschte Themen); zusammengefasste
 * Messwerte zählen je volle 100 Antworten (Kollokationen) bzw. als Vergleich zweier Zeiträume
 * (Fehler-Radar = 2). Die Selbstmarkierung ist nie ein Beleg.
 */
export function canDoEvidence(item: CanDoItem, env: CanDoEnv): number {
  const c1 = item.level === 'C1';
  const tests = env.vtests ?? (env.vtest ? [env.vtest] : []);
  switch (item.evidence) {
    case 'grammar':
      return lessonTopics(item.level).filter((t) => {
        const x = env.grammar.get(t);
        return !!x && x.n >= 5 && x.p >= 0.75;
      }).length;
    case 'vocab_passive':
      return tests.filter((v) => v.passive >= (c1 ? 8000 : 6000)).length;
    case 'vocab_active':
      return tests.filter((v) => v.active >= (c1 ? 6000 : 4000)).length;
    case 'colloc':
      return env.colloc.ema !== null && env.colloc.ema >= 0.75 ? Math.floor(env.colloc.n / 100) : 0;
    case 'errors':
      return evidenceStatus(item, env) === 'reached' ? 2 : 0;
    case 'writing':
      return env.writing.filter((w) => levelAtLeast(w.cefr, item.level)).length;
    case 'writing_register':
      return env.writing.filter((w) => w.register !== null && w.register >= 4).length;
    case 'listening':
      return env.listening.filter((l) => levelAtLeast(l.level, item.level) && l.n > 0 && l.ok / l.n >= 0.8).length;
    case 'fluency':
      return env.speaking && levelAtLeast(env.speaking, item.level) ? (env.speakingConf === 'good' ? 2 : 1) : 0;
    default:
      return 0;
  }
}

export function canDoStatus(item: CanDoItem, env: CanDoEnv): CanDoStatus {
  const raw = evidenceStatus(item, env);
  // C1 erst mit zwei Belegen (N92); bis dahin bleibt der Punkt offen.
  const st = raw === 'reached' && item.level === 'C1' && canDoEvidence(item, env) < C1_MIN_EVIDENCE ? 'open' : raw;
  if (st === 'reached') return 'reached';
  const mark = env.self[item.id];
  if (mark !== undefined && mark !== null && mark !== false) return 'self';
  return item.evidence === 'self' ? 'open' : st;
}

export type CanDoLevelSummary = { level: string; done: number; self: number; total: number };

/** „B2: 9 von 18 belegt · 3 selbst eingeschätzt" – nur Belegtes zählt (N92). */
export function canDoSummary(items: readonly CanDoItem[], status: (i: CanDoItem) => CanDoStatus): CanDoLevelSummary[] {
  const levels = [...new Set(items.map((i) => i.level))];
  return levels.map((level) => {
    const xs = items.filter((i) => i.level === level);
    return { level, done: xs.filter((i) => status(i) === 'reached').length, self: xs.filter((i) => status(i) === 'self').length, total: xs.length };
  });
}
