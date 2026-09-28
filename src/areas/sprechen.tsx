import { z } from 'zod';
import { defineArea } from '../app/registry';
import { MailRefiner } from '../features/business/MailRefiner';
import { PitchCoach } from '../features/business/PitchCoach';
import { PlaybookScreen } from '../features/business/PlaybookScreen';
import { FluencyScreen } from '../features/fluency/FluencyScreen';
import { MeetingScreen } from '../features/meeting/MeetingScreen';
import { SayScreen } from '../features/say/SayScreen';
import { RoleplayScreen } from '../features/speak/RoleplayScreen';
import { SpeakHub } from '../features/speak/SpeakHub';
import { TonesScreen } from '../features/tones/TonesScreen';
import { P5_UNIT_BLOCKS } from '../features/speak/unit';
import { P5_RESUMABLES } from '../features/speak/resumable';

// Bereich „Sprechen & Schreiben“ – Besitz: Paket P5 (docs/neubau/architektur.md §5.2).
// WP0a: heutige Bildschirme unter den heutigen Routennamen.

declare module '../app/router/types' {
  interface RouteParams {
    /** Neubau: `talk` · `write` · `preply`; alte Namen `scenes`/`business` bleiben als Alias lesbar. */
    speak: { seg?: SpeakSeg | 'talk' | 'write' };
    meeting: { id?: string };
    playbook: { id?: string };
    /** `unit`: Block der Tageseinheit (Rollenspiel am Samstag, Generalprobe am Donnerstag). */
    roleplay: { sceneId: string; resume?: boolean; n?: number; unit?: number };
    mail: NoParams;
    pitch: NoParams;
    say: { unit?: number };
    fluency: { unit?: number };
    tones: { unit?: number };
  }
}

/** Reiter-Wurzel: Sprechen mit Umschalter; die Abschnitte der Plätze `speak`/`write` zeigt der jeweilige Bereich. */
function SpeakRoot() {
  return <SpeakHub />;
}

const optId = z.object({ id: z.string().optional() });
/** Block der Tageseinheit (N75); ohne = freies Üben. */
const unitParam = z.object({ unit: z.number().int().min(1).max(5).optional() });

export const sprechen = defineArea({
  id: 'sprechen',
  screens: {
    speak: { kind: 'tab', component: SpeakRoot, title: 'tabSpeak', keepScroll: true, params: z.object({ seg: z.enum(['talk', 'write', 'preply', 'scenes', 'business']).optional() }) },
    meeting: { kind: 'page', component: MeetingScreen, title: 'mtTitle', params: optId },
    playbook: { kind: 'page', component: PlaybookScreen, params: optId },
    roleplay: {
      kind: 'exercise',
      component: RoleplayScreen,
      params: z.object({ sceneId: z.string().min(1), resume: z.boolean().optional(), n: z.number().int().nonnegative().optional(), unit: z.number().int().min(1).max(5).optional() }),
    },
    mail: { kind: 'exercise', component: MailRefiner },
    pitch: { kind: 'exercise', component: PitchCoach },
    say: { kind: 'exercise', component: SayScreen, title: 'sayTitle', params: unitParam },
    fluency: { kind: 'exercise', component: FluencyScreen, params: unitParam },
    tones: { kind: 'exercise', component: TonesScreen, params: unitParam },
  },
  unitBlocks: P5_UNIT_BLOCKS,
  resumables: P5_RESUMABLES,
});
