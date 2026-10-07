// mcc (Passendes Wort), P20/P21: Wertung, Begründung je Option, Lösungsposition, deutscher Ablenker, Hinweis 2.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkC1Content } from '../../src/domain/c1x/checkContent';
import { defaultCheckCtx } from '../../src/domain/c1x/checkContext';
import { mccMuted } from '../../src/domain/c1x/kinds/mcc';
import { c1File } from '../../src/domain/c1x/schema';
import { scoreC1 } from '../../src/domain/c1x/score';
import type { C1Item, Mcc } from '../../src/domain/c1x/types';

const ROOT = join(process.cwd(), 'src/content/c1x/src/mcc');
const items: Mcc[] = [];
// Der K2-Bestand (P21) liegt in den Dateien k2-*; weitere Chargen (t01-* neue Themen) kommen dazu und müssen dieselben Qualitätsregeln erfüllen.
const k2: Mcc[] = [];
for (const f of readdirSync(ROOT).filter((n) => n.endsWith('.json'))) {
  const r = c1File.safeParse(JSON.parse(readFileSync(join(ROOT, f), 'utf8')));
  if (r.success) for (const it of r.data.items as C1Item[]) if (it.kind === 'mcc') (f.startsWith('k2-') ? k2 : items).push(it);
}
items.unshift(...k2);

describe('mcc: Bestand', () => {
  it('120 Aufgaben (K2): je 60 Grammatik und Wortschatz; Wortschatz mit lx.-Muster und lex[]', () => {
    expect(k2.length).toBe(120);
    expect(k2.filter((i) => i.area === 'gram').length).toBe(60);
    const lex = items.filter((i) => i.area === 'lex');
    expect(lex.length).toBe(60);
    for (const it of lex) {
      expect(it.pat.startsWith('lx.'), it.id).toBe(true);
      expect(it.lex?.length ?? 0, it.id).toBeGreaterThan(0);
    }
    for (const it of items.filter((i) => i.area === 'gram')) expect(it.topic, it.id).toBeTruthy();
  });

  it('Wertung: die Lösung ist 1 von 1 (nie frei), jede falsche Option 0', () => {
    for (const it of items) {
      const ok = scoreC1(it, { kind: 'mcc', pick: it.answer });
      expect(ok.got, it.id).toBe(1);
      expect(ok.free, it.id).toBe(false);
      for (const i of [0, 1, 2, 3].filter((x) => x !== it.answer)) expect(scoreC1(it, { kind: 'mcc', pick: i }).got, `${it.id}/${i}`).toBe(0);
    }
  });

  it('Lösungsposition über den Bestand nicht konstant: je Platz 20–30 %, und in jeder Zehnerfolge mindestens drei verschiedene Plätze', () => {
    for (let pos = 0; pos < 4; pos++) {
      const share = items.filter((i) => i.answer === pos).length / items.length;
      expect(share, `Platz ${pos}`).toBeGreaterThanOrEqual(0.2);
      expect(share, `Platz ${pos}`).toBeLessThanOrEqual(0.3);
    }
    for (let i = 0; i + 10 <= items.length; i += 10) expect(new Set(items.slice(i, i + 10).map((x) => x.answer)).size).toBeGreaterThanOrEqual(3);
  });

  it('jede falsche Option hat genau eine Begründung mit Kategorie', () => {
    const bad: string[] = [];
    for (const it of items) {
      const wrong = it.options.filter((_, i) => i !== it.answer);
      for (const w of wrong) {
        const rules = it.why.wrong.filter((r) => r.opt?.trim().toLowerCase() === w.trim().toLowerCase());
        if (rules.length !== 1) bad.push(`${it.id}: ${w} hat ${rules.length} Regeln`);
        else if (!rules[0]?.cat) bad.push(`${it.id}: ${w} ohne Kategorie`);
      }
      if (it.why.wrong.length !== 3) bad.push(`${it.id}: ${it.why.wrong.length} Regeln statt 3`);
    }
    expect(bad).toEqual([]);
  });

  it('ein calque-Ablenker (Deutsch gedacht) steht nur, wo ein Deutscher es wirklich sagt: bei mindestens 80 % der Aufgaben', () => {
    const withCalque = k2.filter((it) => it.why.wrong.some((r) => r.cat === 'calque')).length;
    expect(withCalque / k2.length).toBeGreaterThanOrEqual(0.8);
  });

  it('die Inhaltsprüfung findet keine Befunde; die Lösung steht nie im Satz', () => {
    const ctx = defaultCheckCtx();
    expect(items.flatMap((it) => checkC1Content(it, ctx).map((p) => `${it.id}: ${p}`))).toEqual([]);
  });

  it('Anteile: Beruf überwiegt, Wortschatz-Aufgaben nennen ihre Wendung', () => {
    expect(items.filter((i) => i.dom === 'biz').length / items.length).toBeGreaterThanOrEqual(0.6);
  });
});

describe('mcc: Hinweis 2 (eine falsche Option wird ausgegraut)', () => {
  it('die ausgegraute Option ist nie die Lösung und nie die gerade gewählte; stabil je Aufgabe', () => {
    for (const it of items) {
      const m = mccMuted(it);
      expect(m).not.toBe(it.answer);
      expect(mccMuted(it)).toBe(m);
      for (const avoid of [0, 1, 2, 3]) {
        const k = mccMuted(it, avoid);
        expect(k).not.toBe(it.answer);
        expect(k).not.toBe(avoid);
      }
    }
  });
});

describe('mcc: Wortschatz-Aufgaben erzeugen nie ein Grammatik-Dokument', () => {
  it('der Schreibweg überspringt jede area-lex-Aufgabe (auch mit vorhandenem Dokument)', async () => {
    const { grammarWrite } = await import('../../src/domain/grammar/write');
    const { toTask } = await import('../../src/domain/c1x/runtime');
    const lex = items.find((i) => i.area === 'lex') as Mcc;
    const a = { kind: 'g', t: 1, day: '2026-09-20', task: toTask(lex), dontKnow: false, help: { level: 0 }, grade: 3, verdict: 'wrong', given: 'x', ms: 1000, lang: 'de', ctx: 'duty', judged: 'local' } as never;
    expect(grammarWrite(undefined, a).kind).toBe('skip');
    expect(grammarWrite({ id: 'lex', p: 0.5 }, a).kind).toBe('skip');
  });
});
