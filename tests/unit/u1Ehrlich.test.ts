import { describe, expect, it } from 'vitest';
import { de } from '../../src/i18n/de';
import { en } from '../../src/i18n/en';
import { lp3De, lp3En } from '../../src/i18n/lp3';
import { translate, type MessageKey } from '../../src/i18n';
import { blockWhy } from '../../src/features/unit/labels';
import { weekdayShort } from '../../src/domain/date';

// UX-Audit U1 „Ehrlich“: Konsistenz-Regeln, die für ALLE Texte gelten, nicht nur für einen Datensatz.
// (Farben „Falsch ist nie grün“: tests/e2e/shellColors.spec.ts; dieselbe Zahl überall: metricsToday.test.ts und rueckstand.spec.ts;
// Bildlauf: router.test.ts und rahmen.spec.ts.)

const DE: Record<string, string> = { ...de, ...(lp3De as Record<string, string>) };
const EN: Record<string, string> = { ...en, ...(lp3En as Record<string, string>) };

/** Hauptwörter, die nach „1“ nie in der Mehrzahl stehen dürfen („1 Züge“, „1 Karten“). */
const PLURAL_DE = /\b1\s+(Karten|Wörter|Züge|Schritten|Schritte|Tage|Tagen|Fehlern|Minuten|Aufgaben|Sätze|Sätzen|Wendungen|Themen|Runden|Einwände)\b/;
const PLURAL_EN = /\b1\s+(cards|words|moves|steps|days|minutes|tasks|sentences|phrases|topics|rounds|objections)\b/i;

const t = (lang: 'de' | 'en') => (k: MessageKey, v?: Record<string, string | number>) => translate(lang, k, v);

describe('Mehrzahl', () => {
  it('jede _one-Form liest sich mit n = 1 in der Einzahl (beide Sprachen)', () => {
    for (const [dict, re] of [
      [DE, PLURAL_DE],
      [EN, PLURAL_EN],
    ] as const) {
      for (const [k, v] of Object.entries(dict)) {
        if (!k.endsWith('_one')) continue;
        const s = v.replace(/\{n\}/g, '1');
        expect(re.test(s), `${k}: ${s}`).toBe(false);
      }
    }
  });

  it('kein fester Text enthält „1 <Mehrzahl>“', () => {
    for (const [k, v] of Object.entries(DE)) expect(PLURAL_DE.test(v), `${k}: ${v}`).toBe(false);
    for (const [k, v] of Object.entries(EN)) expect(PLURAL_EN.test(v), `${k}: ${v}`).toBe(false);
  });

  it('Grund des Wiederhol-Schritts: 1 Karte in der Einzahl, Rückstand ohne „überfällig“', () => {
    const b = { block: 1, kind: 'review', opts: {} } as unknown as Parameters<typeof blockWhy>[0];
    expect(blockWhy(b, t('de'), 1)).toBe('1 Karte · Fällige zuerst');
    expect(blockWhy(b, t('de'), 1, true)).toBe('1 Karte · Rückstand wird abgebaut');
    expect(blockWhy(b, t('de'), 52, true)).toBe('52 Karten · Rückstand wird abgebaut');
    expect(blockWhy(b, t('en'), 1)).toBe('1 card · due first');
    for (const n of [1, 2, 40]) for (const behind of [false, true]) expect(blockWhy(b, t('de'), n, behind)).not.toMatch(/überfällig/);
  });
});

describe('Höchstens ein Zähler je Bildschirm', () => {
  it('die Wörter unter dem Übungsbalken und die Stufen-Zeile zählen nicht („von“/„of“)', () => {
    for (const k of ['nbHeuteNote', 'nvDuty', 'nbTrainingLevel'] as const) {
      expect(DE[k], k).not.toMatch(/\bvon\b/);
      expect(EN[k], k).not.toMatch(/\bof\b/);
    }
  });

  it('die Statuszeile der Heute-Karte nennt keine Minuten (die stehen nur im Ring)', () => {
    expect(DE.nbHeuteRing).not.toMatch(/\{min\}|Min\./);
    expect(EN.nbHeuteRing).not.toMatch(/\{min\}|min/);
  });
});

describe('Wochenstreifen', () => {
  it('eine Beschriftung für alle Streifen: zwei Buchstaben ohne Punkt (Mo … So / Mon … Sun)', () => {
    const week = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
    expect(week.map((d) => weekdayShort(d, 'de'))).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
    expect(week.map((d) => weekdayShort(d, 'en'))).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });
});
