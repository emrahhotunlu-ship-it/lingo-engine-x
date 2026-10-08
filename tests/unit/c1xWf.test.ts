// wf (Wort umbauen), P38/P39: Wertung als Eigenschaft über alle wf-Aufgaben im Bestand, Familien-Grund, Tippfehler, US-Hinweis, Zerlegung, Stütze, Begründung je Familienmitglied.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkC1Content } from '../../src/domain/c1x/checkContent';
import { defaultCheckCtx } from '../../src/domain/c1x/checkContext';
import { morphPieces, wfMask } from '../../src/domain/c1x/kinds/wf';
import { ruleMatches } from '../../src/domain/c1x/kinds/common';
import { c1File } from '../../src/domain/c1x/schema';
import { scoreC1 } from '../../src/domain/c1x/score';
import type { C1Item, Wf } from '../../src/domain/c1x/types';
import { kindRound } from '../../src/domain/grammar/kindRound';
import { registerC1Items, resetC1Store } from '../../src/domain/c1x/preload';
import { toUS } from '../../src/domain/answer/spelling';
import { slotCount } from '../../src/domain/answer/mask';

const ROOT = join(process.cwd(), 'src/content/c1x/src/wf');
const items: Wf[] = [];
for (const f of readdirSync(ROOT).filter((n) => n.endsWith('.json'))) {
  const r = c1File.safeParse(JSON.parse(readFileSync(join(ROOT, f), 'utf8')));
  expect(r.success, f).toBe(true);
  if (r.success) for (const it of r.data.items as C1Item[]) if (it.kind === 'wf') items.push(it);
}
const resp = (text: string) => ({ kind: 'wf' as const, text });

describe('wf: Bestand', () => {
  it('es gibt mindestens 100 Aufgaben, alle im Bereich Wortschatz mit lx.-Muster und lex[]', () => {
    expect(items.length).toBeGreaterThanOrEqual(100);
    for (const it of items) {
      expect(it.area).toBe('lex');
      expect(it.pat.startsWith('lx.wf-'), it.id).toBe(true);
      expect(it.lex?.length, it.id).toBeGreaterThan(0);
      expect(it.src).toBe('seed');
      expect(it.stem, it.id).toMatch(/^[A-Z-]+$/);
      expect(it.text.match(/_{3,}/g)?.length, it.id).toBe(1);
    }
  });

  it('jede Lösungsvariante = 1 von 1, frei (getippt), auch in Großbuchstaben', () => {
    const bad: string[] = [];
    for (const it of items) {
      for (const a of it.accept) {
        const s = scoreC1(it, resp(a));
        if (s.got !== 1 || !s.free) bad.push(`${it.id}: ${a}`);
        if (scoreC1(it, resp(a.toUpperCase())).got !== 1) bad.push(`${it.id}: ${a} groß`);
        if (scoreC1(it, resp(`  ${a} `)).got !== 1) bad.push(`${it.id}: ${a} mit Leerzeichen`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('jedes andere Familienmitglied = 0 mit Grund „family“; der Stamm selbst und Unsinn sind falsch', () => {
    const bad: string[] = [];
    for (const it of items) {
      for (const f of it.family.filter((w) => !it.accept.includes(w))) {
        const s = scoreC1(it, resp(f));
        if (s.got !== 0 || s.reason !== 'family') bad.push(`${it.id}: ${f} -> ${s.got} ${s.reason}`);
      }
      if (scoreC1(it, resp(it.stem.toLowerCase())).got !== 0) bad.push(`${it.id}: Stamm`);
      if (scoreC1(it, resp('xyzzy')).verdict !== 'wrong') bad.push(`${it.id}: Unsinn`);
    }
    expect(bad).toEqual([]);
  });

  it('jedes Familienmitglied hat eine Begründung, die genau bei seiner Eingabe greift', () => {
    const bad: string[] = [];
    for (const it of items) {
      for (const f of it.family.filter((w) => !it.accept.includes(w))) {
        if (!it.why.wrong.some((r) => ruleMatches(r, { given: f }))) bad.push(`${it.id}: ${f}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('die Inhaltsprüfung findet keine Befunde', () => {
    const ctx = defaultCheckCtx();
    expect(items.flatMap((it) => checkC1Content(it, ctx).map((p) => `${it.id}: ${p}`))).toEqual([]);
  });

  it('Zerlegung: die Teile ergeben immer das Wort; der Kern liegt in der Mitte', () => {
    for (const it of items) {
      const p = morphPieces(it);
      expect(p.map((x) => x.text).join(''), it.id).toBe(it.accept[0]);
      expect(p.filter((x) => x.role === 'core').length, it.id).toBe(1);
      if (it.parts.pre) expect(p[0]?.role, it.id).toBe('pre');
    }
  });

  it('Anteile: etwa ⅔ Beruf, alle vier Wortarten, mehrere Muster, ein Satz kommt nur einmal vor', () => {
    const biz = items.filter((i) => i.dom === 'biz').length / items.length;
    expect(biz).toBeGreaterThanOrEqual(0.55);
    expect(biz).toBeLessThanOrEqual(0.8);
    expect(new Set(items.map((i) => i.pos)).size).toBe(4);
    expect(new Set(items.map((i) => i.pat)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(items.map((i) => i.text.toLowerCase())).size).toBe(items.length);
    // Jede Wortart ist vertreten; Adverbien fallen am schwersten (Schmitt & Zimmerman 2002), Verben am leichtesten (weniger Aufgaben).
    for (const pos of ['noun', 'adj', 'adv', 'verb'] as const) expect(items.filter((i) => i.pos === pos).length).toBeGreaterThanOrEqual(pos === 'verb' ? 5 : 10);
  });
});

describe('wf: Wertung im Einzelnen', () => {
  const find = (word: string): Wf => {
    const it = items.find((i) => i.accept.includes(word));
    if (!it) throw new Error(`keine Aufgabe für ${word}`);
    return it;
  };

  it('amerikanische Schreibung ist Standard, britische gilt als richtig mit US-Hinweis', () => {
    const it = find('organization');
    const s = scoreC1(it, resp('organisation'));
    expect(s.got).toBe(1);
    expect(s.us).toBe('organization');
    expect(scoreC1(it, resp('organization')).us).toBeUndefined();
    const e = find('emphasize');
    expect(scoreC1(e, resp('emphasise')).got).toBe(1);
  });

  it('Tippfehler im Stamm ist „Fast“, ein falsches Affix ist falsch', () => {
    const it = find('unpredictable');
    expect(scoreC1(it, resp('unpredictible')).verdict).toBe('near');
    expect(scoreC1(it, resp('inpredictable')).verdict).toBe('wrong');
    const u = find('unauthorized');
    expect(scoreC1(u, resp('inauthorized')).verdict).toBe('wrong');
    expect(scoreC1(u, resp('unauthorised')).got).toBe(1);
  });

  it('falsche Wortart derselben Familie: Grund „family“, Verdict wrong', () => {
    const it = find('securely');
    const s = scoreC1(it, resp('secure'));
    expect(s.verdict).toBe('wrong');
    expect(s.reason).toBe('family');
  });

  it('Stütze nach Hinweis 2: ein Platzhalter je Buchstabe, nur der erste Buchstabe sichtbar', () => {
    const it = find('compliance');
    const m = wfMask(it);
    expect(slotCount(m)).toBe('compliance'.length);
    expect(m.filter((c) => c.kind === 'slot' && c.hint).map((c) => (c.kind === 'slot' ? c.hint : ''))).toEqual(['c']);
  });

  it('Zerlegung bei Vorsilbe, Stammänderung und mehreren Nachsilben', () => {
    const texts = (w: string): string[] => morphPieces(find(w)).map((p) => p.text);
    expect(texts('unauthorized')).toEqual(['un', 'authorize', 'd']);
    expect(texts('surprisingly')).toEqual(['surpris', 'ing', 'ly']);
    expect(texts('flexibility')).toEqual(['flexibil', 'ity']);
  });
});

describe('wf: Runde und Lehrer-Befunde', () => {
  it('nie derselbe Stamm direkt hintereinander, auch bei vielen Startwerten', () => {
    resetC1Store();
    registerC1Items(items);
    for (let i = 0; i < 60; i++) {
      const round = kindRound({ kind: 'wf', size: 12, grammarDocs: new Map(), seed: `s${i}` });
      expect(round.length).toBe(12);
      const stems = round.map((t) => (t.c1 as Wf).stem);
      for (let k = 1; k < stems.length; k++) expect(stems[k], `Startwert s${i}`).not.toBe(stems[k - 1]);
    }
  });

  it('Gesehenes kommt erst nach Neuem', () => {
    resetC1Store();
    registerC1Items(items);
    const done = new Set(items.slice(0, 90).map((i) => i.id));
    const round = kindRound({ kind: 'wf', size: 10, grammarDocs: new Map(), seed: 'x', lexDone: done });
    expect(round.filter((t) => !done.has((t.c1 as Wf).id)).length).toBe(10);
  });

  it('britische Formen gelten als richtig (US-Hinweis)', () => {
    for (const [us, gb] of [
      ['unauthorized', 'unauthorised'],
      ['emphasize', 'emphasise'],
      ['organization', 'organisation'],
      ['prioritize', 'prioritise'],
      ['summarize', 'summarise'],
    ] as const) {
      const it = items.find((i) => i.accept[0] === us);
      expect(it, us).toBeTruthy();
      const s = scoreC1(it as Wf, resp(gb));
      expect(s.got, gb).toBe(1);
      expect(s.us, gb).toBe(us);
    }
  });

  it('Partizipien werden in der Begründung als Partizip benannt, nicht als Adjektiv', () => {
    const list: Array<[string, string]> = [
      ['implemented', 'implement'],
      ['grown', 'grow'],
      ['growing', 'grow'],
      ['expected', 'expect'],
      ['renewed', 'renew'],
      ['required', 'require'],
      ['approved', 'approve'],
      ['reported', 'report'],
      ['supposed', 'suppose'],
      ['confirmed', 'confirm'],
      ['recommended', 'recommend'],
      ['obliged', 'oblige'],
      ['intended', 'intend'],
      ['preferred', 'prefer'],
      ['related', 'relate'],
      ['organized', 'organize'],
      ['satisfied', 'satisfy'],
      ['surprised', 'surprise'],
      ['admitted', 'admit'],
      ['summarized', 'summarize'],
    ];
    const bad: string[] = [];
    for (const [w, y] of list) {
      const rules = items.flatMap((it) => it.why.wrong.filter((r) => r.if?.[0] === w).map((r) => ({ it, r })));
      if (!rules.length) bad.push(`${w}: keine Regel`);
      for (const { it, r } of rules) if (!r.de.includes('Partizip') || !r.en.includes('participle') || (w !== 'summarized' && !r.de.includes(`„${y}“`)) || /ist ein Adjektiv/.test(r.de)) bad.push(`${it.id} ${w}: ${r.de}`);
    }
    expect(bad).toEqual([]);
  });

  it('britische Form zählt voll (Urteil richtig, Note unberührt, nur ein Hinweis); toUS arbeitet mit Ausnahmeliste, nicht pauschal -ise → -ize', () => {
    const it = items.find((i) => i.accept[0] === 'prioritize') as Wf;
    const s = scoreC1(it, resp('prioritise'));
    expect(s).toMatchObject({ got: 1, max: 1, verdict: 'correct', free: true, us: 'prioritize' });
    expect(s.reason).toBeUndefined();
    for (const w of ['advise', 'advised', 'advising', 'surprise', 'surprised', 'surprisingly', 'compromise', 'compromised', 'advertise', 'advertising', 'promise', 'exercise', 'precise', 'revise']) expect(toUS(w), w).toBe(w);
    expect(toUS('organisation')).toBe('organization');
    expect(toUS('emphasise')).toBe('emphasize');
  });
});
