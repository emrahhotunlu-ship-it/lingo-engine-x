import { z } from 'zod';
import { defineArea } from '../app/registry';
import { RoleplayScreen } from '../features/speak/RoleplayScreen';
import { SpeakHub } from '../features/speak/SpeakHub';
import { P5_RESUMABLES } from '../features/speak/resumable';

// Freiwilliges Extra „Sprechen“ (Umbau „Fokus Wörter und Grammatik“, 04.10.2026): Rollenspiel mit den festen
// Szenen; das Einwand-Training hängt als Einstieg am Platz `speak` (Bereich `training`). Kein Reiter.

declare module '../app/router/types' {
  interface RouteParams {
    speak: NoParams;
    /** `unit`: nur noch für alte Verweise; das Rollenspiel gehört nicht mehr zur Tageseinheit. */
    roleplay: { sceneId: string; resume?: boolean; n?: number; unit?: number };
  }
}

export const sprechen = defineArea({
  id: 'sprechen',
  screens: {
    speak: { kind: 'page', chrome: 'shell', component: SpeakHub, title: 'tabSpeak', keepScroll: true },
    roleplay: {
      kind: 'exercise',
      component: RoleplayScreen,
      params: z.object({ sceneId: z.string().min(1), resume: z.boolean().optional(), n: z.number().int().nonnegative().optional(), unit: z.number().int().min(1).max(5).optional() }),
    },
  },
  resumables: P5_RESUMABLES,
});
