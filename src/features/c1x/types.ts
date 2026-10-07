import type { ReactNode } from 'react';
import type { C1Form } from '../../domain/c1x/notes';
import type { C1Task } from '../../domain/c1x/runtime';
import type { C1Input, C1Item, C1Response, C1Score } from '../../domain/c1x/types';
import type { InputProfile } from '../../domain/grammar/tasks';
import type { Lang } from '../../domain/srs/types';
import type { useHiddenInput } from '../../engine/HiddenInput';
import type { WordTapArea } from '../../engine/wordTap';

// Vertrag zwischen dem Rahmen (`C1Item`, P14) und den Aufgabenarten (`kinds/<Art>.tsx`, P16 …): Eine Art ist ein Hook `useXUi(ctrl)`,
// der Satz, Eingabe und Hilfen zeichnet und die aktuelle Antwort über `ctrl.setResponse` meldet. Den Rest (Status, Aufgabenzeile, Tipp-Leiter,
// Prüfen, Urteil, Teilpunkte, Erklär-Karte, Buchung, Menü) macht der Rahmen; keine Art baut Karte, Kopf, Urteil oder Erklärung selbst.

/** Angaben zur aktuellen Antwort für Note, Erklärung und Hinweise. */
export type ResponseMeta = {
  /** Eingabeform: bestimmt Notenschlüssel und Hilfe-Bit (kwt: tiles/part/typed, err: tap/tapfix/typed, reg: chips/text, para: pick/text). */
  form: C1Form;
  /** Gewählte Option als Text (Auswahlarten): für die passende Begründung und das Radar. */
  picked?: string;
  /** Angetipptes Wort (Fehler finden) bzw. `none`. */
  tapped?: string;
  /** Gelöschte Zeichen, Länge in Zeichen, Zahl der Bausteine (Note). */
  deletions?: number;
  chars?: number;
  units?: number;
};

export type C1Ctrl = {
  task: C1Task;
  item: C1Item;
  inp: C1Input;
  profile: InputProfile;
  lang: Lang;
  area: WordTapArea;
  /** p des Themas (Stufe der Aufgabe): bestimmt, wie viel Hilfe die Eingabeform gibt. */
  p: number;
  /** Nach „Prüfen“: die Eingabe ist gesperrt, `score` ist da. */
  locked: boolean;
  score: C1Score | null;
  /** Stufe der Tipp-Leiter (0 = keine Hilfe) und ob gerade ein zweiter Versuch nach Hinweis läuft. */
  tip: 0 | 1 | 2 | 3;
  retry: boolean;
  /** Wochen-Check, Check und Einstufung: keine Hilfe. */
  noHelp: boolean;
  api: ReturnType<typeof useHiddenInput>;
  /** Meldet die aktuelle Antwort (`null` = unvollständig: „Prüfen“ bleibt aus). */
  setResponse: (r: C1Response | null, meta?: ResponseMeta) => void;
  /** Prüfen (z. B. Enter im Eingabefeld). */
  submit: () => void;
  /** Erstes getipptes Zeichen (für die Zeit bis zur ersten Eingabe). */
  markFirstKey: () => void;
  /** Der Rahmen setzt die Zeit neu (z. B. nach dem Fund der Stelle bei „Fehler finden“). */
  restartClock: () => void;
};

/** Was eine Art dem Rahmen liefert. */
export type C1Ui = {
  prompt: ReactNode;
  answer: ReactNode;
  /** Zusatz über dem Satz (z. B. Schlüsselwort-Chip). */
  aid?: ReactNode;
  /** Höchste Stufe der Tipp-Leiter (Standard 2: Leitfrage, Formel). */
  maxTip?: 1 | 2 | 3;
  /** Text der Stufe, wenn die Art eine eigene hat (sonst Leitfrage und Formel des Musters). */
  tipText?: (tip: 1 | 2 | 3) => string | null;
  /** Aufgabenzeile aus der Eingabeform (eine Regel-Quelle, UX-Prüfung B3); sonst `cxTask_<art>`. */
  task?: string;
  /** „Richtig: …“ als erste Inhaltszeile der Rückmeldekarte (UX-Prüfung W2), nur nach dem Prüfen. */
  right?: ReactNode;
};

export type C1KindEntry = {
  /** Hook der Art. Wird bei jedem Zeichnen derselben Aufgabe genau einmal aufgerufen (die Art ist je Aufgabe fest). */
  useUi: (ctrl: C1Ctrl) => C1Ui;
};
