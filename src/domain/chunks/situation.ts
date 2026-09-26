import { checkTyped } from '../answer/check';
import { normalize } from '../answer/normalize';
import type { CheckResult } from '../srs/types';
import type { SceneView } from '../speak/types';
import { containsPhrase } from './newChunk';

// M15 (docs/altapp-funktionsabgleich.md): Wendungen „aus der Situation heraus“ abfragen – wie
// `chunkreview.js` der alten App. Die Szene und die Absicht („Du willst sagen: …“) stehen da,
// die Wendung wird frei getippt. Nach dem Prüfen: „Damals hattest du gesagt: …“ und die
// aufgewertete Fassung als Beispiel. Abfrageart für Wendungen mit `src.scene` ab Stufe 4.

type Doc = Record<string, unknown>;

export const SITUATION_MIN_STAGE = 4;

export type SituationExercise = {
  chunkId: string;
  en: string;
  de: string;
  def: string;
  sceneId: string;
  sceneTitle: string;
  /** Lage und Ziel der Szene in Oberflächensprache (leer, wenn die Szene fehlt). */
  situation: string;
  goal: string;
  counterpart: string;
  /** Absicht in Oberflächensprache: DE → deutsche Bedeutung, EN → englische Erklärung. */
  intent: string;
  /** „Damals hattest du gesagt“ (eigener Satz im Gespräch). */
  then: string;
  /** Aufgewertete Fassung (enthält die Wendung). */
  upgraded: string;
  accepted: string[];
  due: number;
};

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

/** Geeignet: nicht ausgeblendet, Herkunft Szene, Wendung vorhanden, Stufe ≥ `minStage`. */
export function situationEligible(doc: Doc, minStage = SITUATION_MIN_STAGE): boolean {
  if (doc.hidden === true || !str(doc.en)) return false;
  const src = obj(doc.src);
  if (!str(src.scene)) return false;
  return num(doc.stage) >= minStage;
}

/** Wendung ohne „…“ und ohne Satzzeichen am Rand – so wird sie getippt. */
export function typedForm(en: string): string {
  return en
    .replace(/…|\.\.\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,;:.!?]+|[,;:.!?]+$/g, '')
    .trim();
}

export function buildSituation(id: string, doc: Doc, scene: SceneView | null, lang: 'de' | 'en'): SituationExercise | null {
  const en = str(doc.en);
  const src = obj(doc.src);
  const sceneId = str(src.scene);
  if (!en || !sceneId) return null;
  const de = str(doc.de);
  const def = str(doc.def);
  const intent = lang === 'de' ? de || def : def || de;
  if (!intent) return null;
  const typed = typedForm(en);
  return {
    chunkId: id,
    en,
    de,
    def,
    sceneId,
    sceneTitle: scene?.title || str(src.sceneTitle) || sceneId,
    situation: scene?.situation ?? '',
    goal: scene?.goal ?? '',
    counterpart: scene?.persona ? `${scene.persona.name}, ${scene.persona.role}` : '',
    intent,
    then: str(src.utterance),
    upgraded: str(src.upgraded),
    accepted: [...new Set([typed, en])].filter(Boolean),
    due: num(doc.due),
  };
}

/**
 * Prüfung: wie getippte Antworten (britisch gilt als richtig, Tippfehler „fast“). Zusätzlich
 * richtig, wenn ein ganzer Satz die Wendung wörtlich enthält.
 */
export function checkSituation(given: string, ex: Pick<SituationExercise, 'accepted' | 'en'>): CheckResult {
  const g = normalize(given);
  if (!g) return { verdict: 'wrong' };
  if (g.includes(' ') && ex.accepted.some((a) => containsPhrase(given, a))) return { verdict: 'correct' };
  return checkTyped(given, ex.accepted, { lemma: typedForm(ex.en) });
}

/** Buchstaben-Platzhalter als Tipp: „p___ b___ t__ g_-l___“. */
export function letterHint(en: string, firstLetters: boolean): string {
  return typedForm(en)
    .split(' ')
    .map((w) => w.replace(/[A-Za-z]/g, (ch, i: number) => (firstLetters && (i === 0 || w[i - 1] === '-') ? ch : '_')))
    .join(' ');
}

/** Reihenfolge einer Übungsrunde: am frühesten fällig zuerst, höchstens `max`. */
export function situationRound(list: readonly SituationExercise[], max = 5): SituationExercise[] {
  return [...list].sort((a, b) => a.due - b.due || a.chunkId.localeCompare(b.chunkId)).slice(0, max);
}
