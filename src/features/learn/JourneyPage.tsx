import { Slot } from '../../app/slots';
import { useT } from '../../i18n';
import { useCompanionSee } from '../companion/seeing';

// C1-Reise als eigene Seite (Relaunch Teil 1c, D5 V-GRAMMATIK): Auf der Wurzel des Reiters fällt die Reise weg (Vorschau H6/L4 zeigt „Du bist hier“
// und die Kapitelliste); erreichbar bleibt sie über das Kapitel-Detail („C1-Reise ansehen“, stufe1c-plan §5 A5: höchstens zwei Tipps tiefer).
// Die Reise selbst meldet sich über den Slot `grammar.head` an (`features/c1/programmap.slot.tsx`), unverändert seit R6 (P58).

export function JourneyPage() {
  const { t } = useT();
  useCompanionSee({ area: 'grammar', label: t('pxMapTitle'), phase: 'idle' });
  return (
    <div className="lx-vg lx-vg-page" data-testid="journey-page">
      <Slot name="grammar.head" />
    </div>
  );
}
