export const ROOT: string;
export function readJson(p: string): unknown;
export function legacyNorm(s: unknown): string;
export function legacyTaskKey(prompt: string): string;
export function allSeedTasks(): Array<Record<string, unknown> & { topic: string; prompt: string; type: string; answer: string; key: string; origin: string }>;
