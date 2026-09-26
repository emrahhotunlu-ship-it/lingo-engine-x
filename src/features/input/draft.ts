import { KEY_PREFIX, local } from '../../platform/storage';

// Entwürfe im Browser-Speicher (Kap. 3.1: nur Bequemlichkeit, Plan §4.3): `lx:draft:<bereich>:<id>`.
// Jeder Zugriff ist abgesichert (storage.ts); ohne Speicher geht nur der Entwurf verloren.

const key = (scope: string) => `${KEY_PREFIX}draft:${scope}`;

export function loadDraft(scope: string): string {
  return local.get(key(scope)) ?? '';
}

export function saveDraft(scope: string, text: string): void {
  if (text.trim()) local.set(key(scope), text);
  else local.remove(key(scope));
}

export function clearDraft(scope: string): void {
  local.remove(key(scope));
}
