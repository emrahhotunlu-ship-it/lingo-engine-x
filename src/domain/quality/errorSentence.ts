// Einfehler-Regel für Fehlersätze (E1a, Lehrer-Audit 26.10.2026). Rein.
// Ein Fehlersatz zeigt genau EINEN erklärbaren Fehler: der falsche und der richtige Satz unterscheiden sich an genau einer Stelle,
// Tippfehler werden nicht mit echten Fehlern gemischt, und die Begründung ist nicht abgeschnitten.
//
//   no_error     falscher und richtiger Satz sind (bis auf Leerraum, Groß-/Kleinschreibung) gleich
//   multi_error  mehr als eine geänderte Stelle (Wort-Abgleich) oder mehr als eine Korrektur
//   typo_mix     ein Tipp-/Zeichenfehler steht neben einem echten Fehler
//   why_cut      die Begründung endet mitten im Gedanken (… / ... / Komma, Doppelpunkt, Strich am Ende)

export type ErrorSentenceIssue = 'no_error' | 'multi_error' | 'typo_mix' | 'why_cut';
export const ERROR_SENTENCE_ISSUES: readonly ErrorSentenceIssue[] = ['no_error', 'multi_error', 'typo_mix', 'why_cut'];

export type ErrorSentenceInput = {
  wrong: string;
  right: string;
  why?: string | null;
  /** Arten der Korrekturen, wenn bekannt (z. B. `grammar`, `spelling`). Mehr als eine Korrektur gilt als `multi_error`. */
  kinds?: readonly string[];
};

const SLIP: ReadonlySet<string> = new Set(['spelling', 'punctuation', 'typo']);

/** Wörter und Satzzeichen, klein, Apostrophe vereinheitlicht. */
export const qTokens = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu) ?? [];

/** Geänderte Stellen zwischen zwei Token-Folgen (längste gemeinsame Teilfolge). Je Stelle: entfernte und eingefügte Tokens. */
export type Region = { del: string[]; ins: string[]; /** unveränderte Tokens seit der vorigen Stelle */ gap: number };
export function changedRegions(a: readonly string[], b: readonly string[]): Region[] {
  const n = a.length;
  const m = b.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i]![j] = a[i] === b[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const out: Region[] = [];
  let cur: Region | null = null;
  let same = 0;
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      cur = null;
      same++;
      i++;
      j++;
      continue;
    }
    if (!cur) {
      out.push((cur = { del: [], ins: [], gap: same }));
      same = 0;
    }
    if (j < m && (i >= n || L[i]![j + 1]! >= L[i + 1]![j]!)) cur.ins.push(b[j++]!);
    else cur.del.push(a[i++]!);
  }
  return out;
}

/** Levenshtein-Abstand (kurze Wörter). */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, k) => k);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]!;
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j]!;
      d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length]!;
}

/**
 * Stellen, zwischen denen höchstens zwei unveränderte Tokens liegen, sind EINE Stelle: so zählt eine Umstellung („we can“ → „can we“,
 * „it saves“ → „does it save“, „have you received“ → „did you receive“) als ein Fehler und nicht als zwei. Weiter auseinander liegende
 * Änderungen sind zwei Fehler. Bei Fehlersätzen aus eigenen Texten zählt zusätzlich die Zahl der Korrekturen (`kinds`).
 */
export function mergeNear(regions: readonly Region[]): Region[] {
  const out: Region[] = [];
  for (const r of regions) {
    const prev = out.at(-1);
    if (prev && r.gap <= 2) out[out.length - 1] = { del: [...prev.del, ...r.del], ins: [...prev.ins, ...r.ins], gap: prev.gap };
    else out.push(r);
  }
  return out;
}

const isPunct = (t: string): boolean => !/[\p{L}\p{N}]/u.test(t);

/**
 * Tippfehler-Stelle: nur Satzzeichen geändert, oder genau ein Wort gegen ein sehr ähnliches getauscht (Abstand ≤ 2, ab 4 Buchstaben),
 * das keine bloße Formänderung ist (gleicher Anfang, nur Endung anders: `go`/`goes`, `discuss`/`discussed` sind Grammatik).
 */
export function isSlipRegion(r: { del: readonly string[]; ins: readonly string[] }): boolean {
  if ([...r.del, ...r.ins].every(isPunct)) return true;
  if (r.del.length !== 1 || r.ins.length !== 1) return false;
  const [x, y] = [r.del[0]!, r.ins[0]!];
  if (Math.min(x.length, y.length) < 4 || editDistance(x, y) > 2) return false;
  const stem = Math.min(x.length, y.length) - 2;
  const sameStart = x.slice(0, stem) === y.slice(0, stem);
  return !sameStart || x.length === y.length;
}

/**
 * Abgeschnittene Begründung: „…“ direkt am Wort (so kürzt `clip`), „...“, oder ein Zeichen/Bindewort, nach dem der Gedanke weitergehen müsste.
 * Ein Muster-Platzhalter mit Leerzeichen („No sooner had we left … than …“, „when …“) ist kein Abschneiden.
 */
export const whyCut = (why: string | null | undefined): boolean => {
  const t = (why ?? '').trim();
  return !!t && /(\p{L}…|\.\.\.|[,;:(–-]|\s(and|or|but|the|und|oder|aber|weil|dass))$/iu.test(t);
};

export function checkErrorSentence(i: ErrorSentenceInput): ErrorSentenceIssue[] {
  const out = new Set<ErrorSentenceIssue>();
  const regions = mergeNear(changedRegions(qTokens(i.wrong), qTokens(i.right)));
  if (!regions.length) out.add('no_error');
  if (regions.length > 1 || (i.kinds && i.kinds.length > 1)) out.add('multi_error');
  const kinds = i.kinds ?? [];
  const kindMix = kinds.some((k) => SLIP.has(k)) && kinds.some((k) => !SLIP.has(k));
  const slips = regions.map(isSlipRegion);
  const regionMix = slips.some(Boolean) && slips.some((s) => !s);
  if (kindMix || regionMix) out.add('typo_mix');
  if (whyCut(i.why)) out.add('why_cut');
  return ERROR_SENTENCE_ISSUES.filter((x) => out.has(x));
}
