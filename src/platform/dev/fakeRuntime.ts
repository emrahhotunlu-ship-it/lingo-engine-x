import type { CapabilityName, ClaudeHost, DbErrCode, Downloads, Permissions } from '../types';
import { createMemoryDb, type MemoryDbHandle } from './memoryDb';
import { createFakeSample, type FakeSampleMode, type SampleFailMap } from './fakeSample';
import type { SampleErrorCode } from '../types';
import { registerCannedReplies, withCallLog, type SampleCall } from './callLog';


// Nachbildung von `window.claude` für Dev-Server und E2E-Tests (Kap. 3.3).

export type FakeOptions = {
  /** Welche Fähigkeiten `use()` liefert; fehlend = verfügbar. */
  capabilities?: Partial<Record<'db' | 'sample' | 'downloads' | 'permissions', boolean>>;
  /** Anfangsbestand der Datenbank. */
  seed?: Record<string, Record<string, unknown>>;
  /** Datenbank über Neuladen hinweg in sessionStorage halten. */
  persist?: boolean;
  latencyMs?: number;
  /** Zeit, bis `use()` antwortet (echte Viewer antworten verzögert). */
  useDelayMs?: number;
  sampleMode?: FakeSampleMode;
  /** Jedes Datenbank-Abonnement endet sofort mit diesem Code. */
  failSubscriptions?: DbErrCode;
  failSubscriptionsTimes?: number;
  /** Jeder `sample`-Aufruf wartet so lange (z. B. für den Langsam-Hinweis). */
  sampleDelayMs?: number;
  /** Phase 3: Fehler je Vorlage, z. B. `{ 'turn-analysis': 'upstream_error' }`. */
  sampleFail?: Record<string, SampleErrorCode>;
  /** Phase 5: Abstand der Streaming-Stücke in ms (Standard 15; langsam z. B. 150 für Scroll-Tests). */
  sampleTickMs?: number;
  /** Phase 5: `sample` scheitert für diese Vorlagen mit dem Code (einmal je Eintrag, dann normal). */
  sampleFailOnce?: Record<string, Claude.sample.SampleErrorCode>;
  /** Phase 6: erste Antwort von assess@1 verletzt das Schema (`?fake=assessbad`). */
  assessBad?: boolean;
  /** Phase 6: `sample()` meldet diese Stufe als `modelTierApplied` (einfacheres Modell nachbilden). */
  tierApplied?: Claude.sample.ModelTier;
};

export type FakeControl = {
  db: MemoryDbHandle;
  saved: Array<{ filename: string; size: number; data: string }>;
  setSampleMode(mode: FakeSampleMode): void;
  /** Jeder `sample`-Aufruf mit Vorlage, Stufe und Eingabe. */
  sampleCalls: SampleCall[];
  /** Gesprochene Texte der nachgebildeten Sprachausgabe (siehe install.ts). */
  spoken: string[];
  /** Phase 3: Fehler je Vorlage setzen (`null` entfernt ihn). */
  setSampleFail(templateId: string, code: SampleErrorCode | null): void;
  /** Phase 3: nachgebildete Spracheingabe „hört“ diesen Text (siehe fakeStt.ts). */
  sttSay(text: string): void;
  /** Phase 3: Wartezeit jedes `sample`-Aufrufs ändern. */
  setSampleDelay(ms: number): void;
};

const PERSIST_KEY = 'lx:fake-db';
const DL_EXT = /\.(gif|png|jpg|jpeg|webp|mp4|webm|txt|json|md|docx|pptx|epub|csv|ttf|html|svg|pdf|xlsx|zip)$/i;

function readPersisted(): Record<string, Record<string, unknown>> | null {
  try {
    const raw = window.sessionStorage.getItem(PERSIST_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Record<string, unknown>>) : null;
  } catch (err) {
    console.warn('fake runtime: persisted db unreadable', err);
    return null;
  }
}

function writePersisted(all: Record<string, Record<string, unknown>>): void {
  try {
    window.sessionStorage.setItem(PERSIST_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn('fake runtime: cannot persist db', err);
  }
}

export function createFakeClaude(opts: FakeOptions = {}): { claude: ClaudeHost; control: FakeControl } {
  const seed = (opts.persist ? readPersisted() : null) ?? opts.seed ?? {};
  const dbOpts: Parameters<typeof createMemoryDb>[0] = { seed };
  if (opts.latencyMs !== undefined) dbOpts.latencyMs = opts.latencyMs;
  if (opts.failSubscriptions) dbOpts.failSubscriptions = opts.failSubscriptions;
  if (opts.failSubscriptionsTimes !== undefined) dbOpts.failSubscriptionsTimes = opts.failSubscriptionsTimes;
  if (opts.persist) {
    // Viele Änderungen hintereinander (z. B. die Umstellung) nur einmal je Takt sichern.
    let pending: Record<string, Record<string, unknown>> | null = null;
    dbOpts.onChange = (all) => {
      if (!pending) setTimeout(() => {
        if (pending) writePersisted(pending);
        pending = null;
      }, 0);
      pending = all;
    };
  }
  const dbHandle = createMemoryDb(dbOpts);
  if (opts.persist) writePersisted(dbHandle.dump());

  let sampleMode: FakeSampleMode = opts.sampleMode ?? 'ok';
  registerCannedReplies();

  const sampleCalls: SampleCall[] = [];
  let sampleFail: SampleFailMap = { ...(opts.sampleFail ?? {}) };
  const delay = { ms: opts.sampleDelayMs ?? 0 };
  const sample = withCallLog(
    createFakeSample(
      () => sampleMode,
      () => sampleFail,
      opts.sampleTickMs ?? 15,
      opts.tierApplied,
    ),
    sampleCalls,
    () => delay.ms,
    { ...(opts.sampleFailOnce ?? {}) },
  );
  const saved: FakeControl['saved'] = [];

  const downloads: Downloads = Object.freeze({
    save(req: Claude.downloads.SaveRequest) {
      return new Promise<Claude.downloads.SaveResult>((resolve, reject) => {
        setTimeout(() => {
          if (typeof req.filename !== 'string' || !req.filename || req.filename.length > 512) {
            reject({ code: 'bad_request', message: 'bad filename' });
            return;
          }
          if (!DL_EXT.test(req.filename)) {
            reject({ code: 'rejected_extension', message: 'extension not allowed' });
            return;
          }
          const data = typeof req.data === 'string' ? req.data : '[binary]';
          if (!data) {
            reject({ code: 'bad_request', message: 'empty data' });
            return;
          }
          saved.push({ filename: req.filename, size: data.length, data });
          resolve({ status: 'saved' });
        }, 10);
      });
    },
  });

  type PermState = Claude.permissions.PermissionState;
  const granted: Record<string, PermState> = { db: 'granted', sample: 'granted', downloads: 'granted' };
  const permissions: Permissions = Object.freeze({
    state: ((name?: string) => Promise.resolve(name === undefined ? granted : (granted[name] ?? 'unavailable'))) as Permissions['state'],
    request: () => Promise.resolve(granted),
  });

  const namespaces: Record<string, unknown> = { db: dbHandle.db, sample, downloads, permissions };
  const memo = new Map<string, Promise<unknown>>();
  const enabled = (name: string) =>
    name in namespaces && (opts.capabilities?.[name as keyof NonNullable<FakeOptions['capabilities']>] ?? true);

  const claude = Object.freeze({
    use(name: CapabilityName) {
      if (!enabled(name)) return Promise.resolve(null);
      let p = memo.get(name);
      if (!p) {
        p = new Promise((resolve) => setTimeout(() => resolve(namespaces[name]), opts.useDelayMs ?? 30));
        memo.set(name, p);
      }
      return p;
    },
  }) as ClaudeHost;

  return {
    claude,
    control: {
      db: dbHandle,
      saved,
      sampleCalls,
      spoken: [],
      setSampleMode: (m) => {
        sampleMode = m;
      },
      setSampleFail: (id, code) => {
        const next: Record<string, SampleErrorCode> = { ...sampleFail };
        if (code) next[id] = code;
        else delete next[id];
        sampleFail = next;
      },
      sttSay: () => undefined,
      setSampleDelay: (ms) => {
        delay.ms = ms;
      },
    },
  };
}
