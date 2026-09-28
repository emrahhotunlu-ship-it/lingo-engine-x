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

// Bereich „Sprechen & Schreiben“ – Besitz: Paket P5 (docs/neubau/architektur.md §5.2).
// WP0a: heutige Bildschirme unter den heutigen Routennamen.

declare module '../app/router/types' {
  interface RouteParams {
    /** Neubau: `talk` · `write` · `preply`; alte Namen `scenes`/`business` bleiben als Alias lesbar. */
    speak: { seg?: SpeakSeg | 'talk' | 'write' };
    meeting: { id?: string };
    playbook: { id?: string };
    roleplay: { sceneId: string; resume?: boolean; n?: number };
    mail: NoParams;
    pitch: NoParams;
    say: NoParams;
    fluency: NoParams;
    tones: NoParams;
  }
}

/** Reiter-Wurzel: Sprechen mit Umschalter; die Abschnitte der Plätze `speak`/`write` zeigt der jeweilige Bereich. */
function SpeakRoot() {
  return <SpeakHub />;
}

const optId = z.object({ id: z.string().optional() });

export const sprechen = defineArea({
  id: 'sprechen',
  screens: {
    speak: { kind: 'tab', component: SpeakRoot, title: 'tabSpeak', keepScroll: true, params: z.object({ seg: z.enum(['talk', 'write', 'preply', 'scenes', 'business']).optional() }) },
    meeting: { kind: 'page', component: MeetingScreen, title: 'mtTitle', params: optId },
    playbook: { kind: 'page', component: PlaybookScreen, params: optId },
    roleplay: {
      kind: 'exercise',
      component: RoleplayScreen,
      params: z.object({ sceneId: z.string().min(1), resume: z.boolean().optional(), n: z.number().int().nonnegative().optional() }),
    },
    mail: { kind: 'exercise', component: MailRefiner },
    pitch: { kind: 'exercise', component: PitchCoach },
    say: { kind: 'exercise', component: SayScreen, title: 'sayTitle' },
    fluency: { kind: 'exercise', component: FluencyScreen },
    tones: { kind: 'exercise', component: TonesScreen },
  },
});
