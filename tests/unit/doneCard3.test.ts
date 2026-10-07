import { describe, expect, it } from 'vitest';
import { de } from '../../src/i18n/de';
import { en } from '../../src/i18n/en';
import { weekGoal, nextGoal } from '../../src/domain/metrics';
import { weekStrip, type WeekDay } from '../../src/domain/streak';
import { footParts, footText, goalLine, weekText } from '../../src/features/today/goalLine';
import type { MessageKey } from '../../src/i18n';

// Abschlusskarte Heute 3.0 (Lernplattform 3.0 P27, Motivation §4.1, §4.4, §4.5, §4.10): Zeilen und Zahlen kommen aus den Selektoren, nie „Serie 0“.

const tOf = (dict: Record<string, string>) => (k: MessageKey, v?: Record<string, string | number>): string => {
  let s = dict[k] ?? `?${k}`;
  for (const [n, x] of Object.entries(v ?? {})) s = s.replaceAll(`{${n}}`, String(x));
  return s;
};
const tde = tOf(de);
const ten = tOf(en);

const FORBIDDEN_DE = /serie 0|verlor|gerissen|verfehlt|nicht erledigt|!/i;
const FORBIDDEN_EN = /streak 0|lost|broken|missed|not done|!/i;

/** Eine Woche Mo–So mit Zuständen (`d` = erledigt, `r` = Ruhetag, `o` = offen/vergangen, `f` = kommt noch, `t` = heute offen). */
function week(pattern: string): WeekDay[] {
  const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];
  return [...pattern].map((c, k) => ({
    day: days[k] as string,
    today: c === 't',
    state: c === 'd' ? 'done' : c === 'r' ? 'rest' : c === 'f' ? 'future' : 'open',
  }));
}

describe('weekText', () => {
  it('ohne Pflichttag in der Woche keine Zeile (nie „Woche 0 von 6“)', () => {
    expect(weekText(weekGoal(week('tffffff')))).toBeNull();
  });
  it('Woche 4 von 6, Woche geschafft, Woche geschafft mit 7 Tagen', () => {
    expect(weekText(weekGoal(week('ddddtff')))).toEqual({ key: 'moWeekProgress', params: { n: 4 } });
    expect(weekText(weekGoal(week('dddddd' + 't')))).toEqual({ key: 'moWeekReached', params: {} });
    expect(weekText(weekGoal(week('ddddddd')))).toEqual({ key: 'moWeekReached7', params: {} });
  });
  it('6 nicht mehr erreichbar: Zahl der Lerntage und „Montag beginnt neu“', () => {
    const w = weekText(weekGoal(week('dooodoo')));
    expect(w).toEqual({ key: 'moWeekOver', params: { n: 2 } });
    expect(tde(w!.key, w!.params)).toBe('Diese Woche: 2 Lerntage · Montag beginnt neu');
  });
});

describe('Kartenfuß', () => {
  it('„Serie 12 · Woche 4 von 6“ (Deutsch und Englisch)', () => {
    const p = footParts({ streak: 12, goal: weekGoal(week('ddddtff')) })!;
    expect(footText(p, tde)).toBe('Serie 12 · Woche 4 von 6');
    expect(footText(p, ten)).toBe('Streak 12 · Week 4 of 6');
  });
  it('ohne Serie nur die Woche, ohne Woche nur die Serie, ohne beides keine Zeile', () => {
    expect(footText(footParts({ streak: 0, goal: weekGoal(week('ddtffff')) })!, tde)).toBe('Woche 2 von 6');
    expect(footText(footParts({ streak: null, goal: weekGoal(week('ddtffff')) })!, tde)).toBe('Woche 2 von 6');
    expect(footText(footParts({ streak: 12, goal: weekGoal(week('tffffff')) })!, tde)).toBe('Serie 12');
    expect(footParts({ streak: 0, goal: weekGoal(week('tffffff')) })).toBeNull();
  });
  it('alle 128 Wochenmuster: kein „Serie 0“, kein Verlust-Wort, kein Ausrufezeichen, keine Zahl 0', () => {
    for (let m = 0; m < 128; m++) {
      const bits = [...m.toString(2).padStart(7, '0')];
      // Vergangene Tage `d`/`o`, heute `t`, Zukunft `f`: heute ist der 4. Tag.
      const pattern = bits.map((b, k) => (k < 3 ? (b === '1' ? 'd' : 'o') : k === 3 ? 't' : 'f')).join('');
      for (const streak of [0, 1, 12]) {
        const p = footParts({ streak, goal: weekGoal(week(pattern)) });
        if (!p) continue;
        const d = footText(p, tde);
        const e = footText(p, ten);
        expect(d, pattern).not.toMatch(FORBIDDEN_DE);
        expect(e, pattern).not.toMatch(FORBIDDEN_EN);
        expect(d, pattern).not.toMatch(/(^|\D)0(\D|$)/);
      }
    }
  });
  it('die Zahl der Wochentage kommt aus der Serienrechnung: weekStrip und weekGoal stimmen überein', () => {
    const strip = weekStrip({ days: {}, xpDays: {}, pflichtSince: '2026-09-01', pflichtDone: new Set(['2026-10-05', '2026-10-06']), today: '2026-10-08', legacyToday: '2026-10-08' });
    expect(weekGoal(strip).done).toBe(strip.filter((d) => d.state === 'done').length);
  });
});

describe('goalLine: ein Ziel, eingefroren, Zahlen live', () => {
  const base = { vocabFest: 190, history: [], today: '2026-10-07' };
  it('Fest-Marke: „noch n“ aus dem Stand jetzt', () => {
    expect(goalLine({ ...base, nx: 'fest250', festUnits: 190 })).toEqual({ key: 'moGoalFest', params: { need: 250, left: 60 } });
    expect(tde('moGoalFest', { need: 250, left: 60 })).toBe('Nächstes Ziel: 250 Wörter und Wendungen fest · noch 60');
  });
  it('mit Verlauf ab 21 Tagen steht ein Zeitraum, sonst nie', () => {
    const history = Array.from({ length: 30 }, (_, i) => ({ d: new Date(Date.UTC(2026, 8, 7 + i)).toISOString().slice(0, 10), vu: 100 + i * 3 }));
    const live = nextGoal({ festUnits: 190, vocabFest: 190, history, today: '2026-10-06' });
    expect(live?.id).toBe('fest250');
    if (live?.weeks) expect(goalLine({ ...base, history, today: '2026-10-06', nx: 'fest250', festUnits: 190 })?.key).toBe('moGoalFestWeeks');
    expect(goalLine({ ...base, nx: 'fest250', festUnits: 190 })?.key).toBe('moGoalFest');
  });
  it('das Ziel gilt bis zum Schluss des Tages: eine Marke, die heute erreicht wurde, erscheint nicht mehr als Ziel', () => {
    expect(goalLine({ ...base, nx: 'fest250', festUnits: 250 })).toBeNull();
    expect(goalLine({ ...base, nx: 'fest250', festUnits: 251 })).toBeNull();
  });
  it('ohne Kennung (Plan von früher) oder Ziel ohne Zahlen im Gerät keine Zeile; der nächste Check steht ohne Zahl', () => {
    expect(goalLine({ ...base, nx: undefined, festUnits: 190 })).toBeNull();
    expect(goalLine({ ...base, nx: 'ch3', festUnits: 190 })).toBeNull();
    expect(goalLine({ ...base, nx: 'quatsch', festUnits: 190 })).toBeNull();
    expect(goalLine({ ...base, nx: 'c1check', festUnits: 190 })).toEqual({ key: 'moGoalCheck', params: {} });
  });
  it('die Zeile enthält nie Verlust-Wörter', () => {
    for (const r of [goalLine({ ...base, nx: 'fest250', festUnits: 190 }), goalLine({ ...base, nx: 'c1check', festUnits: 190 })]) {
      expect(tde(r!.key, r!.params)).not.toMatch(FORBIDDEN_DE);
      expect(ten(r!.key, r!.params)).not.toMatch(FORBIDDEN_EN);
    }
  });
});
