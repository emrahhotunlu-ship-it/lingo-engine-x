import { lazy, Suspense, useState } from 'react';
import { flags } from '../../../app/flags';
import type { Film } from '../../../domain/c1/anim';
import { useT } from '../../../i18n';
import { Icon } from '../../../ui/Icon';
import { Sheet } from '../../../ui/Sheet';
import { filmSeconds } from './timing';

// Einstiege in den Struktur-Film (P61): ein ruhiger Startknopf, der den Spieler an Ort und Stelle aufklappt (Kapitelstart, erste
// Einführungskarte), und ein Blatt für das Menü ⋯ „Zeig es mir“. Der Spieler selbst wird erst beim Öffnen geladen (eigener Teil im Build,
// der Start der App bleibt so schnell wie vorher). Alles hinter dem Schalter `fx.film`.

const FilmPlayer = lazy(() => import('./FilmPlayer').then((m) => ({ default: m.FilmPlayer })));

/** Ist der Struktur-Film eingeschaltet? */
export const filmEnabled = (): boolean => flags.fx.film;

function Placeholder() {
  return <div className="lx-fm-skeleton" aria-hidden="true" />;
}

/** Startknopf, der den Film an Ort und Stelle aufklappt. */
export function FilmLauncher({ film, className }: { film: Film | null; className?: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  if (!film || !filmEnabled()) return null;
  if (open)
    return (
      <section className={`lx-fm-inline ${className ?? ''}`} aria-label={t('eeFmSheetTitle')}>
        <Suspense fallback={<Placeholder />}>
          <FilmPlayer film={film} onClose={() => setOpen(false)} />
        </Suspense>
      </section>
    );
  return (
    <button type="button" className={`lx-fm-launch ${className ?? ''}`} onClick={() => setOpen(true)} data-testid="film-open" data-film={film.id}>
      <span className="lx-fm-launch-icon" aria-hidden="true">
        <Icon name="play" size={18} />
      </span>
      <span className="flex min-w-0 flex-col text-left">
        <span className="font-semibold">{t('eeFmOpen')}</span>
        <span className="text-sm text-muted">{t('eeFmOpenSub', { s: filmSeconds(film) })}</span>
      </span>
    </button>
  );
}

/** Der Film in einem Blatt (Menü ⋯ „Zeig es mir“). */
export function FilmSheet({ film, open, onClose }: { film: Film | null; open: boolean; onClose: () => void }) {
  const { t } = useT();
  return (
    <Sheet open={open && !!film} onClose={onClose} title={t('eeFmSheetTitle')} closeLabel={t('eeFmClose')}>
      {film && open && (
        <Suspense fallback={<Placeholder />}>
          <FilmPlayer film={film} onClose={onClose} />
        </Suspense>
      )}
    </Sheet>
  );
}
