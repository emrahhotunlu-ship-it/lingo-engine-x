import { clip } from '../../prompts/common';
import { workContext } from '../../prompts/work';

// Berufsprofil-Zeile für Tutor-Vorlagen (Lernplattform 3.0 P25, KT §3.1): höchstens 300 Zeichen. Quelle ist `app/profile.ctx2`
// (`{v: 1, role, field, who[], sit[], terms[], t}`, T4/P46), sonst der Berufskontext `app/profile.ctx` bzw. der Standardtext (`workContext`).
// Rein, nichts wird gespeichert.

export const TUTOR_CTX_MAX = 300;

type Doc = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const text = (v: unknown, max: number): string => (typeof v === 'string' ? clip(v, max) : '');
const list = (v: unknown, n: number, max: number): string[] => (Array.isArray(v) ? v.map((x) => text(x, max)).filter(Boolean).slice(0, n) : []);

/** Eine Zeile (≤ 300 Zeichen) über Rolle, Branche, Gesprächspartner, Situationen und Fachwörter des Lernenden. */
export function tutorCtx(profile: Doc | null | undefined): string {
  const p = obj(profile);
  const c = obj(p.ctx2);
  const role = text(c.role, 60);
  const field = text(c.field, 60);
  const parts: string[] = [];
  if (role || field) parts.push([role, field && `in ${field}`].filter(Boolean).join(' '));
  const who = list(c.who, 3, 30);
  if (who.length) parts.push(`talks to ${who.join(', ')}`);
  const sit = list(c.sit, 3, 40);
  if (sit.length) parts.push(`typical situations: ${sit.join('; ')}`);
  const terms = list(c.terms, 6, 24);
  if (terms.length) parts.push(`key terms: ${terms.join(', ')}`);
  const line = parts.join('. ');
  return clip(line || workContext(p.ctx), TUTOR_CTX_MAX);
}
