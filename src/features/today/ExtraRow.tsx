import { useMemo, useState } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { addDays } from '../../domain/date';
import { counts, laptopDeepen, wrongToday } from '../../domain/metrics';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT } from '../../i18n';
import type { IconName } from '../../ui/Icon';
import { useInputProfile } from '../../platform/input';
import { unlockSpeech } from '../../platform/speech';
import { toast } from '../../ui/Toast';
import { VRow, VSheet } from '../../ui/v';
import { checkAvailable, startCheck } from '../check/session';
import { startExtra } from '../vocab/start';
import { useVocabCards } from '../vocab/hub/data';
import { useDocsOnce } from '../progress/useOnce';
import { dowOf } from '../../domain/unit/planFor';

// „Wenn du mehr willst“ (Relaunch Teil 1c, D2 V-HEUTE; Vorschau H1/L1 `moreRows`, screens.js:91–104): Trennzeile, höchstens DREI Zeilen,
// dann „Alles anzeigen“ (Blatt mit allen Angeboten). Nichts davon zählt für Ring oder Serie (Kap. 2 Nr. 6, Kap. 15); die Unterzeilen sagen es.
// Angebote wie bisher (Lernplattform 2.0 §2.2): „Am Laptop vertiefen“ bzw. „Heute falsch – noch einmal“, „Sprechen“, montags der Wochen-Check.
// Neu nach der Pflicht und an erster Stelle (Vorschau, Vokabeltrainer §1): „Wörter üben“ mit der Zahl der fälligen Karten.
// Die Wörter für „Am Laptop vertiefen“ kommen aus der Datenbank (`laptopDeepen`, `log/<tag>`); `localStorage` spielt keine Rolle.

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Größe der Extra-Runde „Wörter üben“ (wie „Noch eine Runde“ im Trainer). */
const PRACTICE_SIZE = 10;
/** Sichtbare Zeilen auf Heute (Vorschau: höchstens drei). */
export const MORE_MAX = 3;

export type ExtraLine = { id: string; icon: IconName; label: string; sub: string; run: () => void };

/** Die Angebote von heute in fester Reihenfolge. `done`: Pflicht erledigt („Wörter üben“ steht dann vorn). */
export function useExtraLines(today: string, done: boolean, before: () => void = () => undefined): ExtraLine[] {
  const { t } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const profile = useInputProfile();
  const cards = useVocabCards();
  const paths = useMemo(() => [`log/${today}`], [today]);
  const logs = useDocsOnce(paths);
  const log = logs.status === 'ready' ? logs.value.get(`log/${today}`) : undefined;
  const appProfile = useLive((s) => s.docs['app/profile']);
  const now = useClock((s) => s.now);

  return useMemo((): ExtraLine[] => {
    const out: ExtraLine[] = [];
    if (done) {
      const due = counts(cards, now).due;
      if (due > 0) {
        out.push({
          id: 'words',
          icon: 'cards',
          label: t('vhWordsPractice'),
          sub: t('vhWordsPracticeSub', { n: due }),
          run: () => {
            before();
            startExtra(api, { deck: 'all', size: PRACTICE_SIZE, label: t('vhWordsPractice') });
          },
        });
      }
    }
    if (profile === 'keys') {
      const words = laptopDeepen({ log, cards, today, max: 3 });
      out.push({
        id: 'laptop',
        icon: 'sparkle',
        label: t('hxExtraLaptop'),
        sub: words.length ? t('hxExtraLaptopWords', { words: words.join(', ') }) : t('hxExtraLaptopSub'),
        run: () => {
          before();
          go({ name: 'comboSentence' });
        },
      });
    } else {
      const wrong = wrongToday(cards, today);
      if (wrong.length > 0) {
        const keys = new Set(wrong.map((c) => c.key));
        out.push({
          id: 'wrong',
          icon: 'refresh',
          label: t('hxExtraWrong'),
          sub: t('hxExtraWrongSub', { n: wrong.length }),
          run: () => {
            before();
            startExtra(api, { deck: 'all', pick: (c) => keys.has(c.key), allowNew: false, size: Math.min(10, keys.size), label: t('hxExtraWrong') });
          },
        });
      }
    }
    out.push({
      id: 'speak',
      icon: 'mic',
      label: t('hxExtraSpeak'),
      sub: t('hxExtraSpeakSub'),
      run: () => {
        before();
        go({ name: 'speak' });
      },
    });
    if (dowOf(today) === 1 && checkAvailable(appProfile, addDays(today, -1)) && Number(obj(appProfile).answers ?? 0) >= 40) {
      out.push({
        id: 'check',
        icon: 'target',
        label: t('hxExtraCheck'),
        sub: t('hxExtraCheckSub'),
        run: () => {
          unlockSpeech();
          before();
          const first = startCheck();
          if (first === 'empty') {
            toast(t('ckEmpty'));
            return;
          }
          if (first === 'typed') api.focusNow();
          go({ name: 'check' });
        },
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, profile, cards, log, today, appProfile, now, t]);
}

/** Blatt „Alles anzeigen“: alle Angebote von heute (Kennungen wie das frühere Blatt „Extra“). */
function ExtraSheet({ today, done, onClose }: { today: string; done: boolean; onClose: () => void }) {
  const { t } = useT();
  const lines = useExtraLines(today, done, onClose);
  return (
    <VSheet open onClose={onClose} title={t('vhMore')} closeLabel={t('close')}>
      <div className="lx-vh-sheet" data-testid="today-extra-sheet">
        <div>
          {lines.map((l) => (
            <VRow key={l.id} icon={l.icon} title={l.label} sub={l.sub} onClick={l.run} data-testid="extra-line" id={`extra-${l.id}`} />
          ))}
        </div>
        <p className="lx-vh-note">{t('hxExtraNote')}</p>
      </div>
    </VSheet>
  );
}

/** Zeilen und „Alles anzeigen“ (ohne Trennzeile; die setzt der Aufrufer: Handy Trennzeile, Laptop Abschnitt in der Kontextspalte). */
export function MoreRows({ today, done, idp = '' }: { today: string; done: boolean; idp?: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const go = useNav((s) => s.go);
  const lines = useExtraLines(today, done);
  return (
    <div className="lx-vh-more" data-testid={`${idp}more-rows`}>
      <div>
        {lines.slice(0, MORE_MAX).map((l) => (
          <VRow key={l.id} icon={l.icon} title={l.label} sub={l.sub} onClick={l.run} data-testid="more-row" id={`${idp}more-${l.id}`} />
        ))}
      </div>
      {/* „Alles anzeigen“ nur, wenn das Blatt wirklich mehr zeigt als die Zeilen hier (sonst stünde dasselbe zweimal da, Kap. 15). */}
      {/* Praxis (Lesen, Sprechen, Satzbau, Schreiben, Kurse) ist seit UX-Neuanfang B kein Reiter mehr, sondern hier erreichbar. */}
      <div className="lx-vh-more-all">
        {lines.length > MORE_MAX && (
          <button type="button" className="lx-vh-link" onClick={() => setOpen(true)} data-testid="today-extra">
            {t('vhMoreAll')}
          </button>
        )}
        <button type="button" className="lx-vh-link" onClick={() => go({ name: 'apply' })} data-testid={`${idp}today-practice`}>
          {t('vhPracticeAll')}
        </button>
      </div>
      {open && <ExtraSheet today={today} done={done} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** Handy und schmale Laptops: Kopf „Freiwillig · zählt als Extra“ (UX-Neuanfang B) und die Zeilen. */
export function ExtraRow({ today, done }: { today: string; done: boolean }) {
  const { t } = useT();
  return (
    <section className="lx-vh-moresec" aria-labelledby="td-more-title">
      <div className="lx-vh-free-h">
        <h2 id="td-more-title" className="lx-vh-label">
          {t('vhFree')}
        </h2>
        <span className="lx-vh-meta">{t('vhFreeNote')}</span>
      </div>
      <MoreRows today={today} done={done} />
    </section>
  );
}
