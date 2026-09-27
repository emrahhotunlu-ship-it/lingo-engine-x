import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { invalidIdsOf, useLive } from '../../data/live';
import { slug } from '../../domain/content';
import { dayKey } from '../../domain/date';
import { resolveWord, posHint, type CardInfo } from '../../domain/lookup/resolve';
import { cardSrcFor } from '../../domain/input/cardSrc';
import { mergedVocab } from '../../domain/overview';
import { lemmaOf } from '../../domain/srs/context';
import { posKey } from '../../domain/srs/explain';
import { stageOf } from '../../domain/srs/ladder';
import { bracketExample } from '../../domain/srs/newCard';
import { normalizeWord } from '../../domain/text/tokenize';
import { closeLookup, focusTargetOf, useLookup, type WordTapRequest } from '../../engine/wordTap';
import { useSettings } from '../../app/settings';
import { useT, type MessageKey } from '../../i18n';
import { speak, unlockSpeech, useSpeech } from '../../platform/speech';
import { wordLookup, type WordLookupOut } from '../../prompts/wordLookup';
import { Button, IconButton } from '../../ui/Button';
import { toast } from '../../ui/Toast';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { SheetGrip, useSheetDrag } from '../../ui/sheetDrag';
import { ensureLookupLoaded, saveLookupCard, storeLookup, useLookupData } from './store';
import { openCompanion } from '../companion/store';

// Nachschlage-Fenster (Kap. 6.11, Plan §5.6): am Desktop verankert unter dem Wort, am Handy
// als Blatt von unten. Bedeutung aus eigener Karte, Zwischenspeicher oder eingebautem
// Wörterbuch; fehlt das Wort überall, fragt es Claude (Antippen ist die Handlung).
// US-Lautschrift, Aussprache (en-US), „Als Karte speichern", „Claude fragen". Esc/außerhalb schließt.

type Doc = Readonly<Record<string, unknown>>;
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function useCardIndex(): ReadonlyMap<string, CardInfo> {
  const vocab = useLive((s) => s.collections.vocab);
  const invalid = useLive((s) => s.invalid);
  return useMemo(() => {
    const out = new Map<string, CardInfo>();
    const all = mergedVocab(vocab ?? new Map<string, Doc>(), invalidIdsOf(invalid, 'vocab'));
    for (const [id, doc] of all) {
      const word = str(doc.word);
      if (!word) continue;
      const info: CardInfo = { id, word, de: str(doc.de), def: str(doc.def), pos: str(doc.pos), stage: stageOf(doc), hidden: doc.hidden === true };
      const k = normalizeWord(lemmaOf(word));
      if (!out.has(k)) out.set(k, info);
    }
    return out;
  }, [vocab, invalid]);
}

function useSheetMode(): boolean {
  const [sheet] = useState(() => window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 640);
  return sheet;
}

export function LookupLayer() {
  const req = useLookup((s) => s.req);
  return <AnimatePresence>{req && <LookupPopover key={`${req.text}|${req.start}`} req={req} />}</AnimatePresence>;
}

function LookupPopover({ req }: { req: WordTapRequest }) {
  const { t, lang } = useT();
  const sheet = useSheetMode();
  const panel = useRef<HTMLDivElement>(null);
  // Blatt am Handy: am Griff nach unten wischen schließt (Kap. 4.5); der Inhalt scrollt weiter.
  const drag = useSheetDrag(closeLookup, sheet);
  const [pos, setPos] = useState<CSSProperties>({ visibility: 'hidden' });
  const ai = useAiAvailable();
  const speech = useSpeech((s) => s.status);
  const cards = useCardIndex();
  const cache = useLookupData((s) => s.doc);
  const savedIds = useLookupData((s) => s.saved);
  const auto = useAsk(wordLookup);
  const [saveState, setSaveState] = useState<'idle' | 'busy' | 'failed'>('idle');
  const [saveNote, setSaveNote] = useState<'added' | 'exists' | null>(null);

  useEffect(() => {
    ensureLookupLoaded();
  }, []);

  const hint = posHint(req.tokens, req.index);
  const resolved = useMemo(() => resolveWord(req.surface, hint, { cards, cache, uiLang: lang }), [req.surface, hint, cards, cache, lang]);
  const aiData: WordLookupOut | null = auto.data;

  // Nichts gefunden: gleich Claude fragen (einmal je Öffnen; das Antippen ist die Handlung).
  const autoRun = auto.run;
  const needAi = resolved.source === 'none' && ai;
  useEffect(() => {
    if (!needAi) return;
    void autoRun({ word: req.surface, sentence: req.text, uiLang: useSettings.getState().lang }).then((out) => {
      if (out) void storeLookup(req.surface, out, useSettings.getState().lang);
    });
  }, [needAi, autoRun, req.surface, req.text]);

  // Esc, Schließen-Knopf und Klick außerhalb schließen; der Fokus geht dabei synchron zurück
  // (vorheriger Fokus, sonst das Wort – closeLookup).
  useEffect(() => {
    // Schließt das Fenster, bevor der verzögerte Fokus (20 ms) kam, darf dieser den
    // zurückgegebenen Fokus nicht mehr an das verschwindende Fenster ziehen.
    let closing = false;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      closing = true;
      closeLookup();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target || panel.current?.contains(target)) return;
      if (target instanceof Element && target.closest('button.lx-word')) return;
      const back = focusTargetOf(req);
      closing = true;
      closeLookup({ restoreFocus: false });
      // Tippen auf eine leere Stelle nimmt dem Element beim Loslassen den Fokus. Deshalb erst
      // danach zurückgeben – noch im selben Tippen (click), damit iOS die Tastatur wieder öffnet.
      // Ohne Zeitgrenze: auch ein langes Drücken endet mit diesem click. Kommt keiner (Finger
      // verschoben), räumt das nächste Tippen den Horcher weg.
      const stop = () => {
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('pointerdown', stop, true);
      };
      const onClick = () => {
        stop();
        const a = document.activeElement;
        if (!a || a === document.body) back?.focus({ preventScroll: true });
      };
      document.addEventListener('click', onClick, true);
      window.setTimeout(() => document.addEventListener('pointerdown', stop, true), 0);
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    const focusTimer = window.setTimeout(() => {
      if (!closing) panel.current?.focus({ preventScroll: true });
    }, 20);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [req]);

  // Position am Desktop: unter dem Wort, sonst darüber; waagerecht im Bild gehalten.
  useLayoutEffect(() => {
    if (sheet) return;
    const place = () => {
      const a = req.anchor?.getBoundingClientRect();
      const el = panel.current;
      if (!a || !el) return;
      const w = Math.min(352, window.innerWidth - 32);
      const left = Math.min(Math.max(16, a.left + a.width / 2 - w / 2), window.innerWidth - 16 - w);
      const h = el.offsetHeight;
      const below = a.bottom + 8;
      const style: CSSProperties = { left, width: w };
      if (below + h <= window.innerHeight - 8 || a.top - 8 - h < 8) {
        style.top = Math.min(below, Math.max(8, window.innerHeight - 8 - h));
      } else {
        style.top = a.top - 8 - h;
      }
      setPos(style);
    };
    place();
    const ro = new ResizeObserver(place);
    if (panel.current) ro.observe(panel.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [sheet, req.anchor]);

  const headword = resolved.source === 'none' && aiData ? aiData.lemma : resolved.headword;
  const posLabel = (() => {
    const p = resolved.pos ?? aiData?.pos ?? null;
    const k = posKey(p);
    return k ? t(k as MessageKey) : null;
  })();
  const ipa = resolved.ipa ?? (aiData?.ipa || null);
  const de = resolved.de ?? aiData?.de ?? null;
  const def = resolved.def ?? aiData?.def ?? null;
  const note = auto.data?.note || resolved.note;
  const sense = auto.data?.sense ?? null;
  const formDiffers = normalizeWord(req.surface) !== normalizeWord(headword);
  const card = resolved.card;
  const exists = !!card || !!savedIds[slug(headword)];

  // „Als Karte speichern": nur mit Bedeutung und Ursprungssatz (Kap. 15).
  // Ein Bruchstück (z. B. ein fettes Wort in einer Claude-Antwort) ist kein Ursprungssatz: mindestens drei Wörter.
  const sentenceOk = req.text.trim().split(/\s+/).length >= 3;
  const exSentence = sentenceOk && bracketExample(req.text, req.surface, headword) ? req.text : aiData?.ex && bracketExample(aiData.ex, req.surface, headword) ? aiData.ex : null;
  const canSave = !exists && !!de && !!exSentence;

  const save = async () => {
    if (!de || !exSentence) return;
    setSaveState('busy');
    const r = await saveLookupCard({
      word: headword,
      de,
      pos: resolved.pos ?? aiData?.pos ?? null,
      def,
      level: aiData?.level || resolved.level || null,
      ex: exSentence,
      surface: req.surface,
      src: cardSrcFor(req.area),
      origin: { v: 1, kind: req.area, t: Date.now(), ...(req.source ? { ref: req.source } : {}), ...(req.title ? { title: req.title } : {}) },
      today: dayKey(Date.now()),
    });
    // Nur eine neu angelegte Karte heißt „gespeichert"; sonst ehrlich sagen, was passiert ist.
    if (r === 'saved') {
      setSaveState('idle');
      toast(t('lkSavedToast'));
    } else if (r === 'added' || r === 'exists') {
      setSaveState('idle');
      setSaveNote(r);
      toast(t(r === 'added' ? 'lkAddedToast' : 'lkExistsToast'));
    } else setSaveState('failed');
  };

  // „Claude fragen" (Phase 5, E5-09): Nachschlagen schließen und den Begleiter mit Wort und Satz
  // öffnen; die Frage geht sofort hinaus (der Klick ist die ausdrückliche Handlung).
  const ask = () => {
    // Nach einem Fehler: „Erneut versuchen" fragt Claude wirklich neu (sonst spielte `sample` 24 h
    // dieselbe ungültige Antwort ab, contract/sample.d.ts `refresh`).
    if (auto.error) {
      void auto.run({ word: req.surface, sentence: req.text, uiLang: lang }, { refresh: true }).then((out) => {
        if (out) void storeLookup(req.surface, out, lang);
      });
      return;
    }
    closeLookup();
    const word = aiData?.lemma || resolved.headword || req.surface;
    openCompanion({ attach: { kind: 'word', word, sentence: req.text, source: req.source }, send: t('askWordAuto', { word }) });
  };

  const phaseOf = (a: { phase: string }) => a.phase === 'queued' || a.phase === 'thinking' || a.phase === 'streaming' || a.phase === 'slow';
  const busy = phaseOf(auto) ? auto : null;
  const error = auto.error;

  const content = (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-xl font-semibold tracking-tight" lang="en" data-testid="lk-headword">
              {headword}
            </span>
            {posLabel && (
              <span className="text-sm text-muted" data-testid="lk-pos">
                {posLabel}
              </span>
            )}
          </p>
          {ipa && (
            <p className="lx-ipa text-sm text-muted" data-testid="lk-ipa">
              /{ipa}/
            </p>
          )}
        </div>
        <div className="flex flex-none items-center">
          {speech === 'ready' && (
            <IconButton
              icon="speaker"
              label={t('lkListen')}
              data-testid="lk-listen"
              onClick={() => {
                unlockSpeech();
                void speak(headword);
              }}
            />
          )}
          <IconButton icon="close" label={t('lkClose')} data-testid="lk-close" onClick={() => closeLookup()} />
        </div>
      </div>
      {formDiffers && (
        <p className="text-xs text-subtle" data-testid="lk-form">
          {t('lkForm', { form: req.surface })}
        </p>
      )}
      {(de || def) && (
        <div className="flex flex-col gap-0.5">
          {lang === 'de' && de && (
            <p className="text-base" lang="de" data-testid="lk-meaning">
              {de}
            </p>
          )}
          {def && (
            <p className={lang === 'de' ? 'text-sm text-muted' : 'text-base'} lang="en" data-testid={lang === 'de' ? 'lk-def' : 'lk-meaning'}>
              {def}
            </p>
          )}
        </div>
      )}
      {resolved.source === 'dict' && !sense && (de || def) && (
        <p className="text-xs text-subtle" data-testid="lk-dict-note">
          {t('lkDictNote')}
        </p>
      )}
      {!de && !def && !busy && !needAi && (
        <p className="text-sm text-muted" data-testid="lk-notfound">
          {t('lkNotFound')}
        </p>
      )}
      {sense && (
        <div className="flex flex-col gap-1 rounded-xl bg-surface px-3 py-2" data-testid="lk-sense">
          <p className="lx-eyebrow">{t('lkInContext')}</p>
          <p className="text-sm" lang={lang}>
            {sense}
          </p>
        </div>
      )}
      {note && (
        <p className="text-sm text-muted" lang={lang} data-testid="lk-note">
          {note}
        </p>
      )}
      {busy && (
        <div className="flex items-center justify-between gap-2 text-sm text-muted" data-testid="ai-phase" data-ai-phase={busy.phase}>
          <span>{busy.phase === 'slow' ? t('aiSlow') : busy.phase === 'queued' ? t('aiQueued') : t('aiThinking')}</span>
          {busy.phase === 'slow' && (
            <Button variant="ghost" onClick={busy.stop} data-testid="ai-stop">
              {t('aiStop')}
            </Button>
          )}
        </div>
      )}
      {error && !busy && (
        <p className="text-sm text-danger-text" role="status" data-testid="ai-error">
          {t(error)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {exists ? (
          <p className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent-text" data-testid="lk-saved" data-note={saveNote ?? undefined}>
            {saveNote === 'exists' ? t('lkExists') : t('lkSaved')}
            {card && !card.hidden && card.stage > 0 ? ` · ${t('lkStage', { n: card.stage })}` : ''}
          </p>
        ) : (
          canSave && (
            <Button variant="secondary" icon="bookmarkPlus" onClick={() => void save()} busy={saveState === 'busy'} data-testid="lk-save">
              {t('lkSave')}
            </Button>
          )
        )}
        {ai && (
          <Button variant="ghost" icon="sparkle" onClick={ask} disabled={!!busy} data-testid="lk-ask" data-ai="">
            {error ? t('aiRetry') : t('lkAsk')}
          </Button>
        )}
      </div>
      {saveState === 'failed' && (
        <p className="text-sm text-danger-text" role="status">
          {t('lkSaveFailed')}
        </p>
      )}
    </div>
  );

  const label = t('lkDialog', { word: req.surface });
  if (sheet) {
    return (
      <div className="fixed inset-0 z-50">
        <motion.div
          className="absolute inset-0"
          style={{ background: 'var(--lx-scrim)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.fast }}
          aria-hidden="true"
        />
        <motion.div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          data-testid="lookup"
          className="lx-popover lx-sheet inset-x-0 bottom-0 max-h-[60svh] overflow-y-auto overscroll-contain rounded-t-[1.5rem] px-5 pt-4 pb-[max(env(safe-area-inset-bottom),1.25rem)]"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT }}
          {...drag.panel}
        >
          {/* Gezogen wird nur am Griff (`touch-action: none` nur dort): ein `drag` am ganzen Blatt
              setzte `touch-action: pan-x` und sperrte das Scrollen am Handy. Außerdem schließen
              Knopf, Esc oder Tippen außerhalb. */}
          <div {...drag.handle} className="-mx-5 -mt-4 mb-1 flex h-7 flex-none items-start justify-center">
            <SheetGrip />
          </div>
          {content}
        </motion.div>
      </div>
    );
  }
  return (
    <motion.div
      ref={panel}
      role="dialog"
      aria-modal="false"
      aria-label={label}
      tabIndex={-1}
      data-testid="lookup"
      className="lx-popover rounded-2xl p-4"
      style={pos}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: DURATION.fast, ease: EASE_OUT }}
    >
      {content}
    </motion.div>
  );
}
