import { useNav } from '../../app/nav';
import { DiscoverScreen } from '../discover/DiscoverScreen';
import { ItemScreen } from '../discover/ItemScreen';
import { ListenScreen } from '../listen/ListenScreen';
import { ReadScreen } from '../read/ReadScreen';
import { WriteScreen } from '../write/WriteScreen';
import { HistoryScreen } from './HistoryScreen';

// Bildschirme von Phase 4 an einer Stelle (App.tsx bindet nur diese Komponente ein).

export function InputRoutes() {
  const route = useNav((s) => s.route);
  switch (route.name) {
    case 'read':
      return <ReadScreen ctx={route.ctx} />;
    case 'listen':
      return <ListenScreen ctx={route.ctx} />;
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
