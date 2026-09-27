import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { TitleActions } from '../system/Chrome';
import { useNav } from '../../app/nav';
import { useT } from '../../i18n';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { nodeOf, PLAYBOOKS, playbookById } from '../../domain/business/playbook';
import type { Playbook, PlaybookPhrase } from '../../domain/business/types';
import { EnglishText } from '../../engine/EnglishText';
import { SpeakButton } from '../../engine/SpeakButton';
import { phraseAdapt, PA_SITUATION_MAX } from '../../prompts/phraseAdapt';
import { Button, IconButton } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { Skeleton } from '../../ui/Skeleton';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { TakeChunkButton } from '../speak/TakeChunkButton';
import { PlaybookDrill } from './PlaybookDrill';
import { useCompanionSee } from '../companion/seeing';

// Phrasen-Baukasten (Plan §5.5, D9): vier Entscheidungsbäume als Inhalt – ohne KI voll nutzbar.
// Frage zur Lage → Optionen → Blatt mit Wendungen (antippbar, 🔊, Register, Hinweis, Beispiel,
// Mitnehmen). Brotkrumen oben, Esc geht eine Ebene zurück. Optional „Auf meine Lage anpassen“.

export function PlaybookScreen() {
  const { t, lang } = useT();
  const route = useNav((s) => s.route);
  const go = useNav((s) => s.go);
  const back = useNav((s) => s.back);
  const id = route.name === 'playbook' ? route.id : undefined;
  const pb = id ? playbookById(id) : undefined;
  useCompanionSee({ area: 'business', label: pb ? `${t('bizPlay')} · ${pb.title[lang]}` : `${t('bizTitle')} · ${t('bizPlay')}`, phase: 'idle' });

  if (!pb) {
    return (
      <div className="flex flex-col gap-6 py-6" data-testid="playbooks">
        <header className="flex items-start gap-2">
          <IconButton icon="arrowLeft" label={t('spBack')} onClick={back} className="-ml-2 flex-none" data-testid="back" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{t('bizPlay')}</h1>
            <p className="text-sm text-muted">{t('pbLead')}</p>
          </div>
          <TitleActions />
        </header>
        <div className="grid gap-3 md:grid-cols-2">
          {PLAYBOOKS.map((p) => (
            <button
              key={p.id}
              type="button"
              data-testid="pb-card"
              data-id={p.id}
              onClick={() => go({ name: 'playbook', id: p.id })}
              className="lx-glass flex flex-col gap-1 rounded-[var(--radius-card)] p-5 text-left"
              style={{ boxShadow: 'inset 3px 0 0 0 var(--lx-ch-business), var(--lx-shadow)' }}
            >
              <span className="text-base font-semibold">{p.title[lang]}</span>
              <span className="text-sm text-muted">{p.purpose[lang]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  return <Tree key={pb.id} pb={pb} />;
}

function Tree({ pb }: { pb: Playbook }) {
  const { t, lang } = useT();
  const go = useNav((s) => s.go);
  const [path, setPath] = useState<string[]>([pb.root]);
  const [drill, setDrill] = useState(false);
  const cur = nodeOf(pb, path[path.length - 1] as string);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[role="dialog"]')) return;
      setPath((p) => (p.length > 1 ? p.slice(0, -1) : p));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (drill) return <PlaybookDrill pb={pb} onClose={() => setDrill(false)} />;

  return (
    <div className="flex flex-col gap-5 py-6" data-testid="playbook" data-id={pb.id}>
      <header className="flex items-start gap-2">
        <IconButton icon="arrowLeft" label={t('spBack')} onClick={() => (path.length > 1 ? setPath(path.slice(0, -1)) : go({ name: 'playbook' }))} className="-ml-2 flex-none" data-testid="back" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{pb.title[lang]}</h1>
          <nav aria-label={t('pbPath')} className="flex flex-wrap items-center gap-1 text-xs text-muted" data-testid="pb-crumbs">
            {path.map((nid, i) => {
              const n = nodeOf(pb, nid);
              const label = !n ? nid : n.kind === 'leaf' ? n.title[lang] : i === 0 ? pb.title[lang] : (nodeOf(pb, path[i - 1] as string) as { kind: 'question'; options: Array<{ label: { de: string; en: string }; next: string }> } | undefined)?.options?.find((o) => o.next === nid)?.label[lang] ?? nid;
              return (
                <span key={nid} className="inline-flex items-center gap-1">
                  {i > 0 && <span aria-hidden="true">›</span>}
                  {i < path.length - 1 ? (
                    <button type="button" className="min-h-8 rounded px-1 hover:text-fg" onClick={() => setPath(path.slice(0, i + 1))}>
                      {label}
                    </button>
                  ) : (
                    <span className="px-1 text-fg" aria-current="step">
                      {label}
                    </span>
                  )}
                </span>
              );
            })}
          </nav>
        </div>
        <TitleActions />
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={cur?.id ?? 'x'} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: DURATION.base, ease: EASE_OUT }}>
          {cur?.kind === 'question' && (
            <Card channel="business" className="flex flex-col gap-3">
              <p className="text-base font-semibold">{cur.q[lang]}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {cur.options.map((o) => (
                  <button key={o.next} type="button" data-testid="pb-option" onClick={() => setPath([...path, o.next])} className="lx-choice">
                    <span className="min-w-0 flex-1 text-left">{o.label[lang]}</span>
                    <Icon name="arrowRight" size={16} />
                  </button>
                ))}
              </div>
            </Card>
          )}
          {cur?.kind === 'leaf' && <Leaf pb={pb} nodeId={cur.id} title={cur.title[lang]} phrases={cur.phrases} />}
        </motion.div>
      </AnimatePresence>

      <div className="flex flex-wrap gap-3 border-t border-line pt-5">
        <Button icon="cards" onClick={() => setDrill(true)} data-testid="drill-start">
          {t('drillStart')}
        </Button>
      </div>
    </div>
  );
}

function PhraseRow({ p, pb, nodeId, def }: { p: PlaybookPhrase; pb: Playbook; nodeId: string; def: string }) {
  const { t, lang } = useT();
  const reg = p.register === 'formal' ? t('regFormal') : p.register === 'informal' ? t('regInformal') : t('regNeutral');
  return (
    <li data-testid="pb-phrase" className="flex flex-col gap-1.5 border-b border-line pb-3 last:border-0 last:pb-0">
      <div className="flex items-start gap-1">
        <EnglishText text={p.en} area="business" source={`playbook/${pb.id}`} title={pb.title.en} className="min-w-0 flex-1 text-base font-semibold" />
        <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs text-muted">{reg}</span>
        <SpeakButton text={p.ex} />
      </div>
      {lang === 'de' && <p className="text-sm text-muted">{p.de}</p>}
      <EnglishText text={p.ex} area="business" source={`playbook/${pb.id}`} title={pb.title.en} className="text-sm text-muted" />
      <p className="text-xs text-subtle">{p.note[lang]}</p>
      <div>
        <TakeChunkButton
          input={{
            en: p.en,
            de: p.de,
            def,
            kind: 'phrase',
            register: p.register,
            why: p.note[lang],
            whyLang: lang,
            level: 'C1',
            src: { kind: 'biz', ref: `playbook/${pb.id}#${nodeId}`, title: pb.title.en, utterance: '', upgraded: p.ex },
          }}
        />
      </div>
    </li>
  );
}

function Leaf({ pb, nodeId, title, phrases }: { pb: Playbook; nodeId: string; title: string; phrases: PlaybookPhrase[] }) {
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const ask = useAsk(phraseAdapt);
  const [open, setOpen] = useState(false);
  const [situation, setSituation] = useState('');
  const running = ask.phase === 'queued' || ask.phase === 'thinking' || ask.phase === 'streaming' || ask.phase === 'slow';
  return (
    <div className="flex flex-col gap-4">
      <Card channel="business">
        <p className="lx-eyebrow">{title}</p>
        <ul className="mt-3 flex flex-col gap-3">
          {phrases.map((p) => (
            <PhraseRow key={p.en} p={p} pb={pb} nodeId={nodeId} def={p.note.en} />
          ))}
        </ul>
      </Card>
      {ai && !open && (
        <div>
          <Button icon="sparkle" onClick={() => setOpen(true)} data-testid="pb-adapt" data-ai="">
            {t('pbAdapt')}
          </Button>
        </div>
      )}
      {ai && open && (
        <Card as="div" className="flex flex-col gap-3" data-testid="pb-adapt-card">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">{t('pbAdaptLabel')}</span>
            <textarea
              value={situation}
              maxLength={PA_SITUATION_MAX}
              rows={3}
              disabled={running}
              onChange={(e) => setSituation(e.target.value)}
              data-testid="pb-adapt-input"
              className="resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-fg outline-none focus:border-[var(--lx-accent)]"
            />
          </label>
          {running ? (
            <div role="status" className="flex flex-col gap-2">
              <p className="text-sm text-muted">{ask.phase === 'slow' ? t('aiSlow') : t('aiThinking')}</p>
              <Skeleton className="h-12 w-full" />
              <div>
                <Button icon="stop" onClick={ask.stop}>
                  {t('aiStop')}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button
                variant="primary"
                icon="sparkle"
                disabled={!situation.trim()}
                data-ai=""
                data-testid="pb-adapt-submit"
                onClick={() => void ask.run({ question: title, phrases: phrases.map((p) => p.en), situation, uiLang: lang })}
              >
                {ask.error ? t('aiRetry') : t('pbAdaptSubmit')}
              </Button>
            </div>
          )}
          {ask.error && !running && (
            <p role="alert" className="text-sm text-danger-text">
              {t(ask.error)}
            </p>
          )}
          {ask.data && (
            <ul className="flex flex-col gap-3" data-testid="pb-adapted">
              {ask.data.phrases.map((p) => (
                <PhraseRow key={p.en} pb={pb} nodeId={`${nodeId}-own`} def={p.def} p={{ en: p.en, de: p.de, register: 'neutral', note: { de: p.why, en: p.why }, ex: p.ex }} />
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
