import { reportBridgeUse, saveFreeUse, saveOutItem, saveRepairs, useLive, type BridgeUseResult } from '../sharedUi';
import { logError } from '../shared';
import { bridgeOutItem, bridgeRepair, countsFreeUse, flowbackOn, reportsWord, type BridgeRun } from '../domain/bridgeResult';

// Schreibwege eines geprüften Brücken-Satzes (P4). Aufgerufen genau einmal je Prüfung, auf eine Handlung hin (nie aus Render oder Timer).
// Reihenfolge: Ergebnis zuerst (`out/<Monat>`), dann der Fehlersatz (`app/repair`), dann der Rückfluss – ein Absturz dazwischen verliert nur die
// späteren Teile. Jeder Teil läuft über den einen Schreibpfad (`writer.transform` auf dem frischen Stand, nur bei Änderung, nie in ein ungültiges
// Dokument) und ist für sich idempotent:
//  - Ergebnis über die Kennung (Art + Zeit der Prüfung),
//  - Fehlersatz über den Satz selbst (`repairId`),
//  - Wort-Beleg über die Zeit der Prüfung (`sync ≥ t`) und „höchstens ein eigener Satz je Wort und Lerntag“ (Wörter-App, `writeBridgeUse`),
//  - Muster-Beleg über den Lerntag (`fu[muster].d`); nie, wenn der vorgeschlagene Satzanfang übernommen wurde (`starterUsed`, das Muster stand
//    dann schon im vorgegebenen Teil).
// Der Rückfluss ist abschaltbar (`app/profile.acfg.rf = 0`); Ergebnis und Fehlersatz bleiben dann.

export type BridgeSaved = {
  out: boolean;
  /** Ein Fehlersatz wurde gespeichert (kommt ab morgen in „Fehler korrigieren“). */
  repair: boolean;
  /** Buchung in der Wörter-App (`null` = nichts gebucht: kein Lexem, Wörter-App aus, Rückfluss aus, schon gebucht). */
  word: BridgeUseResult | null;
  /** Das Muster wurde heute als „frei verwendet“ gezählt. */
  pat: boolean;
};

export async function saveBridge(run: BridgeRun, ctx: string | null, o: { starterUsed?: boolean } = {}): Promise<BridgeSaved> {
  const out = await saveOutItem(bridgeOutItem(run));
  const rep = bridgeRepair(run, ctx);
  const repair = rep ? await saveRepairs([rep]) : false;
  let word: BridgeUseResult | null = null;
  let pat = false;
  if (flowbackOn(useLive.getState().docs['app/profile'])) {
    const w = run.target.word;
    const j = run.out.word;
    if (w.path && reportsWord(j)) {
      try {
        word = await reportBridgeUse({ path: w.path, t: run.now, v: j.v, err: j.err, at: j.at, evade: j.v === 'unused' && !!j.at.trim(), sentence: run.sentence, ms: run.ms });
      } catch (err) {
        logError('apply:bridge-word', err, w.path);
      }
    }
    if (countsFreeUse(run.out, o)) pat = await saveFreeUse(run.target.topic, run.target.pat, run.day);
  }
  return { out, repair, word, pat };
}
