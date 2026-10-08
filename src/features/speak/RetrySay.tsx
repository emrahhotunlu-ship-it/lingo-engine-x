import { useId, useState } from 'react';
import { useT } from '../../i18n';
import { MicButton } from '../../engine/MicButton';
import { useInputProfile } from '../../platform/input';
import { AiMark } from '../../ui/AiMark';
import { AiRunPanel } from '../../ui/AiRunPanel';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { SAY_AGAIN_TRIES, type SayAgainState } from './useRoleplay';

// „Sag’s nochmal“ (Lernplattform 3.0 P51, KI-Tutor T7): Emrah sagt oder tippt den Satz eines eigenen Zugs neu, OHNE die Korrektur zu sehen. Die
// Analysekarte eines Zugs mit echten Fehlern startet verdeckt (Urteil, „Sag’s nochmal“, „Korrektur zeigen“) und zeigt die Korrektur erst nach ✓, nach
// dem letzten Versuch oder auf Wunsch. repair-check@1 (Modus `retry`) prüft, genau ein Aufruf je Prüfung (useRoleplay.sayAgain). ✓ schließt die
// Stelle im Gespräch, ohne weitere Buchung. Die vier Pflichtfragen: Aufgabe und Zweck oben, „Du hast gesagt“ + Urteil, darunter die Begründung.
// Keine Aussprachebewertung (es wird nur Text geprüft); am iPhone ein Hinweis, dass Spracheingabe im Rahmen unsicher ist.

const MAX_LEN = 300;

/** Teilt den Satz in Stücke und markiert die falschen Stellen (`wrong` der Fehler, ohne Groß/Klein). Ohne Fund: ein unmarkiertes Stück. Rein. */
export function markSpans(sentence: string, wrongs: readonly string[]): Array<{ text: string; off: boolean }> {
  const lower = sentence.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const w of wrongs) {
    const needle = w.trim().toLowerCase();
    if (!needle) continue;
    const at = lower.indexOf(needle);
    if (at < 0) continue;
    const end = at + needle.length;
    if (ranges.some(([a, b]) => at < b && end > a)) continue;
    ranges.push([at, end]);
  }
  ranges.sort((x, y) => x[0] - y[0]);
  const out: Array<{ text: string; off: boolean }> = [];
  let pos = 0;
  for (const [a, b] of ranges) {
    if (a > pos) out.push({ text: sentence.slice(pos, a), off: false });
    out.push({ text: sentence.slice(a, b), off: true });
    pos = b;
  }
  if (pos < sentence.length || !out.length) out.push({ text: sentence.slice(pos), off: false });
  return out;
}

type Props = {
  idx: number;
  sentence: string;
  /** Die falschen Stellen der echten Fehler (nur markiert, nie die richtige Form). */
  wrongs: readonly string[];
  state: SayAgainState | undefined;
  /** Korrektur der Karte noch verdeckt (vor ✓, vor dem letzten Versuch, vor „Korrektur zeigen“). */
  hidden: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onReveal: () => void;
  onCheck: (given: string) => Promise<'same' | 'limit' | 'done'>;
};

export function RetrySay({ idx, sentence, wrongs, state, hidden, open, onOpen, onClose, onReveal, onCheck }: Props) {
  const { t } = useT();
  const touch = useInputProfile() === 'touch';
  const inputId = useId();
  const [text, setText] = useState('');
  const [same, setSame] = useState(false);
  const phase = state?.phase;
  const tries = state?.tries ?? 0;
  const left = tries < SAY_AGAIN_TRIES;

  // Erledigt heißt erledigt: eine reparierte Stelle ist Zustand, kein Knopf mehr.
  if (phase === 'ok') {
    return (
      <div data-testid="rs-result" data-idx={idx} data-state="ok" className="flex flex-col gap-1 rounded-2xl bg-accent-soft px-3 py-2 text-sm">
        <p className="flex items-center gap-1.5 font-semibold text-accent-text">
          <Icon name="check" size={16} />
          {t('ttTkSayOk')}
        </p>
        <p className="text-muted">
          {t('ttTkSayYou')}: <span lang="en" className="text-fg">{state?.given}</span>
        </p>
        {state?.note && <p className="text-muted">{state.note}</p>}
        {state?.note && <AiMark variant="explain" tpl="repair-check@1" />}
      </div>
    );
  }

  // Korrektur offen (letzter Versuch vorbei oder selbst aufgedeckt): höchstens das letzte Urteil, keine Übung mehr.
  if (!hidden) {
    if (phase !== 'no' || !state) return null;
    return (
      <div data-testid="rs-result" data-idx={idx} data-state="no" className="flex flex-col gap-1 text-sm">
        <p className="text-muted">
          <span className="font-semibold text-gold-text">{t('ttTkSayNo')}</span> {state.note}
        </p>
        {state.note && <AiMark variant="explain" tpl="repair-check@1" />}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid="rs-start" data-idx={idx}>
        <Button
          variant="primary"
          icon="mic"
          onClick={() => {
            setText('');
            setSame(false);
            onOpen();
          }}
          data-testid="rs-open"
        >
          {t('ttTkSayBtn')}
        </Button>
        <Button variant="ghost" onClick={onReveal} data-testid="rs-reveal">
          {t('ttTkSayReveal')}
        </Button>
      </div>
    );
  }

  const busy = phase === 'busy';
  const check = async () => {
    const r = await onCheck(text);
    setSame(r === 'same');
  };

  return (
    <div data-testid="rs-panel" data-idx={idx} className="flex flex-col gap-3 rounded-2xl border border-line px-3 py-3">
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-semibold">{t('ttTkSayTask')}</p>
        <p className="text-muted">{t('ttTkSayWhy')}</p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="lx-t-label">{t('ttTkSayBefore')}</p>
        <p lang="en" className="text-sm" data-testid="rs-before">
          {markSpans(sentence, wrongs).map((p, k) => (
            <span key={k} className={p.off ? 'lx-diff-off' : undefined} {...(p.off ? { 'data-off': '' } : {})}>
              {p.text}
            </span>
          ))}
        </p>
      </div>

      {(phase === 'no' || phase === 'error') && state && (
        <div data-testid="rs-result" data-idx={idx} data-state={phase} className="flex flex-col gap-1 text-sm">
          {phase === 'no' && (
            <>
              <p className="text-muted">
                {t('ttTkSayYou')}: <span lang="en" className="text-fg">{state.given}</span>
              </p>
              <p className="font-semibold text-gold-text">{t('ttTkSayNo')}</p>
              {state.note && <p className="text-muted">{state.note}</p>}
              {state.note && <AiMark variant="explain" tpl="repair-check@1" />}
            </>
          )}
          {phase === 'error' && <AiRunPanel phase="idle" error={state.error} onRetry={left ? () => void check() : undefined} />}
        </div>
      )}

      {busy ? (
        <AiRunPanel phase="thinking" error={null} skeleton={false} />
      ) : left ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="lx-t-label">
            {phase === 'no' ? t('ttTkSayAgain') : t('ttTkSayLabel')}
          </label>
          <div className="flex items-start gap-2">
            <textarea
              id={inputId}
              value={text}
              rows={2}
              maxLength={MAX_LEN}
              lang="en"
              autoCapitalize="sentences"
              spellCheck={false}
              placeholder={t('ttTkSayPlaceholder')}
              onChange={(e) => {
                setText(e.target.value);
                setSame(false);
              }}
              className="lx-glass w-full resize-y rounded-[var(--radius-control)] px-4 py-3 text-base leading-relaxed text-fg placeholder:text-subtle"
              data-testid="rs-input"
            />
            <MicButton onText={(s) => setText((cur) => (cur.trim() ? `${cur.trim()} ${s}` : s))} />
          </div>
          {same && (
            <p className="text-sm text-gold-text" role="status" data-testid="rs-same">
              {t('ttTkSaySame')}
            </p>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {left && !busy && (
          <Button variant="primary" icon="check" onClick={() => void check()} disabled={!text.trim()} data-ai="" data-testid="rs-check">
            {t('ttTkSayCheck')}
          </Button>
        )}
        {!busy && (
          <Button variant="ghost" onClick={onClose} data-testid="rs-close">
            {t('ttTkSayCancel')}
          </Button>
        )}
        {!busy && (
          <Button variant="ghost" onClick={onReveal} data-testid="rs-reveal">
            {t('ttTkSayReveal')}
          </Button>
        )}
      </div>
      <p className="lx-t-meta text-subtle" data-testid="rs-noscore">
        {t('ttTkSayNoScore')}
      </p>
      {touch && (
        <p className="lx-t-meta text-subtle" data-testid="rs-iphone">
          {t('ttTkSayIphone')}
        </p>
      )}
    </div>
  );
}
