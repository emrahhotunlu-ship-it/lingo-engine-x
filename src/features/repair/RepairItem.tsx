import { useMemo, useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { alignWords, splitWords } from '../../domain/answer/align';
import type { ExplanationModel, ResultVerdict } from '../../domain/explain/types';
import { patternById } from '../../domain/grammar/patterns';
import { inputProfile, type InputProfile } from '../../platform/input';
import { checkRepairLocal } from '../../domain/repair/check';
import type { RepairItem as Repair } from '../../domain/repair/repair';
import { applyFixes, repairTiles, spanFixes, type SpanFix } from '../../domain/repair/variant';
import { EnglishText } from '../../engine/EnglishText';
import { SpotSentence } from '../../engine/SpotSentence';
import { Tiles } from '../../engine/Tiles';
import type { WordTapArea } from '../../engine/wordTap';
import { useT, type MessageKey } from '../../i18n';
import { repairCheck } from '../../prompts/repairCheck';
import { ExerciseShell, SentenceInput, explainDepth, type ShellSecondary } from '../../ui/exercise';

// Ein Fehlersatz im Übungsgerüst (Lernplattform 2.0 §5.7). Der falsche Satz steht da, die bessere Fassung ist verborgen; erst korrigieren,
// dann das Warum. Ohne Selbstbewertung (Note aus Richtigkeit). Form je Eingabeprofil, nie ein Feld mit dem ganzen Satz am Handy:
//   keys              → ein Satzfeld, mit dem falschen Satz vorbefüllt (geändert wird nur die falsche Stelle)
//   touch + Stellen   → Fehlerstelle antippen (bis zu 3 nacheinander), dann nur den Ersatz tippen (`SentenceInput edit-span`)
//   touch ohne Stelle → die Wörter der richtigen Fassung als Bausteine (vorgeordnet bis zur ersten Abweichung)
// Prüfung lokal zuerst, sonst repair-check@1; ohne KI zählt die lokale Prüfung.

export type RepairView = Pick<Repair, 'id' | 'wrong' | 'right' | 'why' | 'src' | 'fix'> & {
  /** Fehlerstellen für das Antippen; ohne Angabe aus dem Satz berechnet. */
  spans?: SpanFix[] | null;
  /** Box des Eintrags vor dieser Antwort (Anzeige). */
  box?: number;
  /** Thema und Muster (Kennung) für die Statuszeile. */
  topic?: string | null;
  pat?: string | null;
};

export type RepairVerdict = 'exact' | 'close' | 'ok' | 'no';

type Props = {
  item: RepairView;
  /** `review` = in der Wiederholung („Damals hast du gesagt"), `step` = direkt nach der Korrektur. */
  mode: 'review' | 'step';
  area: WordTapArea;
  source: string | null;
  /** Zusatz in der Statuszeile (z. B. „Satz 1 von 3"). */
  status?: string | null;
  /** Eingabeprofil der Runde; ohne Angabe das des Geräts (einmal eingefroren). */
  profile?: InputProfile;
  onResult: (r: { ok: boolean; near: boolean; given: string; ms: number }) => void;
  onNext: () => void;
  onSkip?: () => void;
  nextLabel?: string;
};

const VERDICT: Record<RepairVerdict, ResultVerdict> = { exact: 'ok', ok: 'ok', close: 'near', no: 'wrong' };
const BOXES = 3;

export function RepairItem({ item, mode, area, source, status = null, profile: profileProp, onResult, onNext, onSkip, nextLabel }: Props) {
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const ask = useAsk(repairCheck);
  const [profile] = useState<InputProfile>(() => profileProp ?? inputProfile());
  const touch = profile === 'touch';
  const fixes = useMemo<SpanFix[] | null>(() => (item.spans !== undefined ? item.spans : spanFixes(item.wrong, item.right)), [item.spans, item.wrong, item.right]);
  const words = useMemo(() => splitWords(item.wrong), [item.wrong]);
  const form: 'field' | 'spots' | 'tiles' = !touch ? 'field' : fixes ? 'spots' : 'tiles';
  const tiles = useMemo(() => repairTiles(item.wrong, item.right, item.id), [item.wrong, item.right, item.id]);
  const tileList = useMemo(() => tiles.texts.map((text, id) => ({ id, text, distractor: false })), [tiles]);
  // Fehlerstellen am Handy: `done[k]` = Ersatztext der Stelle k; `cur` = Stelle im Ersatz-Schritt.
  const [done, setDone] = useState<string[]>([]);
  const [cur, setCur] = useState<number | null>(null);
  const [tapped, setTapped] = useState<[number, number] | null>(null);
  const [typed, setTyped] = useState('');
  const [misses, setMisses] = useState(0);
  const [nudge, setNudge] = useState(false);
  const [text, setText] = useState(() => item.wrong.trim());
  const [placed, setPlaced] = useState<number[]>(() => Array.from({ length: tiles.pre }, (_, k) => k));
  const [res, setRes] = useState<{ verdict: RepairVerdict; note: string | null; given: string } | null>(null);
  const [shownAt] = useState(() => performance.now());
  const busy = ask.phase === 'queued' || ask.phase === 'thinking' || ask.phase === 'slow' || ask.phase === 'streaming';
  const total = fixes?.length ?? 0;
  const stepNo = Math.min(total, done.filter((d) => d).length + 1);

  const finish = (verdict: RepairVerdict, note: string | null, given: string) => {
    setRes({ verdict, note, given });
    onResult({ ok: verdict !== 'no', near: verdict === 'close', given, ms: performance.now() - shownAt });
  };

  const judge = async (given: string) => {
    if (res || busy || !given.trim()) return;
    const local = checkRepairLocal(given, item);
    if (local !== 'no' || !ai) {
      finish(local, null, given.trim());
      return;
    }
    const out = await ask.run({ wrong: item.wrong, right: item.right, why: item.why ?? '', given: given.trim(), uiLang: lang });
    // KI nicht erreichbar, abgebrochen oder unlesbar: nicht als falsch werten – der Satz bleibt offen, „Prüfen" fragt erneut.
    if (!out) return;
    finish(out.ok ? 'ok' : 'no', out.note ?? null, given.trim());
  };

  const assembled = (): string => (form === 'spots' && fixes ? applyFixes(item.wrong, fixes, done) : form === 'tiles' ? placed.map((id) => tiles.texts[id] ?? '').join(' ') : text);

  const submit = () => {
    if (res || busy) return;
    if (form === 'spots' && fixes) {
      if (cur === null) {
        if (!tapped) return;
        // Die angetippte Stelle gehört zu einer noch offenen Fehlerstelle (Überlappung)? Dann beginnt ihr Ersatz.
        const hit = fixes.findIndex((f, k) => !done[k] && tapped[0] <= f.span[1] && tapped[1] >= f.span[0]);
        if (hit >= 0) {
          setCur(hit);
          setTyped('');
          setTapped(null);
          setNudge(false);
          return;
        }
        if (misses < 1) {
          setMisses(1);
          setNudge(true);
          setTapped(null);
          return;
        }
        // Zweiter Fehlgriff: die Lösung wird gezeigt, ohne Vorwurf.
        finish('no', null, '');
        return;
      }
      if (!typed.trim()) return;
      const next = [...done];
      next[cur] = typed.trim();
      setDone(next);
      setCur(null);
      setTyped('');
      if (next.filter((d) => d).length >= total) void judge(applyFixes(item.wrong, fixes, next));
      return;
    }
    void judge(assembled());
  };

  const dontKnow = () => {
    if (res || busy) return;
    finish('no', null, '');
  };

  const verdict = res ? VERDICT[res.verdict] : null;
  const patName = item.pat ? (patternById(item.pat.includes(':') ? item.pat : `${item.topic ?? ''}:${item.pat}`)?.name ?? null) : null;
  const model: ExplanationModel | null = res
    ? {
        lines: [
          ...(patName ? [{ k: 'pattern' as const, name: lang === 'de' ? patName.de : patName.en, formula: null }] : []),
          ...(item.why ? [{ k: 'why' as const, text: item.why }] : []),
        ],
        examples: [],
        mark: [],
        ai: false,
        source: 'task',
      }
    : null;

  // Aufgabenzeile und Eingabe je Form.
  const taskKey: MessageKey = form === 'field' ? 'fxRTaskField' : form === 'tiles' ? 'fxRTaskTiles' : cur === null ? 'fxRTaskSpot' : 'fxRTaskReplace';
  let prompt;
  let answer = null;
  if (res) {
    prompt = <EnglishText as="p" text={item.right} area={area} source={source} testId="repair-right" />;
  } else if (form === 'spots' && fixes) {
    if (cur === null) {
      prompt = <SpotSentence words={words} pick="span" selected={tapped} onSelect={setTapped} area={area} source={source} testId="spot-sentence" label={t('fxRSpotLabel')} />;
    } else {
      // Ersetzte Stellen stehen schon im Satz; die gerade gewählte ist das Eingabefeld.
      const base: string[] = [];
      let from = 0;
      let i = 0;
      for (const [k, f] of fixes.entries()) {
        base.push(...words.slice(i, f.span[0]));
        if (k === cur) from = base.length;
        else if (done[k]) base.push(...splitWords(done[k]));
        else base.push(...words.slice(f.span[0], f.span[1] + 1));
        i = f.span[1] + 1;
      }
      base.push(...words.slice(i));
      prompt = <SentenceInput mode="edit-span" base={base.join(' ')} span={[from, from]} value={typed} onChange={setTyped} onSubmit={submit} testId="repair-span-input" />;
    }
  } else if (form === 'tiles') {
    prompt = (
      <p lang="en" className="lx-t-support text-muted" data-testid="repair-wrong">
        “{item.wrong}”
      </p>
    );
    answer = (
      <Tiles
        tiles={tileList}
        placed={placed}
        onChange={setPlaced}
        locked={false}
        labels={{ line: t('drTileLine'), pool: t('drTilePool') }}
        markLabels={{ ok: t('drMarkOk'), near: t('drMarkNear'), off: t('drMarkOff') }}
      />
    );
  } else {
    prompt = <SentenceInput mode="free" value={text} onChange={setText} onSubmit={submit} disabled={busy} testId="repair-input" />;
  }

  // Ohne eigene Antwort („Weiß ich nicht“, zweiter Fehlgriff) zeigt der Vergleich den Fehlersatz selbst: was war falsch, was ist richtig.
  const comparison =
    res && res.verdict !== 'exact'
      ? res.given
        ? { given: res.given, ops: alignWords(res.given, item.right) }
        : { given: item.wrong, ops: alignWords(item.wrong, item.right), label: t('fxRCmpWrong') }
      : null;
  const secondary: ShellSecondary[] = res
    ? []
    : [
        { id: 'dontKnow', label: t('exDontKnow'), onClick: dontKnow, testId: 'repair-dontknow' },
        ...(onSkip ? [{ id: 'skip' as const, label: t('exSkip'), onClick: onSkip, testId: 'repair-skip' }] : []),
      ];
  const hint = res
    ? null
    : busy
      ? { text: t('exThinking'), tone: 'hint' as const }
      : ask.error
        ? { text: t('exAiError'), tone: 'near' as const }
        : nudge
          ? { text: t('fxRMiss'), tone: 'near' as const }
          : null;
  const boxLabel = item.box === undefined ? null : t('fxRBadge', { n: Math.min(BOXES, item.box + 1), total: BOXES });
  const badge = [t(`rxSrc_${item.src}` as MessageKey), boxLabel, status, form === 'spots' && total > 1 && !res ? t('fxRSpotNo', { n: stepNo, total }) : null].filter(Boolean).join(' · ') || null;
  const primaryDisabled = busy || (form === 'spots' ? (cur === null ? !tapped : !typed.trim()) : form === 'tiles' ? placed.length < tiles.texts.length : !text.trim() || text.trim() === item.wrong.trim());
  const checkLabel = form === 'spots' && cur === null ? t('fxRCheckSpot') : t('exCheck');

  return (
    <div data-testid="repair-item" data-id={item.id} data-mode={mode} data-form={form} data-profile={profile} data-state={res ? res.verdict : 'open'}>
      <ExerciseShell
        meta={{ ex: 'repair', id: item.id, kind: form }}
        status={{ area: 'grammar', state: null, kindLabel: t('rxKind'), topic: null, pattern: null, badge }}
        task={{ text: t(taskKey), purpose: t('fxRPurpose') }}
        prompt={prompt}
        answer={answer}
        hint={hint}
        secondary={secondary}
        primary={res ? { label: nextLabel ?? t('exNext'), onClick: onNext, testId: 'repair-next' } : { label: checkLabel, onClick: submit, testId: 'repair-check', disabled: primaryDisabled, busy, busyLabel: t('exChecking') }}
        feedback={res && verdict ? { verdict, sub: res.note, comparison, explanation: model, depth: explainDepth({ verdict, p: null, learning: (item.box ?? 0) === 0 }), menu: {} } : null}
      />
    </div>
  );
}
