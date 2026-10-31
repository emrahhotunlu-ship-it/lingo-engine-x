// Typen zu scripts/check-css-legacy.mjs (für tests/unit/cssLegacy.test.ts).
export declare const NEU: string[];
export declare const UMGEBAUT: string[];
export declare function classesOf(file: string, seen?: Set<string>): Set<string>;
export declare function legacyClasses(root?: string): Map<string, string>;
export declare function literalWords(src: string, nested?: boolean): string[];
export type LegacyBefund = { file: string; klasse: string; aus: string };
export declare function check(opts?: { root?: string; umgebaut?: string[] }): {
  ok: boolean;
  files: number;
  legacy: number;
  befunde: LegacyBefund[];
  fehlend: string[];
};
