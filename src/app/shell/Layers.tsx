import { Activity, Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { markNavPainted } from '../perf';
import { savedScroll, useNav } from '../nav';
import { kindOf, screenOf } from '../registry';
import type { Route, RouteName } from '../router/types';
import { ScreenBoundary } from './Boundary';
import { LayerContext, type LayerKind } from './layer';
import { Player } from './Player';
import { KEEP_ALIVE, TABS, type TabId } from './tabs';
import { PageTop } from './TopBar';

// Ebenen des Rahmens (docs/neubau/architektur.md §2.1 Nr. 4, §2.7, §3.3):
// - Je besuchtem Reiter bleibt der oberste Bildschirm seines Stapels in `<Activity>` erhalten
//   (verborgen: keine Effekte, Abos abgebaut; Rückkehr ohne Neuaufbau, Bildlauf bleibt). Tiefere
//   Seiten eines Stapels werden abgebaut, ihr Bildlauf bleibt gemerkt.
// - Die Übungsebene (Player) liegt über dem Herkunftsreiter, der verborgen stehen bleibt.
// - `data-screen` trägt nur die sichtbare Ebene; verborgene tragen `data-screen-kept`.
// - Notbremse `KEEP_ALIVE=false` (tabs.ts): nur die sichtbare Ebene, wie vor WP0b.
// Übergänge (N09): nur Deckkraft, ≤ 180 ms, per WAAPI am Ebenen-Container – kein Neuaufbau, kein
// `window.scrollTo` in `onAnimationStart`, kein `AnimatePresence mode="wait"`. Ohne Transform,
// damit `position: fixed` in Übungen (Prüfen-Leiste über der Tastatur) nie springt.

const FADE_MS: Record<LayerKind, number> = { tab: 150, page: 180, exercise: 180, system: 150 };

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Bildlauf je Ebene (nur im Speicher). */
const scrollMemo = new Map<string, number>();
let scrollTopNext = false;

/** Tipp auf den aktiven Reiter mit Seiten im Stapel: die Wurzel beginnt oben. */
export function requestScrollTop(): void {
  scrollTopNext = true;
}

function Container({ name, kind, visible, children }: { name: RouteName; kind: LayerKind; visible: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!visible || !el || reducedMotion() || typeof el.animate !== 'function') return;
    const a = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS[kind], easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    return () => a.cancel();
  }, [visible, kind, name]);
  return (
    <div ref={ref} data-screen={visible ? name : undefined} data-screen-kept={visible ? undefined : name} data-layer={kind}>
      {children}
    </div>
  );
}

/** Reiter-Wurzel oder Seite: Fehlergrenze, ggf. Kopfzeile des Rahmens, Bildschirm. */
function PageLayer({ route, visible }: { route: Route; visible: boolean }) {
  const def = screenOf(route.name);
  if (!def) return null;
  const kind: LayerKind = def.kind === 'tab' ? 'tab' : 'page';
  const Screen = def.component as (p: { route: Route }) => ReactNode;
  return (
    <Container name={route.name} kind={kind} visible={visible}>
      <LayerContext.Provider value={{ kind, route }}>
        <ScreenBoundary route={route}>
          {def.chrome === 'shell' && <PageTop />}
          <Screen route={route} />
        </ScreenBoundary>
      </LayerContext.Provider>
    </Container>
  );
}

/** Übungsebene. */
function ExerciseLayer({ route }: { route: Route }) {
  const def = screenOf(route.name);
  if (!def) return null;
  const Screen = def.component as (p: { route: Route }) => ReactNode;
  return (
    <Container name={route.name} kind="exercise" visible>
      <Player route={route}>
        <Screen route={route} />
      </Player>
    </Container>
  );
}

/** Bildlauf je sichtbarer Ebene merken und beim Wiederkehren vor dem Zeichnen herstellen. */
function useScrollMemo(key: string, name: RouteName): void {
  const current = useRef(key);
  useEffect(() => {
    const onScroll = () => scrollMemo.set(current.current, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useLayoutEffect(() => {
    current.current = key;
    const y = scrollTopNext ? 0 : (scrollMemo.get(key) ?? savedScroll(name));
    scrollTopNext = false;
    if (Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: y });
    markNavPainted();
    // Ist die Seite beim ersten Bild noch zu kurz (Inhalt kommt einen Takt später), wird der
    // Bildlauf gekappt – dann in den nächsten Bildern noch zweimal nachziehen, solange niemand scrollt.
    if (y <= 0 || Math.abs(window.scrollY - y) <= 1) return;
    let tries = 0;
    let id = 0;
    const again = () => {
      if (current.current !== key) return;
      window.scrollTo({ top: y });
      scrollMemo.set(key, y);
      if (Math.abs(window.scrollY - y) > 1 && ++tries < 3) id = requestAnimationFrame(again);
    };
    id = requestAnimationFrame(again);
    return () => cancelAnimationFrame(id);
  }, [key, name]);
}

export function Layers() {
  const tab = useNav((s) => s.tab);
  const stacks = useNav((s) => s.stacks);
  const overlay = useNav((s) => s.overlay);
  const [visited, setVisited] = useState<ReadonlySet<TabId>>(() => new Set([tab]));
  // Abgeleiteter Zustand im Render (erlaubtes Muster): ein neuer Reiter gilt ab jetzt als besucht.
  if (!visited.has(tab)) setVisited(new Set(visited).add(tab));

  const topOf = (id: TabId): Route => {
    const s = stacks[id];
    return s[s.length - 1] ?? (TABS.find((t) => t.id === id)?.root as Route);
  };
  const activeTop = topOf(tab);
  const visibleRoute = overlay ? overlay.route : activeTop;
  const visibleKey = overlay ? `x:${overlay.route.name}` : `${tab}:${activeTop.name}`;
  useScrollMemo(visibleKey, visibleRoute.name);

  if (!KEEP_ALIVE) {
    // Notbremse: nur die sichtbare Ebene (Verhalten wie vor WP0b).
    if (overlay) return <ExerciseLayer key={`x:${overlay.route.name}`} route={overlay.route} />;
    return <PageLayer key={`${tab}:${activeTop.name}`} route={activeTop} visible />;
  }

  return (
    <>
      {TABS.filter((t) => visited.has(t.id)).map((t) => {
        const top = topOf(t.id);
        const visible = !overlay && t.id === tab;
        return (
          <Activity key={t.id} mode={visible ? 'visible' : 'hidden'}>
            <PageLayer key={top.name} route={top} visible={visible} />
          </Activity>
        );
      })}
      {overlay && (
        <Fragment key="overlay">
          <ExerciseLayer key={overlay.route.name} route={overlay.route} />
        </Fragment>
      )}
    </>
  );
}

/** Ist die sichtbare Ebene eine Reiter-Wurzel (Kopf des Rahmens)? */
export function useVisibleKind(): LayerKind {
  const overlay = useNav((s) => s.overlay);
  const name = useNav((s) => s.route.name);
  if (overlay) return 'exercise';
  return kindOf(name) === 'tab' ? 'tab' : 'page';
}
