import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_DOC_PATHS, COLLECTION_NAMES } from '../../src/data/paths';
import { de } from '../../src/i18n/de';
import { en } from '../../src/i18n/en';

// Entfernungs-Audit (Umbau „Fokus Wörter und Grammatik“, Gesamtkonzept Kap. 6): Die entfallenen
// Bereiche sind weg und kommen nicht zurück. Daten bleiben (`src/data/**` ist ausgenommen).

const ROOT = join(__dirname, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const FILES = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'tests'))].filter((f) => !f.includes('/src/data/') && !f.endsWith('removalAudit.test.ts') && !f.endsWith('/src/domain/plan/retire.ts'));
const read = (f: string): string => readFileSync(f, 'utf-8');

// Ordner, die es nicht mehr geben darf (features/ und domain/).
const GONE = ['input', 'read', 'listen', 'discover', 'write', 'business', 'pron', 'inbox', 'fluency', 'meeting', 'tones', 'say', 'compare'];

describe('Entfernungs-Audit', () => {
  it('keine Ordner der entfallenen Bereiche', () => {
    const found: string[] = [];
    for (const layer of ['features', 'domain']) for (const g of GONE) if (existsDir(join(ROOT, 'src', layer, g))) found.push(`${layer}/${g}`);
    expect(found).toEqual([]);
  });

  it('keine Importe aus gelöschten Ordnern', () => {
    const re = new RegExp(`from '[^']*/(features|domain)/(${GONE.join('|')})(/[^']*)?'`);
    const hits = FILES.filter((f) => re.test(read(f))).map((f) => f.replace(ROOT, ''));
    expect(hits).toEqual([]);
  });

  it('keine Routen der entfallenen Bildschirme', () => {
    const re = /name: '(library|discover|history|read|listen|write|mail|pitch|say|fluency|tones|meeting|playbook|sptask|inbox|pron|compare|listenDialog|inputUnit|discoverItem|week)'/;
    const hits = FILES.filter((f) => f.includes('/src/') && re.test(read(f))).map((f) => f.replace(ROOT, ''));
    expect(hits).toEqual([]);
  });

  // Wochenthema und Handy-Modus (W2 Teil 2): keine Oberfläche, kein Abo, kein Schalter mehr.
  it('keine Oberfläche zum Wochenthema und zum Handy-Modus', () => {
    const found = ['src/features/week', 'src/features/settings/PhoneModeSection.tsx', 'src/app/useWeek.ts', 'src/platform/device.ts'].filter((p) => existsPath(join(ROOT, p)));
    expect(found).toEqual([]);
    const hits = FILES.filter((f) => f.includes('/src/') && /\bphoneMode\b|setPhoneModeLocal|useWeekState|chooseTheme|startWeekWatch/.test(read(f))).map((f) => f.replace(ROOT, ''));
    expect(hits).toEqual([]);
  });

  // Lernplattform 2.0 (docs/umbau/lernplattform-2.md §4.1/§10.0): Das Eingabeprofil wählt nur die Form einer Aufgabe und ist nie
  // planwirksam. Domäne und Tagesplan-Speicher dürfen es deshalb nicht importieren (`src/platform/device.ts` bleibt verboten, s. o.).
  it('src/domain/** und src/features/today/store.ts importieren nichts aus src/platform/input', () => {
    const re = /from '[^']*\/platform\/input(\.[tj]sx?)?'|import\('[^']*\/platform\/input(\.[tj]sx?)?'\)/;
    const hits = FILES.filter((f) => (f.includes('/src/domain/') || f.endsWith('/src/features/today/store.ts')) && re.test(read(f))).map((f) => f.replace(ROOT, ''));
    expect(hits).toEqual([]);
  });

  // Tote Reste des Wochenthemas (Auftrag 2b): Planmaschine liegt in domain/unit, theme/targets/cards/hint/weekWrite sind gelöscht.
  it('keine Wochenthema-Reste: Dateien weg, keine Importe, Plan schreibt kein Thema', () => {
    const gone = ['src/domain/week/theme.ts', 'src/domain/week/targets.ts', 'src/domain/week/cards.ts', 'src/domain/week/hint.ts', 'src/domain/week/index.ts', 'src/domain/week/plan.ts', 'src/domain/week/types.ts', 'src/domain/unit/weekWrite.ts'];
    expect(gone.filter((p) => existsPath(join(ROOT, p)))).toEqual([]);
    const re = /from '[^']*\/week(\/(theme|targets|cards|hint|plan|types|index|weekWrite))?'|domain\/unit\/weekWrite/;
    const hits = FILES.filter((f) => re.test(read(f))).map((f) => f.replace(ROOT, ''));
    expect(hits).toEqual([]);
    expect(read(join(ROOT, 'src/domain/unit/types.ts'))).not.toMatch(/confirmTheme|themeBy/);
  });

  // (a) Daten bleiben vollständig (Gesamtkonzept „Daten bleiben“, Kap. 9 des Auftrags): das Register der Pfade ist Stand `pre-fokus`.
  it('Datenregister unverändert: alle Sammlungen und App-Dokumente sind noch eingetragen', () => {
    expect([...COLLECTION_NAMES].sort()).toEqual(
      ['archive', 'articles', 'biz', 'chunk', 'daily', 'feed', 'fluency', 'grammar', 'lesson', 'log', 'lpool', 'meeting', 'out', 'preply', 'reading', 'say', 'scene', 'talk', 'teacher', 'tones', 'vocab', 'writing', 'wprompt'].sort(),
    );
    expect([...APP_DOC_PATHS].sort()).toEqual(
      ['app/assess', 'app/c1', 'app/chat', 'app/compare', 'app/course', 'app/decks', 'app/levels', 'app/lookup', 'app/memory', 'app/patterns', 'app/pool', 'app/profile', 'app/radar', 'app/repair', 'app/schema', 'app/week', 'app/weekly'].sort(),
    );
  });

  // Kurs-Bereich (W5, Gesamtkonzept: „Kurs entfällt als eigener Bereich“): keine Bildschirme, Routen oder Texte mehr.
  // Übrig bleiben nur der Katalog und die Lesefunktionen für gespeicherte Pläne (`plan.lesson`) und Prompt-Vorlagen.
  it('Kurs-Bereich entfernt; Datenpfade `app/course` und `lesson/*` bleiben im Register', () => {
    expect(existsPath(join(ROOT, 'src/features/course'))).toBe(false);
    expect(readdirSync(join(ROOT, 'src/domain/course')).sort()).toEqual(['baseLesson.ts', 'catalog.ts', 'courseDone.ts', 'production.ts']);
    const routes = FILES.filter((f) => f.includes('/src/') && /name: '(course|lesson)'/.test(read(f))).map((f) => f.replace(ROOT, ''));
    expect(routes).toEqual([]);
    const imports = FILES.filter((f) => /from '[^']*features\/course(\/[^']*)?'/.test(read(f))).map((f) => f.replace(ROOT, ''));
    expect(imports).toEqual([]);
    expect([...COLLECTION_NAMES]).toContain('lesson');
    expect([...APP_DOC_PATHS]).toContain('app/course');
    const keys = [...Object.keys(de), ...Object.keys(en)].filter((k) => /^(cs|ls|ce)[A-Z]/.test(k) || /^(lhOpenLesson|lhAllLessons|lhCourse|courseComplete)$/.test(k));
    expect([...new Set(keys)]).toEqual([]);
  });

  // (b) Keine Textschlüssel der gelöschten Bereiche (Präfixe der 2026-10-04 entfernten Texte).
  it('keine i18n-Schlüssel der gelöschten Bereiche', () => {
    const gone = /^(nbLesen|wrScore|rdOwn|rdSummary|mtDebrief|mtTake|mtRehearsal|mtOwn|ppHeld|ppCtx|ppTab|inAi|inOffer|inSaved|inSave|inHistory|mailInt|mailSt|mailRcp|pitchAud|piTarget|piTo|piApplied|fluCol|fluTask|tnReg|tnVerdict|tnRepairs|sayRepairs|pbAdapt|dcStep|lsShadow|tdBiz|nbHeuteWeek|nbHeuteConfirm|nbHeuteInput|nbHeuteTheme|nbHeutePhone|feedAct_|heat[A-Z])/;
    const hits = [...Object.keys(de), ...Object.keys(en)].filter((k) => gone.test(k));
    expect([...new Set(hits)]).toEqual([]);
  });
});

function existsPath(p: string): boolean {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

function existsDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}
