import { useSettings } from '../../app/settings';
import type { UnitBlockProvider, UnitCtx } from '../../app/unit/types';
import { inboxReadOn, startInbox } from '../inbox/session';
import { startShadow } from '../pron/session';
import { startPressure } from '../pressure/session';
import { startDrill } from './session';
import { unitRunOf } from './shared';

// Block-Anbieter der Tageseinheit von Paket P7 (Plan §1.5, N106). `start` baut die Sitzung
// SYNCHRON im Klick (iPhone-Tastatur) und liefert die Route; P1 öffnet sie. Rückfälle ohne KI oder
// Sprachausgabe entscheidet P1 vorher mit `resolveBlock` (M5) – hier nur `feasible`.

const lang = () => useSettings.getState().lang;

export const P7_UNIT_BLOCKS: readonly UnitBlockProvider[] = [
  {
    kind: 'pron.shadow',
    // Am Handy entfällt das Nachsprechen (Emrah 01.10.2026): der Block zählt dann nach dem Input.
    feasible: (env) => env.tts && !env.phone,
    start: (ctx: UnitCtx) => {
      // Quellen: Sätze aus Block 2, sonst Themen-Text der Woche, sonst die Wendungen der Woche.
      const phrases = ctx.phrases?.length ? ctx.phrases : ctx.targets.phrases;
      return startShadow({ unit: unitRunOf(ctx), sentences: ctx.sentences ?? null, phrases }) ? { name: 'pron', kind: 'shadow' } : false;
    },
  },
  {
    kind: 'task.inbox',
    feasible: () => true,
    start: (ctx: UnitCtx) => {
      const unit = unitRunOf(ctx);
      if (ctx.block === 2) {
        return startInbox({ unit, lang: lang(), part: 'read' }) ? { name: 'inbox' } : false;
      }
      const readId = inboxReadOn(ctx.day);
      return startInbox({ unit, lang: lang(), part: readId ? 'reply' : 'full', id: readId || null }) ? { name: 'inbox' } : false;
    },
  },
  {
    kind: 'task.objection',
    feasible: () => true,
    // Kurz-Einheit (Samstag, ≤ 7 Min.): 3 statt 5 Einwände.
    start: (ctx: UnitCtx) => (startPressure({ unit: unitRunOf(ctx), lang: lang(), n: ctx.minutes > 0 && ctx.minutes <= 7 ? 3 : 5 }) ? { name: 'pressure' } : false),
  },
  {
    kind: 'focus.colloc',
    feasible: () => true,
    start: (ctx: UnitCtx) => (startDrill('colloc', { unit: unitRunOf(ctx), lang: lang(), n: 3 }) ? { name: 'nbdrill', set: 'colloc' } : false),
  },
];

