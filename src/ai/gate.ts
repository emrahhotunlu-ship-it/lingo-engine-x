import type { z } from 'zod';
import { getSample } from '../platform/capabilities';
import { logError, logWarn } from '../platform/diagnostics';
import { linkAbort } from './abort';
import { cancelledFailure, failure, failureFromSample } from './errors';
import { aiQueue } from './queue';
import { recordCall, resetAiStatus, throttleReason } from './status';
import { AiFailure, type AiPhase, type AiRequest, type AiResult, type CacheOpt, type ModelTier, type PromptTemplate } from './types';

// Das eine KI-Tor (Kap. 10, Architektur-Entwurf §3.2). Jede Anfrage an `sample` läuft hier durch:
// Verfügbarkeit → Drosselung → Warteschlange (≤ 2) → Aufruf mit eigenem AbortController →
// Prüfung mit zod → höchstens EIN Neuversuch, und nur bei Schemafehler (A6.3).
// Es gibt keinen Timer-Abbruch (A6.2): Nach SLOW_AFTER_MS kommt nur der Hinweis `slow`.

/**
 * Obergrenze je Prompt (UTF-8-Bytes), vor dem Aufruf geprüft. Gleich `PROMPT_MAX_BYTES` in
 * prompts/common.ts (Test); hier eigen, weil das KI-Tor aus `prompts` nur Typen importiert.
 */
export const PROMPT_BUDGET_BYTES = 60_000;
/** Harte Grenze aus contract/sample.d.ts; gilt für den Neuversuch mit angehängten Mängeln. */
export const SAMPLE_LIMIT_BYTES = 65_536;

const encoder = new TextEncoder();

/** Ab wann „dauert länger als üblich" erscheint (ms bis zum ersten Text). */
export const SLOW_AFTER_MS: Readonly<Record<ModelTier, number>> = { quick: 8_000, default: 45_000, complex: 90_000 };

type Phase = (p: AiPhase) => void;
type IssueLike = { readonly path: readonly PropertyKey[]; readonly message: string };

function budget(prompt: string, max: number, scope: string): void {
  const bytes = encoder.encode(prompt).length;
  if (bytes > max) {
    // Programmfehler: Vorlagen kürzen ihre Eingaben selbst.
    logError(scope, { code: 'prompt_too_large', message: `${bytes} bytes > ${max}` });
    throw failure('too_large', 'prompt_too_large');
  }
}

function guardThrottle(scope: string): void {
  const reason = throttleReason();
  if (reason === null) return;
  if (reason === 'local_limit') logWarn(scope, { code: 'local_limit', message: 'more than 20 AI calls within 60 s' });
  throw failure('busy', reason);
}

function describeIssues(issues: readonly IssueLike[]): string {
  return issues
    .slice(0, 5)
    .map((i) => `- ${i.path.map(String).join('.') || '(root)'}: ${i.message}`)
    .join('\n');
}

/** Eingabe des einen Neuversuchs: anders als die erste, trifft also nicht den Zwischenspeicher. */
export function retryPrompt(prompt: string, issues: readonly IssueLike[], reply: unknown): string {
  const previous = (JSON.stringify(reply) ?? 'null').slice(0, 1500);
  return (
    prompt +
    '\n\nYour previous reply did not match the required format:\n' +
    describeIssues(issues) +
    '\nPrevious reply: ' +
    previous +
    '\nReply again with only the corrected JSON object.'
  );
}

/** Standardfenster von `sample`, wenn eine Vorlage nur `cache: true` sagt (sample.d.ts). */
const DEFAULT_GC_MS = 300_000;

/** `cache` des Aufrufs: bei „Erneut versuchen" mit `refresh`, sonst wie in der Vorlage. */
export function cacheFor(cache: CacheOpt, refresh: boolean): CacheOpt {
  return refresh ? refreshCache(cache) : cache;
}

/**
 * Zwischenspeicher für einen Nutzer-Neuversuch (E5-21): einmal frisch fragen und den
 * gespeicherten Eintrag überschreiben. `false` bleibt `false`.
 */
export function refreshCache(cache: CacheOpt): CacheOpt {
  if (cache === false) return false;
  const gcTime = cache === true ? DEFAULT_GC_MS : cache.gcTime;
  return { gcTime, refresh: true };
}

/**
 * Repariert den häufigsten Fehler echter Antworten: gerade Anführungszeichen `"` MITTEN in einem
 * JSON-Text, meist als Schluss eines deutschen „…" (Befund 27.09.: „Play" kann …). Zuerst werden
 * „…" und “…" zu typografischen Paaren, dann wird jedes übrige `"` innerhalb eines Textes
 * maskiert, auf das kein Strukturzeichen (`,` `:` `}` `]`) folgt.
 */
export function repairJson(src: string): string {
  // Beendet `"` an Stelle i wirklich den Text? Nur, wenn danach ein Strukturzeichen kommt – ein
  // Komma aber nur, wenn dahinter ein neuer JSON-Wert/Schlüssel beginnt (nicht „x", sondern …).
  const closes = (s: string, i: number): boolean => {
    const m = s.slice(i + 1).match(/^\s*(.)(\s*)(.?)/);
    if (!m) return true;
    const c = m[1];
    if (c === '}' || c === ']' || c === ':') return true;
    if (c === ',') return m[3] === '' || /["{[\-0-9tfn}\]]/.test(m[3] ?? '');
    return false;
  };
  // Zuerst „…" / “…" zu typografischen Paaren, wenn das `"` den Text nicht beendet.
  let paired = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    paired += c;
    if (c !== '„' && c !== '“') continue;
    const j = src.indexOf('"', i + 1);
    const nl = src.indexOf('\n', i + 1);
    if (j < 0 || j - i > 200 || (nl >= 0 && nl < j) || /[„“]/.test(src.slice(i + 1, j)) || closes(src, j)) continue;
    paired += src.slice(i + 1, j) + (c === '„' ? '“' : '”');
    i = j;
  }
  let out = '';
  let inStr = false;
  for (let i = 0; i < paired.length; i++) {
    const c = paired[i]!;
    if (!inStr) {
      if (c === '"') inStr = true;
      out += c;
      continue;
    }
    if (c === '\\') {
      out += c + (paired[i + 1] ?? '');
      i++;
      continue;
    }
    if (c === '"') {
      if (closes(paired, i)) {
        inStr = false;
        out += c;
      } else out += '\\"';
      continue;
    }
    // Rohe Zeilenumbrüche in Texten sind in JSON nicht erlaubt.
    out += c === '\n' ? '\\n' : c;
  }
  return out;
}

/**
 * Liest eine Textantwort tolerant als JSON – dieselben drei Regeln wie `sample.json`
 * (contract/sample.d.ts): ganzer Text; sonst Inhalt EINES Markdown-Codeblocks; sonst vom ersten
 * `{`/`[` bis zum letzten `}`/`]`. `undefined`, wenn nichts davon lesbar ist.
 */
export function parseJsonText(text: string): unknown {
  const strict = (s: string): unknown => {
    try {
      return JSON.parse(s) as unknown;
    } catch (err) {
      // Kein JSON: die nächste Regel versucht es (Fehler ist hier erwartet, kein Programmfehler).
      void err;
      return undefined;
    }
  };
  // Erst streng, dann repariert (deutsche Anführungszeichen „…" mit geradem Schlusszeichen).
  const tryParse = (s: string): unknown => {
    const v = strict(s);
    if (v !== undefined) return v;
    const fixed = repairJson(s);
    return fixed === s ? undefined : strict(fixed);
  };
  const whole = tryParse(text.trim());
  if (whole !== undefined) return whole;
  const fences = [...text.matchAll(/```[a-zA-Z]*\n([\s\S]*?)```/g)];
  if (fences.length === 1) {
    const inner = tryParse((fences[0]?.[1] ?? '').trim());
    if (inner !== undefined) return inner;
  }
  const starts = [text.indexOf('{'), text.indexOf('[')].filter((i) => i >= 0);
  const ends = [text.lastIndexOf('}'), text.lastIndexOf(']')].filter((i) => i >= 0);
  if (!starts.length || !ends.length) return undefined;
  const from = Math.min(...starts);
  const to = Math.max(...ends);
  return to > from ? tryParse(text.slice(from, to + 1)) : undefined;
}

/**
 * Prompts, deren letzte Antwort ungültig war (B2): `sample` hat sie womöglich zwischengespeichert,
 * „Erneut versuchen" bekäme ohne `refresh` dieselbe Antwort. Der NÄCHSTE, vom Nutzer ausgelöste
 * Aufruf mit demselben Prompt fragt deshalb frisch (`refresh`) – nie ein automatischer Neuversuch.
 * Gespeichert wird nur ein Streuwert (Stufe + Prompt), höchstens STALE_MAX Einträge.
 */
const staleKeys = new Set<string>();
const STALE_MAX = 64;

/** FNV-1a (53 Bit) über Stufe und Prompt – der Zwischenspeicher-Schlüssel von `sample` ohne `images`. */
export function promptKey(tier: ModelTier, prompt: string): string {
  const s = `${tier}\n${prompt}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x1b873593;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return `${(h1 >>> 0).toString(36)}.${(h2 >>> 0).toString(36)}.${s.length}`;
}

function markStale(key: string): void {
  staleKeys.delete(key);
  staleKeys.add(key);
  while (staleKeys.size > STALE_MAX) {
    const oldest = staleKeys.values().next().value;
    if (oldest === undefined) break;
    staleKeys.delete(oldest);
  }
}

/** Nur für Tests: Wird der nächste Aufruf mit diesem Prompt frisch gefragt? */
export function isStalePrompt(tier: ModelTier, prompt: string): boolean {
  return staleKeys.has(promptKey(tier, prompt));
}

type CallOut = { value: unknown; tier: ModelTier };

/** An jede JSON-Vorlage angehängt: keine geraden Anführungszeichen in Texten. */
export const QUOTE_RULE =
  '\nJSON rule: never put the straight double quote character " inside a text value. For quotations inside text use „…“ (German) or “…” (English) or single quotes.';

async function callOnce(
  prompt: string,
  template: PromptTemplate<unknown, unknown>,
  cache: CacheOpt,
  signal: AbortSignal,
  phase: Phase,
  scope: string,
): Promise<CallOut> {
  if (signal.aborted) throw cancelledFailure();
  const sample = getSample();
  if (!sample) throw failure('unavailable', 'absent');
  guardThrottle(scope);

  // Je Aufruf ein eigener Controller (contract/sample.d.ts: „a NEW controller per call").
  const ctl = new AbortController();
  const unlink = linkAbort(signal, ctl);
  let slowTimer: ReturnType<typeof setTimeout> | null = null;
  const stopSlow = () => {
    if (slowTimer !== null) clearTimeout(slowTimer);
    slowTimer = null;
  };
  let streaming = false;
  phase('thinking');
  slowTimer = setTimeout(() => {
    slowTimer = null;
    phase('slow');
  }, SLOW_AFTER_MS[template.tier]);
  recordCall();
  const onText = () => {
    if (streaming) return;
    streaming = true;
    stopSlow();
    phase('streaming');
  };
  try {
    // Alle Vorlagen über den Text-Weg mit eigenem, reparierendem Lesen (Befund 27.09.: `sample.json`
    // verwarf Antworten mit deutschen Anführungszeichen „…" – der Nutzer sah nur „unvollständig“).
    {
      const res = await sample(prompt, { modelTier: template.tier, cache, signal: ctl.signal, onText });
      const tier = res.modelTierApplied ?? template.tier;
      if (tier !== template.tier) logWarn(scope, { code: 'tier_substituted', message: `${template.tier} → ${tier}` });
      const value = res.truncated ? undefined : parseJsonText(res.text);
      // Wie `sample.json`: nichts lesbar oder abgeschnitten → `invalid_json`, nie automatisch wiederholt (A6.3).
      if (value === undefined) throw failureFromSample({ code: 'invalid_json', message: res.truncated ? 'reply truncated' : 'no JSON value', text: res.text }, scope);
      return { value, tier };
    }
  } catch (err) {
    throw failureFromSample(err, scope);
  } finally {
    stopSlow();
    unlink();
  }
}

async function run<V, O>(req: AiRequest<V, O>, scope: string, phase: Phase): Promise<AiResult<O>> {
  const { template, vars, signal } = req;
  if (signal.aborted) throw cancelledFailure();
  if (!getSample()) throw failure('unavailable', 'absent');

  let prompt: string;
  let schema: z.ZodType<O>;
  try {
    prompt = template.build(vars) + QUOTE_RULE;
    schema = template.schema(vars);
  } catch (err) {
    logError(scope, err, 'build');
    throw failure('bug', 'build');
  }
  budget(prompt, PROMPT_BUDGET_BYTES, scope);
  guardThrottle(scope);

  const release = await aiQueue.acquire(signal, req.priority ?? 'user', () => phase('queued'));
  try {
    const t = template as PromptTemplate<unknown, unknown>;
    const key = promptKey(template.tier, prompt);
    const cache = cacheFor(template.cache, req.refresh === true || staleKeys.has(key));
    let first: CallOut;
    try {
      first = await callOnce(prompt, t, cache, signal, phase, scope);
    } catch (err) {
      // `text-json`: auch eine unlesbare Textantwort kann im Zwischenspeicher liegen.
      if (err instanceof AiFailure && err.kind === 'invalid') markStale(key);
      throw err;
    }
    const r1 = schema.safeParse(first.value);
    if (r1.success) {
      staleKeys.delete(key);
      return { data: r1.data, tierApplied: first.tier, retried: false };
    }
    markStale(key);

    logWarn(scope, { code: 'schema', message: describeIssues(r1.error.issues) }, 'first reply');
    const prompt2 = retryPrompt(prompt, r1.error.issues, first.value);
    budget(prompt2, SAMPLE_LIMIT_BYTES, scope);
    // Der eine Neuversuch (A6.3) fragt immer frisch, damit er keine gespeicherte Antwort trifft.
    const second = await callOnce(prompt2, t, refreshCache(template.cache), signal, phase, scope);
    const r2 = schema.safeParse(second.value);
    if (r2.success) return { data: r2.data, tierApplied: second.tier, retried: true };

    logWarn(scope, { code: 'schema', message: describeIssues(r2.error.issues) }, 'retry');
    throw failure('invalid', 'schema');
  } finally {
    release();
  }
}

/**
 * Fragt Claude nach JSON gemäß Vorlage. Löst mit geprüften Daten auf oder lehnt mit genau
 * einem `AiFailure` ab. Nur auf eine ausdrückliche Handlung hin aufrufen, nie aus Schleifen
 * oder Timern (contract/sample.d.ts).
 */
export async function askJson<V, O>(req: AiRequest<V, O>): Promise<AiResult<O>> {
  const scope = `ai:${req.template.id}@${req.template.version}`;
  const phase: Phase = (p) => {
    try {
      req.onPhase?.(p);
    } catch (err) {
      logError('ai:onPhase', err, scope);
    }
  };
  try {
    const result = await run(req, scope, phase);
    phase('done');
    return result;
  } catch (err) {
    const f = err instanceof AiFailure ? err : failureFromSample(err, scope);
    if (f.kind !== 'cancelled') phase('error');
    throw f;
  }
}

/** Nur für Tests: Warteschlange und Drosselung zurücksetzen. */
export function resetAiGate(): void {
  aiQueue.reset();
  staleKeys.clear();
  resetAiStatus();
}
