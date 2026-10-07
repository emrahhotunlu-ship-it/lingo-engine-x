// Testantworten Lernplattform 3.0, Paket P26 (docs/umbau/lernplattform-3.md §10.0). Besitzer: nur dieses Paket.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../../fakeSample';
import { explainAnswerReply } from '../lp2/p2';

const line = (input: string, label: string): string => new RegExp(`^${label}: (.*)$`, 'm').exec(input)?.[1]?.trim() ?? '';

/** Marker in der Antwort des Lernenden steuern die Testantwort (wie `zzjson` bei `grammar-judge`). */
const NOT_JSON = 'Hier ist die Erklärung, aber leider ohne das verlangte Format.';

/** Erste Folge von Buchstaben (ab 4) aus dem Satz, die auch im Satz steht: ein Signalwort für `signal`. */
function signalFrom(task: string): string {
  return /[A-Za-z]{4,}/.exec(task.replace(/_{3,}/g, ' '))?.[0] ?? '';
}

/**
 * Feste, realistische Antwort für `explain-answer@2`. Ein Marker in der Antwort des Lernenden wählt einen Fehlerfall:
 * `zzjson` → kein JSON, `zzschema` → beim ersten Aufruf ungültige Form (der Neuversuch mit angehängtem Mangel ist gültig),
 * `zzalso` → `alsoRight`, `zzbrit` → britisches Beispiel (fällt weg), `zzsignal` → Signalwort, das nicht im Satz steht (fällt weg).
 */
export function explainAnswerV2Reply(input: string): string {
  if (input.startsWith('[explain-answer@1]')) return explainAnswerReply(input);
  const given = line(input, 'Learner answer');
  const task = line(input, 'Task');
  // Marker steuern die Antwort: im Text der Antwort oder (für Tests mit Auswahlaufgaben) über `__LINGO_FAKE__.explainMode`.
  const mode = (globalThis as { __LINGO_FAKE__?: { explainMode?: string } }).__LINGO_FAKE__?.explainMode ?? '';
  const flags = `${given} ${mode}`;
  if (/zzjson/i.test(flags)) return NOT_JSON;
  if (/zzschema/i.test(flags) && !input.includes('did not match the required format')) return JSON.stringify({ why: 'kaputt' });
  const neighbor = /^Easily confused patterns \(id: name\): ([a-z0-9.-]+):/m.exec(input)?.[1] ?? null;
  const shown = given.replace(/zz[a-z]+/gi, '').trim() || 'deine Form';
  const signal = /zzsignal/i.test(flags) ? 'nonexistentword' : signalFrom(task);
  return JSON.stringify({
    yours: {
      de: `„${shown}“ passt hier nicht: Die Form drückt etwas anderes aus als der Satz verlangt.`,
      en: `“${shown}” does not fit here: that form expresses something other than the sentence calls for.`,
    },
    why: {
      de: 'Das Signalwort im Satz verlangt die andere Form, weil es um etwas Vergangenes geht.',
      en: 'The signal word in the sentence calls for the other form, because it refers to something in the past.',
    },
    signal: signal ? [signal] : [],
    confused: neighbor,
    alsoRight: /zzalso/i.test(flags),
    example: /zzbrit/i.test(flags)
      ? { en: 'The company organised the new archive module after the audit in March.', de: 'Die Firma organisierte das neue Archivmodul nach dem Audit im März.' }
      : { en: 'The team will launch the new archive module after the audit in March.', de: 'Das Team führt das neue Archivmodul nach dem Audit im März ein.' },
  });
}

/** Meldet die Testantworten von P26 an (nach P2, denn die Kennung `explain-answer` ist dieselbe). */
export function registerLp3P26Replies(): void {
  registerCannedReply('explain-answer', explainAnswerV2Reply);
}
