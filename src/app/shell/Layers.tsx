import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import { IconButton } from '../../ui/Button';
import { DURATION } from '../../ui/motion';
import { TitleActions } from '../../features/system/Chrome';
import { savedScroll, useNav } from '../nav';
import { screenOf } from '../registry';
import type { Route, RouteName } from '../router/types';

// Ebenen des Rahmens (docs/neubau/architektur.md §2.1 Nr. 4): Reiter-Wurzel bzw. Seite oder die
// Übungsebene. WP0a zeichnet – wie bisher – nur die sichtbare Ebene; das Behalten verborgener
// Reiter in `<Activity>` und die Fehlergrenzen folgen in WP0b.
//
// Bildschirmwechsel ohne `AnimatePresence mode="wait"`: Der neue Bildschirm steht sofort und blendet
// nur ein. Ein Wechsel kann so nie an einer hängenden Ausblendung stecken bleiben.

/** Zeile über Seiten ohne eigene Titelzeile (`chrome: 'shell'`): Zurück und Titel-Aktionen. */
function PageBar() {
  const { t } = useT();
  const back = useNav((s) => s.back);
  return (
    <div className="flex items-center justify-between gap-3 pt-3" data-testid="page-bar">
      <IconButton icon="arrowLeft" label={t('lrBack')} onClick={back} data-testid="page-back" className="-ml-2" />
      <div data-testid="stand-actions">
        <TitleActions />
      </div>
    </div>
  );
}

export function RouteView({ route }: { route: Route }) {
  const def = screenOf(route.name);
  if (!def) return null;
  const Screen = def.component;
  return (
    <>
      {def.chrome === 'shell' && <PageBar />}
      <Screen route={route} />
    </>
  );
}

/** Die sichtbare Ebene: `data-screen` trägt nur sie (Test-Helfer `screen()`). */
export function Layer({ screen, children }: { screen: string; children: ReactNode }) {
  return (
    <motion.div
      key={screen}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.base }}
      data-screen={screen}
      onAnimationStart={(def) => {
        // Bildlaufposition je Liste (M13): beim Zurückkehren wiederherstellen, sonst oben beginnen.
        if (def && typeof def === 'object' && 'opacity' in def && def.opacity === 1) window.scrollTo({ top: savedScroll(screen as RouteName) });
      }}
    >
      {children}
    </motion.div>
  );
}
