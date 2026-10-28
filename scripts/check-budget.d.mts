export type Piece = { file: string; gz: number };
export type Measurement = { entry: number; entryFiles: string[]; css: number; html: number; lazy: Record<string, Piece>; bin: Record<string, Piece>; files: number; total: number };
export type SizeSpec = { basis: number; zuwachs?: Record<string, number | { bytes: number; freigabe: string }> };
export type Budget = {
  grenzen: { entry: SizeSpec; css: SizeSpec; html: SizeSpec; lazy?: Record<string, SizeSpec>; lazyNeu?: number; bin?: number; files?: number };
  vorab?: Record<string, Record<string, number>>;
  [k: string]: unknown;
};
export const MANIFEST: string;
export function gz(buf: Uint8Array): number;
export function measure(dir: string): Measurement;
export function evaluate(m: Measurement, budget: Budget): { problems: string[]; notes: string[]; rows: Array<{ name: string; gz: number; limit: number; ok: boolean }> };
export function loadBudget(path?: string): Budget;
export const FREIGABE: RegExp;
