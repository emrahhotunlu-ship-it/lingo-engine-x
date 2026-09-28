import type { DecksError } from '../../../domain/srs/decks';
import type { MessageKey } from '../../../i18n';

/** Klarer Hinweis statt Schreiben, wenn eine Grenze von `app/decks` verletzt wäre (data-guard 00:35). */
export function decksErrorKey(e: DecksError | 'failed' | 'offline'): MessageKey {
  switch (e) {
    case 'limit_decks':
      return 'nbWsErrLimitDecks';
    case 'limit_ids':
      return 'nbWsErrLimitIds';
    case 'too_big':
      return 'nbWsErrTooBig';
    case 'name':
      return 'nbWsErrName';
    case 'limit_flagged':
      return 'nbWsErrFlagged';
    case 'invalid':
      return 'nbWsErrInvalid';
    default:
      return 'nbWsErrFailed';
  }
}
