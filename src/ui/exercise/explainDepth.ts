import type { ExplainDepth, ExplainLine, ExplanationModel, ResultVerdict } from '../../domain/explain/types';

// Erklär-Tiefe und sichtbare Zeilen (Lernplattform 2.0 §4.6). Rein, ohne React.

export function explainDepth(i: { verdict: ResultVerdict; p?: number | null; stage?: number | null; learning: boolean }): ExplainDepth {
  if (i.learning || i.verdict === 'wrong' || i.verdict === 'near' || i.verdict === 'dontKnow') return 'full';
  if (typeof i.p === 'number') return i.p < 0.4 ? 'full' : i.p <= 0.7 ? 'short' : 'min';
  if (typeof i.stage === 'number') return i.stage <= 2 ? 'full' : i.stage === 3 ? 'short' : 'min';
  return 'full';
}

export type VisibleLines = {
  open: ExplainLine[];
  folded: ExplainLine[];
  examplesOpen: 0 | 1;
  /** `min`: die offene Liste wird als EINE Zeile „✓ Muster · Richtig, weil …“ gezeigt. */
  oneLine: boolean;
};

const OPEN: Record<ExplainDepth, ReadonlyArray<ExplainLine['k']>> = {
  full: ['pattern', 'yours', 'why', 'mistake'],
  short: ['pattern', 'yours', 'why'],
  min: ['pattern', 'why'],
};

/** `learning` (Standard: wahr) entscheidet nur bei `full`, ob „Typischer Fehler“ offen steht. */
export function visibleLines(m: ExplanationModel, d: ExplainDepth, opts: { learning?: boolean } = {}): VisibleLines {
  const learning = opts.learning ?? true;
  const allowed = OPEN[d].filter((k) => k !== 'mistake' || learning);
  const open: ExplainLine[] = [];
  const folded: ExplainLine[] = [];
  let usedPattern = false;
  let usedWhy = false;
  for (const line of m.lines) {
    // Bei `min` zählt nur die erste Musterzeile und die erste Begründung.
    const first = line.k === 'pattern' ? !usedPattern : line.k === 'why' ? !usedWhy : true;
    if (allowed.includes(line.k) && (d !== 'min' || first)) open.push(line);
    else folded.push(line);
    if (line.k === 'pattern') usedPattern = true;
    if (line.k === 'why') usedWhy = true;
  }
  return { open, folded, examplesOpen: d === 'full' && m.examples.length > 0 ? 1 : 0, oneLine: d === 'min' };
}

/** Holt Zeilen der Arten `unfold` aus „Mehr“ nach oben (Reihenfolge wie im Modell); dann nie die Einzeilen-Form. Rein. */
export function liftLines(v: VisibleLines, m: ExplanationModel, unfold?: ReadonlyArray<ExplainLine['k']>): VisibleLines {
  if (!unfold?.length) return v;
  const lifted = v.folded.filter((l) => unfold.includes(l.k));
  if (!lifted.length) return v;
  const open = m.lines.filter((l) => v.open.includes(l) || lifted.includes(l));
  return { ...v, open, folded: v.folded.filter((l) => !lifted.includes(l)), oneLine: false };
}

const words = (s: string | null | undefined): number => (s ? s.split(/\s+/).filter(Boolean).length : 0);

function lineWords(l: ExplainLine): number {
  switch (l.k) {
    case 'pattern':
      return words(l.name) + words(l.formula);
    case 'yours':
      return words(l.given) + words(l.text);
    case 'why':
    case 'note':
      return words(l.text);
    case 'mistake':
      return words(l.bad) + words(l.good) + words(l.cause);
    case 'contrast':
      return words(l.a) + words(l.b) + words(l.diff);
  }
}

/** Wörter der offenen Zeilen plus des offenen Beispiels (Ziel am Handy: höchstens 45). */
export function visibleWordCount(m: ExplanationModel, d: ExplainDepth, opts: { learning?: boolean } = {}): number {
  const v = visibleLines(m, d, opts);
  const ex = v.examplesOpen ? words(m.examples[0]?.en) : 0;
  return v.open.reduce((n, l) => n + lineWords(l), 0) + ex;
}
