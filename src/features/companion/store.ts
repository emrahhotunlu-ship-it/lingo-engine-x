import { create } from 'zustand';
import { askText } from '../../ai/stream';
import { isAiFailure, type AiErrorKind, type AiMessageKey, type AiPhase } from '../../ai/types';
import { useSettings } from '../../app/settings';
import { useLive } from '../../data/live';
import { learnerBrief } from '../../domain/companion/brief';
import { activeMsgs, readChat, replyLang, type ChatMsg } from '../../domain/companion/chatDoc';
import { dayKey } from '../../domain/date';
import { companionChat, type Attach } from '../../prompts/companionChat';
import { workContext } from '../../prompts/work';
import { logWarn } from '../../platform/diagnostics';
import { KEY_PREFIX, local } from '../../platform/storage';
import { saveChatMsgs, saveChatSince, type SaveOutcome } from './persistChat';
import { currentSeeing } from './seeing';

// Zustand des Claude-Begleiters (Phase 5 §3.3/§3.4). Der laufende Aufruf lebt HIER und nicht in
// einem Bildschirm: Schließen des Overlays bricht die Antwort nicht ab, sie wird fertig
// geschrieben und gespeichert (E5-06). Abbrechen nur mit „Stopp". Jeder Aufruf geht auf eine
// ausdrückliche Handlung zurück (Senden, Vorschlag, „Claude fragen"); nie automatisch wiederholt.

export type { Attach };
export type CompanionTab = 'chat' | 'translate';
export type Tier = 'quick' | 'default';
export type TurnStatus = 'idle' | 'queued' | 'thinking' | 'streaming' | 'slow' | 'error';

export type TurnState = {
  status: TurnStatus;
  /** Bisher geschriebener Text (Streaming) bzw. Teiltext nach `upstream_error`. */
  text: string;
  errorKey: AiMessageKey | null;
  errorKind: AiErrorKind | null;
  /** Die Nutzernachricht dieses Zugs – für „Erneut senden". */
  userMsg: ChatMsg | null;
};

/** Lokale Anzeige-Zusätze je Nachricht (nicht gespeichert). */
export type MsgNote = { truncated?: boolean };

type State = {
  open: boolean;
  tab: CompanionTab;
  attach: Attach | null;
  /** Aus `app/chat` (live, solange offen). */
  dbMsgs: ChatMsg[];
  since: number;
  docOk: boolean;
  loaded: boolean;
  /** Gesendet bzw. beantwortet, aber noch nicht in `app/chat` gesehen. */
  pending: ChatMsg[];
  notes: Record<string, MsgNote>;
  turn: TurnState;
  saveState: SaveOutcome | 'ok';
  tier: Tier;
  openedAt: number;
  openMsTotal: number;
  lastOpenAt: number;
  /** Zähler für „Antwort fertig" (aria-live). */
  finished: number;
  /** Zähler je eigener Nachricht (alle Wege: Eingabe, Vorschlag, „Claude fragen"): Verlauf ans Ende. */
  sentSeq: number;
  /** Eingabe, die geöffnet werden soll (Übersetzer vorbefüllen, gestoppte Nachricht zurück). */
  prefill: { tab: CompanionTab; text: string; seq: number } | null;
};

const TIER_KEY = `${KEY_PREFIX}companion-tier`;
const TAB_KEY = `${KEY_PREFIX}companion-tab`;
const idleTurn: TurnState = { status: 'idle', text: '', errorKey: null, errorKind: null, userMsg: null };

const readTier = (): Tier => (local.get(TIER_KEY) === 'quick' ? 'quick' : 'default');
const readTab = (): CompanionTab => (local.get(TAB_KEY) === 'translate' ? 'translate' : 'chat');

export const useCompanion = create<State>(() => ({
  open: false,
  tab: 'chat',
  attach: null,
  dbMsgs: [],
  since: 0,
  docOk: true,
  loaded: false,
  pending: [],
  notes: {},
  turn: idleTurn,
  saveState: 'ok',
  tier: 'default',
  openedAt: 0,
  openMsTotal: 0,
  lastOpenAt: -1,
  finished: 0,
  sentSeq: 0,
  prefill: null,
}));

export const msgKey = (m: ChatMsg): string => `${m.role}|${m.t ?? m.content.slice(0, 40)}`;

let lastT = 0;
/** Zeitstempel je Nachricht, streng steigend (feste Kennung für doppelte Schreibvorgänge). */
function nextT(): number {
  lastT = Math.max(Date.now(), lastT + 1);
  return lastT;
}

let ctl: AbortController | null = null;
let prefillSeq = 0;
let lastAttach: Attach | null = null;

// ------------------------------------------------------------------ Öffnen und Schließen

export function openCompanion(o: { tab?: CompanionTab; attach?: Attach; send?: string; text?: string } = {}): void {
  const s = useCompanion.getState();
  const now = performance.now();
  const tab = o.tab ?? (o.attach || o.send ? 'chat' : readTab());
  const patch: Partial<State> = { tab, tier: readTier() };
  if (!s.open) Object.assign(patch, { open: true, openedAt: now, lastOpenAt: now });
  if (o.attach) patch.attach = o.attach;
  if (o.text !== undefined) patch.prefill = { tab, text: o.text, seq: ++prefillSeq };
  useCompanion.setState(patch);
  if (o.send) void sendMessage(o.send);
}

export function closeCompanion(): void {
  const s = useCompanion.getState();
  if (!s.open) return;
  useCompanion.setState({ open: false, openMsTotal: s.openMsTotal + (performance.now() - s.openedAt), openedAt: 0 });
}

export function setCompanionTab(tab: CompanionTab): void {
  local.set(TAB_KEY, tab);
  useCompanion.setState({ tab });
}

export function setTier(tier: Tier): void {
  local.set(TIER_KEY, tier);
  useCompanion.setState({ tier });
}

export function removeAttach(): void {
  useCompanion.setState({ attach: null });
}

/** Offene Zeit gesamt (ms, steigt nur) – der Trainer zieht sie von der Antwortzeit ab. */
export function companionOpenMs(): number {
  const s = useCompanion.getState();
  return s.openMsTotal + (s.open ? performance.now() - s.openedAt : 0);
}

/** Wurde der Begleiter seit `sinceMs` (performance.now) geöffnet oder ist er offen? → Hilfe (E5-05). */
export function companionOpenedSince(sinceMs: number): boolean {
  const s = useCompanion.getState();
  return s.open || s.lastOpenAt >= sinceMs;
}

// ------------------------------------------------------------------ Daten aus app/chat

/** Vom Abo des Overlays: frischer Stand von `app/chat`. */
export function receiveChatDoc(doc: Record<string, unknown> | undefined, ok: boolean): void {
  const chat = readChat(doc);
  const valid = ok && chat.ok;
  const inDb = new Set(chat.msgs.map(msgKey));
  useCompanion.setState((s) => ({
    dbMsgs: chat.msgs,
    since: Math.max(s.since, chat.since),
    docOk: valid,
    loaded: true,
    pending: s.pending.filter((m) => !inDb.has(msgKey(m))),
    saveState: !valid ? 'invalid' : s.saveState === 'invalid' ? 'ok' : s.saveState,
  }));
}

/** Angezeigte Nachrichten: Datenbank plus noch nicht gesehene eigene. */
export function allMsgs(s: Pick<State, 'dbMsgs' | 'pending'>): ChatMsg[] {
  const keys = new Set(s.dbMsgs.map(msgKey));
  return [...s.dbMsgs, ...s.pending.filter((m) => !keys.has(msgKey(m)))];
}

function learnerFor(uiLang: 'de' | 'en'): { learner: string; work: string } {
  const live = useLive.getState();
  const profile = live.docs['app/profile'] ?? null;
  const pflicht = profile && typeof profile.pflicht === 'object' && profile.pflicht ? (profile.pflicht as Record<string, unknown>) : null;
  const learner = learnerBrief({
    assess: live.docs['app/assess'] ?? null,
    grammar: live.collections.grammar,
    vocab: live.collections.vocab,
    uiLang,
    pflichtDone: pflicht ? !!pflicht[dayKey(Date.now())] : null,
  });
  return { learner, work: workContext(profile?.ctx) };
}

async function persist(add: ChatMsg[]): Promise<void> {
  const r = await saveChatMsgs(add);
  useCompanion.setState({ saveState: r === 'saved' || r === 'unchanged' ? 'ok' : r });
}

/** „Erneut speichern" nach einem Speicherfehler: noch nicht gesehene Nachrichten erneut anhängen (idempotent). */
export async function retrySave(): Promise<void> {
  const s = useCompanion.getState();
  if (!s.pending.length) return;
  await persist(s.pending.filter((m) => m.t !== undefined && s.turn.userMsg?.t !== m.t));
}

// ------------------------------------------------------------------ Senden

const running = (t: TurnState) => t.status === 'queued' || t.status === 'thinking' || t.status === 'streaming' || t.status === 'slow';

export function isTurnRunning(): boolean {
  return running(useCompanion.getState().turn);
}

/**
 * Nachricht senden (ein Aufruf). `reuse` = „Erneut senden" derselben Nutzernachricht nach
 * einem Fehler (neuer Aufruf auf Knopfdruck, nie automatisch).
 */
export async function sendMessage(text: string, reuse?: ChatMsg): Promise<void> {
  if (!text.trim() || isTurnRunning()) return;
  // Eine neue Nachricht ersetzt die nicht beantwortete nach einem Fehler.
  if (!reuse) dismissError();
  const s = useCompanion.getState();
  const content = text.trim();
  const uiLang = useSettings.getState().lang;
  const seeing = currentSeeing();
  // „Erneut senden" behält das Wort der ursprünglichen Frage.
  const attach = reuse ? lastAttach : s.attach;
  lastAttach = attach;
  const userMsg: ChatMsg = reuse ?? {
    role: 'user',
    content: content.slice(0, 2_000),
    t: nextT(),
    lang: uiLang,
    ...(attach ? { ctx: `${attach.word}` } : seeing ? { ctx: seeing.label } : {}),
  };
  const shown = allMsgs(s);
  const history = activeMsgs(
    shown.filter((m) => msgKey(m) !== msgKey(userMsg)),
    s.since,
    Date.now(),
  );
  // Ein angetipptes Wort gilt nur für die eine Frage, nicht für alle folgenden.
  useCompanion.setState((st) => ({
    attach: null,
    pending: st.pending.some((m) => msgKey(m) === msgKey(userMsg)) ? st.pending : [...st.pending, userMsg],
    turn: { status: 'queued', text: '', errorKey: null, errorKind: null, userMsg },
    sentSeq: st.sentSeq + 1,
  }));

  const { learner, work } = learnerFor(uiLang);
  const turns = companionChat.buildTurns({ uiLang, learner, work, seeing, attach, history, message: userMsg.content });
  ctl?.abort();
  const c = new AbortController();
  ctl = c;
  let streamed = '';
  const mine = () => ctl === c;
  try {
    const r = await askText({
      id: companionChat.id,
      version: companionChat.version,
      tier: useCompanion.getState().tier,
      input: turns,
      cache: companionChat.cache,
      signal: c.signal,
      onPhase: (p: AiPhase) => {
        if (!mine() || p === 'done' || p === 'error') return;
        useCompanion.setState((st) => ({ turn: { ...st.turn, status: p } }));
      },
      onText: ({ text: t }) => {
        streamed = t;
        if (mine()) useCompanion.setState((st) => ({ turn: { ...st.turn, status: 'streaming', text: t } }));
      },
    });
    const reply: ChatMsg = { role: 'assistant', content: r.text, t: nextT(), lang: replyLang(r.text, uiLang) };
    finishTurn(userMsg, reply, r.truncated);
  } catch (err) {
    const f = isAiFailure(err) ? err : null;
    if (!f) logWarn('companion:send', err);
    if (f?.kind === 'cancelled') {
      if (streamed.trim()) {
        const reply: ChatMsg = { role: 'assistant', content: streamed, t: nextT(), lang: replyLang(streamed, uiLang), stopped: true };
        finishTurn(userMsg, reply, false);
      } else {
        // Vor dem ersten Text gestoppt: Senden zurücknehmen, Text zurück ins Eingabefeld.
        useCompanion.setState((st) => ({
          pending: st.pending.filter((m) => msgKey(m) !== msgKey(userMsg)),
          turn: idleTurn,
          prefill: { tab: 'chat', text: userMsg.content, seq: ++prefillSeq },
        }));
      }
      return;
    }
    const kind = f?.kind ?? 'failed';
    // `refused`: Teiltext ist zurückgezogen (errors.ts leert ihn). Sonst bleibt er mit „unterbrochen".
    const partial = kind === 'refused' ? '' : (f?.partial ?? streamed);
    useCompanion.setState({ turn: { status: 'error', text: partial, errorKey: f?.messageKey ?? 'aiFailed', errorKind: kind, userMsg } });
  } finally {
    if (ctl === c) ctl = null;
  }
}

function finishTurn(userMsg: ChatMsg, reply: ChatMsg, truncated: boolean): void {
  useCompanion.setState((st) => ({
    pending: [...st.pending.filter((m) => msgKey(m) !== msgKey(reply)), reply],
    notes: truncated ? { ...st.notes, [msgKey(reply)]: { truncated: true } } : st.notes,
    turn: idleTurn,
    finished: st.finished + 1,
  }));
  void persist([userMsg, reply]);
}

/** „Stopp": laufende Antwort abbrechen (Teiltext wird als gestoppt gespeichert). */
export function stopTurn(): void {
  ctl?.abort();
}

/** „Erneut senden" nach einem Fehler: dieselbe Nachricht, ein neuer Aufruf. */
export function resend(): void {
  const t = useCompanion.getState().turn;
  if (t.status !== 'error' || !t.userMsg) return;
  void sendMessage(t.userMsg.content, t.userMsg);
}

/** Fehlerzustand verwerfen (z. B. bei neuer Eingabe). */
export function dismissError(): void {
  const s = useCompanion.getState();
  if (s.turn.status !== 'error') return;
  const u = s.turn.userMsg;
  useCompanion.setState({ turn: idleTurn, pending: u ? s.pending.filter((m) => msgKey(m) !== msgKey(u)) : s.pending });
}

/** „Neues Gespräch": nur eine Marke; ältere Nachrichten bleiben sichtbar, gehen aber nicht mehr an Claude. */
export async function newConversation(): Promise<void> {
  if (isTurnRunning()) return;
  dismissError();
  const since = nextT();
  useCompanion.setState({ since, attach: null });
  const r = await saveChatSince(since);
  if (r !== 'saved') useCompanion.setState({ saveState: r === 'unchanged' ? 'ok' : r });
}

/** Nur für Tests. */
export function resetCompanion(): void {
  ctl?.abort();
  ctl = null;
  useCompanion.setState({
    open: false,
    tab: 'chat',
    attach: null,
    dbMsgs: [],
    since: 0,
    docOk: true,
    loaded: false,
    pending: [],
    notes: {},
    turn: idleTurn,
    saveState: 'ok',
    tier: 'default',
    openedAt: 0,
    openMsTotal: 0,
    lastOpenAt: -1,
    finished: 0,
    sentSeq: 0,
    prefill: null,
  });
}
