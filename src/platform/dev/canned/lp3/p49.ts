// Testantworten Lernplattform 3.0, Paket P49 (Wochen-Diagnose `diagnose@1`). Besitzer: nur dieses Paket.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../../fakeSample';

const NOT_JSON = 'Hier ist meine Einschätzung, aber leider ohne das verlangte Format.';

/**
 * Feste Antwort für `diagnose@1`: liest die erlaubten Aktionen und die Belegzeilen aus dem Prompt und zitiert nur sie.
 * `__LINGO_FAKE__.diagnoseMode` steuert Fehlerfälle: `zzjson` → kein JSON, `zzschema` → beim ersten Aufruf ungültige Form (der Neuversuch
 * mit angehängtem Mangel ist gültig), `zzinvent` → der erste Befund zitiert zusätzlich eine erfundene Kennung (sie fällt weg, der Befund bleibt),
 * `zzonlyinvent` → alle Befunde zitieren nur Erfundenes (Schemaverletzung, auch der Neuversuch).
 */
export function diagnoseReply(input: string): string {
  const mode = (globalThis as { __LINGO_FAKE__?: { diagnoseMode?: string } }).__LINGO_FAKE__?.diagnoseMode ?? '';
  if (/zzjson/i.test(mode)) return NOT_JSON;
  if (/zzschema/i.test(mode) && !input.includes('did not match the required format')) return JSON.stringify({ headline: 'kaputt' });
  const de = /in German\./.test(input);
  const allowed = (/^Allowed actions: (.*)$/m.exec(input)?.[1] ?? '').split(',').map((s) => s.trim()).filter((s) => s && s !== '-');
  const ids = [...input.matchAll(/^\[([a-z0-9:.|>-]+)\] /gm)].map((m) => m[1] ?? '');
  const contrast = allowed.filter((a) => a.startsWith('contrast:'));
  const pattern = allowed.filter((a) => a.startsWith('pattern:'));
  const act = (k: number): string => contrast[k] ?? pattern[k] ?? allowed[k] ?? allowed[0] ?? 'pattern:x';
  const evOf = (k: number): string => ids[k] ?? ids[0] ?? 'p:x';
  const invent = /zzinvent/i.test(mode);
  const onlyInvent = /zzonlyinvent/i.test(mode);
  const first = {
    title: de ? 'Zwei Formen vertauscht' : 'Two forms mixed up',
    why: de ? 'Du nimmst oft die Form, die zur Gegenwart passt, wo der Satz etwas Früheres meint. Achte auf das Signalwort.' : 'You often use the form for the present where the sentence refers to something earlier. Look at the signal word.',
    rule: de ? 'Frage dich: Geht es um jetzt oder um früher?' : 'Ask yourself: is it about now or about earlier?',
    ev: onlyInvent ? ['p:invented.one'] : invent ? [evOf(0), 'p:invented.one'] : [evOf(0)],
    action: act(0),
  };
  const second = {
    title: de ? 'Verwandtes Muster' : 'Related pattern',
    why: de ? 'Auch hier hilft die Frage nach dem Zeitbezug, bevor du die Form wählst.' : 'Here, too, asking about the time reference helps before you choose the form.',
    rule: de ? 'Erst den Zeitbezug klären, dann die Form.' : 'Clarify the time reference first, then the form.',
    ev: onlyInvent ? ['p:invented.two'] : [evOf(1)],
    action: act(1),
  };
  return JSON.stringify({
    headline: de ? 'Du verwechselst vor allem Formen mit ähnlichem Zeitbezug.' : 'You mostly mix up forms with a similar time reference.',
    findings: onlyInvent ? [first, second] : [first, ...(contrast.length + pattern.length > 1 ? [second] : [])],
    better: null,
    next: de ? 'Übe diese Woche eine Kontrast-Runde zum ersten Befund.' : 'Do a contrast round on the first finding this week.',
  });
}

/** Meldet die Testantworten von P49 an. */
export function registerLp3P49Replies(): void {
  registerCannedReply('diagnose', diagnoseReply);
}
