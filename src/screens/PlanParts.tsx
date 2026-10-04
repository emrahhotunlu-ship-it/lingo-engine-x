import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { Button } from '../ui/Button';
import { askText } from '../ai/stream';
import { isAiFailure } from '../ai/types';
import { useAiAvailable } from '../ai/scope';
import { useClock } from '../app/clock';
import { go } from '../app/route';
import { saveBrief, useCoach } from '../coach/store';
import { briefHasData, briefWeekOf, buildBriefFacts } from '../coach/brief';
import { checkDue, curvePoints } from '../coach/curve';
import { VOCAB_C1 } from '../coach/derived';
import { BRIEF_ID, briefPrompt, PROMPT_VERSION } from '../prompts/coach';
import { logWarn } from '../platform/diagnostics';
import { countAiCall } from './aiCount';

// Fahrplan-Bausteine: Trainer-Brief (eine KI-Anfrage je Woche, nur auf Knopfdruck),
// Monats-Check und Fortschrittskurve (docs/neustart.md §6).

export function BriefCard() {
  const { t, lang } = useT();
  const today = useClock((s) => s.today);
  const available = useAiAvailable();
  const profile = useCoach((s) => s.profile);
  const cards = useCoach((s) => s.cards);
  const days = useCoach((s) => s.days);
  const inlog = useCoach((s) => s.inlog);
  const grammar = useCoach((s) => s.grammar);
  const checks = useCoach((s) => s.checks);
  const briefs = useCoach((s) => s.briefs);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [live, setLive] = useState('');
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => () => ctl.current?.abort(), []);

  const week = briefWeekOf(today);
  const mine = briefs[week];
  const latestKey = Object.keys(briefs).sort().pop();
  const shown = mine ?? (latestKey ? briefs[latestKey] : undefined);
  const facts = buildBriefFacts(profile, cards, days, inlog, grammar?.t, checks, today);
  const ready = briefHasData(facts);

  async function write() {
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setBusy(true);
    setFailed(false);
    setLive('');
    countAiCall(today);
    try {
      const res = await askText({ id: BRIEF_ID, version: PROMPT_VERSION, tier: 'default', input: briefPrompt(facts, lang), cache: false, signal: c.signal, priority: 'user', onText: (u) => setLive(u.text) });
      const text = res.text.trim();
      if (text) await saveBrief(week, { at: Date.now(), lang, text });
    } catch (err) {
      if (!(isAiFailure(err) && err.kind === 'cancelled')) {
        logWarn('brief', err);
        setFailed(true);
      }
    } finally {
      setBusy(false);
      setLive('');
    }
  }

  return (
    <section className="lx-glass mt-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="brief">
      <h2 className="text-sm font-semibold">{t('cBrTitle')}</h2>
      {(live || shown) && (
        <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed" data-testid="brief-text" lang={live ? lang : shown?.lang}>
          {live || shown?.text}
        </p>
      )}
      {!mine && !busy && (
        <div className="mt-3">
          <p className="text-sm text-muted">{shown ? t('cBrOld') : t('cBrNone')}</p>
          {!ready ? (
            <p className="mt-2 text-sm text-muted" data-testid="brief-wait">
              {t('cBrNeedData')}
            </p>
          ) : available ? (
            <div className="mt-3">
              <Button variant="primary" icon="sparkle" onClick={() => void write()} data-testid="brief-write">
                {t('cBrWrite')}
              </Button>
            </div>
          ) : null}
        </div>
      )}
      {busy && <p className="mt-2 text-sm text-muted">{t('cAskThinking')}</p>}
      {failed && <p className="mt-3 text-sm text-danger-text">{t('cAskError')}</p>}
      {mine && <p className="mt-2 text-2xs text-muted">{t('cBrDone')}</p>}
    </section>
  );
}

export function CheckCard() {
  const { t } = useT();
  const today = useClock((s) => s.today);
  const now = useClock((s) => s.now);
  const profile = useCoach((s) => s.profile);
  const checks = useCoach((s) => s.checks);
  const due = checkDue(profile?.placement, checks, now, today.slice(0, 7));
  const doneThisMonth = !!checks[today.slice(0, 7)];
  return (
    <section className="mt-5 rounded-[var(--radius-card)] border border-line/70 p-5" data-testid="check-card">
      <h2 className="text-sm font-semibold">{t('cCkCardTitle')}</h2>
      <p className="mt-1.5 text-sm text-muted">{doneThisMonth ? t('cCkDoneMonth') : due ? t('cCkDue') : t('cCkNotYet')}</p>
      <div className="mt-3">
        <Button variant={due ? 'primary' : 'secondary'} onClick={() => go({ name: 'check' })} data-testid="check-start">
          {t('cCkStart')}
        </Button>
      </div>
    </section>
  );
}

const W = 320;
const H = 140;
const PAD = { l: 38, r: 10, t: 10, b: 22 };

export function CurveCard() {
  const { t, num, lang } = useT();
  const profile = useCoach((s) => s.profile);
  const checks = useCoach((s) => s.checks);
  const pts = curvePoints(profile?.placement, checks);
  if (pts.length === 0) return null;
  const t0 = pts[0]!.at;
  const t1 = Math.max(pts[pts.length - 1]!.at, t0 + 30 * 86_400_000);
  const lo = Math.floor((Math.min(...pts.map((p) => p.size)) - 200) / 500) * 500;
  const hi = Math.max(VOCAB_C1, ...pts.map((p) => p.size));
  const x = (at: number) => PAD.l + ((at - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const fmt = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { month: 'short', day: 'numeric' });
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)} ${y(p.size).toFixed(1)}`).join(' ');
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  return (
    <section className="lx-glass mt-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="curve">
      <h2 className="text-sm font-semibold">{t('cCvTitle')}</h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={t('cCvAria', { from: num(first.size), to: num(last.size) })}>
        <line x1={PAD.l} x2={W - PAD.r} y1={y(VOCAB_C1)} y2={y(VOCAB_C1)} stroke="currentColor" className="text-line" strokeDasharray="4 4" />
        <text x={PAD.l} y={y(VOCAB_C1) - 3} className="fill-current text-muted" fontSize="9">
          C1 · {num(VOCAB_C1)}
        </text>
        <text x={PAD.l - 4} y={y(lo) + 3} textAnchor="end" className="fill-current text-muted" fontSize="9">
          {num(lo)}
        </text>
        <path d={path} fill="none" stroke="currentColor" className="text-accent" strokeWidth="2" strokeLinejoin="round" />
        {pts.map((p) => (
          <circle key={p.at} cx={x(p.at)} cy={y(p.size)} r="3.5" className="fill-current text-accent" />
        ))}
        <text x={x(first.at)} y={H - 6} fontSize="9" className="fill-current text-muted" textAnchor="start">
          {fmt.format(first.at)}
        </text>
        {pts.length > 1 && (
          <text x={x(last.at)} y={H - 6} fontSize="9" className="fill-current text-muted" textAnchor="end">
            {fmt.format(last.at)}
          </text>
        )}
      </svg>
      <p className="mt-2 text-sm text-muted" data-testid="curve-text">
        {pts.length > 1 ? t('cCvText', { from: num(first.size), to: num(last.size), n: pts.length - 1 }) : t('cCvOne')}
      </p>
    </section>
  );
}
