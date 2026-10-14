import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArticleItem, ReadState } from '../../schemas';
import { parseDayDoc, parseMonthDoc, parsePrefs } from '../../domain/docs';
import type { Prefs } from '../../domain/docs';
import { dayOfArticleId, monthOfDay, readDayPath, readMonthPath, READ_PREFS_PATH } from '../../domain/paths';
import { rdrText } from '../../domain/readerText';
import { saveReadState } from '../../store';
import { logError, logWarn } from '../../shared';
import type { Writer } from '../../shared';
import { Button, Skeleton, createWriter, getWriter, useT, waitForDb } from '../../sharedUi';
import { saveView } from './persist';
import { ReaderView } from './ReaderView';

// Der Leser als Seite (docs/umbau/lesen-plan.md §2.2): lädt EINEN Artikel nach Kennung (Tagesdokument, Monatsindex, Einstellungen, je ein
// `get`, kein Abo) und zeigt `ReaderView`. Geschrieben wird nur auf Handlung: Ansicht wechseln, Ausblenden/Verlassen.

type Loaded = { article: ArticleItem; day: string; state: ReadState | null; prefs: Prefs };
type Phase = { key: string } & ({ status: 'loading' } | { status: 'notfound' } | { status: 'failed' } | ({ status: 'ready' } & Loaded));

export type ReaderScreenProps = {
  /** Artikel-Kennung `a-<Tag>-<Nr.>-<Streuwert>`. */
  id: string;
  /** Der eine Schreibpfad der App; ohne Angabe wird aus der Datenbank-Fähigkeit ein eigener erzeugt. */
  writer?: Writer;
};

const writers = new WeakMap<object, Writer>();

export function ReaderScreen({ id, writer }: ReaderScreenProps) {
  const { lang } = useT();
  const [loaded, setPhase] = useState<Phase | null>(null);
  const [attempt, setAttempt] = useState(0);
  const w = useRef<Writer | null>(writer ?? null);
  useEffect(() => {
    if (writer) w.current = writer;
  }, [writer]);

  useEffect(() => {
    let alive = true;
    const key = `${id}#${attempt}`;
    void (async () => {
      const day = dayOfArticleId(id);
      if (!day) {
        if (alive) setPhase({ key, status: 'notfound' });
        return;
      }
      try {
        const db = await waitForDb();
        if (!db) {
          if (alive) setPhase({ key, status: 'failed' });
          return;
        }
        if (writer) w.current = writer;
        // Zuerst der eine Schreibpfad der App (eine Schreibreihe je Dokument); nur ohne ihn ein eigener.
        if (!w.current) w.current = getWriter() ?? null;
        if (!w.current) {
          const known = writers.get(db);
          w.current = known ?? createWriter(db);
          writers.set(db, w.current);
        }
        const [d, m, p] = await Promise.all([db.doc(readDayPath(day)).get(), db.doc(readMonthPath(monthOfDay(day))).get(), db.doc(READ_PREFS_PATH).get()]);
        const dayDoc = parseDayDoc(d.exists ? d.data() : undefined);
        const article = dayDoc.ok ? dayDoc.items.find((x) => x.id === id) : undefined;
        if (!alive) return;
        if (!article) {
          setPhase({ key, status: 'notfound' });
          return;
        }
        const month = parseMonthDoc(m.exists ? m.data() : undefined);
        const state = month.ok ? (month.items.find((x) => x.id === id)?.st ?? null) : null;
        setPhase({ key, status: 'ready', article, day, state, prefs: parsePrefs(p.exists ? p.data() : undefined) });
      } catch (err) {
        logError('read:reader', err, id);
        if (alive) setPhase({ key, status: 'failed' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, attempt, writer]);

  const phase: Phase = loaded && loaded.key === `${id}#${attempt}` ? loaded : { key: '', status: 'loading' };
  const day = phase.status === 'ready' ? phase.day : null;
  const onProgress = useCallback(
    (patch: ReadState) => {
      const writer2 = w.current;
      if (!writer2 || !day) return;
      saveReadState(writer2, monthOfDay(day), id, patch).catch((err: unknown) => logWarn('read:progress', err, id));
    },
    [day, id],
  );
  const onViewChange = useCallback((view: 'a' | 'b' | 'c') => {
    if (w.current) void saveView(w.current, view);
  }, []);

  if (phase.status === 'loading')
    return (
      <div className="mx-auto flex w-full max-w-[66ch] flex-col gap-3" role="status" aria-label={rdrText(lang, 'rdrLoading')} data-testid="rdr-loading">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  if (phase.status === 'notfound')
    return (
      <p className="m-0 text-sm text-muted" role="status" data-testid="rdr-notfound">
        {rdrText(lang, 'rdrNotFound')}
      </p>
    );
  if (phase.status === 'failed')
    return (
      <div className="flex flex-col items-start gap-3" role="status" data-testid="rdr-failed">
        <p className="m-0 text-sm text-danger-text">{rdrText(lang, 'rdrLoadFailed')}</p>
        <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
          {rdrText(lang, 'rdrRetry')}
        </Button>
      </div>
    );
  return <ReaderView key={phase.article.id} article={phase.article} state={phase.state} view={phase.prefs.view} autoSpeak={phase.prefs.autoSpeak} onViewChange={onViewChange} onProgress={onProgress} />;
}
