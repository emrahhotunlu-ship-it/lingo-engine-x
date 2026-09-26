// Kopplung von Abbruchsignalen ohne `AbortSignal.any` (fehlt in Safari 16, Architektur-Entwurf §10.2).

/** Bricht `child` ab, sobald `parent` abbricht. Liefert eine Funktion, die die Kopplung löst. */
export function linkAbort(parent: AbortSignal, child: AbortController): () => void {
  if (parent.aborted) {
    child.abort(parent.reason);
    return () => undefined;
  }
  const onAbort = () => child.abort(parent.reason);
  parent.addEventListener('abort', onAbort, { once: true });
  const unlink = () => parent.removeEventListener('abort', onAbort);
  child.signal.addEventListener('abort', unlink, { once: true });
  return unlink;
}
