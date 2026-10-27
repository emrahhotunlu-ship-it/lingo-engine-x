import type { ExplainDepth, ExplainExample, ExplainLine, ExplanationModel } from '../../domain/explain/types';
import { liftLines, visibleLines } from './explainDepth';
import { splitHead, splitWhy } from './wordParts';

// Bauplan der Ergebnis-Karte (UX-Audit U3, 27.10.2026). Rein, ohne React.
// Jede Übungsart zeigt dieselben höchstens drei Blöcke in fester Reihenfolge:
//   1. Urteil + Lösung (setzt das Gerüst selbst: Urteil, Kopf, „Richtig: …“, Vergleich)
//   2. „Warum“    – die Begründung zur eigenen Antwort bzw. zur Lösung
//   3. „Merke“    – das Muster (Grammatik) bzw. die Merke-Zeile (Wörter)
// Alles Weitere (Typischer Fehler, Nicht verwechseln, Hinweise, Beispiele, Wortarten-Chips) steht hinter EINEM „Mehr“.
// Kein Text wird umgeschrieben: die Stücke stehen wörtlich so im Modell.

export type BlockItem =
  /** Begründungs- oder Hinweistext. `lead`: eigene Kurzüberschrift der Zeile (z. B. „Deine Wertung“), steht fett davor. */
  | { t: 'text'; k: 'yours' | 'why' | 'note'; text: string; lead?: string | undefined; ai?: boolean | undefined }
  /** Muster: Name und Formel. */
  | { t: 'pattern'; name: string; formula: string | null }
  /** Kern der Merke-Zeile (Wörter): groß; `en` = englischer Ausdruck (antippbar), sonst „Wort = Bedeutung“ in der Oberflächensprache. */
  | { t: 'main'; text: string; en: boolean }
  /** Beschriftetes Gegenstück („Formeller: discontinue“). */
  | { t: 'pair'; label: string; text: string }
  | { t: 'mistake'; bad: string; good: string; cause: string | null }
  | { t: 'contrast'; a: string; b: string; diff: string; meaningOnly?: boolean | undefined }
  /** Wortkarte: Wortart und Register als Chips (die Wortart steht schon im Kopf, deshalb nur unter „Mehr“). */
  | { t: 'chips'; word: string; chips: string[]; formula: string | null };

/** `example`: der erste Beispielsatz steht offen im Merke-Block, wenn es sonst nichts zu merken gibt (Kap. 15: „Karten ohne Ursprungssatz“). */
export type ResultPlan = { why: BlockItem[]; remember: BlockItem[]; more: BlockItem[]; example: ExplainExample | null };

export type PlanOpts = {
  learning?: boolean;
  /** Diese Zeilenarten stehen immer unter „Mehr“. */
  fold?: ReadonlyArray<ExplainLine['k']>;
  /** Diese Zeilenarten stehen immer offen (gewinnt gegen `fold`). */
  unfold?: ReadonlyArray<ExplainLine['k']> | undefined;
};

/** „Phase out = schrittweise abschaffen“: eine Bedeutungsangabe – die Bedeutung steht schon im Kopf, deshalb unter „Mehr“. */
const DEFINITION = /^[^=]{1,60}\s=\s\S/;

const toItem = (l: ExplainLine): BlockItem => {
  switch (l.k) {
    case 'pattern':
      return { t: 'pattern', name: l.name, formula: l.formula };
    case 'yours':
      return { t: 'text', k: 'yours', text: l.text, lead: l.head };
    case 'why':
      // Die Überschrift „Claude sagt“ entfällt (der Block heißt immer „Warum“, die KI-Kennzeichnung bleibt an der Zeile);
      // eine andere eigene Überschrift (z. B. „Nur auf Deutsch“) bleibt als Vorspann.
      return { t: 'text', k: 'why', text: l.text, ai: l.ai, ...(l.head && !l.ai ? { lead: l.head } : {}) };
    case 'note':
      return { t: 'text', k: 'note', text: l.text };
    case 'mistake':
      return { t: 'mistake', bad: l.bad, good: l.good, cause: l.cause };
    case 'contrast':
      return { t: 'contrast', a: l.a, b: l.b, diff: l.diff, meaningOnly: l.meaningOnly };
  }
};

/** Leere Begründung (z. B. „Deine Antwort“ ohne Text) zählt nicht als Inhalt. */
const empty = (it: BlockItem): boolean => it.t === 'text' && !it.text.trim() && !it.lead;

export function planResult(model: ExplanationModel, depth: ExplainDepth, opts: PlanOpts = {}): ResultPlan {
  const unfold = opts.unfold ?? [];
  const fold = (opts.fold ?? []).filter((k) => !unfold.includes(k));
  const v = liftLines(visibleLines(model, depth, { learning: opts.learning ?? true }), model, unfold.length ? unfold : undefined);
  const open = v.open.filter((l) => !fold.includes(l.k));
  const why: BlockItem[] = [];
  const remember: BlockItem[] = [];
  const more: BlockItem[] = [];
  const card = model.source === 'card';
  const head = card ? model.lines.find((l): l is Extract<ExplainLine, { k: 'pattern' }> => l.k === 'pattern') : undefined;
  const headWord = head ? splitHead(head.name).word : '';

  const placeCardWhy = (l: Extract<ExplainLine, { k: 'why' }>, into: 'open' | 'more') => {
    const w = splitWhy(l.text, headWord);
    if (!w.label) {
      // Ohne „Merke:“ ist die Zeile eine Begründung (Kontrast-Schritt, Satzprüfung, Wortpartner-Drill) – oder nur das Wort selbst.
      if (!w.main && !w.rest.length) return;
      (into === 'open' ? why : more).push({ t: 'text', k: 'why', text: l.text, ai: l.ai });
      return;
    }
    const target = into === 'open' ? remember : more;
    if (w.main) target.push({ t: 'main', text: w.main, en: !w.main.includes(' = ') });
    for (const r of w.rest) {
      if (r.label) target.push({ t: 'pair', label: `${r.label.charAt(0).toUpperCase()}${r.label.slice(1)}`, text: r.text });
      else if (DEFINITION.test(r.text)) more.push({ t: 'text', k: 'note', text: r.text });
      else (into === 'open' ? why : more).push({ t: 'text', k: 'why', text: r.text });
    }
  };

  for (const l of model.lines) {
    const isOpen = open.includes(l);
    if (card && l.k === 'pattern') {
      const h = splitHead(l.name);
      if (h.chips.length || l.formula) more.push({ t: 'chips', word: h.word, chips: h.chips, formula: l.formula });
      continue;
    }
    if (card && l.k === 'why') {
      placeCardWhy(l, isOpen ? 'open' : 'more');
      continue;
    }
    const it = toItem(l);
    if (empty(it)) continue;
    if (!isOpen) {
      more.push(it);
      continue;
    }
    if (l.k === 'pattern') remember.push(it);
    else if (l.k === 'mistake') more.push(it);
    else why.push(it);
  }
  const example = !remember.length ? (model.examples[0] ?? null) : null;
  return { why, remember, more, example };
}

/** Wie oft ein Ausdruck in einem Text vorkommt (ganze Wörter, ohne Groß/klein). Für den Test „Lernwort höchstens zweimal“. */
export function countWord(text: string, word: string): number {
  const w = word.trim().toLowerCase();
  if (!w) return 0;
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return (text.toLowerCase().match(new RegExp(`(^|[^a-z])${esc}(?=$|[^a-z])`, 'g')) ?? []).length;
}
