import type { MessageKey } from '../../i18n';

// Diagnose-Protokoll in der Oberflächensprache: Die App schreibt ihre eigenen Meldungen als
// feste deutsche Sätze ins Protokoll (auch alte, gespeicherte Einträge). Angezeigt wird der Text
// aus i18n; unbekannte Meldungen (z. B. Fehlertexte der Plattform) bleiben unverändert.

type Rule = { re: RegExp; key: MessageKey; vars?: (m: RegExpExecArray) => Record<string, string> };

const RULES: readonly Rule[] = [
  { re: /^Protokoll konnte nicht lokal gesichert werden$/, key: 'diagMsg_persist' },
  { re: /^Radar nicht gespeichert – bleibt in der Warteschlange$/, key: 'diagMsg_radarPending' },
  { re: /^Fehler-Radar noch nicht gespeichert – wird nachgeholt$/, key: 'diagMsg_radarLater' },
  { re: /^Gesprächslauf nicht geschrieben$/, key: 'diagMsg_talkUnchanged' },
  { re: /^Pool gerade belegt – Aufgaben nur in dieser Runde$/, key: 'diagMsg_poolBusy' },
  { re: /^Pool ungültig – nicht überschrieben$/, key: 'diagMsg_poolInvalid' },
  { re: /^Kursstand ungültig – Abschluss nicht geschrieben$/, key: 'diagMsg_courseInvalid' },
  { re: /^Profil ungültig – Zähler nicht geschrieben$/, key: 'diagMsg_profileCounters' },
  { re: /^Profil ungültig – Tagesplan nur lokal$/, key: 'diagMsg_planLocal' },
  { re: /^Tagesprotokoll ungültig – nicht überschrieben$/, key: 'diagMsg_logInvalid' },
  { re: /^Sperre konnte nicht verlängert werden$/, key: 'diagMsg_leaseLost' },
  { re: /^Karte nicht gespeichert$/, key: 'diagMsg_cardNotSaved' },
  { re: /^Lektionsinhalt ungültig – Grundfassung$/, key: 'diagMsg_lessonInvalid' },
  { re: /^Kein Schreibzugriff$/, key: 'diagMsg_noWriter' },
  { re: /^Pflicht prüfen$/, key: 'diagMsg_checkDuty' },
  { re: /^ausgelagert: (.+)$/, key: 'diagMsg_compacted', vars: (m) => ({ years: m[1] ?? '' }) },
  { re: /^(\d+) Kopien aus diesem Browser ergänzt$/, key: 'diagMsg_rescueDone', vars: (m) => ({ n: m[1] ?? '' }) },
  { re: /^(\d+) nicht übernommene Kopien zur Kenntnis genommen$/, key: 'diagMsg_rescueAck', vars: (m) => ({ n: m[1] ?? '' }) },
  { re: /^Datenversion (\d+)$/, key: 'diagMsg_migrationDone', vars: (m) => ({ v: m[1] ?? '' }) },
  { re: /^(\d+) Aufgaben nur in dieser Runde$/, key: 'diagMsg_roundOnly', vars: (m) => ({ n: m[1] ?? '' }) },
  { re: /^(\d+) Schreibschritte$/, key: 'diagMsg_writes', vars: (m) => ({ n: m[1] ?? '' }) },
];

/** Meldung bzw. Zusatz eines Protokolleintrags in der Oberflächensprache. */
export function diagText(text: string, t: (k: MessageKey, v?: Record<string, string>) => string): string {
  for (const r of RULES) {
    const m = r.re.exec(text);
    if (m) return t(r.key, r.vars?.(m));
  }
  return text;
}
