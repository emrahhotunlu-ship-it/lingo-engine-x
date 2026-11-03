import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { errorsDueByTopic } from '../../domain/metrics';
import { lernweg } from '../../domain/grammar/path';
import { useT } from '../../i18n';
import { Disclosure } from '../../ui/Disclosure';
import { Icon } from '../../ui/Icon';
import { chapterNodes, type TopicNode } from '../grammar/chapters';
import { Dots, topicName } from '../grammar/topicUi';

// Großpaket G5 (Entscheidung 4, Emrah 02.11.2026): EIN Weg durch die Themen statt Kapitelliste plus zweiter Themenliste (M12).
// „Jetzt dran“ ist die Karte darüber (`HereCard`, nicht wiederholt); hier stehen „Als Nächstes“ (höchstens 3 Themen nach dem aktuellen) und
// eingeklappt „Sitzt schon“. Zustände aus derselben Quelle wie die Themenliste (`chapterNodes`), hier wird nichts gespeichert.

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();
const NEXT_MAX = 3;
const isSafe = (n: TopicNode): boolean => n.state === 'safe' || n.state === 'firm';

type Row = TopicNode & { chapter: { de: string; en: string } };

/** Reine Auswahl (testbar): Themen in Lernweg-Reihenfolge, „sitzt“ und die nächsten nach dem aktuellen Thema. */
export function splitPath(rows: readonly Row[], current: string | null): { safe: Row[]; next: Row[]; current: string | null } {
  const safe = rows.filter(isSafe);
  const at = current ? rows.findIndex((r) => r.id === current) : -1;
  const cur = at >= 0 ? current : (rows.find((r) => !isSafe(r))?.id ?? null);
  const from = cur ? rows.findIndex((r) => r.id === cur) + 1 : 0;
  const next = rows
    .slice(from)
    .filter((r) => !isSafe(r) && r.id !== cur)
    .slice(0, NEXT_MAX);
  return { safe, next, current: cur };
}

function TopicRow({ r, onOpen, points }: { r: Row; onOpen: (id: string) => void; points: number }) {
  const { tn, lang } = useT();
  return (
    <li>
      <button type="button" className="lx-v-row" onClick={() => onOpen(r.id)} data-testid="gpath-topic" data-topic={r.id} data-state={r.state}>
        <span className="lx-v-row-t">
          <b>{topicName(r.id, lang)}</b>
          <span>
            {lang === 'en' ? r.chapter.en : r.chapter.de}
            {r.due > 0 ? ` · ${tn('grDueBadge', r.due)}` : ''}
          </span>
        </span>
        <span className="flex flex-none items-center text-sm text-muted" aria-hidden="true">
          <Dots n={points} />
        </span>
        <span className="lx-v-row-chev" aria-hidden="true">
          <Icon name="chevronRight" size={18} />
        </span>
      </button>
    </li>
  );
}

export function TopicPath({ current, onOpen }: { current: string | null; onOpen: (id: string) => void }) {
  const { t } = useT();
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const go = useNav((s) => s.go);
  const docs = useLive((s) => s.collections.grammar) ?? EMPTY;
  const dueByTopic = useMemo(() => errorsDueByTopic(docs, now), [docs, now]);
  const { rows, nChapters } = useMemo(() => {
    const path = chapterNodes({ docs, nowMs: now, today, dueByTopic });
    return {
      rows: path.chapters.flatMap((c) => c.topics.map((x): Row => ({ ...x, chapter: c.name }))),
      nChapters: path.chapters.length,
    };
  }, [docs, now, today, dueByTopic]);
  const { safe, next } = useMemo(() => splitPath(rows, current), [rows, current]);
  const points = (id: string): number => lernweg(id, docs.get(id), now).done.filter(Boolean).length;

  return (
    <section className="lx-vg-path" aria-labelledby="gpath-next" data-testid="gpath" data-safe={safe.length} data-next={next.length}>
      {next.length > 0 && (
        <>
          <h2 id="gpath-next" className="lx-vg-lbl lx-vg-pathlbl">
            {t('gmPathNext')}
          </h2>
          <ul className="lx-vg-chs" data-testid="gpath-next">
            {next.map((r) => (
              <TopicRow key={r.id} r={r} onOpen={onOpen} points={points(r.id)} />
            ))}
          </ul>
        </>
      )}
      {safe.length > 0 && (
        <div className="pt-2" data-testid="gpath-safe">
          <Disclosure label={t('gmPathSafe', { n: safe.length })} testId="gpath-safe-toggle">
            <ul className="lx-vg-chs pt-2">
              {safe.map((r) => (
                <TopicRow key={r.id} r={r} onOpen={onOpen} points={points(r.id)} />
              ))}
            </ul>
          </Disclosure>
        </div>
      )}
      <button type="button" className="lx-vg-quiet" onClick={() => go({ name: 'journey' })} data-testid="gpath-all">
        {t('gmPathAll', { n: nChapters })}
      </button>
    </section>
  );
}
