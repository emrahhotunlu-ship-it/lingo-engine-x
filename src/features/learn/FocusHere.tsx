import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import type { FocusStage, FocusView } from '../../domain/grammar/focus';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT, type MessageKey } from '../../i18n';
import { VButton, VCard } from '../../ui/v';
import { useBookDutyStep } from '../grammar/bookStep';
import { stageLine } from '../grammar/focusView';
import { resumeOrStartGrammar } from '../grammar/resume';
import { useGrammarSession } from '../grammar/session';
import { topicName } from '../grammar/topicUi';
import { grammarDutyId, useToday } from '../today/state';
import { startUnitDuty } from '../unit/run';

// „Du bist hier“ mit dem Fokus-Thema (Politur P3, Emrah E1 „A“ 13.11.2026): EIN Weg im Grammatik-Reiter. Thema groß, darunter
// „Stufe x von 4 · Verstehen/Bilden/Umformen/Mischen“ mit vier Abschnitten, ein Satz, was heute dran ist, und EIN Knopf zur Runde.
// Der Knopf startet den Grammatik-Schritt von heute (dieselbe Runde wie auf Heute); ist er erledigt, eine freiwillige weitere Runde.

const SUB: Record<FocusStage, MessageKey> = { 1: 'gfHereSub1', 2: 'gfHereSub2', 3: 'gfHereSub3', 4: 'gfHereSub4' };

/** Minuten des Grammatik-Schritts im Plan von heute (Tageseinheit), sonst 5. */
function useGrammarMinutes(): number {
  return useToday((s) => s.plan?.u?.b.find(([, kind]) => kind === 'grammar')?.[2] ?? 5);
}

export function FocusHere({ view }: { view: FocusView }) {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const today = useClock((s) => s.today);
  const minutes = useGrammarMinutes();
  // Ist der Grammatik-Schritt von heute noch offen? Dann IST der Knopf dieser Schritt (außer das Buch ist der Schritt des Tages).
  const dutyId = grammarDutyId(today);
  const dutyOpen = useToday((s) => !!dutyId && s.duties.items.some((d) => d.id === dutyId && d.state === 'open'));
  const dutyDone = useToday((s) => !!dutyId && s.duties.items.some((d) => d.id === dutyId && d.state === 'done'));
  const bookStep = useBookDutyStep();
  const viaDuty = dutyOpen && !bookStep && view.frozen;
  const running = useGrammarSession((s) => s.active && s.status === 'running' && s.day === today && s.focus?.topic === view.topic && s.pos < s.tasks.length);

  const start = () => {
    if (viaDuty && dutyId && startUnitDuty(dutyId, api)) return;
    const { first, route } = resumeOrStartGrammar({ mode: 'topic', topic: view.topic, focus: true });
    if (first === 'typed') api.focusNow();
    else api.blur();
    go(route);
  };

  const sub = view.sitsToday
    ? t('gfHereSits')
    : view.stage === 1 && view.rule
      ? t('gfHereSub1Rule')
      : view.stage === 4 && view.partner
        ? t('gfHereSub4Partner', { partner: topicName(view.partner, lang) })
        : t(SUB[view.stage]);
  const label = running ? t('gfBtnResume') : viaDuty ? t('gfBtnRound', { n: minutes }) : t('gfBtnMore');

  return (
    <VCard raised className="lx-vg-here" aria-labelledby="vg-here-t" data-testid="hub-next-topic" data-topic={view.topic} data-focus="1" data-stage={view.stage}>
      <p className="lx-vg-lbl">{t('gfHereLbl')}</p>
      <h2 id="vg-here-t" className="lx-vg-h2 lx-v-disp">
        {topicName(view.topic, lang)}
      </h2>
      <p className="lx-vg-p2 font-semibold text-fg" data-testid="here-stage">
        {stageLine(view.stage, t)}
      </p>
      <div className="lx-vg-bar" data-testid="here-steps" data-n={view.stage} data-total={4} aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <i key={n} data-d={n <= view.stage ? '' : undefined} />
        ))}
      </div>
      <p className="lx-vg-p2" data-testid="hub-next-line">
        {sub}
        {!view.sitsToday && !view.rule ? ` ${t('gfHereWarm')}` : ''}
      </p>
      {!view.sitsToday && view.k > 0 && (
        <p className="lx-vg-p2 lx-tnum" data-testid="here-streak">
          {t('gfHereStreak', { k: view.k })}
        </p>
      )}
      {dutyDone && !running && (
        <p className="lx-vg-p2" data-testid="here-done">
          {t('gfDoneToday')}
        </p>
      )}
      <VButton variant={viaDuty || running ? 'pri' : 'sec'} full className="lx-vg-go" onClick={start} data-testid="hub-next-start" data-action={running ? 'resume' : viaDuty ? 'duty' : 'more'}>
        {label}
      </VButton>
    </VCard>
  );
}
