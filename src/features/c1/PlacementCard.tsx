import { useState } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { readC1, type C1Place } from '../../domain/c1/c1doc';
import { reliabilityOf } from '../../domain/c1/placement/model';
import { canRetake, retakeFrom } from '../../domain/c1/placement/run';
import { useT } from '../../i18n';
import { local } from '../../platform/storage';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { PlacementResult } from './PlacementResult';
import { PlacementScreen } from './PlacementScreen';

// Einstiegskarte der Einstufung (Lernplattform 3.0 P34) im Grammatik-Reiter über der Programmkarte (Slot `grammar.head`). Ohne Einstufung: Einladung
// mit „Später“ (verschiebbar; merkt sich nur den Tag, nur auf diesem Gerät). Mit Einstufung: eine ruhige Zeile mit „Ergebnis ansehen“ und „Neu einstufen“
// (erst nach drei Monaten). Solange die Datenbank noch nicht geladen ist, erscheint nichts.

const LATER_KEY = 'lx:place-later';

const laterToday = (today: string): boolean => local.get(LATER_KEY) === today;

export function PlacementCard() {
  const { t, lang } = useT();
  const today = useClock((s) => s.today);
  const status = useLive((s) => s.status);
  const raw = useLive((s) => s.docs['app/c1']);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(false);
  const [later, setLater] = useState(() => laterToday(today));
  if (status !== 'ready' || raw === undefined) return null;
  const place: C1Place | undefined = readC1(raw).place;
  const dateText = (d: string): string => new Date(`${d}T12:00:00`).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });

  const retake = place ? canRetake(place, today) : false;
  return (
    <>
      {!place && !later && (
        <section className="lx-glass flex flex-col gap-3 rounded-[var(--radius-card)] p-5" aria-labelledby="px-pl-card" data-testid="place-card">
          <h2 id="px-pl-card" className="lx-t-answer tracking-tight">
            {t('pxPlCardTitle')}
          </h2>
          <p className="text-sm text-muted">{t('pxPlCardText')}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => setOpen(true)} data-testid="place-start">
              {t('pxPlCardStart')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                local.set(LATER_KEY, today);
                setLater(true);
              }}
              data-testid="place-later"
            >
              {t('pxPlCardLater')}
            </Button>
          </div>
        </section>
      )}
      {place && (
        <section className="lx-glass flex flex-col gap-2 rounded-[var(--radius-card)] px-5 py-4" data-testid="place-done">
          <p className="text-sm font-semibold">{t('pxPlDoneLine', { d: dateText(place.d) })}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setView(true)} data-testid="place-see">
              {t('pxPlSeeResult')}
            </Button>
            {retake ? (
              <Button variant="ghost" onClick={() => setOpen(true)} data-testid="place-retake">
                {t('pxPlRetake')}
              </Button>
            ) : (
              <span className="text-sm text-muted" data-testid="place-retake-from">
                {t('pxPlRetakeFrom', { d: dateText(retakeFrom(place)) })}
              </span>
            )}
          </div>
        </section>
      )}
      {/* Die Blätter stehen immer an derselben Stelle: Nach dem Speichern wechselt nur die Karte darüber, das offene Blatt bleibt dasselbe Objekt. */}
      <PlacementScreen open={open} onClose={() => setOpen(false)} />
      <Sheet open={view && !!place} onClose={() => setView(false)} title={t('pxPlTitle')} closeLabel={t('pxPlClose')}>
        {view && place && <PlacementResult result={{ theta: place.th ?? 0, se: place.se, n: place.n, reliability: reliabilityOf(place.se), skip: place.skip }} vw={place.vw ?? null} onClose={() => setView(false)} />}
      </Sheet>
    </>
  );
}
