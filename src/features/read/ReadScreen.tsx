import { useEffect, useMemo, useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { useNav, type UnitCtx } from '../../app/nav';
import { wordCount } from '../../domain/input/textStats';
import type { ArticleItem } from '../../domain/input/types';
import { useT, type MessageKey } from '../../i18n';
import { readingText, SOURCE_TEXT_MAX } from '../../prompts/readingText';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Skeleton } from '../../ui/Skeleton';
import { toast } from '../../ui/Toast';
import { AiRunPanel, isBusy } from '../input/AiRunPanel';
import { enrichOwnArticle, saveGeneratedArticle, saveOwnArticle } from '../input/complete';
import { dbArticles, findArticle, pickArticle, readAll, readDoneBefore, readingsOn } from '../input/derive';
import { clearDraft, loadDraft } from '../input/draft';
import { DraftArea } from '../input/DraftArea';
import { ensureLibrary, rememberPick, useInputLibrary } from '../input/library';
import { UnitShell } from '../input/UnitShell';
import { useInputContext } from '../input/useInputContext';
import { ReadUnit } from './ReadUnit';

// Lesen (Kap. 6.8, Plan §4.1, M12, M16): Wahl des Tages nach F1–F4 (gespeichert → Startbestand →
// Claude auf Klick, mit Themenwahl), heute Erledigtes ist Zustand mit Ergebnis. Eigener Text
// wird als Lese-Einheit in `articles/*` gespeichert – nie in `feed/*`.

const TOPIC_CHIPS: ReadonlyArray<{ id: string; label: MessageKey; hint: string }> = [
  { id: 'any', label: 'tp_any', hint: '' },
  { id: 'business', label: 'tp_business', hint: 'business and sales' },
  { id: 'tech', label: 'tp_tech', hint: 'technology and AI' },
  { id: 'football', label: 'tp_football', hint: 'soccer (European football)' },
  { id: 'travel', label: 'tp_travel', hint: 'travel' },
  { id: 'science', label: 'tp_science', hint: 'science' },
  { id: 'film', label: 'tp_film', hint: 'movies and film' },
];

type Doc = Readonly<Record<string, unknown>>;
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

type Chosen = { id: string; fresh: true } | null;

export function ReadScreen({ ctx }: { ctx: UnitCtx }) {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const input = useInputContext();
  const status = useInputLibrary((s) => s.status);
  const articles = useInputLibrary((s) => s.docs.articles);
  const reading = useInputLibrary((s) => s.docs.reading);
  const picks = useInputLibrary((s) => s.picks);
  const [chosen, setChosen] = useState<Chosen>(null);
  const [another, setAnother] = useState(false);
  const [own, setOwn] = useState(false);

  useEffect(() => {
    void ensureLibrary();
  }, []);

  const db = useMemo(() => dbArticles(articles), [articles]);
  const today = useMemo(() => readingsOn(reading, input.day), [reading, input.day]);

  // Die Wahl des Tages: einmal berechnet und gemerkt (würfelt sich beim Neuzeichnen nie neu).
  const pickKey = `read|${input.day}${another ? '#2' : ''}`;
  const picked = useMemo(() => {
    if (status !== 'ready') return null;
    const memo = picks[pickKey];
    if (memo) return findArticle(memo, db);
    const done = another ? readAll(reading) : readDoneBefore(reading, input.day);
    return pickArticle({ day: input.day, target: input.target, domain: input.domain }, db, done, another ? '#2' : '');
  }, [status, picks, pickKey, db, another, reading, input.day, input.target, input.domain]);
  useEffect(() => {
    if (picked && !picks[pickKey]) rememberPick(pickKey, picked.id);
  }, [picked, picks, pickKey]);

  if (status === 'idle' || status === 'loading') return <ReadSkeleton />;
  if (status === 'error') {
    return (
      <UnitShell kind="read" ctx={ctx} state="error" title={t('ch_read')} onClose={() => go({ name: 'today' })}>
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <p className="text-sm text-danger-text">{t('inLoadFailed')}</p>
          <Button icon="refresh" onClick={() => void ensureLibrary(true)}>
            {t('inReload')}
          </Button>
        </div>
      </UnitShell>
    );
  }

  const badgeOf = (item: ArticleItem): string | null => (articles.get(item.id)?.src === 'own' ? t('rdOwnBadge') : null);

  if (own) {
    return (
      <OwnText
        ctx={ctx}
        onCancel={() => setOwn(false)}
        onSaved={(id) => {
          setOwn(false);
          setChosen({ id, fresh: true });
        }}
      />
    );
  }

  // 1. Frisch gewählter Text (erzeugt, eigener oder „Noch einen").
  const freshItem = chosen ? findArticle(chosen.id, db) : null;
  if (freshItem) {
    const doneRow = today.find((r) => r.doc.articleId === freshItem.id && num(r.doc.t) > 0);
    return (
      <ReadUnit
        key={`fresh-${freshItem.id}`}
        item={freshItem}
        pool={db}
        ctx={another || today.length ? 'extra' : ctx}
        day={input.day}
        start={doneRow ? 'done' : 'reading'}
        readingId={doneRow?.id ?? null}
        quiz={null}
        badge={badgeOf(freshItem)}
        extra={<OwnEnrich item={freshItem} doc={articles.get(freshItem.id)} />}
        onAnother={() => {
          setChosen(null);
          setAnother(true);
        }}
      />
    );
  }

  // 2. Heute schon erledigt: Ergebnis als Zustand (kein Knopf, der die Einheit neu startet).
  const doneToday = today[0];
  if (doneToday && !another) {
    const item = findArticle(typeof doneToday.doc.articleId === 'string' ? doneToday.doc.articleId : '', db);
    if (item) {
      const quiz = doneToday.doc.quiz && typeof doneToday.doc.quiz === 'object' ? (doneToday.doc.quiz as Doc) : null;
      return (
        <ReadUnit
          key={`done-${doneToday.id}`}
          item={item}
          pool={db}
          ctx={ctx}
          day={input.day}
          start="done"
          readingId={doneToday.id}
          quiz={quiz ? { n: num(quiz.n), ok: num(quiz.ok) } : null}
          badge={badgeOf(item)}
          onAnother={() => setAnother(true)}
        />
      );
    }
  }

  // 3. Die Wahl des Tages.
  if (picked) {
    return (
      <ReadUnit
        key={`pick-${picked.id}`}
        item={picked}
        pool={db}
        ctx={another ? 'extra' : ctx}
        day={input.day}
        start="reading"
        readingId={null}
        quiz={null}
        badge={badgeOf(picked)}
        extra={<OwnEnrich item={picked} doc={articles.get(picked.id)} />}
        onAnother={() => {
          setChosen(null);
          setAnother(true);
        }}
      />
    );
  }

  // 4. Nichts mehr ungelesen: Claude erzeugt auf Klick (mit Themenwahl), sonst ein klarer Hinweis.
  return (
    <UnitShell kind="read" ctx={ctx} state="empty" title={t('ch_read')} onClose={() => go({ name: 'today' })}>
      <Generator onCreated={(id) => setChosen({ id, fresh: true })} onOwn={() => setOwn(true)} />
    </UnitShell>
  );
}

function ReadSkeleton() {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-4 py-8" role="status" aria-label={t('inSkeleton')} data-testid="unit-skeleton">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-9 w-3/4" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-4 w-full max-w-[68ch]" />
      ))}
    </div>
  );
}

function Generator({ onCreated, onOwn }: { onCreated: (id: string) => void; onOwn: () => void }) {
  const { t } = useT();
  const ai = useAiAvailable();
  const input = useInputContext();
  const articleDocs = useInputLibrary((s) => s.docs.articles);
  const titles = useMemo(() => [...articleDocs.values()].map((d) => (typeof d.title === 'string' ? d.title : '')).slice(-20), [articleDocs]);
  const gen = useAsk(readingText);
  const [topic, setTopic] = useState('any');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    const chip = TOPIC_CHIPS.find((c) => c.id === topic);
    const out = await gen.run({ level: input.target, domain: input.domain, topicHint: chip?.hint ?? '', avoid: titles, context: input.context });
    if (!out?.text) return;
    setSaving(true);
    try {
      const domain = topic === 'any' ? input.domain : topic === 'business' || topic === 'tech' ? 'work' : 'life';
      const id = await saveGeneratedArticle({ ...out, text: out.text }, { level: input.target, domain, day: input.day, src: 'ai' });
      onCreated(id);
    } catch {
      toast(t('inSaveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card channel="read" data-testid="empty-state">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="lx-eyebrow">{t('rdGenTitle')}</p>
          <p className="text-base">{ai ? t('rdTask') : t('inNoMore')}</p>
        </div>
        {ai && (
          <>
            <div role="radiogroup" aria-label={t('rdTopic')} className="flex flex-wrap gap-2" data-testid="topic-chips">
              {TOPIC_CHIPS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={topic === c.id}
                  onClick={() => setTopic(c.id)}
                  data-testid="topic-chip"
                  data-topic={c.id}
                  className={`min-h-11 rounded-full px-4 text-sm transition-colors ${topic === c.id ? 'bg-surface-strong font-semibold text-fg shadow-[inset_0_0_0_1px_var(--lx-fg-subtle)]' : 'bg-surface text-muted hover:text-fg'}`}
                >
                  {t(c.label)}
                </button>
              ))}
            </div>
            <div data-testid="gen-phase" data-ai-phase={gen.phase}>
              <AiRunPanel phase={gen.phase} error={gen.error} onStop={gen.stop} onRetry={() => void create()} />
            </div>
            {!isBusy(gen.phase) && (
              <div>
                <Button variant="primary" icon="sparkle" onClick={() => void create()} busy={saving} data-testid="gen-new" data-ai="">
                  {t('inGenNew')}
                </Button>
              </div>
            )}
          </>
        )}
        <div className="border-t border-line pt-3">
          <Button variant="ghost" icon="plus" onClick={onOwn} data-testid="own-open">
            {t('rdOwnOpen')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Eigener Text (M16): einfügen, dann mit Fragen aufbereiten (KI) oder ohne Fragen speichern. */
function OwnText({ ctx, onCancel, onSaved }: { ctx: UnitCtx; onCancel: () => void; onSaved: (id: string) => void }) {
  const { t } = useT();
  const ai = useAiAvailable();
  const input = useInputContext();
  const gen = useAsk(readingText);
  const [text, setText] = useState(() => loadDraft('read:own'));
  const [saving, setSaving] = useState(false);
  const words = wordCount(text);
  const tooLong = text.length > SOURCE_TEXT_MAX;
  const ok = words >= 60 && !tooLong;

  const title = () =>
    text
      .trim()
      .split(/\s+/)
      .slice(0, 8)
      .join(' ')
      .replace(/[.,;:!?]+$/, '');

  const finish = async (makeId: () => Promise<string>) => {
    setSaving(true);
    try {
      const id = await makeId();
      clearDraft('read:own');
      onSaved(id);
    } catch {
      toast(t('inSaveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const prepare = async () => {
    const source = text.trim();
    const out = await gen.run({ level: input.target, domain: input.domain, topicHint: '', avoid: [], context: input.context, sourceText: source });
    if (!out) return;
    await finish(() => saveGeneratedArticle({ ...out, text: source }, { level: input.target, domain: input.domain, day: input.day, src: 'own' }));
  };

  return (
    <UnitShell kind="read" ctx={ctx} state="own" title={t('rdOwnTitle')} onClose={onCancel} task={t('rdOwnHint')}>
      <div className="flex max-w-[68ch] flex-col gap-3" data-testid="own-text">
        <DraftArea value={text} onChange={setText} label={t('rdOwnLabel')} draftKey="read:own" rows={12} testId="own-draft" />
        {!ok && text.trim() && <p className="text-xs text-muted">{tooLong ? t('rdOwnTooLong') : t('rdOwnTooShort')}</p>}
        <AiRunPanel phase={gen.phase} error={gen.error} onStop={gen.stop} onRetry={() => void prepare()} />
        {!isBusy(gen.phase) && (
          <div className="flex flex-wrap gap-2">
            {ai && (
              <Button variant="primary" icon="sparkle" disabled={!ok} busy={saving} onClick={() => void prepare()} data-testid="own-prepare" data-ai="">
                {t('rdOwnPrepare')}
              </Button>
            )}
            <Button variant={ai ? 'secondary' : 'primary'} disabled={!ok} busy={saving} onClick={() => void finish(() => saveOwnArticle(text.trim(), title(), { level: input.target, domain: input.domain }))} data-testid="own-save">
              {t('rdOwnSave')}
            </Button>
          </div>
        )}
      </div>
    </UnitShell>
  );
}

/** Eigener Text ohne Fragen: auf Klick nachträglich aufbereiten (Titel, Glossar, Fragen). */
function OwnEnrich({ item, doc }: { item: ArticleItem; doc: Doc | undefined }) {
  const { t } = useT();
  const ai = useAiAvailable();
  const input = useInputContext();
  const gen = useAsk(readingText);
  if (!doc || doc.src !== 'own' || item.questions.length > 0 || !ai) return null;
  const run = async () => {
    const out = await gen.run({ level: input.target, domain: input.domain, topicHint: '', avoid: [], context: input.context, sourceText: item.text });
    if (!out) return;
    try {
      await enrichOwnArticle(item.id, out);
    } catch {
      toast(t('inSaveFailed'), 'error');
    }
  };
  return (
    <div className="flex flex-col gap-2" data-testid="own-enrich">
      <AiRunPanel phase={gen.phase} error={gen.error} onStop={gen.stop} onRetry={() => void run()} skeleton={false} />
      {!isBusy(gen.phase) && (
        <div>
          <Button icon="sparkle" onClick={() => void run()} data-ai="">
            {t('rdOwnPrepare')}
          </Button>
        </div>
      )}
    </div>
  );
}
