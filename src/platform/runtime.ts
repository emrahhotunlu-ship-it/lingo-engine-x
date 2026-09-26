import type { CapabilityName, ClaudeHost } from './types';
import { logError } from './diagnostics';

// Der einzige Ort, der `claude.use` aufruft (Kap. 3.3). `use()` kann `null` liefern:
// außerhalb eines Claude-Viewers gibt es `window.claude` gar nicht, im Viewer kommt der
// Namensraum später über das Promise (contract/claude.d.ts). Die App rendert sofort
// und schaltet Funktionen zu, sobald die Fähigkeit bereitsteht.

const cache = new Map<CapabilityName, Promise<unknown>>();

function host(): ClaudeHost | null {
  if (typeof window === 'undefined') return null;
  const candidate = (window as { claude?: unknown }).claude;
  if (candidate && typeof candidate === 'object' && typeof (candidate as { use?: unknown }).use === 'function') {
    return candidate as ClaudeHost;
  }
  return null;
}

async function resolve<K extends CapabilityName>(name: K): Promise<ClaudeCapabilityMap[K] | null> {
  const h = host();
  if (!h) return null;
  try {
    const ns = await h.use(name);
    return ns ?? null;
  } catch (err) {
    logError('platform:use', err, name);
    return null;
  }
}

/** Liefert den Namensraum einer Fähigkeit oder `null` (Fähigkeit hier nicht nutzbar). */
export function capability<K extends CapabilityName>(name: K): Promise<ClaudeCapabilityMap[K] | null> {
  let p = cache.get(name);
  if (!p) {
    p = resolve(name);
    cache.set(name, p);
  }
  return p as Promise<ClaudeCapabilityMap[K] | null>;
}

/** Nur für Tests: Zwischenspeicher leeren. */
export function resetCapabilityCache(): void {
  cache.clear();
}
