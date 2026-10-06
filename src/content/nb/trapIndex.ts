// Fallen-Index (Lernplattform 2.0, §3.7): zu jeder Deutsch-Falle aus `traps.ts` die englischen Wörter, bei denen sie
// zuschlägt (`en`, kleingeschrieben, Grundform bzw. Wendung), und die deutschen Wörter, aus denen der Fehler entsteht
// (`de`). Daraus findet `domain/srs/traps.ts`, ob eine Karte oder eine Antwort an eine Falle rührt. Nur Daten.
// Kennungen wie in `traps.ts` (f01 …); jede Falle hat mindestens ein englisches Wort.

export type TrapIndexEntry = { en: readonly string[]; de: readonly string[] };

export const TRAP_INDEX: Readonly<Record<string, TrapIndexEntry>> = {
  f01: { en: ['actual', 'actually'], de: ['aktuell'] },
  f02: { en: ['eventually'], de: ['eventuell'] },
  f03: { en: ['become'], de: ['bekommen'] },
  f04: { en: ['provision', 'commission'], de: ['Provision'] },
  f05: { en: ['prospect', 'brochure'], de: ['Prospekt'] },
  f06: { en: ['opportunity', 'chance'], de: ['Chance'] },
  f07: { en: ['serious', 'reputable'], de: ['seriös'] },
  f08: { en: ['sympathetic', 'likable'], de: ['sympathisch'] },
  f09: { en: ['billion', 'decimal'], de: ['Milliarde', 'Komma'] },
  f10: { en: ['appointment', 'deadline'], de: ['Termin'] },
  f11: { en: ['until', 'by the end of'], de: ['bis'] },
  f12: { en: ['since'], de: ['seit'] },
  f13: { en: ['security', 'safety', 'certainty'], de: ['Sicherheit'] },
  f14: { en: ['information', 'advice', 'equipment', 'feedback', 'knowledge', 'software', 'evidence', 'luggage'], de: ['Informationen', 'Ratschläge'] },
  f15: { en: ['discuss'], de: ['diskutieren über'] },
  f16: { en: ['explain'], de: ['erklären'] },
  f17: { en: ['look forward to'], de: ['sich freuen auf'] },
  f18: { en: ['interested in', 'depend on'], de: ['interessiert an', 'abhängen von'] },
  f19: { en: ['give a discount', 'take a photo', 'do business'], de: ['Rabatt machen', 'Foto machen', 'Geschäfte machen'] },
  f20: { en: ['indirect question', 'word order'], de: ['Wortstellung'] },
  f21: { en: ['hold a meeting', 'have a meeting'], de: ['ein Meeting machen'] },
  f22: { en: ['ago', 'last week'], de: ['letzte Woche'] },
  f23: { en: ['prescription', 'deposit'], de: ['Rezept', 'Kaution'] },
  f24: { en: ['nice to meet you', 'nice to see you'], de: ['schön, dich zu sehen'] },
  f25: { en: ['not possible', 'you must', 'that is wrong'], de: ['das geht nicht', 'Sie müssen'] },
};
