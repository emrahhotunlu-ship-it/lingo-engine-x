import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACTIVE_COURSES, COURSES } from '../../../src/modules/read/domain/courses';
import { acceptLesson, LESSON_PHRASES, LESSON_QUESTIONS, LESSON_WORDS } from '../../../src/modules/read/domain/lesson';
import { seedLesson } from './fixtures';

// Anweisung für die Routine „Kurslektionen“ (docs/umbau/lesen-routine-kurse.md): Das Beispiel-JSON läuft gegen die echten Prüftore der App,
// der Katalog stimmt mit dem Code überein, und die Anweisung nennt die Regeln, die die App prüft. Ändert sich der Prüfer oder der Katalog,
// schlägt dieser Test an, bevor die Anweisung veraltet.

const DOC = new URL('../../../docs/umbau/lesen-routine-kurse.md', import.meta.url);
const md = readFileSync(DOC, 'utf8');

function between(start: string, end: string): string {
  const a = md.indexOf(start);
  const b = md.indexOf(end);
  expect(a, start).toBeGreaterThan(0);
  expect(b, end).toBeGreaterThan(a);
  return md.slice(a + start.length, b);
}
const instruction = (): string => between('<!-- ANWEISUNG-BEGINN -->', '<!-- ANWEISUNG-ENDE -->');

describe('Beispiel-JSON der Anweisung', () => {
  const block = /```json\n([\s\S]*?)\n```/.exec(between('<!-- BEISPIEL-JSON-BEGINN -->', '<!-- BEISPIEL-JSON-ENDE -->'));
  it('ist gültiges JSON und genau ein Dokument mit den Pflichtfeldern', () => {
    expect(block, 'JSON-Block').not.toBeNull();
    const doc = JSON.parse(block![1]!) as Record<string, unknown>;
    for (const k of ['v', 'by', 'course', 'n', 'title', 'lessonGoal', 'asOf', 'paras', 'phrases', 'check', 'tip', 'apply', 'sources']) expect(doc, k).toHaveProperty(k);
    expect(doc.by).toBe('routine');
  });

  it('besteht die echten Prüftore der App (acceptLesson) und ist dieselbe Lektion wie im Seed', () => {
    const doc = JSON.parse(block![1]!) as Record<string, unknown>;
    const res = acceptLesson(doc, { course: 'k1', n: 1 });
    expect(res.ok, res.ok ? '' : res.reason).toBe(true);
    expect(doc).toEqual(seedLesson(1));
  });

  it('die Grenzen der Anweisung entsprechen den Toren der App', () => {
    const t = instruction();
    expect(t).toContain('350 bis 450 Wörter');
    expect(t).toContain(`weniger als ${LESSON_WORDS[0]} und mehr als ${LESSON_WORDS[1]} Wörter`);
    expect(t).toContain(`${LESSON_PHRASES[0]} bis ${LESSON_PHRASES[1]}`);
    expect(t).toContain(`Genau ${LESSON_QUESTIONS}`);
    expect(t).toContain('mindestens 3');
  });
});

describe('Katalog in der Anweisung', () => {
  it('jede Lektion der aktiven Kurse steht mit englischem Titel, deutschem Titel und Inhalt in der Anweisung', () => {
    const t = instruction();
    for (const c of ACTIVE_COURSES) {
      expect(t, c.id).toContain(c.titleDe);
      expect(t, c.id).toContain(c.titleEn);
      for (const p of c.plan) {
        expect(t, `${c.id}-${p.n} ${p.titleEn}`).toContain(`${p.n}. **${p.titleEn}** (${p.titleDe})`);
        expect(t, `${c.id}-${p.n} Inhalt`).toContain(p.focus);
      }
    }
  });

  it('nur K1 und K5 sind aktiv und genannt; die anderen Kurse stehen nicht als Schreibauftrag drin', () => {
    const t = instruction();
    expect(t).toContain('`k1` (Claude Code in 10 Tagen, 10 Lektionen) und `k5` (KI im Unternehmen, 10 Lektionen)');
    for (const c of COURSES.filter((x) => !x.active)) expect(t, c.id).not.toContain(c.titleDe);
  });
});

describe('Regeln der Anweisung', () => {
  const t = (): string => instruction();

  it('Schreibweg: nur read/c-<Kurs>-<nn>, nie in App-Dokumente, nie löschen, nichts überschreiben', () => {
    expect(t()).toContain('`read/c-<Kurs>-<nn>`');
    expect(t()).toContain('Schreibe nie in `read/cp`');
    expect(t()).toContain('lösche nie ein Dokument');
    expect(t()).toContain('überschreibe es nie');
    expect(t()).toMatch(/höchstens 2 neue Lektionen je Kurs und Lauf/);
    expect(t()).toMatch(/mindestens zwei bereit/);
  });

  it('Aufbauen: Wendungsliste, keine Doppelungen, Wiederkehr früherer Wendungen', () => {
    expect(t()).toContain('Wendungsliste');
    expect(t()).toContain('keine Doppelungen');
    expect(t()).toContain('ein bis zwei Wendungen aus früheren Lektionen');
  });

  it('Claude Code nur nach Recherche in offizieller Doku, mit Quellen und Stand, ohne Bedienungsdetails ohne wörtliche Quelle', () => {
    expect(t()).toContain('nur nach Recherche in der offiziellen Anthropic-Dokumentation');
    expect(t()).toContain('WebFetch');
    expect(t()).toContain('Keine Bedienungsdetails ohne wörtliche Quelle');
    expect(t()).toContain('`sources`');
    expect(t()).toContain('`asOf`');
  });

  it('K5: EU AI Act, DSGVO und Zahlen nur mit Quelle, keine Rechtsberatung', () => {
    expect(t()).toMatch(/EU AI Act, Datenschutz\/DSGVO/);
    expect(t()).toContain('Keine Rechtsberatung');
    expect(t()).toContain('Keine Zahl aus dem Gedächtnis');
  });

  it('die Hauptsitzung bekommt Einrichtung, Ersttest, Stichprobe und Rückweg', () => {
    expect(md).toContain('## 4. Für die Hauptsitzung');
    expect(md).toContain('Stichprobe');
    expect(md).toContain('Rückweg');
  });
});
