import { dayKey } from '../domain/date';
import { clearInLogDay, saveBrief, saveCards, saveCheck, saveDay, saveDays, saveGrammarStates, saveInLog, saveInputDay, saveProfile, useCoach } from './store';
import { dueUp, inLogByMonth, mergeSampleInput, resetDayRec, sampleBriefs, sampleCards, sampleChecks, sampleDays, sampleGrammar, sampleInLog, testProfilePatch } from './testData';

// Aktionen der Testwerkzeuge (nur im Test-Build, siehe src/app/testBuild.ts). Alles geht über den
// Schreibpfad von store.ts: schreibt nur bei Änderung, löscht nie. Die Daten selbst sind in
// testData.ts reine Berechnung.

/** Test-Profil: Niveau B2 ohne Einstufung, Fahrplan seit 25 Tagen. */
export async function applyTestProfile(): Promise<void> {
  const now = Date.now();
  await saveProfile(testProfilePatch(dayKey(now), now, !!useCoach.getState().profile?.imported));
}

/** Beispiel-Fortschritt der letzten vier Wochen. Ohne Einstufung setzt er zuerst das Test-Profil. */
export async function applySampleProgress(): Promise<{ cards: number; days: number }> {
  const now = Date.now();
  const today = dayKey(now);
  if (!useCoach.getState().profile?.placement) await applyTestProfile();
  const cards = sampleCards(now, useCoach.getState().cards);
  await saveCards(cards);
  const days = sampleDays(today);
  await saveDays(days);
  await saveGrammarStates(sampleGrammar(now));
  for (const [month, part] of Object.entries(inLogByMonth(sampleInLog(today)))) await saveInLog(`${month}-01`, part);
  for (const [month, rec] of Object.entries(sampleChecks(today))) await saveCheck(month, rec);
  for (const [week, rec] of Object.entries(sampleBriefs(today))) await saveBrief(week, rec);
  return { cards: cards.length, days: Object.keys(days).length };
}

/** Zwei Beispiel-Beiträge (Video und Artikel) für heute. */
export async function applySampleInput(): Promise<void> {
  const today = dayKey(Date.now());
  const existing = useCoach.getState().input.find((x) => x.d === today)?.items ?? [];
  await saveInputDay(today, mergeSampleInput(existing));
}

/** Heute zurücksetzen: Tagesteile, Kern und Zähler auf null, bewerteter Input von heute zurückgenommen. */
export async function resetToday(): Promise<void> {
  const today = dayKey(Date.now());
  await saveDay(today, resetDayRec(useCoach.getState().days[today]));
  await clearInLogDay(today);
}

/** Bis zu `n` Karten jetzt fällig machen. Liefert, wie viele es wurden. */
export async function makeDueNow(n = 25): Promise<number> {
  const entries = dueUp(useCoach.getState().cards, Date.now(), n);
  await saveCards(entries);
  return entries.length;
}
