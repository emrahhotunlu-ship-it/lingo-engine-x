import { eventById, mailById, roleById } from '../../content/activation/pools';
import { EnglishText } from '../../engine/EnglishText';
import { useT, type MessageKey } from '../../i18n';
import { HIDES_TARGET } from '../../domain/srs/actBrief';
import { actMeaning, type ActTask } from '../../domain/srs/actTask';
import type { TrainCard } from '../../domain/srs/types';
import { typedForm } from '../../domain/chunks/situation';
import { dayLabel } from '../../domain/activation/actDoc';

// Die Vorgaben einer Aktivierungs-Aufgabe A2–A5 (Wörter aktivieren, Stufe 2): Zielwörter oder – bei A4 – nur ihre Bedeutung, Lage, Gegenüber, Marken für Ton,
// Zeitform, Textsorte und Besonderheit, Ausgangssatz (Umformen) bzw. die Mail des Kunden. Alles aus dem Code der Vorgabe (`ActTask`), nichts wird gewürfelt.

const chip = 'rounded-[var(--radius-inline)] bg-surface px-2 py-0.5 font-semibold';

export function ActPanel({ task, card, lang }: { task: ActTask; card: TrainCard; lang: 'de' | 'en' }) {
  const { t } = useT();
  const src = { area: 'trainer' as const, source: card.path, title: card.word };
  const hidden = HIDES_TARGET.has(task.fmt);
  const event = task.fmt === 'ml' ? null : eventById(task.event);
  const mail = task.fmt === 'ml' ? mailById(task.event) : null;
  const role = roleById(task.role);
  const main = task.targets[0];
  const meaning = hidden && main ? actMeaning(main, task.fmt, lang) : null;
  const sourceDate = task.source?.own && task.source.day ? dayLabel(task.source.day) : null;
  return (
    <div className="flex flex-col gap-2" data-testid="act-panel" data-fmt={task.fmt} data-step={task.step} data-code={task.code}>
      {!hidden && (
        <p className="lx-t-support flex flex-wrap items-center gap-2" data-testid="act-targets">
          <span className="text-muted">{t(task.targets.length > 1 ? 'actLblWords' : 'actLblWord')}</span>
          {task.targets.map((x) => (
            <span key={x.key} className={chip} lang="en" data-testid="target-chip">
              {x.kind === 'chunk' ? typedForm(x.word) : x.word}
            </span>
          ))}
        </p>
      )}
      {hidden && meaning && (
        <p className="lx-t-prompt" lang={lang} data-testid="act-meaning">
          <span className="text-muted">{task.fmt === 'im' ? t('actLblThought') : t('actLblMeaning')}: </span>
          <span className="font-semibold">{meaning}</span>
        </p>
      )}
      {event && (
        <p className="lx-t-prompt" lang={lang} data-testid="act-event">
          <span className="text-muted">{t('actLblEvent')}: </span>
          {event[lang]}
        </p>
      )}
      {mail && (
        <div className="lx-inset lx-t-support flex flex-col gap-1" data-testid="act-mail">
          <p className="lx-t-label">{t('actLblMail')}</p>
          <EnglishText as="p" text={mail.en} testId="act-mail-text" {...src} />
        </div>
      )}
      {task.source && (
        <div className="lx-inset lx-t-support flex flex-col gap-1" data-testid="act-source" data-own={task.source.own ? '' : undefined}>
          <p className="lx-t-label">{task.source.own && sourceDate ? t('actLblSourceOwn', { date: sourceDate }) : t('actLblSource')}</p>
          <EnglishText as="p" text={task.source.text} testId="act-source-text" {...src} />
        </div>
      )}
      <p className="lx-t-support flex flex-wrap items-center gap-2" data-testid="act-marks">
        {role && (
          <span className={chip} data-testid="act-role">
            {t('actLblRole')}: {role[lang]}
          </span>
        )}
        {task.type !== '-' && (
          <span className={chip} data-testid="act-type">
            {t('actLblType')}: {t(`actType_${task.type}` as MessageKey)}
          </span>
        )}
        {task.tone !== '-' && (
          <span className={chip} data-testid="act-tone">
            {t('brToneLbl')}: {t(`brTone_${task.tone}` as MessageKey)}
          </span>
        )}
        {task.tense !== '-' && (
          <span className={chip} data-testid="act-tense">
            {t('brTenseLbl')}: {t(`brTense_${task.tense}` as MessageKey)}
          </span>
        )}
        {task.shape !== '-' && (
          <span className={chip} data-testid="act-shape">
            {t('actLblShape')}: {t((task.fmt === 'ml' ? `actGoal_${task.shape}` : `actShape_${task.shape}`) as MessageKey)}
          </span>
        )}
      </p>
      {hidden && (
        <p className="lx-t-meta text-muted" data-testid="act-hidden-note">
          {t('actHiddenNote')}
        </p>
      )}
    </div>
  );
}
