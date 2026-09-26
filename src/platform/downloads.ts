import { getDownloads } from './capabilities';
import { logError, logWarn } from './diagnostics';

// Datenexport (Kap. 6.14) über die Fähigkeit `downloads`. Der Nutzer bestätigt jede Datei.

export type SaveOutcome = 'saved' | 'declined' | 'unavailable' | 'busy' | 'error';

export async function saveFile(filename: string, data: string): Promise<SaveOutcome> {
  const dl = getDownloads();
  if (!dl) return 'unavailable';
  try {
    const res = await dl.save({ filename, data });
    return res.status === 'saved' || res.status === 'delivered' ? 'saved' : 'error';
  } catch (err) {
    const code = err && typeof err === 'object' ? (err as { code?: unknown }).code : undefined;
    switch (code) {
      case 'declined':
        logWarn('downloads:save', err, filename);
        return 'declined';
      case 'rate_limited':
        logWarn('downloads:save', err, filename);
        return 'busy';
      case 'unavailable':
      case 'not_granted':
      case 'capability_disabled':
      case 'capability_removed':
        logWarn('downloads:save', err, filename);
        return 'unavailable';
      default:
        logError('downloads:save', err, filename);
        return 'error';
    }
  }
}
