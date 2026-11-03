import { useMemo, useState } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { addDays } from '../../domain/date';
import { counts, wrongToday } from '../../domain/metrics';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT } from '../../i18n';
import type { IconName } from '../../ui/Icon';
import { unlockSpeech } from '../../platform/speech';
import { toast } from '../../ui/Toast';
import { VRow, VSheet } from '../../ui/v';
import { checkAvailable, startCheck } from '../check/session';
import { startExtra } from '../vocab/start';
import { useVocabCards } from '../vocab/hub/data';
import { dowOf } from '../../domain/unit/planFor';

// „Wenn du mehr willst“ (Relaunch Teil 1c, D2 V-HEUTE; Vorschau H1/L1 `moreRows`, screens.js:91–104): Trennzeile, höchstens DREI Zeilen,
// dann „Alles anzeigen“ (Blatt mit allen Angeboten). Nichts davon zählt für Ring oder Serie (Kap. 2 Nr. 6, Kap. 15); die Unterzeilen sagen es.
// Angebote wie bisher (Lernplattform 2.0 §2.2): „Am Laptop vertiefen“ bzw. „Heute falsch – noch einmal“, „Sprechen“, montags der Wochen-Check.
// Neu nach der Pflicht und an erster Stelle (Vorschau, Vokabeltrainer §1): „Wörter üben“ mit der Zahl der fälligen Karten.

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Größe der Extra-Runde „Wörter üben“ (wie „Noch eine Runde“ im Trainer). */
const PRACTICE_SIZE = 10;
/** Sichtbare Zeilen auf Heute (Vorschau: höchstens drei). */
export const MORE_MAX = 3;

/** `tile` = kurze Beschriftung für die Kacheln auf Heute (Kern e, Vorschau „Sprechen · Rollenspiel“). */
export type ExtraLine = { id: string; icon: IconName; label: string; sub: string; tile: [string, string]; run: () => void };

/** Die Angebote von heute in fester Reihenfolge. `done`: Pflicht erledigt („Wörter üben“ steht dann vorn). */
export function useExtraLines(today: string, done: boolean, before: () => void = () => undefined): ExtraLine[] {
  const { t } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const cards = useVocabCards();
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
          tile: [t('kernTileWords'), t('kernTileWordsSub', { n: due })],
          run: () => {
            before();
            startExtra(api, { deck: 'all', size: PRACTICE_SIZE, label: t('vhWordsPractice') });
          },
        });
      }
    }
    // Lehrer-Prüfung 02.11.2026: „Am Laptop vertiefen“ war derselbe Satz-Schreiben-Schritt wie Schritt 3 (Anwenden) – entfällt. Auf jedem Gerät
    // steht stattdessen „Heute falsch“ (falls es heute falsche Antworten gab).
    const wrong = wrongToday(cards, today);
    if (wrong.length > 0) {
      const keys = new Set(wrong.map((c) => c.key));
      out.push({
        id: 'wrong',
        icon: 'refresh',
        label: t('hxExtraWrong'),
        sub: t('hxExtraWrongSub', { n: wrong.length }),
        tile: [t('kernTileWrong'), t('kernTileWrongSub', { n: wrong.length })],
        run: () => {
          before();
          startExtra(api, { deck: 'all', pick: (c) => keys.has(c.key), allowNew: false, size: Math.min(10, keys.size), label: t('hxExtraWrong') });
        },
      });
    }
    out.push({
      id: 'speak',
      icon: 'mic',
      label: t('hxExtraSpeak'),
      sub: t('hxExtraSpeakSub'),
      tile: [t('kernTileSpeak'), t('kernTileSpeakSub')],
      run: () => {
        before();
        go({ name: 'speak' });
      },
    });
    // Kern e (Vorschau „Lesen · Artikel des Tages“): Lesen steht wie Sprechen als freiwilliges Angebot auf Heute.
    out.push({
      id: 'read',
      icon: 'book',
      label: t('shRead'),
      sub: t('shReadSub'),
      tile: [t('shRead'), t('kernTileReadSub')],
      run: () => {
        before();
        go({ name: 'read' });
      },
    });
    if (dowOf(today) === 1 && checkAvailable(appProfile, addDays(today, -1)) && Number(obj(appProfile).answers ?? 0) >= 40) {
      out.push({
        id: 'check',
        icon: 'target',
        label: t('hxExtraCheck'),
        sub: t('hxExtraCheckSub'),
        tile: [t('kernTileCheck'), t('kernTileCheckSub')],
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
  }, [done, cards, today, appProfile, now, t]);
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
export function MoreRows({ today, done, idp = '', tiles = false }: { today: string; done: boolean; idp?: string; tiles?: boolean }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const go = useNav((s) => s.go);
  const lines = useExtraLines(today, done);
  return (
    <div className="lx-vh-more" data-testid={`${idp}more-rows`} data-tiles={tiles ? '' : undefined}>
      {tiles ? (
        // Kern e (Vorschau): ruhige Kacheln „Sprechen · Rollenspiel“ – am Handy zwei nebeneinander, am Monitor untereinander.
        <div className="lx-kh-tiles">
          {lines.slice(0, MORE_MAX).map((l) => (
            <button key={l.id} type="button" className="lx-kh-tile" onClick={l.run} data-testid="more-row" id={`${idp}more-${l.id}`}>
              <b>{l.tile[0]}</b>
              <span>{l.tile[1]}</span>
            </button>
          ))}
        </div>
      ) : (
        <div>
          {lines.slice(0, MORE_MAX).map((l) => (
            <VRow key={l.id} icon={l.icon} title={l.label} sub={l.sub} onClick={l.run} data-testid="more-row" id={`${idp}more-${l.id}`} />
          ))}
        </div>
      )}
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

/** Handy und schmale Laptops: Kopf „Freiwillig – nur wenn du Zeit hast“ (Kern e, Vorschau) und die Kacheln. */
export function ExtraRow({ today, done }: { today: string; done: boolean }) {
  const { t } = useT();
  return (
    <section className="lx-vh-moresec lx-kh-free" aria-labelledby="td-more-title">
      <h2 id="td-more-title" className="lx-kh-lbl">
        {t('kernFreeHead')}
      </h2>
      <MoreRows today={today} done={done} tiles />
    </section>
  );
}
