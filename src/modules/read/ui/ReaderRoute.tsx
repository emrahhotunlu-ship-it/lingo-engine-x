import { getWriter } from '../sharedUi';
import type { ScreenProps } from '../sharedUi';
import { ReaderScreen } from './reader';

/** Seite `readArticle`: der Leser mit dem gemeinsamen Schreiber der App (geteilte Warteschlangen). */
export function ReaderRoute({ route }: ScreenProps<'readArticle'>) {
  return <ReaderScreen id={route.id} writer={getWriter() ?? undefined} />;
}
