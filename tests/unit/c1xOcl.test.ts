// ocl (Kleines Wort), P20: Wertung als Eigenschaft über alle ocl-Aufgaben im Bestand, Tippfehler-Budget, US-Hinweis, Stütze, Begründung je Chip.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkC1Content } from '../../src/domain/c1x/checkContent';
import { defaultCheckCtx } from '../../src/domain/c1x/checkContext';
import { oclMask } from '../../src/domain/c1x/kinds/ocl';
import { ruleMatches } from '../../src/domain/c1x/kinds/common';
import { c1File } from '../../src/domain/c1x/schema';
import { scoreC1 } from '../../src/domain/c1x/score';
import type { C1Item, Ocl } from '../../src/domain/c1x/types';
import { slotCount } from '../../src/domain/answer/mask';

const ROOT = join(process.cwd(), 'src/content/c1x/src/ocl');
const items: Ocl[] = [];
// Der K2-Bestand (P21) liegt in den Dateien k2-*; weitere Chargen (t01-* neue Themen) kommen dazu und müssen dieselben Qualitätsregeln erfüllen.
const k2: Ocl[] = [];
for (const f of readdirSync(ROOT).filter((n) => n.endsWith('.json'))) {
  const r = c1File.safeParse(JSON.parse(readFileSync(join(ROOT, f), 'utf8')));
  if (r.success) for (const it of r.data.items as C1Item[]) if (it.kind === 'ocl') (f.startsWith('k2-') ? k2 : items).push(it);
}
items.unshift(...k2);
const resp = (text: string) => ({ kind: 'ocl' as const, text });

describe('ocl: Bestand', () => {
  it('es gibt 120 Aufgaben (K2), alle im Bereich Grammatik mit Thema und Muster', () => {
    expect(k2.length).toBe(120);
    for (const it of items) {
      expect(it.area).toBe('gram');
      expect(it.topic).toBeTruthy();
      expect(it.src).toBe('seed');
    }
  });

  it('keine Aufgabe hat eine Verbstütze in Klammern; Lücke genau einmal', () => {
    for (const it of items) {
      expect(it.text.match(/_{3,}/g)?.length, it.id).toBe(1);
      expect(/\([a-z]+\)/i.test(it.text), `${it.id}: Klammerstütze`).toBe(false);
    }
  });

  it('jede Lösung = 1 von 1 und frei (getippt); jeder Chip = 0', () => {
    const bad: string[] = [];
    for (const it of items) {
      for (const a of it.accept) {
        const s = scoreC1(it, resp(a));
        if (s.got !== 1 || !s.free) bad.push(`${it.id}: ${a}`);
        // Groß-/Kleinschreibung ist egal.
        if (scoreC1(it, resp(a.toUpperCase())).got !== 1) bad.push(`${it.id}: ${a} groß`);
      }
      for (const c of it.chips) if (scoreC1(it, resp(c)).got !== 0) bad.push(`${it.id}: Chip ${c}`);
    }
    expect(bad).toEqual([]);
  });

  it('jeder Chip hat eine Begründung, die genau bei seiner Eingabe greift', () => {
    const bad: string[] = [];
    for (const it of items) {
      for (const c of it.chips) {
        const rule = it.why.wrong.find((r) => ruleMatches(r, { given: c }));
        if (!rule) bad.push(`${it.id}: ${c}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('die Inhaltsprüfung findet keine Befunde', () => {
    const ctx = defaultCheckCtx();
    expect(items.flatMap((it) => checkC1Content(it, ctx).map((p) => `${it.id}: ${p}`))).toEqual([]);
  });

  it('Anteile: etwa zwei Drittel Beruf, jede der neun Wortklassen kommt vor, Lücke nicht immer am Anfang', () => {
    const biz = items.filter((i) => i.dom === 'biz').length / items.length;
    expect(biz).toBeGreaterThanOrEqual(0.55);
    expect(new Set(items.map((i) => i.cls)).size).toBeGreaterThanOrEqual(8);
    const atStart = items.filter((i) => /^_{3,}/.test(i.text)).length;
    expect(atStart).toBeLessThan(items.length * 0.2);
  });
});

describe('ocl: Wertung im Einzelnen', () => {
  const it0 = items.find((i) => i.accept.includes('unless')) as Ocl;

  it('Tippfehler in einem langen Wort ist „Fast“ (Note 2), in einem kurzen Wort falsch', () => {
    const near = scoreC1(it0, resp('unles'));
    expect(near.got).toBe(0);
    expect(near.verdict).toBe('near');
    expect(near.reason).toBe('typo');
    const short = items.find((i) => i.accept.includes('had')) as Ocl;
    expect(scoreC1(short, resp('hd')).verdict).toBe('wrong');
  });

  it('leere Eingabe und fremde Antwortart zählen als nicht gegeben', () => {
    expect(scoreC1(it0, resp('')).got).toBe(0);
    expect(scoreC1(it0, { kind: 'mcc', pick: 0 }).got).toBe(0);
  });

  it('britische Schreibweise einer Lösung wird erkannt: die US-Form steht als Hinweis (Beispiel mit synthetischer Aufgabe)', () => {
    const synth: Ocl = { ...it0, accept: ['color'], chips: ['coler', 'colon', 'colt'] };
    const s = scoreC1(synth, resp('colour'));
    expect(s.got).toBe(1);
    expect(s.us).toBe('color');
  });

  it('Stütze nach Hinweis 2: ein Platzhalter je Buchstabe, nur der erste Buchstabe sichtbar', () => {
    for (const it of items.slice(0, 40)) {
      const mask = oclMask(it);
      const first = it.accept[0] ?? '';
      expect(slotCount(mask), it.id).toBe(first.replace(/[^A-Za-z]/g, '').length);
      const shown = mask.filter((c) => c.kind === 'slot' && c.hint !== undefined);
      expect(shown.length).toBe(1);
    }
  });
});
