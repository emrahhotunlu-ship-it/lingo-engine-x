import { chapterById } from '../../../domain/c1/chapters';
import { GATE, type GateStatus } from '../../../domain/c1/gate/trigger';
import { useT } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { topicName } from '../../grammar/topicUi';
import { useGateSheet } from './store';
import { useGateStatuses, useReadyGate } from './useGate';

// Kapitelprüfung, Oberfläche an zwei Stellen (Lernplattform 3.0 §4.4, P42): die Karte als Extra auf Heute (nur, wenn eine Prüfung bereit ist, nie Pflicht)
// und der Abschnitt „Abschlussprüfung“ im Kapitelblatt (jeder Zustand ehrlich benannt). Das Blatt selbst hängt in der Shell (`GateHost`).

/** Karte unter „Extra“ auf Heute. Ohne bereite Prüfung kommt nichts (keine Höhe). */
export function GateCard() {
  const { t, lang } = useT();
  const ready = useReadyGate();
  const open = useGateSheet((s) => s.open);
  const ch = ready ? chapterById(ready.chapter) : null;
  if (!ready || !ch) return null;
  return (
    <section className="lx-glass flex flex-col gap-3 rounded-[var(--radius-card)] p-5" aria-labelledby="px-gt-card" data-testid="gate-card" data-chapter={ch.id}>
      <p className="lx-eyebrow">{t('pxGtCardEyebrow')}</p>
      <h2 id="px-gt-card" className="lx-t-answer tracking-tight">
        {t('pxGtCardTitle', { n: ch.n, name: ch.name[lang] })}
      </h2>
      <p className="text-sm text-muted">{t('pxGtCardText', { g: ch.topics.length * GATE.perTopic, w: GATE.words })}</p>
      <div>
        <Button variant="secondary" onClick={() => open(ch.n)} data-testid="gate-start">
          {t('pxGtCardStart')}
        </Button>
      </div>
    </section>
  );
}

function statusLine(s: GateStatus, t: ReturnType<typeof useT>['t'], date: (d: string) => string, name: (id: string) => string): string {
  switch (s.state) {
    case 'passed':
      return t('pxGtStPassed', { d: date(s.on) });
    case 'pause':
      return t('pxGtStPause', { d: date(s.from) });
    case 'spent':
      return t('pxGtStSpent');
    case 'ready':
      return t('pxGtStReady');
    case 'locked':
      if (s.why === 'no-content') return t('pxGtStSoon');
      if (s.why === 'topics') return t('pxGtStTopics');
      if (s.why === 'settle') return t('pxGtStSettle', { d: s.from ? date(s.from) : '' });
      return t('pxGtStStrength', { names: (s.weak ?? []).map(name).join(' · ') });
  }
}

/** Abschnitt im Kapitelblatt: der Stand der Prüfung dieses Kapitels und, wenn sie bereit ist, der Startknopf. */
export function GateSection({ chapter }: { chapter: number }) {
  const { t, lang } = useT();
  const statuses = useGateStatuses();
  const open = useGateSheet((s) => s.open);
  const s = statuses[chapter - 1];
  if (!s) return null;
  const date = (d: string): string => new Date(`${d}T12:00:00`).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'long' });
  const name = (id: string): string => topicName(id, lang);
  return (
    <section className="flex flex-col gap-2" aria-labelledby="px-gt-sec" data-testid="gate-section" data-state={s.state}>
      <h3 id="px-gt-sec" className="lx-eyebrow">
        {t('pxGtSecTitle')}
      </h3>
      <p className="text-sm text-muted" data-testid="gate-status">
        {statusLine(s, t, date, name)}
      </p>
      {s.state === 'ready' && (
        <div>
          <Button variant="secondary" onClick={() => open(chapter)} data-testid="gate-start-sheet">
            {t('pxGtCardStart')}
          </Button>
        </div>
      )}
    </section>
  );
}
