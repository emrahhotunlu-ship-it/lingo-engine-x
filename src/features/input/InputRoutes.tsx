import type { Route } from '../../app/nav';
import { DiscoverScreen } from '../discover/DiscoverScreen';
import { ItemScreen } from '../discover/ItemScreen';
import { ListenScreen } from '../listen/ListenScreen';
import { ReadScreen } from '../read/ReadScreen';
import { WriteScreen } from '../write/WriteScreen';
import { HistoryScreen } from './HistoryScreen';

// Bildschirme von Phase 4 an einer Stelle (App.tsx bindet nur diese Komponente ein).
// Die Route kommt als Eigenschaft aus App.tsx, nicht aus dem Store: Beim Bildschirmwechsel bleibt
// der alte Bildschirm während der Ausblendung stehen (AnimatePresence) und darf dabei nicht schon
// den neuen zeigen – sonst träfe ein schneller Tipp eine Kopie, die gleich verschwindet.

export function InputRoutes({ route }: { route: Route }) {
  switch (route.name) {
    case 'read':
      return <ReadScreen key={`${route.id ?? ''}|${route.mode ?? ''}`} ctx={route.ctx} id={route.id} mode={route.mode} />;
    case 'listen':
      return <ListenScreen key={`${route.id ?? ''}|${route.mode ?? ''}`} ctx={route.ctx} id={route.id} mode={route.mode} />;
    case 'write':
      return <WriteScreen ctx={route.ctx} />;
    case 'discover':
      return <DiscoverScreen />;
    case 'discoverItem':
      return <ItemScreen key={`${route.feedId}|${route.itemId}`} feedId={route.feedId} itemId={route.itemId} ctx={route.ctx} />;
    case 'history':
      return <HistoryScreen key={route.kind} kind={route.kind} />;
    default:
      return null;
  }
}
