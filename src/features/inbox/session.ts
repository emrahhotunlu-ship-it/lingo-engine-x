import { create } from 'zustand';
import { askJson } from '../../ai/gate';
import { selectAiAvailable } from '../../ai/scope';
import { isAiFailure, type AiMessageKey, type AiPhase } from '../../ai/types';
import type { Resumable } from '../../app/resume';
import type { RouteOf } from '../../app/router/types';
import type { UnitTaskResult } from '../../app/unit/types';
import { inboxMails } from '../../content/nb/load';
import type { InboxMail } from '../../content/nb/schemas';
import { firstStep, INBOX_GIST_MAX, INBOX_REPLY_MAX, nextStep, pickMail, type InboxPart } from '../../domain/nbdrill/inbox';
import { outId, outRef } from '../../domain/nbdrill/outDoc';
import { pickRotating } from '../../domain/nbdrill/pick';
import { logWarn } from '../../platform/diagnostics';
import { local } from '../../platform/storage';
import { useCapabilities } from '../../platform/capabilities';
import { inboxCheck, type InboxCheckOut } from '../../prompts/nb/p7/inboxCheck';
import type { Fix } from '../../ui/feedback/types';
import { currentDay, logAnswers, nextRound, restoreSaved, saveOut, type UnitRun } from '../nbdrill/shared';

// Posteingang (Plan N104, Lehrer L2): Mail lesen → „Was will der Kunde?“ → Antwort → Rückmeldung.
// Entwürfe liegen in der Momentaufnahme (Neuladen behält sie). Mit KI prüft `inbox-check@1` im
// Hintergrund; ohne KI vergleicht Emrah selbst mit Anliegen, Pflichtpunkten und Musterantwort.

export type InboxStepS = 'read' | 'gist' | 'reply' | 'review';

export type InboxSession = {
  v: 1;
  mail: string;
  part: InboxPart;
  step: InboxStepS;
  gist: string;
  reply: string;
  /** Selbstcheck der Pflichtpunkte (ohne KI). */
  self: boolean[];
  ai: { phase: AiPhase | 'idle'; error: AiMessageKey | null; out: InboxCheckOut | null };
  day: string;
  t0: number;
  lang: 'de' | 'en';
  unit: UnitRun | null;
  done: boolean;
};

export const useInbox = create<{ s: InboxSession | null }>(() => ({ s: null }));
const put = (s: InboxSession) => useInbox.setState({ s });
const get = () => useInbox.getState().s;
let ctl: AbortController | null = null;

export const mailOf = (s: InboxSession): InboxMail | null => inboxMails().find((m) => m.id === s.mail) ?? null;

export function startInbox(opts: { unit?: UnitRun | null; lang: 'de' | 'en'; part?: InboxPart; id?: string | null }): boolean {
  const list = inboxMails();
  const theme = opts.unit?.theme ?? null;
  // In der Einheit: die Mail zum Thema; frei: reihum.
  const mail = opts.id || theme ? pickMail(list, theme, opts.id) : (pickRotating(list, 1, nextRound('inbox'))[0] ?? null);
  if (!mail) return false;
  const part = opts.part ?? 'full';
  ctl?.abort();
  ctl = null;
  put({ v: 1, mail: mail.id, part, step: firstStep(part) === 'reply' ? 'reply' : 'read', gist: '', reply: '', self: mail.must.map(() => false), ai: { phase: 'idle', error: null, out: null }, day: opts.unit?.day ?? currentDay(), t0: Date.now(), lang: opts.lang, unit: opts.unit ?? null, done: false });
  return true;
}

export function setGist(v: string): void {
  const s = get();
  if (s && s.step === 'gist') put({ ...s, gist: v.slice(0, INBOX_GIST_MAX) });
}
export function setReply(v: string): void {
  const s = get();
  if (s && s.step === 'reply') put({ ...s, reply: v.slice(0, INBOX_REPLY_MAX) });
}

const aiOn = () => selectAiAvailable(useCapabilities.getState());

function logStep(s: InboxSession, m: InboxMail, kind: 'gist' | 'reply', ok: boolean): void {
  const given = kind === 'gist' ? s.gist : s.reply;
  logAnswers([{ type: 'nb-inbox', ref: outRef({ id: outId('inbox', s.t0), d: s.day }), q: `${m.subject} (${kind})`, given: given.trim(), ans: kind === 'gist' ? m.hidden.en : m.reply, ok, ms: 0, day: s.day, lang: s.lang, duty: !!s.unit, t: Date.now() }]);
}

/** „Weiter“ im Ablauf. Nach dem Anliegen (nur lesen) oder der Antwort folgt der Rückblick. */
export function advance(): void {
  const s = get();
  const m = s ? mailOf(s) : null;
  if (!s || !m) return;
  if (s.step === 'read') {
    put({ ...s, step: 'gist' });
    return;
  }
  if (s.step === 'gist') {
    if (!s.gist.trim()) return;
    logStep(s, m, 'gist', true);
    const n = nextStep('gist', s.part);
    put({ ...s, step: n === 'reply' ? 'reply' : 'review' });
    return;
  }
  if (s.step === 'reply') {
    if (!s.reply.trim()) return;
    const ai = aiOn();
    put({ ...s, step: 'review', ai: ai ? { phase: 'queued', error: null, out: null } : s.ai });
    if (ai) void runCheck(false);
  }
}

async function runCheck(refresh: boolean): Promise<void> {
  const s = get();
  const m = s ? mailOf(s) : null;
  if (!s || !m) return;
  ctl ??= new AbortController();
  const patch = (ai: Partial<InboxSession['ai']>) => {
    const cur = get();
    if (cur && cur.t0 === s.t0) put({ ...cur, ai: { ...cur.ai, ...ai } });
  };
  try {
    const r = await askJson({
      template: inboxCheck,
      vars: { subject: m.subject, body: m.body, hidden: m.hidden.en, must: m.must.map((x) => x.en), gist: s.gist || '-', reply: s.reply, uiLang: s.lang },
      signal: ctl.signal,
      refresh,
      onPhase: (p) => patch({ phase: p }),
    });
    patch({ phase: 'done', error: null, out: r.data });
  } catch (err) {
    if (isAiFailure(err) && err.kind === 'cancelled') return;
    if (!isAiFailure(err)) logWarn('inbox:check', err, m.id);
    patch({ phase: 'error', error: isAiFailure(err) ? (err.messageKey ?? 'aiFailed') : 'aiFailed' });
  }
}

export function retryInboxCheck(): void {
  const s = get();
  if (!s || s.step !== 'review') return;
  put({ ...s, ai: { phase: 'queued', error: null, out: null } });
  void runCheck(true);
}

export function toggleMust(i: number): void {
  const s = get();
  if (s) put({ ...s, self: s.self.map((v, k) => (k === i ? !v : v)) });
}

/** Rückblick abschließen: Ergebnis in `out/<Monat>`, Antwort ins Tagesprotokoll. */
export function finishReview(): void {
  const s = get();
  const m = s ? mailOf(s) : null;
  if (!s || !m || s.done) return;
  const out = s.ai.out;
  const hasReply = !!s.reply.trim();
  if (hasReply) logStep(s, m, 'reply', out ? out.gist && out.must.every(Boolean) : s.self.every(Boolean));
  const done = { ...s, done: true };
  put(done);
  if (s.part === 'read') local.set(readKey(s.day), m.id);
  void saveOut({
    id: outId('inbox', s.t0),
    k: 'inbox',
    d: s.day,
    t: s.t0,
    ...(s.unit?.theme ? { theme: s.unit.theme } : {}),
    ...(hasReply ? { ok: out ? out.gist && out.must.every(Boolean) : undefined } : {}),
    text: `${m.id}\n${s.gist.trim()}\n\n${s.reply.trim()}`,
    fb: out ? { gist: out.gist, must: out.must, tone: out.tone, effect: out.effect } : { self: s.self },
  });
}

export function inboxResult(s: InboxSession): UnitTaskResult | undefined {
  const m = mailOf(s);
  if (!m || !s.reply.trim()) return undefined;
  const fixes: Fix[] = (s.ai.out?.fixes ?? []).map((f) => ({ kind: 'form', mine: f.mine, right: f.right, why: f.why }));
  return { kind: 'task.inbox', ref: outRef({ id: outId('inbox', s.t0), d: s.day }), text: s.reply.trim(), better: s.ai.out?.better ?? m.reply, fixes };
}

/** Mittwoch: Block 2 liest die Mail, Block 3 antwortet auf dieselbe (lokal gemerkt, Bequemlichkeit). */
const readKey = (day: string) => `lx:nb:inbox-read:${day}`;
export const inboxReadOn = (day: string): string | null => local.get(readKey(day)) || null;

export function endInbox(): void {
  ctl?.abort();
  ctl = null;
  useInbox.setState({ s: null });
}

function isSession(x: unknown): x is InboxSession {
  if (!x || typeof x !== 'object') return false;
  const s = x as Partial<InboxSession>;
  return s.v === 1 && typeof s.mail === 'string' && typeof s.gist === 'string' && typeof s.reply === 'string' && typeof s.day === 'string' && Array.isArray(s.self);
}

export const inboxResume: Resumable<InboxSession> = {
  id: 'inbox',
  version: 1,
  origin: 'write',
  snapshot: () => {
    const s = get();
    return s && !s.done ? s : null;
  },
  subscribe: (cb) => useInbox.subscribe(cb),
  restore: (s) => {
    if (!isSession(s) || !inboxMails().some((m) => m.id === s.mail)) return false;
    const ai = s.ai?.phase === 'done' ? s.ai : { phase: s.step === 'review' ? ('error' as const) : ('idle' as const), error: s.step === 'review' ? ('aiFailed' as AiMessageKey) : null, out: null };
    put({ ...s, ai, done: false });
    return true;
  },
  route: (s) => ({ name: 'inbox', id: s.mail }),
  label: (s, t) => t('nbTrainingResumeInbox', { n: s.step === 'read' ? 1 : s.step === 'gist' ? 2 : 3 }),
};

export function ensureInbox(route: RouteOf<'inbox'>, lang: 'de' | 'en'): boolean {
  const s = get();
  if (s && (!route.id || route.id === s.mail)) return true;
  if (restoreSaved(inboxResume, currentDay())) {
    const r = get();
    if (r && (!route.id || route.id === r.mail)) return true;
  }
  return startInbox({ lang, id: route.id ?? null });
}
