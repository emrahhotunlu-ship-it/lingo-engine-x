import { useEffect, useMemo, useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { useNav, type UnitCtx } from '../../app/nav';
import { useLive } from '../../data/live';
import { hash32 } from '../../domain/random';
import { useT } from '../../i18n';
import { listeningText, LISTEN_GENRES, type ListenGenre } from '../../prompts/listeningText';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Skeleton } from '../../ui/Skeleton';
import { toast } from '../../ui/Toast';
import { AiRunPanel, isBusy } from '../input/AiRunPanel';
import { saveGeneratedListening } from '../input/complete';
import { dbListening, findListening, listenDoneBefore, listenRows, listensOn, pickListening } from '../input/derive';
import { ensureLibrary, rememberPick, useInputLibrary } from '../input/library';
import { UnitShell } from '../input/UnitShell';
import { useInputContext } from '../input/useInputContext';
import { ListenUnit } from './ListenUnit';

// Hören (Kap. 6.8, Plan §4.2): Wahl des Tages nach F1–F4 (ungehörte gespeicherte Hörtexte →
// Startbestand → Claude auf Klick). Heute Gehörtes ist Zustand mit Transkript zum Mitsprechen.

const WORK_GENRES: readonly ListenGenre[] = ['briefing', 'update', 'voicemail'];
const LIFE_GENRES: readonly ListenGenre[] = ['podcast', 'news', 'announcement'];

export function ListenScreen({ ctx, id, mode }: { ctx: UnitCtx; id?: string | undefined; mode?: 'gen' | undefined }) {
  const { t } = useT();
  const back = useNav((s) => s.back);
  const input = useInputContext();
  const status = useInputLibrary((s) => s.status);
  const lpool = useInputLibrary((s) => s.docs.lpool);
  const picks = useInputLibrary((s) => s.picks);
  const profile = useLive((s) => s.docs['app/profile']);
  const [fresh, setFresh] = useState<string | null>(null);
  const [another, setAnother] = useState(false);

  useEffect(() => {
    void ensureLibrary();
  }, []);

  const db = useMemo(() => dbListening(lpool), [lpool]);
  const rows = useMemo(() => listenRows(profile), [profile]);
  const today = useMemo(() => listensOn(rows, input.day), [rows, input.day]);

  const pickKey = `listen|${input.day}${another ? '#2' : ''}`;
  const picked = useMemo(() => {
    if (status !== 'ready') return null;
    const memo = picks[pickKey];
    if (memo) return findListening(memo, db);
    const done = another ? new Set(rows.map((r) => r.id)) : listenDoneBefore(rows, input.day);
    return pickListening({ day: input.day, target: input.target, domain: input.domain }, db, done, another ? '#2' : '');
  }, [status, picks, pickKey, db, another, rows, input.day, input.target, input.domain]);
  useEffect(() => {
    if (picked && !picks[pickKey]) rememberPick(pickKey, picked.id);
  }, [picked, picks, pickKey]);

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex flex-col gap-4 py-8" role="status" aria-label={t('inSkeleton')} data-testid="unit-skeleton">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-full max-w-xl" />
      </div>
    );
  }
  if (status === 'error') {
    return (
      <UnitShell kind="listen" ctx={ctx} state="error" title={t('ch_listen')} onClose={back}>
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <p className="text-sm text-danger-text">{t('inLoadFailed')}</p>
          <Button icon="refresh" onClick={() => void ensureLibrary(true)}>
            {t('inReload')}
          </Button>
        </div>
      </UnitShell>
    );
  }

  const direct = id ? findListening(id, db) : null;
  if (direct && !fresh && !another) {
    const rec = today.find((r) => r.id === direct.id) ?? null;
    return <ListenUnit key={`id-${direct.id}`} item={direct} ctx="extra" day={input.day} start={rec ? 'done' : 'prep'} record={rec} onAnother={null} />;
  }
  if (mode === 'gen' && !fresh) {
    return (
      <UnitShell kind="listen" ctx="extra" state="gen" title={t('ch_listen')} onClose={back}>
        <ListenGenerator onCreated={setFresh} />
      </UnitShell>
    );
  }

  const next = () => {
    setFresh(null);
    setAnother(true);
  };

  const freshItem = fresh ? findListening(fresh, db) : null;
  if (freshItem) {
    return <ListenUnit key={`fresh-${freshItem.id}`} item={freshItem} ctx={another || today.length ? 'extra' : ctx} day={input.day} start="prep" record={null} onAnother={next} />;
  }

  const doneToday = today[0];
  if (doneToday && !another) {
    const item = findListening(doneToday.id, db);
    if (item) return <ListenUnit key={`done-${item.id}`} item={item} ctx={ctx} day={input.day} start="done" record={doneToday} onAnother={next} />;
  }

  if (picked) {
    return <ListenUnit key={`pick-${picked.id}${another ? '#2' : ''}`} item={picked} ctx={another ? 'extra' : ctx} day={input.day} start="prep" record={null} onAnother={next} />;
  }

  return (
    <UnitShell kind="listen" ctx={ctx} state="empty" title={t('ch_listen')} onClose={back}>
      <ListenGenerator onCreated={setFresh} />
    </UnitShell>
  );
}

function ListenGenerator({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useT();
  const ai = useAiAvailable();
  const input = useInputContext();
  const lpool = useInputLibrary((s) => s.docs.lpool);
  const avoid = useMemo(() => [...lpool.values()].map((d) => (typeof d.title === 'string' ? d.title : '')).slice(-20), [lpool]);
  const gen = useAsk(listeningText);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    const list = input.domain === 'work' ? WORK_GENRES : LIFE_GENRES;
    const genre = list[hash32(`${input.day}|genre`) % list.length] ?? LISTEN_GENRES[0];
    const out = await gen.run({ level: input.target, domain: input.domain, genre, avoid, context: input.context });
    if (!out) return;
    setSaving(true);
    try {
      onCreated(await saveGeneratedListening(out, { level: input.target, domain: input.domain, day: input.day }));
    } catch {
      toast(t('inSaveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card channel="listen" data-testid="empty-state">
      <div className="flex flex-col gap-4">
        <p className="text-base">{ai ? t('lsTask') : t('lsNoMore')}</p>
        {ai && (
          <>
            <div data-testid="gen-phase" data-ai-phase={gen.phase}>
              <AiRunPanel phase={gen.phase} error={gen.error} onStop={gen.stop} onRetry={() => void create()} />
            </div>
            {!isBusy(gen.phase) && (
              <div>
                <Button variant="primary" icon="sparkle" onClick={() => void create()} busy={saving} data-testid="gen-new" data-ai="">
                  {t('lsGenNew')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
