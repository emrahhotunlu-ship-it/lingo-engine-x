import { legacyV2Items } from '../c1x/legacyV2';
import { toTask } from '../c1x/runtime';
import { topicById } from '../content';
import type { GrammarTask, GrammarTaskType } from '../learn/types';
import { topicP } from './bkt';
import { focusPartner, stageFallback, stageForms, type FocusStage } from './focus';
import { isNewTopic } from './path';
import { FALLBACK, roundPicker, selectRound, wantTypes, type InputProfile, type Pick2, type RoundInput } from './tasks';

// Fokus-Runde (Politur P3, Emrahs Entscheidung E1 „A“ 13.11.2026): 1–2 Aufwärm-Aufgaben (fällige Wiederholung früherer Themen in neuer
// Variante, eigene Fehlersätze aus eingeführten Themen), danach nur das Fokus-Thema in der Stufe des Tages. Am Tag mit der kurzen Regel
// kostet die Regel einen Platz, damit die Runde nicht länger dauert als geplant. Rein: Zeit und Startwert kommen als Parameter.

type Doc = Readonly<Record<string, unknown>>;

export type FocusRoundIn = Pick<RoundInput, 'grammarDocs' | 'dailyOpen' | 'pool' | 'seed' | 'profile' | 'wordsToday' | 'reported' | 'repairs' | 'c1'> & {
  nowMs: number;
  /** Plätze laut Plan (`grammarTasksFor(Minuten)`). */
  size: number;
  topic: string;
  stage: FocusStage;
  /** Muster des Tages (leer = alle eingeführten Muster des Themas). */
  pats: readonly string[];
  /** Vorn steht heute die kurze Regel. */
  rule: boolean;
  /** Zuerst ein eigener Fehlersatz (`error`) oder eine fällige Themen-Wiederholung (`review`); der andere Platz nimmt das andere. */
  warmFirst?: 'error' | 'review';
  /** Zusätzlich ausgeschlossene Aufgaben (z. B. schon in der Runde). */
  exclude?: ReadonlySet<string>;
};

/** Aufwärm-Aufgaben und Gesamtlänge: an normalen Tagen 1 (ab 5 Plätzen 2); am Regel-Tag kostet die Regel einen Platz und das Aufwärmen weicht zuerst. */
export function focusShape(size: number, rule: boolean): { total: number; warm: number } {
  const n = Math.max(1, Math.floor(size));
  if (!rule) return { total: n, warm: n >= 5 ? 2 : n >= 3 ? 1 : 0 };
  const total = Math.max(Math.min(3, n), n - 1);
  return { total, warm: Math.min(2, Math.max(0, total - 3)) };
}

/** Fällige Wiederholung: begonnene Themen außer dem Fokus-Thema, deren Fälligkeit erreicht ist (älteste zuerst); sonst das am längsten nicht geübte. */
export function warmTopics(docs: ReadonlyMap<string, Doc>, nowMs: number, focus: string, max = 2): string[] {
  const begun = [...docs.entries()].filter(([t, d]) => t !== focus && !!topicById(t) && !isNewTopic(d));
  const due = (d: Doc): number => (typeof d.due === 'number' ? d.due : Number.POSITIVE_INFINITY);
  const last = (d: Doc): number => (typeof d.last === 'number' ? d.last : 0);
  const dueNow = begun.filter(([, d]) => due(d) <= nowMs).sort((a, b) => due(a[1]) - due(b[1]) || a[0].localeCompare(b[0]));
  const rest = begun.filter(([, d]) => due(d) > nowMs).sort((a, b) => last(a[1]) - last(b[1]) || a[0].localeCompare(b[0]));
  return [...dueNow, ...rest].slice(0, max).map(([t]) => t);
}

/** Die erste Umformung der Stufe „Umformen“ als Baustein-Aufgabe (c1x-Adapter der LP2-Umformung), sonst die Aufgabe selbst. */
export function withTiles(t: GrammarTask): GrammarTask {
  if (t.type !== 'kwt' || t.c1 || t.x?.kind !== 'kwt') return t;
  const x = t.x;
  const item = legacyV2Items().find((it) => it.kind === 'kwt' && it.topic === t.topic && it.lead === x.from && it.key === x.key);
  if (!item) return t;
  return { ...toTask(item, { ref: t.ref ?? 'content/grammar/tasks-v2' }), ...(t.slot ? { slot: t.slot } : {}), ease: 'tiles' };
}

type Picker = ReturnType<typeof roundPicker>;

/**
 * `count` Fokus-Aufgaben der Stufe (ab Platz `from` der Formenfolge): je Platz die Wunschform, reihum über die Muster des Tages; fehlt sie,
 * erst andere Muster des Themas, dann schon gesehene Aufgaben, zuletzt die leichteren Formen der Stufe. In „Mischen“ ist jede zweite Aufgabe
 * (ab der zweiten) vom Verwechslungs-Partner. Die erste Umformung in „Umformen“ kommt mit Bausteinen.
 */
function pickFocus(pk: Picker, i: Pick<FocusRoundIn, 'topic' | 'stage' | 'pats' | 'grammarDocs' | 'nowMs' | 'profile'>, count: number, from = 0, tiled = false): GrammarTask[] {
  const profile: InputProfile = i.profile ?? 'keys';
  const forms = stageForms(i.stage, profile);
  const back = stageFallback(i.stage, profile);
  const dayPats = i.pats.length ? [...i.pats] : null;
  const partner = i.stage === 4 ? focusPartner(i.topic, i.grammarDocs, i.nowMs) : null;
  const out: GrammarTask[] = [];
  let tiles = tiled;
  for (let k = 0; k < count; k++) {
    const slot = from + k;
    const prefer = forms[slot % forms.length] as readonly GrammarTaskType[];
    // Mischen: Fokus, Partner, Fokus, Fokus, Partner … (jede dritte Aufgabe ab der zweiten).
    const topic = partner && slot % 3 === 1 ? partner : i.topic;
    const own = topic === i.topic;
    const one = own && dayPats ? [dayPats[slot % dayPats.length] as string] : null;
    const all = own ? dayPats : null;
    const want = own ? prefer : wantTypes(topicP(topic, i.grammarDocs.get(topic), i.nowMs), profile);
    const tries: Array<() => GrammarTask | null> = [
      () => pk.fresh({ topic, prefer: want, strict: true, pats: one }),
      () => pk.fresh({ topic, prefer: want, strict: true, pats: all }),
      () => (all ? pk.fresh({ topic, prefer: want, strict: true }) : null),
      () => pk.fresh({ topic, prefer: want, strict: true, pats: all, allowSeen: true }),
      () => pk.fresh({ topic, prefer: own ? back : [...want, ...FALLBACK[profile]], strict: true, pats: all }),
      () => pk.fresh({ topic, prefer: own ? back : [...want, ...FALLBACK[profile]], strict: true, allowSeen: true }),
    ];
    let pick: GrammarTask | null = null;
    for (const run of tries) {
      pick = pk.take(run());
      if (pick) break;
    }
    // Der Partner hat nichts Passendes: der Platz gehört dem Fokus-Thema.
    if (!pick && !own) pick = pk.take(pk.fresh({ topic: i.topic, prefer, pats: dayPats })) ?? pk.take(pk.fresh({ topic: i.topic, prefer: back, allowSeen: true }));
    if (!pick) continue;
    let task: GrammarTask = pick.topic === i.topic ? { ...pick, slot: 'focus', fo: i.stage } : { ...pick, slot: 'family' };
    if (i.stage === 3 && !tiles && task.type === 'kwt' && task.topic === i.topic) {
      const t2 = withTiles(task);
      if (t2 !== task) {
        task = { ...t2, fo: i.stage };
        pk.used.add(task.key);
      }
      tiles = true;
    }
    out.push(task);
  }
  return out;
}

const pickerIn = (i: FocusRoundIn, exclude?: ReadonlySet<string>): Pick2 => ({
  mode: 'duty',
  grammarDocs: i.grammarDocs,
  dailyOpen: i.dailyOpen,
  pool: i.pool,
  seed: i.seed,
  gt: null,
  // Die Muster des Tages gelten als eingeführt (neues Thema, neuer Einführungsschritt).
  introBlock: { topic: i.topic, pats: [...i.pats] },
  ...(i.profile ? { profile: i.profile } : {}),
  ...(i.wordsToday ? { wordsToday: i.wordsToday } : {}),
  ...(i.reported ? { reported: i.reported } : {}),
  ...(exclude ? { exclude } : {}),
});

/**
 * Die Fokus-Runde: Aufwärmen vorn (`warm: true`), dann das Fokus-Thema (`fo` = Stufe). Eigene Fehlersätze kommen nur im Aufwärmen
 * (höchstens 2, wie bisher als neue Variante ab Box 1) und nur aus begonnenen Themen. Fehlt Aufwärm-Stoff, gehört der Platz dem Fokus-Thema.
 */
export function selectFocusRound(i: FocusRoundIn): { tasks: GrammarTask[]; warm: number } {
  const shape = focusShape(i.size, i.rule);
  const warmTasks: GrammarTask[] = [];
  const used = new Set<string>(i.exclude ?? []);
  if (shape.warm > 0) {
    // Eigene Fehler: dieselbe Auswahl wie bisher (fällige Grammatik-Fehlersätze und `app/repair` im Wechsel, Variante ab Box 1).
    const errors = selectRound({
      mode: 'errors',
      grammarDocs: i.grammarDocs,
      dailyOpen: i.dailyOpen,
      pool: i.pool,
      nowMs: i.nowMs,
      size: shape.warm,
      seed: `${i.seed}|warm`,
      ...(i.profile ? { profile: i.profile } : {}),
      ...(i.wordsToday ? { wordsToday: i.wordsToday } : {}),
      ...(i.reported ? { reported: i.reported } : {}),
      ...(i.repairs?.length ? { repairs: i.repairs } : {}),
      ...(i.c1 ? { c1: i.c1 } : {}),
      exclude: used,
    }).filter((t) => t.rep || !isNewTopic(i.grammarDocs.get(t.topic)));
    const pk = roundPicker(pickerIn(i, used));
    const profile: InputProfile = i.profile ?? 'keys';
    const reviews: GrammarTask[] = [];
    for (const topic of warmTopics(i.grammarDocs, i.nowMs, i.topic, 4)) {
      if (reviews.length >= shape.warm) break;
      const want = wantTypes(topicP(topic, i.grammarDocs.get(topic), i.nowMs), profile);
      const pick = pk.fresh({ topic, prefer: [...new Set([...want, ...FALLBACK[profile]])] });
      if (pick && !errors.some((e) => e.key === pick.key)) {
        pk.take(pick);
        reviews.push({ ...pick, slot: 'mix' });
      }
    }
    const order = i.warmFirst === 'review' ? [reviews, errors] : [errors, reviews];
    for (let k = 0; warmTasks.length < shape.warm && (k < errors.length || k < reviews.length); k++) {
      for (const list of order) {
        const t = list[k];
        if (t && warmTasks.length < shape.warm && !used.has(t.key)) {
          used.add(t.key);
          warmTasks.push({ ...t, warm: true });
        }
      }
    }
  }
  const pk = roundPicker(pickerIn(i, used));
  const focus = pickFocus(pk, i, shape.total - warmTasks.length);
  return { tasks: [...warmTasks, ...focus], warm: warmTasks.length };
}

/**
 * Nach einem Stufenwechsel mitten in der Runde: die noch offenen Fokus-Aufgaben (ab `from`, nur solche mit `fo`) in der neuen Stufe neu wählen.
 * Die Zahl der Aufgaben bleibt gleich; findet sich nichts, bleibt die alte Aufgabe stehen.
 */
export function refocus(i: FocusRoundIn, tasks: readonly GrammarTask[], from: number, end: number): GrammarTask[] {
  const idx: number[] = [];
  for (let k = from; k < Math.min(end, tasks.length); k++) if (tasks[k]?.fo !== undefined || tasks[k]?.slot === 'family') idx.push(k);
  if (!idx.length) return [...tasks];
  const keep = new Set(tasks.filter((_, k) => !idx.includes(k)).map((t) => t.key));
  const pk = roundPicker(pickerIn(i, new Set([...(i.exclude ?? []), ...keep])));
  // Plätze der Formenfolge: nach den schon beantworteten Fokus-Aufgaben dieser Runde weiterzählen (die erste Umformung bleibt die mit Bausteinen).
  const done = tasks.slice(0, from).filter((t) => t.fo === i.stage).length;
  const tiled = tasks.slice(0, from).some((t) => t.ease === 'tiles');
  const fresh = pickFocus(pk, i, idx.length, done, tiled);
  const out = [...tasks];
  idx.forEach((at, k) => {
    const t = fresh[k];
    if (t) out[at] = t;
  });
  return out;
}
