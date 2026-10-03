import { useMemo, useState } from 'react';
import type { UnitCtx } from '../../app/unit/types';
import { useWeek } from '../../app/useWeek';
import { TOPICS } from '../../domain/content';
import { detectTargets } from '../../domain/week';
import type { TargetKind } from '../../domain/week/types';
import { useT, type MessageKey } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { phrasesOf } from './useUnit';

// Wochenziele in der Aufgabe (N13, Prüfbefund M8): „Ziel: 2 deiner Wendungen · 2 Überleitungen ·
// Werkzeug“. Der Zähler steigt beim Tippen lokal (`detectTargets`), ohne KI und ohne Speichern.
// Die Wendungen (aus Block 2, sonst die der Woche) stehen aufklappbar darunter, benutzte mit ✓.

const KIND_KEY: Record<TargetKind, MessageKey> = {
  phrase: 'nbSprechenTgtPhrase',
  hedge: 'nbSprechenTgtHedge',
  transition: 'nbSprechenTgtTransition',
};

/** Standard: 2 Wendungen, falls das Thema kein Wendungsziel nennt (M8). */
export const PHRASE_NEED = 2;

export function toolName(id: string | null, lang: 'de' | 'en'): string | null {
  if (!id) return null;
  const t = TOPICS.find((x) => x.id === id);
  if (!t) return null;
  return lang === 'de' ? t.name : (t.name_en ?? t.name);
}

export function TargetBar({ text, ctx }: { text: string; ctx: UnitCtx | null }) {
  const { t, lang } = useT();
  const week = useWeek();
  const targets = ctx?.targets ?? week.targets;
  const phrases = phrasesOf(ctx, targets.phrases);
  const [open, setOpen] = useState(false);
  const goals = useMemo(() => {
    const g = targets.goals.length ? [...targets.goals] : [];
    if (phrases.length && !g.some((x) => x.kind === 'phrase')) g.unshift({ kind: 'phrase', need: PHRASE_NEED });
    return g;
  }, [targets.goals, phrases.length]);
  const scan = useMemo(() => detectTargets(text, { goals, phrases: [...phrases] }), [text, goals, phrases]);
  const tool = toolName(targets.tool, lang);
  if (!goals.length && !tool) return null;

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface px-4 py-3 text-sm" data-testid="target-bar">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="lx-eyebrow">{t('nbSprechenTgtGoal')}</span>
        {scan.progress.map((p) => {
          const done = p.have >= p.need;
          return (
            <span key={p.kind} className={`inline-flex items-center gap-1 lx-tnum ${done ? 'text-accent-text' : 'text-muted'}`} data-testid="target-chip" data-kind={p.kind} data-have={p.have} data-need={p.need}>
              {done && <Icon name="check" size={14} aria-hidden="true" />}
              {t(KIND_KEY[p.kind], { have: Math.min(p.have, p.need), need: p.need })}
            </span>
          );
        })}
        {tool && (
          <span className="text-muted" data-testid="target-tool">
            {t('nbSprechenTgtTool', { tool })}
          </span>
        )}
        {phrases.length > 0 && (
          <button type="button" className="ml-auto inline-flex min-h-8 items-center gap-1 text-xs text-muted hover:text-fg" aria-expanded={open} onClick={() => setOpen((v) => !v)} data-testid="target-phrases-toggle">
            {t('nbSprechenTgtPhrases')}
            <Icon name="chevronDown" size={14} className={open ? 'rotate-180' : ''} />
          </button>
        )}
      </div>
      {open && (
        <ul className="flex flex-col gap-1" data-testid="target-phrases">
          {phrases.map((p) => {
            const used = scan.phrasesUsed.includes(p);
            return (
              <li key={p} className={`flex items-center gap-2 ${used ? 'text-accent-text' : ''}`} data-used={used ? 'yes' : 'no'}>
                <Icon name={used ? 'check' : 'target'} size={14} className={used ? '' : 'text-subtle'} aria-hidden="true" />
                <span lang="en">{p}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
