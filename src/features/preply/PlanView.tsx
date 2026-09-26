import { useState, type ReactNode } from 'react';
import type { PlanView as Plan } from '../../domain/preply/docs';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';
import { speak, unlockSpeech, useSpeech } from '../../platform/speech';
import { Button, IconButton } from '../../ui/Button';
import { Card, ChannelIcon } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { CopyBox } from './CopyBox';
import { HeldSheet } from './HeldSheet';

// Ein Stundenplan (Phase 5 §8.3): oben das Ziel in einer Zeile (Zweck hinter dem Info-Symbol,
// A7), dann Aufwärmen, Sprechanlässe, Modellsätze (antippbar, 🔊), Fokus: deine Fehler,
// Nachricht an den Lehrer mit Kopieren. Unten EIN Primärknopf „Stunde gehalten"; danach Zustand.

function Section({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2" data-testid={testId}>
      <h3 className="lx-eyebrow">{title}</h3>
      {children}
    </section>
  );
}

export function PlanView({ plan }: { plan: Plan }) {
  const { t, lang } = useT();
  const speech = useSpeech((s) => s.status);
  const [held, setHeld] = useState(false);
  const [info, setInfo] = useState(false);
  const langMismatch = !!plan.lang && plan.lang !== lang;
  const src = { area: 'preply' as const, source: `preply/${plan.id}`, title: plan.title || null };
  const date = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return y && m && d ? new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { day: '2-digit', month: '2-digit' }).format(new Date(y, m - 1, d)) : day;
  };

  const list = (items: string[], english: boolean) => (
    <ul className="flex flex-col gap-1.5">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2 text-[0.95rem] leading-relaxed">
          <span className="mt-2.5 size-1.5 flex-none rounded-full bg-[var(--lx-fg-subtle)]" aria-hidden="true" />
          {english ? <EnglishText as="span" text={x} {...src} /> : <span>{x}</span>}
        </li>
      ))}
    </ul>
  );

  return (
    <Card channel="speak" className="flex flex-col gap-5" data-testid="pp-plan" data-id={plan.id} data-state={plan.done ? 'done' : 'open'}>
      <header className="flex flex-col gap-1.5">
        <p className="lx-eyebrow">{t('ppPlanEyebrow', { min: plan.minutes || 50 })}</p>
        <h2 className="text-xl font-semibold tracking-tight">{plan.title || t('ppTitle')}</h2>
      </header>
      <div className="flex flex-col gap-1" data-testid="pp-goal">
        <div className="flex items-start gap-2">
          <p className="flex-1 text-base font-medium">{!langMismatch && plan.goal_x ? plan.goal_x : <EnglishText as="span" text={plan.goal_en} {...src} />}</p>
          <IconButton icon="info" label={t('ppPurposeLabel')} onClick={() => setInfo((v) => !v)} aria-expanded={info} />
        </div>
        {!langMismatch && plan.goal_x && plan.goal_en && <EnglishText as="p" className="text-sm text-muted" text={plan.goal_en} {...src} />}
        {info && <p className="text-sm text-muted">{t('ppPurpose')}</p>}
        {langMismatch && <p className="text-xs text-subtle">{t('ppLangOnly', { lang: plan.lang === 'en' ? t('cmpLangEn') : t('cmpLangDe') })}</p>}
      </div>
      {plan.warmup.length > 0 && (
        <Section title={t('ppWarmup')} testId="pp-warmup">
          {list(plan.warmup, true)}
        </Section>
      )}
      {plan.talk.length > 0 && (
        <Section title={t('ppTalk')} testId="pp-talk">
          {list(plan.talk, true)}
        </Section>
      )}
      {plan.say.length > 0 && (
        <Section title={t('ppSay')} testId="pp-say">
          <ul className="flex flex-col gap-1.5">
            {plan.say.map((x, i) => (
              <li key={i} className="flex items-start gap-1 text-[0.95rem] leading-relaxed">
                <EnglishText as="span" className="flex-1 pt-2.5" text={x} {...src} />
                {speech === 'ready' && (
                  <IconButton
                    icon="speaker"
                    label={t('tlListen')}
                    onClick={() => {
                      unlockSpeech();
                      void speak(x);
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {plan.watch.length > 0 && (
        <Section title={t('ppWatch')} testId="pp-watch">
          <ul className="flex flex-col gap-2.5">
            {plan.watch.map((w, i) => (
              <li key={i} className="flex flex-col gap-0.5 text-[0.95rem] leading-relaxed">
                <span lang="en">
                  <span className="lx-diff-off">{w.mistake}</span>
                  <span className="text-muted"> → </span>
                  <strong className="font-semibold">{w.fix}</strong>
                </span>
                {!langMismatch && w.note && <span className="text-sm text-muted">{w.note}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {plan.message && (
        <Section title={t('ppMessage')} testId="pp-message">
          <CopyBox text={plan.message} label={t('ppMessage')} />
        </Section>
      )}
      {plan.done ? (
        <ul>
          <li data-state="done" data-testid="pp-held-state" className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface px-4 py-3">
            <ChannelIcon channel="speak">
              <Icon name="check" />
            </ChannelIcon>
            <span className="text-base font-medium">{t('ppHeldState', { date: plan.heldDay ? date(plan.heldDay) : plan.doneT ? new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { day: '2-digit', month: '2-digit' }).format(plan.doneT) : '–', min: plan.heldMin || plan.minutes || 50 })}</span>
          </li>
        </ul>
      ) : (
        <div>
          <Button variant="primary" size="lg" icon="check" onClick={() => setHeld(true)} data-testid="pp-held">
            {t('ppHeld')}
          </Button>
        </div>
      )}
      <HeldSheet open={held} ppId={plan.id} defaultMinutes={plan.minutes} onClose={() => setHeld(false)} />
    </Card>
  );
}
