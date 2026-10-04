import { useNav } from '../../app/nav';
import type { FocusApi } from '../../app/registry';
import { unlockSpeech } from '../../platform/speech';
import { useTodayPlan } from '../today/store';
import { startSession, useSession, type SessionOpts } from './session';

// Starts des Wortschatz-Bereichs: synchron im Klick (iPhone-Tastatur), dann `go` in den Player.

/**
 * „Wiederholen →“ auf „Alle fälligen“: Ist „Wiederholen“ heute Pflicht und noch offen, zählt die
 * Runde zur Pflicht (Modus aus den Einstellungen, DE→EN); sonst eine Extra-Runde über alle Fälligen.
 */
export function startAllDue(api: FocusApi): void {
  unlockSpeech();
  const plan = useTodayPlan.getState().plan;
  if (plan?.duty.includes('review')) {
    const first = startSession('pflicht');
    const s = useSession.getState();
    if (s.status === 'running') {
      if (first === 'typed') api.focusNow();
      else api.blur();
      useNav.getState().go({ name: 'trainer', round: 'pflicht' });
      return;
    }
  }
  startExtra(api, { deck: 'all', size: 20 });
}

/** Freie Runde (Extra): Stapel, zeitweilige Auswahl oder genau diese Karten. */
export function startExtra(api: FocusApi, opts: SessionOpts): void {
  unlockSpeech();
  const first = startSession('extra', opts);
  if (first === 'typed') api.focusNow();
  else api.blur();
  const deck = typeof opts.deck === 'string' && opts.deck !== 'all' ? opts.deck : undefined;
  useNav.getState().go({ name: 'trainer', round: 'extra', ...(deck ? { deck } : {}) });
}
