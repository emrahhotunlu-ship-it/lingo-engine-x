import { dayKey } from '../date';
import { whyOfError } from '../grammar/errorWhy';
import type { Lang } from '../srs/types';
import { dueErrors, errorSentences } from '../grammar/errors';
import { hasFk } from './fk';
import { fehlersatzProblem, gapHintOf, type HideReason } from './quality';
import { dueRepairs, readRepairs, repairNorm, type RepairSrc } from './repair';

// Fehlersätze (Schritt „Fehler korrigieren“): EINE Liste aus beiden Speichern, `app/repair` (eigene Sätze, Boxen 1/3/9) und
// `grammar/<thema>.errors` (falsche Grammatik-Antworten, gleiche Boxen). Rein, schreibt nichts. Sätze vom Anlegetag (Lerntag) kommen
// nie (verteilt statt massiert), nichts doppelt, älteste Fälligkeit zuerst. Jeder Satz weiß, in welchen Speicher seine Antwort gehört.

type Doc = Readonly<Record<string, unknown>>;

export type Fehlersatz = {
  /** Eindeutig über beide Speicher: `app/repair`-Kennung bzw. `g:<thema>:<t>`. */
  id: string;
  wrong: string;
  right: string;
  why?: string;
  due: number;
  store: 'repair' | 'grammar';
  /** Herkunft für die Anzeige: bei Grammatik-Fehlern `lesson`. */
  src: RepairSrc;
  fix?: string[];
  /** Nur Grammatik: Thema und Zeitstempel des Fehlereintrags (Schlüssel für `reviewError`). */
  topic?: string;
  errorT?: number;
  /** Muster (Kennung wie im Eintrag), falls bekannt. */
  pat?: string;
  /** Wie oft dieselbe Fehlerart schon vorkam (Fehlerart-Etikett von B3): der Eintrag selbst plus die gemerkten Zusatzsätze. */
  n?: number;
  /** Gespeicherter Kontext: Herkunft des Satzes (`ctx` des Reparatur-Satzes) bzw. die damalige Aufgabe mit Lücke. */
  ctx?: string;
  /** Lückenhinweis der damaligen Aufgabe („already / send“). */
  gapHint?: string;
  /** Gesetzt: der Satz ist als Korrektur-Aufgabe unbrauchbar (Ausschlussregel) und kommt nur als B1 „Sag es richtig“ wieder. */
  hidden?: HideReason;
};

export type HiddenFehlersatz = { id: string; reason: HideReason };

const str = (v: unknown): string => (typeof v === 'string' ? v : '');


type CollectIn = { grammarDocs: ReadonlyMap<string, Doc>; repairDoc: Doc | null | undefined; nowMs: number; today: string; limit?: number; /** Eigene Sätze und Grammatik-Fehlersätze im Wechsel statt „älteste zuerst“. Ohne Angabe: gemischt, sobald eine Grenze (`limit`) gesetzt ist. */ mix?: boolean; lang?: Lang };

/**
 * Fällige Fehlersätze beider Speicher mit den Ausschlussregeln von Paket FK (`quality.ts`): Ein unbrauchbarer Satz (verstümmelt, nur ein Wort,
 * Anweisung als Satz, Dopplung, Mitschrift, schon richtig) wird nicht als Korrektur gezeigt. Hat sein Muster oder Thema eine „Sag es richtig“-Aufgabe,
 * kommt er mit `hidden` wieder (und zählt mit), sonst fällt er heraus (`dropped`, nur für die Diagnose). Nichts wird gelöscht; wer „Kann ich nicht
 * nachvollziehen“ gedrückt hat (`unclear`), kommt nie wieder.
 */
function collect(i: CollectIn): { list: Fehlersatz[]; dropped: HiddenFehlersatz[] } {
  const out: Fehlersatz[] = [];
  const dropped: HiddenFehlersatz[] = [];
  const keep = (f: Fehlersatz, problem: HideReason | null): void => {
    if (!problem) {
      out.push(f);
      return;
    }
    if (hasFk({ pat: f.pat ?? null, topic: f.topic ?? null })) out.push({ ...f, hidden: problem });
    else dropped.push({ id: f.id, reason: problem });
  };
  for (const r of dueRepairs(readRepairs(i.repairDoc ?? undefined), i.nowMs)) {
    if (dayKey(r.t) === i.today) continue;
    const f: Fehlersatz = { id: r.id, wrong: r.wrong, right: r.right, ...(r.why ? { why: r.why } : {}), due: r.due, store: 'repair', src: r.src, ...(r.fix ? { fix: r.fix } : {}), ...(r.pat ? { pat: r.pat } : {}), ...(r.ctx ? { ctx: r.ctx } : {}) };
    keep(f, fehlersatzProblem({ wrong: r.wrong, right: r.right, src: r.src, confirmed: (r as { confirmed?: unknown }).confirmed === true }));
  }
  for (const d of dueErrors(i.grammarDocs, i.nowMs)) {
    const t = typeof d.e.t === 'number' ? d.e.t : null;
    if (t === null || dayKey(t) === i.today) continue;
    const q = str(d.e.q).trim();
    const given = str(d.e.given);
    const { wrong, right } = errorSentences(q, given, d.task.answer);
    if (!right || repairNorm(wrong) === repairNorm(right)) continue;
    const why = whyOfError(d.topic, d.e, i.lang ?? 'de');
    const pat = str(d.e.pat).trim();
    const hint = q.includes('___') ? gapHintOf(q) : null;
    const f: Fehlersatz = {
      id: `g:${d.topic}:${t}`,
      wrong,
      right,
      ...(why ? { why } : {}),
      due: d.due,
      store: 'grammar',
      src: 'lesson',
      topic: d.topic,
      errorT: t,
      ...(pat ? { pat } : {}),
      n: 1 + (Array.isArray(d.e.more) ? d.e.more.length : 0),
      // Die damalige Aufgabe mit Lücke ist der Kontext des gefüllten Fehlersatzes; ein Satz ohne Lücke ist selbst die Aufgabe.
      ...(q.includes('___') ? { ctx: q.replace(/\s*\([^()]*\)/, '') } : {}),
      ...(hint ? { gapHint: hint } : {}),
    };
    keep(f, wrong ? fehlersatzProblem({ wrong, right, src: 'lesson', q, given }) : 'empty');
  }
  const seen = new Set<string>();
  // Auswertung 15.10.2026, Punkt 5: Mit Grenze (`limit`) wechseln sich Reparatur-Sätze (eigene Sätze) und Grammatik-Fehlersätze ab, je Speicher nach Fälligkeit.
  // Reine „älteste zuerst“-Reihenfolge ließ die eigenen Sätze aus dem Schreiben auf Box 0 liegen (25 von 25 ohne eine einzige Wiederholung), weil die
  // übrigen, älteren Einträge jeden Platz belegten. Ohne Grenze (Zählungen) bleibt es bei „älteste zuerst“, außer `mix: true` (Reparatur-Durchgang: erst mischen, erledigte Sätze entfernen, dann die ersten 5 nehmen).
  const byDue = (a: Fehlersatz, b: Fehlersatz): number => a.due - b.due;
  const ordered = ((): Fehlersatz[] => {
    if (!(i.mix ?? i.limit !== undefined)) return out.sort(byDue);
    const own = out.filter((f) => f.store === 'repair').sort(byDue);
    const gram = out.filter((f) => f.store === 'grammar').sort(byDue);
    const mixed: Fehlersatz[] = [];
    for (let k = 0; k < Math.max(own.length, gram.length); k++) {
      if (own[k]) mixed.push(own[k]!);
      if (gram[k]) mixed.push(gram[k]!);
    }
    return mixed;
  })();
  const list = ordered.filter((f) => {
    const k = repairNorm(f.wrong);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { list: i.limit === undefined ? list : list.slice(0, i.limit), dropped };
}

export function dueFehlersaetze(i: CollectIn): Fehlersatz[] {
  return collect(i).list;
}

/** Fehlersätze, die als Aufgabe ganz herausfallen (Ausschlussregel ohne passende B1-Aufgabe), mit Grund: Diagnose-Zähler. Die Einträge bleiben gespeichert. */
export function droppedFehlersaetze(i: CollectIn): HiddenFehlersatz[] {
  return collect({ ...i, limit: undefined }).dropped;
}

/**
 * Fällige Grammatik-Fehlersätze: derselbe Filter wie `dueFehlersaetze` (Sätze vom Anlegetag nie, gültige Sätze, nichts doppelt), nur ohne
 * Reparatur-Sätze. Grundlage der Einführungsbremse „ab 10 fälligen Grammatikfehlern kein neues Thema“ (`grammar/path`).
 */
export function grammarFehlersaetzeDue(i: { grammarDocs: ReadonlyMap<string, Doc>; nowMs: number; today: string }): number {
  return dueFehlersaetze({ grammarDocs: i.grammarDocs, repairDoc: null, nowMs: i.nowMs, today: i.today }).length;
}
