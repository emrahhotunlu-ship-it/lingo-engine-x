import { useEffect, useMemo, useRef, useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { takeTutorCall } from '../../ai/tutorBudget';
import { useAsk } from '../../ai/useAsk';
import { useSettings } from '../../app/settings';
import { slug } from '../../domain/content';
import { dayKey } from '../../domain/date';
import { cardSrcFor } from '../../domain/lookup/cardSrc';
import { resolveWord, type CardInfo } from '../../domain/lookup/resolve';
import { bracketExample } from '../../domain/srs/newCard';
import { cancelPick, closeLookup, useLookup, wordCount, type WordTapRequest } from '../../engine/wordTap';
import { useT } from '../../i18n';
import { inputProfile } from '../../platform/input';
import { speak, unlockSpeech, useSpeech } from '../../platform/speech';
import { wordLookup, type WordLookupOut } from '../../prompts/wordLookup';
import { Button, IconButton } from '../../ui/Button';
import { toast } from '../../ui/Toast';
import { openCompanion } from '../companion/store';
import { checkCardUnit, saveLookupCard, storeLookup, useLookupData, type UnitDecision } from './store';

// Mehrwort-Markierung (Emrahs Wunsch, 21.10.2026): Inhalt des Nachschlage-Fensters für eine Wortgruppe. Bedeutung zuerst aus eigener Karte,
// Zwischenspeicher oder Wörterbuch; sonst fragt es Claude einmal (word-lookup, quick) mit dem Satz – das zählt zur Tagesbremse (20 am Tag).
// Ohne Claude oder nach der Tagesbremse: ehrlicher Hinweis und die einzelnen Wörter aus dem Wörterbuch. „Als Karte merken“ legt eine
// Wendungs-Karte mit Ursprungssatz an (neue Karten landen im Eingangskorb), über denselben Schreibweg wie das Einzelwort, nie doppelt.
// Kartenqualität (26.10.2026): Aus Artikel/Leser wird eine Wortgruppe nur als feste Einheit gespeichert (`checkCardUnit`); sonst Hinweis
// und höchstens das tragende Einzelwort.

type Doc = Readonly<Record<string, unknown>>;
type Span = readonly [number, number];

/** Text zwischen `from` und `to`, nicht antippbare Stellen (Lücke, Lösung während der Frage) als „___“. */
export function blanked(text: string, from: number, to: number, gaps: readonly Span[] | undefined): string {
  let out = '';
  let pos = from;
  for (const [a, b] of [...(gaps ?? [])].sort((x, y) => x[0] - y[0])) {
    if (b <= pos || a >= to) continue;
    out += text.slice(pos, Math.max(pos, a));
    out += '___';
    pos = Math.min(to, b);
  }
  return out + text.slice(pos, to);
}

export function PhraseBody({ req, cards, cache }: { req: WordTapRequest; cards: ReadonlyMap<string, CardInfo>; cache: Doc | undefined }) {
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const speech = useSpeech((s) => s.status);
  const savedIds = useLookupData((s) => s.saved);
  const ask = useAsk(wordLookup);
  const phrase = req.surface;
  const sentence = useMemo(() => blanked(req.text, 0, req.text.length, req.gaps), [req.text, req.gaps]);
  const resolved = useMemo(() => resolveWord(phrase, null, { cards, cache, uiLang: lang }), [phrase, cards, cache, lang]);
  const found = resolved.source !== 'none' && !!(resolved.de || resolved.def);
  const [limit, setLimit] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'busy' | 'failed'>('idle');
  const [saveNote, setSaveNote] = useState<'added' | 'exists' | null>(null);
  const [notUnit, setNotUnit] = useState<Extract<UnitDecision, { kind: 'not_unit' }> | null>(null);
  const [singleSaved, setSingleSaved] = useState(false);
  const unitCtl = useRef<AbortController | null>(null);
  useEffect(() => () => unitCtl.current?.abort(), []);

  // Nicht gefunden: Claude einmal je Öffnen fragen (das Markieren ist die Handlung), gebremst durch die Tagesbremse.
  const asked = useRef(false);
  const run = ask.run;
  useEffect(() => {
    if (found || !ai || asked.current) return;
    asked.current = true;
    if (!takeTutorCall()) {
      // Ergebnis der Tagesbremse nach dem Effekt melden (kein setState direkt im Effekt).
      void Promise.resolve().then(() => setLimit(true));
      return;
    }
    const ui = useSettings.getState().lang;
    void run({ word: phrase, sentence, uiLang: ui }).then((out) => {
      if (out) void storeLookup(phrase, out, ui);
    });
  }, [found, ai, run, phrase, sentence]);

  const aiData: WordLookupOut | null = ask.data;
  const headword = found ? resolved.headword : (aiData?.lemma ?? phrase);
  const de = found ? resolved.de : (aiData?.de ?? null);
  const def = found ? resolved.def : (aiData?.def ?? null);
  const sense = aiData?.sense ?? null;
  const note = aiData?.note || resolved.note;
  const card = resolved.card;
  const exists = !!card || !!savedIds[slug(headword)];
  const busy = ask.phase === 'queued' || ask.phase === 'thinking' || ask.phase === 'streaming' || ask.phase === 'slow';
  const sentenceOk = req.text.trim().split(/\s+/).length >= 3;
  const exSentence = sentenceOk && bracketExample(req.text, phrase, headword) ? req.text : aiData?.ex && bracketExample(aiData.ex, phrase, headword) ? aiData.ex : null;
  const canSave = !exists && !!de && !!exSentence;
  // Einzelwörter aus dem Wörterbuch, wenn Claude keine Bedeutung im Zusammenhang liefern kann.
  const noAi = !found && !ai;
  const showWords = !found && !de && !busy && (noAi || limit || !!ask.error);
  const words = useMemo(() => {
    if (!showWords) return [];
    const last = req.last ?? req.index;
    const out: Array<{ w: string; text: string | null }> = [];
    for (let i = req.index; i <= last; i += 1) {
      const tk = req.tokens[i];
      if (!tk || tk.kind !== 'word') continue;
      const r = resolveWord(tk.text, null, { cards, cache, uiLang: lang });
      out.push({ w: tk.text, text: (lang === 'de' ? r.de : null) ?? r.def ?? r.de });
    }
    return out;
  }, [showWords, req.index, req.last, req.tokens, cards, cache, lang]);

  const save = async () => {
    if (!de || !exSentence) return;
    setSaveState('busy');
    const src = cardSrcFor(req.area);
    unitCtl.current?.abort();
    unitCtl.current = new AbortController();
    const d = await checkCardUnit({ word: headword, sentence: exSentence, uiLang: lang, signal: unitCtl.current.signal, src });
    if (d.kind === 'not_unit') {
      setNotUnit(d);
      setSaveState('idle');
      return;
    }
    const r = await saveLookupCard({
      word: headword,
      de,
      pos: aiData?.pos || resolved.pos || 'phrase',
      def,
      level: aiData?.level || resolved.level || null,
      ex: exSentence,
      surface: phrase,
      src,
      ...(d.lu ? { lu: d.lu } : {}),
      origin: { v: 1, kind: req.area, t: Date.now(), ...(req.source ? { ref: req.source } : {}), ...(req.title ? { title: req.title } : {}) },
      today: dayKey(Date.now()),
      ...(aiData?.note ? { keep: { tip: aiData.note } } : {}),
    });
    if (r === 'saved') {
      setSaveState('idle');
      toast(t('lkSavedToast'));
    } else if (r === 'added' || r === 'exists') {
      setSaveState('idle');
      setSaveNote(r);
      toast(t(r === 'added' ? 'lkAddedToast' : 'lkExistsToast'));
    } else if (r === 'not_unit') {
      setNotUnit({ kind: 'not_unit', by: 'rule', single: null });
      setSaveState('idle');
    } else setSaveState('failed');
  };

  const saveSingle = async () => {
    const one = notUnit?.single;
    if (!one || !exSentence) return;
    setSaveState('busy');
    const r = await saveLookupCard({
      word: one.word,
      de: one.de,
      ...(one.pos ? { pos: one.pos } : {}),
      ex: exSentence,
      surface: one.surface,
      src: cardSrcFor(req.area),
      origin: { v: 1, kind: req.area, t: Date.now(), ...(req.source ? { ref: req.source } : {}), ...(req.title ? { title: req.title } : {}) },
      today: dayKey(Date.now()),
    });
    if (r === 'saved' || r === 'added' || r === 'exists') {
      setSaveState('idle');
      setSingleSaved(true);
    } else setSaveState('failed');
  };

  const askClaude = () => {
    if (ask.error) {
      void ask.run({ word: phrase, sentence, uiLang: lang }, { refresh: true }).then((out) => {
        if (out) void storeLookup(phrase, out, lang);
      });
      return;
    }
    closeLookup();
    openCompanion({ attach: { kind: 'word', word: phrase, sentence, source: req.source }, send: t('askWordAuto', { word: phrase }) });
  };

  const before = blanked(req.text, 0, req.start, req.gaps);
  const after = blanked(req.text, req.end, req.text.length, req.gaps);

  return (
    <div className="flex flex-col gap-3" data-testid="lk-phrase" data-words={wordCount(req.tokens.slice(req.index, (req.last ?? req.index) + 1))}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-xl font-semibold tracking-tight" lang="en" data-testid="lk-headword">
          {phrase}
        </p>
        <div className="flex flex-none items-center">
          {speech === 'ready' && (
            <IconButton
              icon="speaker"
              label={t('ttPhListen')}
              data-testid="lk-listen"
              onClick={() => {
                unlockSpeech();
                void speak(phrase);
              }}
            />
          )}
          <IconButton icon="close" label={t('lkClose')} data-testid="lk-close" onClick={() => closeLookup()} />
        </div>
      </div>
      <div className="flex flex-col gap-1 rounded-xl bg-surface px-3 py-2" data-testid="ph-sentence">
        <p className="lx-eyebrow">{t('ttPhInSentence')}</p>
        <p className="text-sm" lang="en">
          {before}
          <mark className="lx-mark text-fg">{phrase}</mark>
          {after}
        </p>
      </div>
      {req.capped && (
        <p className="text-xs text-subtle" data-testid="ph-capped">
          {t('ttPhCapped')}
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
      {resolved.source === 'dict' && found && !sense && (
        <p className="text-xs text-subtle" data-testid="lk-dict-note">
          {t('lkDictNote')}
        </p>
      )}
      {sense && (
        <div className="flex flex-col gap-1" data-testid="lk-sense">
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
        <div className="flex items-center justify-between gap-2 text-sm text-muted" data-testid="ai-phase" data-ai-phase={ask.phase}>
          <span>{ask.phase === 'slow' ? t('aiSlow') : ask.phase === 'queued' ? t('aiQueued') : t('aiThinking')}</span>
          {ask.phase === 'slow' && (
            <Button variant="ghost" onClick={ask.stop} data-testid="ai-stop">
              {t('aiStop')}
            </Button>
          )}
        </div>
      )}
      {ask.error && !busy && (
        <p className="text-sm text-danger-text" role="status" data-testid="ai-error">
          {t(ask.error)}
        </p>
      )}
      {showWords && (
        <div className="flex flex-col gap-1.5" data-testid="ph-words" data-reason={noAi ? 'noai' : limit ? 'limit' : 'error'}>
          <p className="text-sm text-muted" role="status">
            {noAi ? t('ttPhNoAi') : limit ? t('ttPhLimit') : t('ttPhErrorWords')}
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {words.map((w, k) => (
              <li key={`${w.w}-${k}`} className="flex gap-2 text-sm" data-testid="ph-word">
                <span className="font-medium" lang="en">
                  {w.w}
                </span>
                <span className={w.text ? 'text-muted' : 'text-subtle'} lang={w.text && lang === 'de' ? 'de' : 'en'}>
                  {w.text ?? t('ttPhWordNone')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {notUnit && (
        <div className="flex flex-col gap-1.5" data-testid="ph-notunit" data-by={notUnit.by}>
          <p className="text-sm font-medium" role="status">
            {t('ttCqNotUnit')}
          </p>
          {notUnit.better && (
            <p className="text-sm text-muted" data-testid="ph-better">
              {t('ttCqBetterLabel')}{' '}
              <span className="font-semibold text-fg" lang="en">
                {notUnit.better}
              </span>
            </p>
          )}
          {notUnit.why && (
            <p className="text-xs text-muted" lang={lang}>
              {notUnit.why}
            </p>
          )}
          {notUnit.by === 'claude' && <p className="text-2xs text-subtle">{t('ttCqByClaude')}</p>}
          {notUnit.single &&
            (singleSaved ? (
              <p className="inline-flex min-h-11 items-center text-sm font-medium text-accent-text" role="status" data-testid="ph-single-saved">
                {t('ttCqSingleSaved', { word: notUnit.single.word })}
              </p>
            ) : (
              <div>
                <Button variant="secondary" icon="bookmarkPlus" onClick={() => void saveSingle()} busy={saveState === 'busy'} data-testid="ph-single">
                  {t('ttCqSaveSingle', { word: notUnit.single.word })}
                </Button>
              </div>
            ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {exists ? (
          <p className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent-text" data-testid="lk-saved" data-note={saveNote ?? undefined}>
            {saveNote === 'exists' ? t('lkExists') : t('lkSaved')}
          </p>
        ) : (
          canSave &&
          !notUnit && (
            <Button variant="secondary" icon="bookmarkPlus" onClick={() => void save()} busy={saveState === 'busy'} data-testid="lk-save">
              {t('ttPhSave')}
            </Button>
          )
        )}
        {ai && !limit && (
          <Button variant="ghost" icon="sparkle" onClick={askClaude} disabled={busy} data-testid="lk-ask" data-ai="">
            {ask.error ? t('aiRetry') : t('lkAsk')}
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
}

/**
 * Hinweisleiste während „Mehrere Wörter markieren“: oben fest (kein Layoutsprung), mit Abbrechen (≥ 44 px). Esc bricht ab (vor allen
 * anderen Esc-Horchern); verschwindet das erste Wort (Bildschirmwechsel), endet das Markieren still.
 */
export function PickBar() {
  const { t } = useT();
  const pick = useLookup((s) => s.pick);
  const [desk] = useState(() => inputProfile() !== 'touch');
  useEffect(() => {
    if (!pick) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      cancelPick();
    };
    const onClick = () => {
      window.setTimeout(() => {
        const cur = useLookup.getState().pick;
        if (cur && !cur.anchor?.isConnected) cancelPick({ restoreFocus: false });
      }, 0);
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('click', onClick, true);
    };
  }, [pick]);
  if (!pick) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),0.75rem)] z-50 flex justify-center px-4">
      <div
        className="pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl py-1 pr-1 pl-4"
        style={{ background: 'var(--lx-surface-solid)', border: '1px solid var(--lx-border)', boxShadow: 'var(--lx-shadow)' }}
        role="status"
        data-testid="ph-pick"
      >
        <p className="m-0 text-sm">
          {desk ? t('ttPhPickHintDesk') : t('ttPhPickHint')}{' '}
          <span className="font-semibold" lang="en">
            {pick.surface} …
          </span>
        </p>
        <Button variant="ghost" onClick={() => cancelPick()} data-testid="ph-pick-cancel">
          {t('ttPhPickCancel')}
        </Button>
      </div>
    </div>
  );
}
