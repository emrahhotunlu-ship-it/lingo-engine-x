import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allSeedTasks } from '../../src/domain/grammar/tasks';
import { c1File } from '../../src/domain/c1x/schema';
import type { C1Item } from '../../src/domain/c1x/types';
import { checkErrorSentence, whyCut } from '../../src/domain/quality/errorSentence';
import { gateTask } from '../../src/domain/quality/gate';
import { deEnMismatch, duplicates } from '../../src/domain/quality/match';
import { denglisch, longForms } from '../../src/domain/quality/register';
import { absoluteClaims, duSieMix } from '../../src/domain/quality/wording';

// E1a Qualitätstor für den VORHANDENEN Bestand. Feste Inhalte werden nicht gesperrt (das Tor gilt für erzeugte Inhalte), sondern hier gemeldet.
// Altlasten stehen in `tests/fixtures/quality-exceptions.json` (je Prüfung die Kennungen). Der Zähler darf nur sinken:
// - ein NEUER Befund (Kennung nicht in der Liste) macht den Test rot → Inhalt korrigieren, nie die Liste erweitern;
// - eine behobene Altlast (Kennung in der Liste, aber kein Befund mehr) macht ihn auch rot → Kennung aus der Liste streichen.
// Neu schreiben (nur nach bewusster Entscheidung, z. B. nach einer Regeländerung): `QUALITY_BASELINE=write npx vitest run tests/unit/qualityContent.test.ts`.

const FIX = 'tests/fixtures/quality-exceptions.json';
type Exceptions = { note: string; counts: Record<string, number>; ids: Record<string, string[]> };

const json = <T,>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const deStrings = (v: unknown, key = ''): string[] =>
  typeof v === 'string' ? (key === 'de' ? [v] : []) : Array.isArray(v) ? v.flatMap((x) => deStrings(x, key)) : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => deStrings(x, k)) : [];

// --- Bestand laden ---
const C1X = join(process.cwd(), 'src/content/c1x/src');
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.json') ? [join(dir, e.name)] : []));
const c1x: C1Item[] = files(C1X)
  .sort()
  .flatMap((p) => {
    const r = c1File.safeParse(json(p));
    return r.success ? r.data.items : [];
  });
type PackRow = { id: string; cat: string; en: string; de: string; ex: string; register?: string; why?: string; col?: Array<{ en: string; ex?: string }> };
const pack = json<{ items: PackRow[] }>('src/content/c1/pack.json').items;
const tasks = allSeedTasks();
const taskId = (t: { topic: string; key: string }) => `${t.topic}|${t.key}`;
type FkTask = { id: string; sit?: unknown; intent?: unknown; hint?: unknown };
const fk = [...json<{ tasks: FkTask[] }>('src/content/fk/b1.json').tasks, ...json<{ tasks: FkTask[] }>('src/content/fk/b2.json').tasks];
type Obj = { id: string; model: Record<string, string> };
const objections = json<Obj[]>('src/content/nb/objections.json');
const nbTexts = json<Array<{ id: string; text: string }>>('src/content/nb/texts.json');

// --- Prüfungen: je Prüfung die Kennungen mit Befund ---
function findings(): Record<string, string[]> {
  const out: Record<string, Set<string>> = {};
  const add = (check: string, id: string) => (out[check] ??= new Set()).add(id);

  // 1. Grammatik-Aufgaben durch das Tor (lintTask + Eindeutigkeit + Einfehler + Denglisch)
  for (const t of tasks) for (const i of gateTask(t)) add(`grammar:${i}`, taskId(t));

  // 2. c1x-Fehlersätze: Einfehler-Regel (Satz gegen Satz mit erster Korrektur)
  for (const it of c1x) {
    if (it.kind === 'err' && it.bad) {
      const right = it.text.replace(it.bad.span, it.bad.fix[0] ?? '');
      for (const i of checkErrorSentence({ wrong: it.text, right, why: it.why.ok.de })) add(`c1x-err:${i}`, it.id);
    }
    for (const de of deStrings(it.why)) if (whyCut(de)) add('why-cut', it.id);
  }

  // 3. Absolute Regeln in deutschen Begründungen
  for (const it of c1x) if (deStrings(it.why).some((s) => absoluteClaims(s).length)) add('absolute', it.id);
  for (const t of tasks) if ([...deStrings(t.expl), ...deStrings(t.why), ...(t.expl.de ? [t.expl.de] : [])].some((s) => absoluteClaims(s).length)) add('absolute', taskId(t));
  for (const p of pack) if (p.why && absoluteClaims(p.why).length) add('absolute', p.id);

  // 4. Register: Langformen in gesprochenen Beispielsätzen (nicht formell), Denglisch überall im Englischen
  for (const p of pack) {
    if (p.register === 'formal') continue;
    const exs = [p.ex, ...(p.col ?? []).map((c) => c.ex ?? '')].filter(Boolean);
    if (exs.some((s) => longForms(s).length)) add('long-form', p.id);
  }
  const en: Array<[string, string]> = [
    ...pack.map((p): [string, string] => [p.id, [p.en, p.ex, ...(p.col ?? []).flatMap((c) => [c.en, c.ex ?? ''])].join(' ')]),
    ...c1x.map((it): [string, string] => [it.id, 'text' in it && typeof it.text === 'string' ? it.text : '']),
    ...objections.map((o): [string, string] => [o.id, Object.values(o.model).join(' ')]),
    ...nbTexts.map((x): [string, string] => [x.id, x.text]),
    ...tasks.map((t): [string, string] => [taskId(t), `${t.prompt} ${t.answer}`]),
  ];
  for (const [id, s] of en) if (denglisch(s).length) add('denglisch', id);

  // 5. Dubletten
  for (const g of duplicates(pack.map((p) => ({ id: p.id, text: p.en })))) for (const id of g) add('dup:pack-en', id);
  for (const g of duplicates(c1x.filter((it) => it.kind === 'err').map((it) => ({ id: it.id, text: it.text })))) for (const id of g) add('dup:c1x-err', id);
  for (const g of duplicates(tasks.map((t) => ({ id: taskId(t), text: `${t.topic} ${t.prompt}` })))) for (const id of g) add('dup:grammar', id);

  // 6. Wortart/Zahl DE↔EN
  for (const p of pack) if (deEnMismatch(p.de, p.en).length) add('de-en', p.id);

  // 7. du/Sie einheitlich
  for (const it of c1x) if (deStrings(it.why).some(duSieMix)) add('du-sie', it.id);
  for (const t of fk) if (deStrings({ sit: t.sit, intent: t.intent, hint: t.hint }).some(duSieMix)) add('du-sie', t.id);
  for (const t of tasks) if (deStrings({ expl: t.expl, why: t.why }).some(duSieMix)) add('du-sie', taskId(t));

  const res: Record<string, string[]> = {};
  for (const k of Object.keys(out).sort()) res[k] = [...(out[k] ?? [])].sort();
  return res;
}

describe('Qualitätstor: Bestand mit Ausnahmeliste (Zähler darf nur sinken)', () => {
  const now = findings();

  if (process.env.QUALITY_BASELINE === 'write') {
    const ex: Exceptions = {
      note: 'E1a: Altlasten je Prüfung (tests/unit/qualityContent.test.ts). Nur streichen, nie ergänzen. Neue Befunde werden im Inhalt behoben.',
      counts: Object.fromEntries(Object.entries(now).map(([k, v]) => [k, v.length])),
      ids: now,
    };
    writeFileSync(FIX, JSON.stringify(ex, null, 1) + '\n');
  }
  const base = json<Exceptions>(FIX);

  it('kein neuer Befund (jede Kennung steht in der Ausnahmeliste)', () => {
    for (const [check, ids] of Object.entries(now)) {
      const allowed = new Set(base.ids[check] ?? []);
      expect(ids.filter((id) => !allowed.has(id)), `neu in ${check}`).toEqual([]);
    }
  });

  it('behobene Altlasten sind aus der Liste gestrichen; Zähler = Länge der Liste', () => {
    for (const [check, ids] of Object.entries(base.ids)) {
      const cur = new Set(now[check] ?? []);
      expect(ids.filter((id) => !cur.has(id)), `behoben in ${check}: aus ${FIX} streichen`).toEqual([]);
      expect(base.counts[check], check).toBe(ids.length);
    }
  });
});
