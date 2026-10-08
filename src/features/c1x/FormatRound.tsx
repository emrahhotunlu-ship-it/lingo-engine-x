import { flags } from '../../app/flags';
import type { Route } from '../../app/router/types';
import type { UnitBlockNo } from '../../app/unit/types';
import { useLive } from '../../data/live';
import { FORMAT_MIN, FORMAT_N } from '../../domain/c1/checkSchedule';
import { kindRound } from '../../domain/grammar/kindRound';
import { lexDoneSet } from './lexDone';
import type { Step3Fmt } from '../../domain/plan/types';
import { startGrammar } from '../grammar/session';
import { ensureC1xLoaded } from './resolve';

// Die Format-Runde von Schritt 3 (Lernplattform 3.0 §2.1, P23): an Dienstag bis Freitag eine einzige Aufgabenart des Tages, `FORMAT_N` Aufgaben.
// Sie läuft im Übungsgerüst der Grammatikrunde (Art-Runde, `kindRound`) als Pflicht des Blocks 3; das Rundenende meldet den Block wie bei
// jeder Pflichtrunde (`reportGrammarDone` → `unitDone`). Gibt es zu wenig passende Aufgaben (§2.3 Grenze) oder ist die Art nicht angeboten,
// startet nichts und der Aufrufer nimmt den Satzbau – nie ein leerer Schritt.

type Docs = ReadonlyMap<string, Readonly<Record<string, unknown>>>;

/** Gibt es genug passende, ungesperrte Aufgaben für die Runde? */
export function formatAvailable(fmt: Step3Fmt, docs: Docs, day: string): boolean {
  if (!flags.c1xKinds[fmt]) return false;
  ensureC1xLoaded();
  return kindRound({ kind: fmt, size: FORMAT_N[fmt], grammarDocs: docs, seed: `${day}|fmt`, lexDone: lexDoneSet() }).length >= FORMAT_MIN;
}

export type FormatStart = { route: Route; first: 'typed' | 'choice' | null };

/** Startet die Format-Runde als Block `block` des Tages; `null`, wenn sie nicht machbar ist (dann Satzbau). SYNCHRON im Klick. */
export function startFormatRound(i: { fmt: Step3Fmt; day: string; block: UnitBlockNo }): FormatStart | null {
  const docs: Docs = useLive.getState().collections.grammar ?? new Map();
  if (!formatAvailable(i.fmt, docs, i.day)) return null;
  const first = startGrammar({ mode: 'duty', day: i.day, block: i.block, kind: i.fmt, size: FORMAT_N[i.fmt] });
  return { route: { name: 'grammarSession', mode: 'duty' }, first };
}
