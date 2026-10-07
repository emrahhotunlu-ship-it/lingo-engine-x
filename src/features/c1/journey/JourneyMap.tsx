import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { ProgramChapter } from '../../../domain/c1/programTypes';
import type { ChapterProgress } from '../../../domain/c1/state';
import { useFxLevel } from '../../../engine/fx/level';
import { useT } from '../../../i18n';
import { local } from '../../../platform/storage';

// C1-Reise (Lernplattform 3.0 P58, Erlebnis-Engine §5.4): die Premium-Darstellung der Programmkarte. Rein darstellend: alle Zahlen kommen vom
// Aufrufer (`chapterState`, dieselbe Quelle wie der Lernpfad), hier wird nichts gerechnet und nichts gespeichert außer dem Gerätevermerk,
// dass „Du bist hier“ heute schon einmal in die Mitte gerollt wurde (`lx:journey-seen`).
//
// Handy: sieben Stationen auf einer geschwungenen Route von unten (Kapitel 1) nach oben (C1), dahinter ein Untergrund aus Höhenlinien und
// Sternenstaub, leicht nach hinten gekippt (CSS-Perspektive). Laptop: dieselbe Route waagerecht. Parallaxe nur über `animation-timeline`
// (wo der Browser es kann), der Lichthof der aktuellen Station atmet dreimal und steht dann still. Stufe „Aus“: flach, ohne Bewegung,
// dieselbe Information. Die Route wird aus den gemessenen Stationen gezeichnet (ResizeObserver, keine Dauerschleife).

export type JourneyOrientation = 'vertical' | 'horizontal';

export type JourneyMapProps = {
  chapters: readonly ProgramChapter[];
  progress: readonly ChapterProgress[];
  orientation: JourneyOrientation;
  /** Waagerecht: gewähltes Kapitel (Knopf gedrückt). */
  picked?: number;
  /** Senkrecht: Kapitelblatt öffnen; waagerecht: Kapitel wählen. */
  onSelect: (index: number) => void;
  /** Heutiges Datum: „Du bist hier“ wird einmal je Tag in die Mitte gerollt (nur senkrecht). Ohne Datum nie. */
  centerDay?: string | undefined;
  /** Inhalt unter der Route (Ziel bzw. Detailfeld). */
  children?: ReactNode;
  /** Für Vorschauen (Demo): andere Testkennung der Wurzel. */
  testId?: string;
};

const SEEN_KEY = 'lx:journey-seen';
/** Seitliche Auslenkung der Stationen (rem) am Handy: eine ruhige Schlangenlinie. */
const WAVE_X = [0, 1.25, 2.25, 1.25, 0, 1.25, 2.25] as const;
/** Höhenversatz am Laptop (rem). */
const WAVE_Y = [1.5, 0.5, 1.25, 0, 1, 0.25, 1.25] as const;

type Pt = { x: number; y: number };

/** Station: geschafft = grüner Ring mit Haken, aktuell = Grammatik-Farbe mit Fortschritt, offen = gestrichelt mit Nummer. */
function Station({ n, status, frac }: { n: number; status: ChapterProgress['status']; frac: number }) {
  const r = 19;
  const c = 2 * Math.PI * r;
  return (
    <svg className="relative block flex-none" width={44} height={44} viewBox="0 0 44 44" aria-hidden="true" data-testid="program-station" data-state={status}>
      {status === 'done' ? (
        <>
          <circle cx="22" cy="22" r={r} fill="var(--lx-jr-node-bg)" />
          <circle cx="22" cy="22" r={r} fill="var(--lx-ok-soft)" stroke="var(--lx-ok)" strokeWidth="3" />
          <path d="M14 22.5l5.5 5.5L30 17" fill="none" stroke="var(--lx-ok-text)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="22" cy="22" r={r} fill="var(--lx-jr-node-bg)" stroke="var(--lx-line-strong)" strokeWidth="3" strokeDasharray={status === 'current' ? undefined : '4 4'} />
          {status === 'current' && (
            <circle
              cx="22"
              cy="22"
              r={r}
              fill="none"
              stroke="var(--lx-ch-grammar)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${c * Math.max(frac, 0.12)} ${c}`}
              transform="rotate(-90 22 22)"
            />
          )}
          <text x="22" y="27.5" textAnchor="middle" fill="var(--lx-fg)" fontSize="15" fontWeight="650">
            {n}
          </text>
        </>
      )}
    </svg>
  );
}

const frac = (p: ChapterProgress): number => (p.patTotal > 0 ? Math.min(1, p.patSafe / p.patTotal) : 0);

export function StatusChip({ status }: { status: ChapterProgress['status'] }) {
  const { t } = useT();
  if (status === 'open') return null;
  return status === 'done' ? (
    <span className="inline-flex h-6 flex-none items-center rounded-full bg-ok-soft px-2.5 text-xs font-bold text-ok-text" data-testid="program-done">
      {t('pxMapDone')}
    </span>
  ) : (
    <span className="inline-flex h-[1.375rem] flex-none items-center rounded-full px-2.5 text-xs font-bold" style={{ background: 'var(--lx-btn-grammar)', color: '#fff' }} data-testid="program-here">
      {t('pxMapHere')}
    </span>
  );
}

export function PatsLine({ p, compact = false }: { p: ChapterProgress; compact?: boolean }) {
  const { t } = useT();
  // Waagerecht ist die Spalte schmal: kurzer Balken mit „a/b“ (die ganze Zeile steht im Namen des Knopfs).
  if (compact && p.ready)
    return (
      <span className="lx-jr-pats lx-tnum text-sm text-muted" data-testid="program-pats" data-safe={p.patSafe} data-total={p.patTotal} title={t('pxMapPats', { a: p.patSafe, b: p.patTotal })}>
        <span className="lx-jr-pats-bar" aria-hidden="true">
          <span style={{ width: `${Math.round(frac(p) * 100)}%` }} />
        </span>
        {p.patSafe}/{p.patTotal}
      </span>
    );
  return p.ready ? (
    <span className="lx-tnum text-sm text-muted" data-testid="program-pats" data-safe={p.patSafe} data-total={p.patTotal}>
      {t('pxMapPats', { a: p.patSafe, b: p.patTotal })}
    </span>
  ) : (
    <span className="text-sm text-muted" data-testid="program-soon">
      {t('pxMapSoon')}
    </span>
  );
}

// ----------------------------------------------------------------------------------------------- Untergrund (fest, deterministisch)

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Höhenlinien: geschlossene, leicht gewellte Ringe um zwei Gipfel; Sternenstaub: feste Punkte. Einmal beim Laden berechnet. */
const GROUND = (() => {
  const rnd = lcg(58);
  const contour = (cx: number, cy: number, r: number, k: number): string => {
    const pts: string[] = [];
    const N = 48;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const w = 1 + 0.09 * Math.sin(a * 3 + k) + 0.05 * Math.sin(a * 5 + k * 1.7);
      pts.push(`${(cx + Math.cos(a) * r * 1.35 * w).toFixed(1)} ${(cy + Math.sin(a) * r * w).toFixed(1)}`);
    }
    return `M${pts.join('L')}Z`;
  };
  const lines: string[] = [];
  for (let i = 1; i <= 7; i++) lines.push(contour(300, 150, i * 34, i * 0.6));
  for (let i = 1; i <= 5; i++) lines.push(contour(90, 640, i * 38, i * 0.9 + 2));
  const stars = Array.from({ length: 70 }, () => ({
    x: rnd() * 400,
    y: rnd() * 800,
    r: 0.6 + rnd() * 1.3,
    o: 0.18 + rnd() * 0.5,
  }));
  return { lines, stars };
})();

function Ground({ orientation }: { orientation: JourneyOrientation }) {
  return (
    <div className="lx-jr-ground-clip" aria-hidden="true">
      <div className="lx-jr-ground" data-orient={orientation}>
        <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" className="lx-jr-ground-svg">
          <g className="lx-jr-contours">
            {GROUND.lines.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          <g className="lx-jr-dust">
            {GROUND.stars.map((s, i) => (
              <circle key={i} cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.r.toFixed(2)} opacity={s.o.toFixed(2)} />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------------------------- Route

type Seg = { d: string; tone: 'walked' | 'arrive' | 'ahead' };

function segPath(a: Pt, b: Pt, orientation: JourneyOrientation): string {
  const f = (n: number) => n.toFixed(1);
  if (orientation === 'vertical') {
    const my = (a.y + b.y) / 2;
    return `M${f(a.x)} ${f(a.y)}C${f(a.x)} ${f(my)} ${f(b.x)} ${f(my)} ${f(b.x)} ${f(b.y)}`;
  }
  const mx = (a.x + b.x) / 2;
  return `M${f(a.x)} ${f(a.y)}C${f(mx)} ${f(a.y)} ${f(mx)} ${f(b.y)} ${f(b.x)} ${f(b.y)}`;
}

/** Misst die Mittelpunkte der Stationen (`[data-jr-node]`) relativ zur Bühne und zeichnet die Route neu, sobald sich die Größe ändert. */
function useRoute(stage: RefObject<HTMLDivElement | null>, key: string): { pts: Pt[]; w: number; h: number } {
  const [geo, setGeo] = useState<{ pts: Pt[]; w: number; h: number }>({
    pts: [],
    w: 0,
    h: 0,
  });
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = (): void => {
      const base = el.getBoundingClientRect();
      const nodes = [...el.querySelectorAll<HTMLElement>('[data-jr-node]')].sort((a, b) => Number(a.dataset.jrNode) - Number(b.dataset.jrNode));
      const pts = nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return {
          x: r.left - base.left + r.width / 2,
          y: r.top - base.top + r.height / 2,
        };
      });
      setGeo((g) => {
        const same =
          g.w === base.width && g.h === base.height && g.pts.length === pts.length && g.pts.every((p, i) => Math.abs(p.x - (pts[i]?.x ?? 0)) < 0.5 && Math.abs(p.y - (pts[i]?.y ?? 0)) < 0.5);
        return same ? g : { pts, w: base.width, h: base.height };
      });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stage, key]);
  return geo;
}

function Route({ pts, w, h, progress, orientation, summit }: { pts: Pt[]; w: number; h: number; progress: readonly ChapterProgress[]; orientation: JourneyOrientation; summit: boolean }) {
  if (pts.length < 2 || w === 0) return null;
  const segs: Seg[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = progress[i]?.status;
    const b = summit && i === pts.length - 2 ? 'open' : progress[i + 1]?.status;
    const tone: Seg['tone'] = a === 'done' && b === 'done' ? 'walked' : a === 'done' && b === 'current' ? 'arrive' : 'ahead';
    segs.push({ d: segPath(pts[i]!, pts[i + 1]!, orientation), tone });
  }
  return (
    <svg className="lx-jr-route" width={w} height={h} viewBox={`0 0 ${w.toFixed(1)} ${h.toFixed(1)}`} aria-hidden="true" data-testid="journey-route">
      {segs.map((s, i) => (
        <g key={i} data-tone={s.tone}>
          {s.tone !== 'ahead' && <path className="lx-jr-route-glow" d={s.d} />}
          <path className="lx-jr-route-line" d={s.d} />
        </g>
      ))}
    </svg>
  );
}

// ----------------------------------------------------------------------------------------------- Karte

export function JourneyMap({ chapters, progress, orientation, picked, onSelect, centerDay, children, testId }: JourneyMapProps) {
  const { t, lang } = useT();
  const level = useFxLevel();
  const stage = useRef<HTMLDivElement>(null);
  const vertical = orientation === 'vertical';
  const geo = useRoute(stage, `${orientation}|${lang}|${progress.map((p) => p.status).join(',')}|${chapters.length}`);
  const stateName = (p: ChapterProgress): string => (p.status === 'done' ? t('pxMapDone') : p.status === 'current' ? t('pxMapHere') : t('pxMapOpenState'));

  // „Du bist hier“ einmal je Tag in die Mitte rollen (nur senkrecht, nur wenn die Station nicht ohnehin ganz zu sehen ist).
  useEffect(() => {
    if (!vertical || !centerDay) return;
    if (local.get(SEEN_KEY) === centerDay) return;
    local.set(SEEN_KEY, centerDay);
    const here = stage.current?.querySelector<HTMLElement>('[data-here="true"]');
    if (!here || typeof here.scrollIntoView !== 'function') return;
    const r = here.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= window.innerHeight) return;
    here.scrollIntoView({
      block: 'center',
      behavior: level === 'off' ? 'auto' : 'smooth',
    });
  }, [vertical, centerDay, level]);

  return (
    <div className="lx-jr flex flex-col gap-4" data-orient={orientation} data-testid={testId ?? 'journey'}>
      <div ref={stage} className="lx-jr-stage">
        <Ground orientation={orientation} />
        <Route pts={geo.pts} w={geo.w} h={geo.h} progress={progress} orientation={orientation} summit={vertical} />
        {vertical && (
          <div className="lx-jr-summit" aria-hidden="true" data-testid="journey-summit">
            <span className="lx-jr-summit-node" data-jr-node={chapters.length}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 20l6.5-11 4 6.5 2.5-4 5 8.5z" />
                <path d="M9.5 9V4l4 1.5-4 1.5" />
              </svg>
            </span>
            <span className="lx-jr-summit-label">{t('eeJrSummit')}</span>
          </div>
        )}
        <ol className={`lx-jr-list m-0 list-none p-0 ${vertical ? 'flex flex-col-reverse' : 'grid grid-cols-7 gap-2'}`} aria-label={vertical ? t('pxMapRoute') : t('pxMapRailAria')}>
          {chapters.map((c, i) => {
            const p = progress[i]!;
            const here = p.status === 'current';
            const name = c.name[lang];
            return (
              <li
                key={c.id}
                className="lx-jr-stop min-w-0"
                style={
                  vertical
                    ? {
                        ['--jr-x' as string]: `${WAVE_X[i % WAVE_X.length] ?? 0}rem`,
                      }
                    : {
                        ['--jr-y' as string]: `${WAVE_Y[i % WAVE_Y.length] ?? 0}rem`,
                      }
                }
                data-testid="program-chapter"
                data-chapter={c.id}
                data-status={p.status}
                data-here={here ? 'true' : undefined}
              >
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  aria-pressed={vertical ? undefined : i === picked}
                  aria-label={t('pxMapAria', {
                    n: c.n,
                    name,
                    state: stateName(p),
                  })}
                  data-testid="program-chapter-open"
                  className="lx-jr-btn"
                >
                  <span className="lx-jr-node" data-jr-node={i} data-state={p.status}>
                    <Station n={c.n} status={p.status} frac={frac(p)} />
                  </span>
                  <span className="lx-jr-text">
                    {vertical ? (
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold tracking-tight">{t('pxMapChapter', { n: c.n, name })}</span>
                        <StatusChip status={p.status} />
                      </span>
                    ) : (
                      <span className="lx-jr-name w-full text-sm font-semibold leading-tight" lang={lang}>
                        {name}
                      </span>
                    )}
                    <PatsLine p={p} compact={!vertical} />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {children}
    </div>
  );
}
