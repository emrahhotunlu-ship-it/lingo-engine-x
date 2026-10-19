import { alignKey, alignWords } from '../answer/align';
import { wordTypo } from '../grammar/check';
import { fixedProblems } from '../text/correctness';
import { lemmaCandidates } from '../text/lemma';
import { l1Entries, l1Text } from '../tutor/l1';
import type { RepairItem } from './repair';

// Eintritts-Wächter für Fehlersätze (`app/repair`, Rückmeldung 19.10.2026 „by Friday → until Friday“): Ein Eintrag, dessen „richtige“ Fassung
// selbst falsch ist oder dessen Begründung nicht zur geänderten Stelle passt, wird Emrah nie als „korrigiere das“ vorgelegt. Rein, ohne KI,
// deterministisch. Läuft beim Anlegen (`saveRepairs`) und beim Vorlegen (`dueRepairs`). Hohe Trefferquote vor Vollständigkeit: lieber einen
// fragwürdigen Eintrag durchlassen als einen richtigen sperren. Gelöscht wird nie; der Eintrag ruht (`held`) und steht in der Lehrer-Liste.
//
//  reverse_rule  Die Korrektur dreht eine bekannte Regel um: `wrong` hat die gute Form, `right` die schlechte (by → until bei einer Frist).
//  right_l1      Die „richtige“ Fassung löst einen bekannten Übertragungsfehler aus (`content/tutor/l1.json`, kind 'error').
//  right_error   Die „richtige“ Fassung hat einen eindeutigen Fehler (`fixedProblems`, Selbstprüfung seit 15.10.2026, für ältere Einträge).
//  why_mismatch  Die Begründung ist ein Allgemeinplatz (Tippfehler, Subjekt/Verb), die Korrektur tauscht aber ein Wort, das sie nicht nennt.

export type GateReason = 'reverse_rule' | 'right_l1' | 'right_error' | 'why_mismatch';
export type GateHit = { reason: GateReason; detail: string };
export type GateInput = { wrong: string; right: string; why?: string | null; src?: string | null };

/** Lehrer-Texte (Preply, Unterricht) und Lektionen stammen nicht von der KI und werden nicht geprüft (wie die Selbstprüfung in `saveRepairs`). */
const TRUSTED: ReadonlySet<string> = new Set(['teacher', 'preply', 'lesson']);

// ------------------------------------------------------------------ Gegenrichtung (Bedeutungsregeln mit `when`)

/** Fristwörter im Teilsatz vor „by …“: dann ist by richtig (spätestens). */
const DEADLINE =
  /\b(?:needs?|needed|due|send|sent|submit(?:s|ted)?|deliver(?:s|ed)?|finish(?:es|ed)?|complete(?:s|d)?|ready|return(?:s|ed)?|provide(?:s|d)?|confirm(?:s|ed)?|pay|paid|sign(?:s|ed)?|reply|respond|decide|approve(?:s|d)?|required?|expected|have\s+to|has\s+to|must|should|get\s+back|let\s+(?:me|us)\s+know|deadline|done|at\s+the\s+latest)\b/;
/** Dauer oder Verneinung im selben Teilsatz: until kann richtig sein (We are closed until Monday, We won't know until Friday). */
const DURATION =
  /\b(?:wait(?:s|ed|ing)?|stay(?:s|ed|ing)?|closed|open|last(?:s|ed)?|remain(?:s|ed)?|continue(?:s|d)?|keep|kept|valid|leave|vacation|holiday|away|off|postpone(?:s|d)?|delay(?:s|ed)?|run(?:s|ning)?|work(?:s|ed|ing)?|busy|available|not)\b|n't\b/;
const CLAUSE_SPLIT = /[,.;:!?]|\b(?:and|but|or|otherwise|so|because)\b/;

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Teilsatz vor der Stelle `at` (ab dem letzten Satzzeichen oder Bindewort). */
function clauseBefore(text: string, at: number): string {
  const parts = text.slice(0, at).split(CLAUSE_SPLIT);
  return parts[parts.length - 1] ?? '';
}

/**
 * Bedeutungsregeln, deren Gegenrichtung nur mit Zusatzwissen eindeutig ist. Eine Regel mit `when` ohne Eintrag hier wird nie umgedreht geprüft
 * (z. B. must not ↔ don't have to: Verbot oder fehlende Pflicht hängt von der Absicht ab, die der Satz nicht verrät).
 */
const REVERSE_SENSE: Readonly<Record<string, (wrong: string, right: string, m: RegExpExecArray) => boolean>> = {
  // „by Friday“ → „until Friday“: nur bei einer Frist im selben Teilsatz und an derselben Stelle (dieselbe Zeitangabe folgt auf until).
  'l1:bis-by-until': (wrong, right, m) => {
    const time = m[0].trim().split(/\s+/)[1];
    if (!time || !new RegExp(`\\buntil\\s+${esc(time)}\\b`).test(right)) return false;
    const clause = clauseBefore(wrong, m.index);
    return DEADLINE.test(clause) && !DURATION.test(clause);
  },
};

function reverseRule(w: string, r: string): string | null {
  for (const e of l1Entries()) {
    if (e.kind !== 'error' || !e.badRe || !e.whenRe) continue;
    const sense = REVERSE_SENSE[e.id];
    if (!sense) continue;
    if (!e.badRe.test(r) || e.badRe.test(w) || e.whenRe.test(r)) continue;
    const m = e.whenRe.exec(w);
    if (m && sense(w, r, m)) return e.id;
  }
  return null;
}

/** Bekannter Übertragungsfehler in der „richtigen“ Fassung (nur Einträge ohne Bedeutungsbedingung `when`: die treffen immer). */
function rightL1(r: string): string | null {
  for (const e of l1Entries()) if (e.kind === 'error' && e.badRe && !e.whenRe && e.badRe.test(r)) return e.id;
  return null;
}

// ------------------------------------------------------------------ Begründung gegen die geänderte Stelle

const TYPO_WHY = /rechtschreib|tippfehler|schreibfehler|schreibweise|spelling|typo|misspel/i;
const AGREE_WHY = /subjekt|singular|plural|kongruenz|subject|agreement/i;
/** Formen von be/have/do: ein Tausch untereinander ist Kongruenz (are → is). */
const AGREE_WORDS: ReadonlySet<string> = new Set(['am', 'is', 'are', 'was', 'were', 'has', 'have', 'do', 'does', "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't", "don't", "doesn't"]);

const shareLemma = (a: string, b: string): boolean => {
  const la = lemmaCandidates(a);
  return lemmaCandidates(b).some((x) => la.includes(x));
};

/** Nennt die Begründung das Wort (oder eine Form davon)? */
function mentions(why: string, w: string): boolean {
  const forms = new Set([w, ...lemmaCandidates(w)].filter((x) => x.length > 0));
  return [...forms].some((f) => new RegExp(`(?:^|[^a-z'])${esc(f)}(?:$|[^a-z'])`).test(why));
}

function whyMismatch(wrong: string, right: string, why: string): string | null {
  const text = l1Text(why).replace(/["„“”‚‘’«»]/g, ' ');
  if (!text) return null;
  const typo = TYPO_WHY.test(text);
  const agree = AGREE_WHY.test(text);
  // Eine freie Begründung („bis als Frist heißt by“) wird nicht beurteilt; nur Allgemeinplätze können an der Stelle vorbeigehen.
  if (!typo && !agree) return null;
  for (const o of alignWords(wrong, right, { typo: wordTypo })) {
    if (o.op === 'eq' || o.op === 'typo') continue;
    const g = alignKey(o.given ?? '');
    const e = alignKey(o.expected ?? '');
    if (!g && !e) continue;
    // Andere Form desselben Worts (need → needs): passt zu jeder grammatischen Begründung.
    if (g && e && shareLemma(g, e)) continue;
    if (agree && (!g || AGREE_WORDS.has(g)) && (!e || AGREE_WORDS.has(e))) continue;
    if ((g && mentions(text, g)) || (e && mentions(text, e))) continue;
    return `${g || '∅'}→${e || '∅'}`;
  }
  return null;
}

// ------------------------------------------------------------------ Gesamtprüfung

const memo = new Map<string, GateHit | null>();

function gateRaw(i: GateInput): GateHit | null {
  if (i.src && TRUSTED.has(i.src)) return null;
  const wrong = i.wrong.trim();
  const right = i.right.trim();
  if (!wrong || !right) return null;
  const w = l1Text(wrong);
  const r = l1Text(right);
  const rev = reverseRule(w, r);
  if (rev) return { reason: 'reverse_rule', detail: rev };
  const l1 = rightL1(r);
  if (l1) return { reason: 'right_l1', detail: l1 };
  const fixed = fixedProblems(right)[0];
  if (fixed) return { reason: 'right_error', detail: `${fixed.id}: ${fixed.hit}`.slice(0, 120) };
  const mis = i.why?.trim() ? whyMismatch(wrong, right, i.why) : null;
  if (mis) return { reason: 'why_mismatch', detail: mis };
  return null;
}

/** Warum dieser Fehlersatz nicht vorgelegt werden darf, sonst `null`. Hängt nur vom Text ab und wird zwischengemerkt (Zählungen rufen es oft auf). */
export function repairGate(i: GateInput): GateHit | null {
  const key = `${i.wrong}\u0001${i.right}\u0001${i.why ?? ''}\u0001${i.src ?? ''}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const out = gateRaw(i);
  if (memo.size > 3000) memo.clear();
  memo.set(key, out);
  return out;
}

/** Ruht der Eintrag (gespeicherter Merker `held`) oder fällt er jetzt durch den Wächter? */
export const repairHeld = (e: Pick<RepairItem, 'wrong' | 'right' | 'why' | 'src' | 'held'>): boolean => !!e.held || repairGate(e) !== null;

/** Offene Einträge, die der Wächter jetzt sperrt, aber noch keinen Merker haben (werden beim Vorlegen still ruhend gestellt). */
export function newlyGated(list: readonly RepairItem[]): Array<{ id: string; hit: GateHit }> {
  const out: Array<{ id: string; hit: GateHit }> = [];
  for (const e of list) {
    if (e.done || e.unclear || e.held) continue;
    const hit = repairGate(e);
    if (hit) out.push({ id: e.id, hit });
  }
  return out;
}

/** Eine Zeile der Lehrer-Liste (Einstellungen › Diagnose › KI-Stichprobe): zurückgehaltene Fehlersätze zum Gegenlesen. */
export type HeldRepairRow = { id: string; wrong: string; right: string; why: string; src: string; reason: string; detail: string; t: number };

/** Alle ruhenden bzw. jetzt gesperrten Fehlersätze, neueste zuerst. Rein. */
export function heldRepairRows(list: readonly RepairItem[]): HeldRepairRow[] {
  const out: HeldRepairRow[] = [];
  for (const e of list) {
    const hit = e.held ? { reason: e.held.r, detail: e.held.d ?? '' } : (() => {
      const h = e.done || e.unclear ? null : repairGate(e);
      return h ? { reason: h.reason, detail: h.detail } : null;
    })();
    if (!hit) continue;
    out.push({ id: e.id, wrong: e.wrong, right: e.right, why: e.why ?? '', src: e.src, reason: hit.reason, detail: hit.detail, t: e.held?.t ?? e.t });
  }
  return out.sort((a, b) => b.t - a.t || a.id.localeCompare(b.id));
}
