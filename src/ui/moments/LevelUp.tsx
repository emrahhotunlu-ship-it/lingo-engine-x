import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { chapterById } from '../../domain/c1/chapters';
import type { LevelKind } from '../../domain/moments/detect';
import { emit } from '../../engine/fx/events';
import { effectiveLevel } from '../../engine/fx/level';
import { startMoment } from '../../engine/fx/measure';
import { useT } from '../../i18n';
import { Button } from '../Button';
import { Odometer } from '../Odometer';
import { Emblem, type EmblemId } from './Emblem';
import { useLevelUp, type LevelShow } from './store';

// Aufstieg (Lernplattform 3.0 P60, EE M8): eine ruhige Karte über einem abgedunkelten Hintergrund. Das Emblem zeichnet sich nach (700 ms), ein
// Lichtstreif zieht einmal darüber, die Zahl rollt; nach 1,4 s steht alles still. „Weiter“ hat sofort den Fokus und ist ab dem ersten Bild bedienbar;
// Esc und Tippen neben die Karte schließen. Stufe „Aus“ zeigt den Endzustand, reduzierte Bewegung blendet nur über (CSS in `r6a.css`).

export function emblemOf(level: LevelKind): EmblemId | null {
  if (level.kind === 'chapter') return `k${level.n}`;
  if (level.kind === 'c1') return 'c1';
  return null;
}

type Props = { show: LevelShow; onClose: () => void };

export function LevelUp({ show, onClose }: Props) {
  const { t, num, lang } = useT();
  const title = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const play = effectiveLevel() !== 'off';
  const { level } = show;
  const emblem = emblemOf(level);
  const chapterName = level.kind === 'chapter' ? (chapterById(`k${level.n}`)?.name[lang] ?? '') : '';
  const value = level.kind === 'words' ? (show.value ?? level.n) : null;

  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    btn.current?.focus();
    const stop = play ? startMoment('level') : null;
    const timer = play ? window.setTimeout(() => emit({ k: 'moment', m: 'level', el: card.current }), 120) : 0;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
      stop?.();
      if (before?.isConnected) before.focus();
    };
    // Einmal je Karte (Wechsel der ID = neue Karte).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show.id]);

  const head =
    level.kind === 'chapter' ? t('eeR6LevelChapter', { n: num(level.n) }) : level.kind === 'c1' ? t('eeR6LevelC1') : t('eeR6LevelWords');
  const body =
    level.kind === 'chapter' ? t('eeR6LevelChapterBody', { name: chapterName }) : level.kind === 'c1' ? t('eeR6LevelC1Body') : t('eeR6LevelWordsBody');

  return createPortal(
    <div
      className="lx-levelup-scrim"
      data-testid="levelup-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={card}
        className="lx-levelup"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title}
        data-testid="levelup"
        data-id={show.id}
        data-kind={level.kind}
        data-demo={show.demo ? 'true' : undefined}
        data-play={play ? '' : undefined}
      >
        <p className="lx-eyebrow m-0 text-ok-text">{t('eeR6LevelEyebrow')}</p>
        {emblem ? (
          <Emblem id={emblem} label={t('eeR6EmblemLabel', { name: emblem === 'c1' ? t('eeR6LevelC1') : chapterName })} />
        ) : (
          value !== null && (
            <span className="dz-hero-n" data-testid="levelup-value">
              <Odometer text={num(value)} {...(show.demo ? {} : { id: `level:${show.id}` })} play={play} delay={300} />
            </span>
          )
        )}
        <h2 id={title} className="m-0 text-xl font-semibold tracking-tight text-balance">
          {head}
        </h2>
        <p className="m-0 text-sm text-muted text-balance">{body}</p>
        <Button ref={btn} variant="primary" size="lg" className="mt-2 w-full sm:w-full" onClick={onClose} data-testid="levelup-continue">
          {t('eeR6Continue')}
        </Button>
      </div>
    </div>,
    document.body,
  );
}

/** Einzige Stelle, an der eine Aufstiegskarte erscheint (in der Shell eingehängt). */
export function LevelUpHost() {
  const current = useLevelUp((s) => s.current);
  const close = useLevelUp((s) => s.close);
  if (!current) return null;
  return <LevelUp key={current.id} show={current} onClose={close} />;
}
