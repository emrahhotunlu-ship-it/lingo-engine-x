import { useSettings } from '../../app/settings';
import { getWriter } from '../../data';
import { useLive } from '../../data/live';
import { loadSnapshot } from '../../data/snapshot';
import { translate } from '../../i18n';
import { loadAutoSwitch } from '../../modules/vocab/api';
import { getDb } from '../../platform/capabilities';
import { logError, logWarn } from '../../platform/diagnostics';
import { toast } from '../../ui/Toast';

// Neue Wörter-App von selbst an (Emrah 02.11.2026: „warum muss ich da noch manuell was machen“). Einmal je App-Start: sobald die Live-Daten
// stehen und `app/profile` kein `vcfg` hat (Modul nie entschieden), lädt die Teil-Datei `modules/vocab/ui/switch` nach und übernimmt die
// Wörter mit denselben Wächtern wie von Hand (`autoEnable`). Ein vorhandenes `vcfg` (auch der Rückweg `mod = 0`) bleibt unangetastet.
// Kein Wiederholen in einer Schleife: scheitert es, bleibt die alte Ansicht bis zum nächsten Start, der Grund steht in der Diagnose.

let started = false;

const read = async () => {
  const db = getDb();
  if (!db) throw new Error('db unavailable');
  return loadSnapshot(db);
};

function undecided(): boolean {
  const s = useLive.getState();
  if (s.status !== 'ready') return false;
  const p = s.docs['app/profile'];
  return !!p && typeof p === 'object' && (p.vcfg === undefined || p.vcfg === null) && !s.invalid['app/profile'];
}

async function run(): Promise<void> {
  const writer = getWriter();
  if (!writer) return;
  try {
    const sw = await loadAutoSwitch();
    const r = await sw.autoEnable(writer, read, Date.now());
    if (r.state === 'done' || r.state === 'already') {
      toast(translate(useSettings.getState().lang, 'vmSwOnState'));
      return;
    }
    if (r.state !== 'skipped') logWarn('vocab:switch', { message: `Automatisch nicht eingeschaltet: ${r.state}` }, r.why ?? '');
  } catch (err) {
    logError('vocab:switch', err, 'Automatisch einschalten');
  }
}

/** Beim Start des Bereichs Wörter einhängen (`boot`). Läuft höchstens einmal je App-Start. */
export function installAutoSwitch(): void {
  if (started) return;
  const check = () => {
    if (started || !undecided()) return;
    started = true;
    unsub();
    void run();
  };
  const unsub = useLive.subscribe(check);
  check();
}
