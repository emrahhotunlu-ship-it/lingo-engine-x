import { useEffect, useState } from 'react';
import { useT, type MessageKey } from '../i18n';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { ExternalLink } from '../ui/ExternalLink';
import { useClock } from '../app/clock';
import { go, openWord, setAskContext } from '../app/route';
import { emptyDay, saveDay, saveInLog, useCoach } from '../coach/store';
import { inputOf, isCore } from '../coach/derived';
import type { InLogEntry, InputItem } from '../coach/types';
import { addDays } from '../domain/date';

// Input des Tages (docs/neustart.md §4, Säule „Input verstehen"): echte Artikel und Videos zu
// Emrahs Themen, ausgesucht vom schlanken Tagesauftrag. Nach dem Lesen/Sehen bewertet er Interesse
// und Niveau; daraus lernt der Tagesauftrag (coach/summary). Eigene Zeit auf Englisch zählt mit.

export const TOPIC_KEY: Record<string, MessageKey> = {
  economy: 'cTopicEconomy',
  tech: 'cTopicTech',
  business: 'cTopicBusiness',
  sport: 'cTopicSport',
  science: 'cTopicScience',
};

export const logKey = (day: string, item: Pick<InputItem, 'id'>): string => `${day}-${item.id}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 120);

function Choice<T extends string>({ value, options, onChange, label }: { value: T | null; options: ReadonlyArray<[T, MessageKey]>; onChange: (v: T) => void; label: string }) {
  const { t } = useT();
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(([v, key]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`min-h-10 rounded-full border px-4 text-sm transition-colors ${value === v ? 'border-accent bg-accent-soft text-fg' : 'border-line text-muted hover:text-fg'}`}
        >
          {t(key)}
        </button>
      ))}
    </div>
  );
}

/** Beitrag als erledigt verbuchen: Bewertung, Minuten, Tagesteil „Input" des heutigen Lerntags. */
export async function markInputDone(itemDay: string, today: string, item: InputItem, entry: Omit<InLogEntry, 'd' | 'm' | 't'>): Promise<void> {
  const st = useCoach.getState();
  const logEntry: InLogEntry = { d: today, m: item.mins, t: item.title.slice(0, 160), s: item.source.slice(0, 60), k: item.kind, ...(item.topic ? { topic: item.topic } : {}), ...entry };
  await saveInLog(today, { it: { [logKey(itemDay, item)]: logEntry } });
  const cur = st.days[today] ?? emptyDay();
  const rec = { ...cur, i: 1 as const, min: cur.min + Math.min(60, item.mins) };
  if (isCore(rec, inputOf(st.input, today).length > 0)) rec.core = 1;
  await saveDay(today, rec);
}

export function InputCard({ item, day }: { item: InputItem; day: string }) {
  const { t, lang } = useT();
  const today = useClock((s) => s.today);
  const done = useCoach((s) => s.inlog.it[logKey(day, item)]);
  const [rating, setRating] = useState<'great' | 'ok' | 'boring' | null>(null);
  const [level, setLevel] = useState<'easy' | 'right' | 'hard' | null>(null);
  const [asking, setAsking] = useState(false);
  const why = lang === 'de' ? item.why_de : item.why_en;
  const tip = lang === 'de' ? item.tip_de : item.tip_en;
  const topicKey = item.topic ? TOPIC_KEY[item.topic] : undefined;
  return (
    <article className="lx-glass rounded-[var(--radius-card)] p-5 sm:p-6" data-testid="input-item" data-done={done ? '1' : '0'}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted">
        <Icon name={item.kind === 'video' ? 'play' : 'book'} size={14} />
        <span>{item.kind === 'video' ? t('cInVideo') : t('cInArticle')}</span>
        <span>· {item.mins} min</span>
        {item.level && <span>· {item.level}</span>}
        {topicKey && <span className="rounded-full bg-surface px-2">{t(topicKey)}</span>}
        {done && (
          <span className="ml-auto inline-flex items-center gap-1 text-accent-text" data-testid="input-done-badge">
            <Icon name="check" size={14} /> {t('cInDoneBadge')}
          </span>
        )}
      </p>
      <h2 className="mt-2 text-lg font-semibold leading-snug" lang="en">
        {item.title}
      </h2>
      <p className="text-sm text-muted">{item.source}</p>
      {why && <p className="mt-3 text-sm leading-relaxed">{why}</p>}
      {item.words && item.words.length > 0 && (
        <div className="mt-4">
          <p className="lx-eyebrow text-muted">{t('cInWords')}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {item.words.map((w) => (
              <li key={w.en}>
                <button type="button" onClick={() => openWord(w.en)} className="rounded-full border border-line px-3 py-1 text-xs hover:bg-surface">
                  <span lang="en" className="font-semibold">
                    {w.en}
                  </span>{' '}
                  <span className="text-muted">{w.de}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {tip && (
        <div className="mt-4">
          <p className="lx-eyebrow text-muted">{t('cInTip')}</p>
          <p className="mt-1 text-sm">{tip}</p>
        </div>
      )}
      <div className="mt-4">
        <ExternalLink href={item.url} showUrl={false}>
          {t('cInOpen')}
        </ExternalLink>
      </div>
      {!done && !asking && (
        <div className="mt-3">
          <Button variant="secondary" icon="check" onClick={() => setAsking(true)} data-testid="input-finish">
            {t('cInDone')}
          </Button>
        </div>
      )}
      {!done && asking && (
        <div className="mt-4 space-y-3 border-t border-line/60 pt-4" data-testid="input-rate">
          <p className="text-sm font-semibold">{t('cInRateQ')}</p>
          <Choice
            value={rating}
            onChange={setRating}
            label={t('cInRateQ')}
            options={[
              ['great', 'cInGreat'],
              ['ok', 'cInOk'],
              ['boring', 'cInBoring'],
            ]}
          />
          <p className="text-sm font-semibold">{t('cInLevelQ')}</p>
          <Choice
            value={level}
            onChange={setLevel}
            label={t('cInLevelQ')}
            options={[
              ['easy', 'cInEasy'],
              ['right', 'cInRight'],
              ['hard', 'cInHard'],
            ]}
          />
          <Button
            variant="primary"
            disabled={!rating || !level}
            onClick={() => void markInputDone(day, today, item, { ...(rating ? { r: rating } : {}), ...(level ? { l: level } : {}) })}
            data-testid="input-save"
          >
            {t('cInSave')}
          </Button>
        </div>
      )}
      {done && <p className="mt-3 text-xs text-muted">{t('cInSaved')}</p>}
      {done && (
        <div className="mt-3">
          <Button variant="secondary" icon="edit" onClick={() => go({ name: 'write', from: { day, id: item.id } })} data-testid="input-write">
            {t('schInputWrite')}
          </Button>
        </div>
      )}
    </article>
  );
}

function OwnTime() {
  const { t } = useT();
  const today = useClock((s) => s.today);
  const mins = useCoach((s) => s.inlog.own[today] ?? 0);
  return (
    <section className="mt-6 rounded-[var(--radius-card)] border border-line/70 p-5" data-testid="own-time">
      <h2 className="text-sm font-semibold">{t('cInOwn')}</h2>
      <p className="mt-1 text-sm text-muted">{t('cInOwnText')}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {[10, 20, 30].map((n) => (
          <Button key={n} variant="secondary" onClick={() => void saveInLog(today, { own: { [today]: mins + n } })} data-testid={`own-${n}`}>
            {t('cInOwnAdd', { n })}
          </Button>
        ))}
        {mins > 0 && <span className="text-sm text-muted">{t('cInOwnToday', { n: mins })}</span>}
      </div>
    </section>
  );
}

export function InputScreen() {
  const { t } = useT();
  const today = useClock((s) => s.today);
  const input = useCoach((s) => s.input);
  const inlog = useCoach((s) => s.inlog);
  useEffect(() => setAskContext(''), []);
  const todays = inputOf(input, today);
  const earlier = input
    .filter((d) => d.d < today && d.d >= addDays(today, -6))
    .flatMap((d) => d.items.map((item) => ({ d: d.d, item })))
    .filter(({ d, item }) => !inlog.it[logKey(d, item)]);
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 lg:max-w-5xl lg:pt-10" data-testid="input">
      <h1 className="text-xl font-semibold tracking-tight">{t('cInTitle')}</h1>
      <p className="mt-1 text-sm text-muted">{t('cInIntro')}</p>
      <div className="mt-5 space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:space-y-0">
        {todays.length === 0 && <p className="text-sm text-muted lg:col-span-2">{t('cInEmpty')}</p>}
        {todays.map((item) => (
          <InputCard key={item.id} item={item} day={today} />
        ))}
      </div>
      {earlier.length > 0 && (
        <section className="mt-8">
          <h2 className="lx-eyebrow text-muted">{t('cInEarlier')}</h2>
          <div className="mt-3 space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:space-y-0">
            {earlier.map(({ d, item }) => (
              <InputCard key={`${d}-${item.id}`} item={item} day={d} />
            ))}
          </div>
        </section>
      )}
      <OwnTime />
    </div>
  );
}
