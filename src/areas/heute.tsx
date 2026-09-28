import { defineArea } from '../app/registry';
import { HubSections } from '../app/shell/Hub';
import { placesOf } from '../app/shell/tabs';
import { CheckScreen } from '../features/check/CheckScreen';
import { TodayScreen } from '../features/today/TodayScreen';
import { useToday } from '../features/today/state';

// Bereich „Heute“ – Besitz: Paket P1 (docs/neubau/architektur.md §5.2).
// WP0a: heutige Bildschirme unter den heutigen Routennamen.

declare module '../app/router/types' {
  interface RouteParams {
    today: NoParams;
    check: NoParams;
  }
}

/** Reiter-Wurzel: Tagesplan, darunter die Abschnitte der Plätze `today` und `learn`. */
function TodayRoot() {
  return (
    <>
      <TodayScreen />
      <HubSections places={placesOf('today')} />
    </>
  );
}

/** Zahl offener Pflichtpunkte am Reiter „Heute" (M13). */
function useOpenDuties(): number {
  const st = useToday();
  return st.ready && st.dayLoaded && st.status === 'open' ? st.duties.total - st.duties.done : 0;
}

export const heute = defineArea({
  id: 'heute',
  screens: {
    today: { kind: 'tab', component: TodayRoot, title: 'navToday' },
    check: { kind: 'exercise', component: CheckScreen, title: 'ckTitle' },
  },
  badge: { id: 'openDuties', use: useOpenDuties },
});
