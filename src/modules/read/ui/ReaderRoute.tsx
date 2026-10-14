import { getWriter, useNav } from '../sharedUi';
import type { ScreenProps } from '../sharedUi';
import { ReaderScreen } from './reader';

/** Seite `readArticle`: der Leser mit dem gemeinsamen Schreiber der App (geteilte Warteschlangen). */
export function ReaderRoute({ route }: ScreenProps<'readArticle'>) {
  const go = useNav((s) => s.go);
  return <ReaderScreen id={route.id} startAt={route.at ?? null} writer={getWriter() ?? undefined} onOpen={(id) => go({ name: 'readArticle', id })} onList={() => go({ name: 'read' })} />;
}
