import { useSettings } from '../../app/settings';
import { getWriter } from '../../data';
import { useLive } from '../../data/live';
import { loadSnapshot } from '../../data/snapshot';
import { translate } from '../../i18n';
import { catchUpDone, loadAutoSwitch, prepareDay, registerCatchUp, startCatchUpOnce, vocabModuleOn } from '../../modules/vocab/api';
import { useClock } from '../../app/clock';
import { loadWordsDay } from '../today/wordsDay';
import { getDb, useCapabilities } from '../../platform/capabilities';
import { logError, logWarn } from '../../platform/diagnostics';
import { dismissToast, toast } from '../../ui/Toast';
import { useNav } from '../../app/nav';

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
      watchFresh();
      // ux-reviewer 05.11.2026 Nr. 20: der Hinweis gilt dem Bildschirm, auf dem er erscheint – beim nächsten Bildschirm verschwindet er
      // (sonst lag er bis zu 5 s über Überzeile und Filtern der nächsten Seite).
      const id = toast(translate(useSettings.getState().lang, 'vmSwOnState'));
      if (id !== null) {
        const at = useNav.getState().route;
        const off = useNav.subscribe((s) => {
          if (s.route === at) return;
          dismissToast(id);
          off();
        });
      }
      // ux-reviewer 05.11.2026 Nr. 14: Heute wurde vor dem Einschalten mit dem alten Wörter-Bereich gerechnet. Den Wörter-Plan jetzt einfrieren
      // und lesen, damit Heute sofort dieselbe Wortzahl nennt wie die Runde (vorher fehlte die Zeile „0 von n erledigt“ bis zum nächsten Start).
      if (getDb()) {
        const min = await prepareDay(() => {
          const c = useCapabilities.getState();
          return c.sample !== 'absent' && !c.sampleRevoked;
        });
        if (min) await loadWordsDay(useClock.getState().today);
      }
      return;
    }
    if (r.state !== 'skipped') logWarn('vocab:switch', { message: `Automatisch nicht eingeschaltet: ${r.state}` }, r.why ?? '');
  } catch (err) {
    logError('vocab:switch', err, 'Automatisch einschalten');
  }
}

/** Wörter-App schon an: Antworten aus dem alten Bereich nachholen (einmal je App-Start, Emrah 04.11.2026). */
function moduleOn(): boolean {
  const s = useLive.getState();
  return s.status === 'ready' && vocabModuleOn(s.docs['app/profile']) && !s.invalid['app/profile'];
}

async function runCatchUp(): Promise<unknown> {
  const writer = getWriter();
  if (!writer) return null;
  try {
    const sw = await loadAutoSwitch();
    return await sw.startCatchUp(writer, read, Date.now());
  } catch (err) {
    logError('vocab:catchup', err, 'Start');
    return null;
  }
}

function catchUp(): void {
  if (!getWriter()) return;
  void startCatchUpOnce(runCatchUp);
  void catchUpDone().then(watchFresh);
}

// Neue Karten sofort übernehmen (Emrah 06.11.2026): legt ein anderer Bereich eine Karte ohne Lexem an (Lehrer-Feedback, „Merken“ …), bekommt
// sie ihr Lexem gleich, nicht erst beim nächsten Start. Je Pfad höchstens ein Versuch je App-Start (keine Schleife); kurz gebündelt, weil
// „Alle übernehmen“ viele Karten nacheinander schreibt.
type Doc = Record<string, unknown>;
const ADOPT_WAIT_MS = 800;
const tried = new Set<string>();
let watching = false;

function watchFresh(): void {
  if (watching) return;
  watching = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let seen: unknown[] = [];
  const kick = () => {
    const s = useLive.getState();
    const now = [s.collections.vocab, s.collections.chunk, s.docs['app/schema']];
    if (now.every((x, i) => x === seen[i])) return;
    seen = now;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void adopt();
    }, ADOPT_WAIT_MS);
  };
  useLive.subscribe(kick);
  kick();
}

async function adopt(): Promise<void> {
  const writer = getWriter();
  if (!writer || !moduleOn()) return;
  const s = useLive.getState();
  const docs = new Map<string, Doc>();
  for (const kind of ['vocab', 'chunk'] as const) for (const [id, doc] of s.collections[kind] ?? []) docs.set(`${kind}/${id}`, doc);
  try {
    const sw = await loadAutoSwitch();
    const todo = new Map<string, Doc>();
    for (const path of sw.freshCandidates(docs, s.docs['app/schema'], Date.now())) {
      if (tried.has(path)) continue;
      tried.add(path);
      const doc = docs.get(path);
      if (doc) todo.set(path, doc);
    }
    if (todo.size) await sw.adoptFresh(writer, todo, Date.now());
  } catch (err) {
    logError('vocab:adopt', err, 'Neue Karten');
  }
}

/** Beim Start des Bereichs Wörter einhängen (`boot`). Läuft höchstens einmal je App-Start. */
export function installAutoSwitch(): void {
  if (started) return;
  // Startet eine Wörter-Runde vor dem ersten Abgleich, stößt sie das Nachholen selbst an (`catchUpDone`).
  registerCatchUp(runCatchUp);
  const check = () => {
    if (started) return;
    if (moduleOn()) {
      started = true;
      unsub();
      catchUp();
      return;
    }
    if (!undecided()) return;
    started = true;
    unsub();
    void run();
  };
  const unsub = useLive.subscribe(check);
  check();
}
