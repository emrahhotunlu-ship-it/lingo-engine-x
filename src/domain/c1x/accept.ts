import { legacyNorm } from '../grammar/key';
import { checkC1Content } from './checkContent';
import { BRITISH, type CheckCtx } from './kinds/common';
import { c1Item } from './schema';
import type { C1Item, C1Kind } from './types';

// Annahmeprüfung für Aufgaben, die Claude erzeugt (Lernplattform 3.0 §3.8, K-8): eine Funktion für `c1-gen@1` und den Nutzerknopf
// „Neue Aufgaben“. Strenger als `checkC1Content`: Claude schreibt keine `id` (sie wird aus dem Inhalt berechnet, geräteübergreifend gleich),
// keine Aufgabe darf zum Check, zur Kapitelprüfung oder zur Einstufung gehören, nur Arten mit formal prüfbarer Regel werden angenommen.

/** Arten, die zur Laufzeit erzeugt werden dürfen (c1-aufgaben.md §4.4): Pair, Cnet und Reg sind formal nicht prüfbar, Para erst in Stufe 2. */
export const GENERATED_KINDS: readonly C1Kind[] = ['mcc', 'ocl', 'wf', 'kwt', 'err'];

export type AcceptCtx = CheckCtx & {
  /** Schon bekannte Sätze (Normalform wie `itemKey`): feste Inhalte, gesehene, im Vorrat. */
  known?: ReadonlySet<string>;
  /** Steht das Wort im Wörterbuch oder Atlas? Nur für `mcc`-Optionen (alle vier müssen bekannt sein). */
  knownWord?: (w: string) => boolean;
};

export type AcceptResult = { ok: true; item: C1Item } | { ok: false; reason: string };

/** Der Hauptsatz einer Aufgabe in Normalform (Dubletten-Schlüssel). */
export function itemKey(item: C1Item): string {
  switch (item.kind) {
    case 'mcc':
    case 'ocl':
    case 'wf':
    case 'err':
      return legacyNorm(item.text);
    case 'kwt':
      return legacyNorm(item.lead);
    case 'pair':
      return legacyNorm(item.sa);
    case 'cnet':
      return legacyNorm(`${item.hub} ${item.slot}`);
    case 'reg':
      return legacyNorm(item.text);
    case 'para':
      return legacyNorm(item.a);
  }
}

/** Stabile Zeichenfolge eines Werts (Schlüssel sortiert). */
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

/** Inhalts-Hash (FNV-1a, 32 Bit, acht Hexziffern): die Aufgaben-ID einer Claude-Aufgabe ist `<art>-ai-<Hash>`. */
export function c1Hash(raw: Record<string, unknown>): string {
  const { id: _id, ...rest } = raw;
  void _id;
  const text = canon(rest);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const FORBIDDEN = ['probe', 'pool', 'form', 'b', 'set', 'seq'] as const;

export function acceptC1(raw: unknown, ctx: AcceptCtx = {}): AcceptResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'no_object' };
  const o = { ...(raw as Record<string, unknown>) };
  const kind = o.kind;
  if (typeof kind !== 'string' || !(GENERATED_KINDS as readonly string[]).includes(kind)) return { ok: false, reason: 'kind_not_allowed' };
  for (const f of FORBIDDEN) if (o[f] !== undefined) return { ok: false, reason: `forbidden_field:${f}` };
  o.src = 'ai';
  o.id = `${kind}-ai-${c1Hash(o)}`;
  const p = c1Item.safeParse(o);
  if (!p.success) return { ok: false, reason: `schema:${p.error.issues[0]?.path.join('.') ?? ''}` };
  const item = p.data;
  const problems = checkC1Content(item, ctx);
  if (problems.length) return { ok: false, reason: `content:${problems[0]}` };
  if (BRITISH.test(canon(o))) return { ok: false, reason: 'british' };
  if (ctx.known?.has(itemKey(item))) return { ok: false, reason: 'duplicate' };
  if (item.kind === 'mcc' && ctx.knownWord && !item.options.every((w) => ctx.knownWord?.(w.toLowerCase()))) return { ok: false, reason: 'unknown_word' };
  return { ok: true, item };
}
