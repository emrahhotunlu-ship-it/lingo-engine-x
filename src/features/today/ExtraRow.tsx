import { useMemo, useState } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { addDays, dayKey } from '../../domain/date';
import { laptopDeepen } from '../../domain/metrics';
import { histOf } from '../../domain/srs/flip';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT } from '../../i18n';
import { useInputProfile } from '../../platform/input';
import { unlockSpeech } from '../../platform/speech';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { checkAvailable, startCheck } from '../check/session';
import { startExtra } from '../vocab/start';
import { useVocabCards } from '../vocab/hub/data';
import { useDocsOnce } from '../progress/useOnce';
import { dowOf } from '../../domain/unit/planFor';

// „Extra ›“ nach der Pflicht (Lernplattform 2.0 §2.2): genau EINE Zeile auf Heute, dahinter ein Blatt mit höchstens drei Einträgen in
// fester Reihenfolge. Nichts davon zählt für Ring oder Serie. Die Wörter für „Am Laptop vertiefen“ kommen aus der Datenbank
// (`laptopDeepen`, `log/<tag>`), also auch die vom iPhone am Morgen; `localStorage` spielt keine Rolle.

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

type Line = { id: string; label: string; sub: string; run: () => void };

export function ExtraRow({ today }: { today: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="today-extra" className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-accent-text hover:underline">
        {t('hxExtraRow')}
        <Icon name="arrowRight" size={16} />
      </button>
      {open && <ExtraSheet today={today} onClose={() => setOpen(false)} />}
    </>
  );
}

function ExtraSheet({ today, onClose }: { today: string; onClose: () => void }) {
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

  const lines = useMemo((): Line[] => {
    const out: Line[] = [];
    if (profile === 'keys') {
      const words = laptopDeepen({ log, cards, today, max: 3 });
      out.push({
        id: 'laptop',
        label: t('hxExtraLaptop'),
        sub: words.length ? t('hxExtraLaptopWords', { words: words.join(', ') }) : t('hxExtraLaptopSub'),
        run: () => {
          onClose();
          go({ name: 'comboSentence' });
        },
      });
    } else {
      const wrong = cards.filter((c) => !c.hidden && histOf(c.doc).some((h) => h.g === 1 && dayKey(h.t) === today));
      if (wrong.length > 0) {
        const keys = new Set(wrong.map((c) => c.key));
        out.push({
          id: 'wrong',
          label: t('hxExtraWrong'),
          sub: t('hxExtraWrongSub', { n: wrong.length }),
          run: () => {
            onClose();
            startExtra(api, { deck: 'all', pick: (c) => keys.has(c.key), allowNew: false, size: Math.min(10, keys.size), label: t('hxExtraWrong') });
          },
        });
      }
    }
    out.push({
      id: 'speak',
      label: t('hxExtraSpeak'),
      sub: t('hxExtraSpeakSub'),
      run: () => {
        onClose();
        go({ name: 'speak' });
      },
    });
    if (dowOf(today) === 1 && checkAvailable(appProfile, addDays(today, -1)) && Number(obj(appProfile).answers ?? 0) >= 40) {
      out.push({
        id: 'check',
        label: t('hxExtraCheck'),
        sub: t('hxExtraCheckSub'),
        run: () => {
          unlockSpeech();
          onClose();
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
  }, [profile, cards, log, today, appProfile, now, t]);

  return (
    <Sheet open onClose={onClose} title={t('hxExtraTitle')} closeLabel={t('close')}>
      <div className="flex flex-col gap-4" data-testid="today-extra-sheet">
        <ul className="m-0 flex list-none flex-col divide-y divide-line overflow-hidden rounded-2xl bg-surface p-0">
          {lines.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={l.run} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left" data-testid="extra-line" data-line={l.id}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{l.label}</span>
                  <span className="text-sm text-muted">{l.sub}</span>
                </span>
                <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
              </button>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">{t('hxExtraNote')}</p>
      </div>
    </Sheet>
  );
}
