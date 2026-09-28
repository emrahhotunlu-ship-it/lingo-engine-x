import type { WritingPrompt } from '../../domain/input/types';
import { useT } from '../../i18n';

// Weitere Gattungen der Schreibwerkstatt (Neubau N61, Lehrer S2, S5, S7, S8): je eigene Maske über
// die Aufgabe (Ausgangstext steht in der Aufgabe) und eigenes Wortziel. Geprüft wird mit der
// vorhandenen Schreib-Rückmeldung (`writing-review`), ohne neue Vorlage. Ohne KI: gespeichert, ohne Urteil.

export const GENRE_PROMPTS: readonly WritingPrompt[] = [
  {
    id: 'nb-exec-summary',
    genre: 'summary',
    level: 'C1',
    domain: 'work',
    title: { de: 'Executive Summary', en: 'Executive summary' },
    task: {
      de: 'Interner Stand: „Das Pilotprojekt mit dem Logistikkunden läuft seit acht Wochen. Die Rechnungsprüfung dauert jetzt 3 statt 9 Tage. Zwei Schnittstellen zum ERP fehlen noch, das kostet etwa 40.000 Euro. Der Kunde will bis Ende Oktober wissen, ob wir auf alle 12 Standorte ausrollen.“ Schreib daraus 5 Sätze für die Geschäftsführung: Ergebnis zuerst, eine Zahl, eine Empfehlung, welche Entscheidung nötig ist.',
      en: 'Internal status: "The pilot with the logistics customer has been running for eight weeks. Invoice checks now take 3 days instead of 9. Two ERP interfaces are still missing, which will cost about 40,000 euros. The customer wants to know by the end of October whether we will roll out to all 12 sites." Turn this into 5 sentences for senior management: result first, one number, one recommendation, the decision you need.',
    },
    words: [60, 110],
    focus: { de: 'Ergebnis zuerst, knapp', en: 'Bottom line up front, concise' },
    useful: ['In short,', 'We recommend', 'The key decision is', 'reduced … from … to'],
    src: 'seed',
  },
  {
    id: 'nb-linkedin',
    genre: 'post',
    level: 'B2+',
    domain: 'work',
    title: { de: 'LinkedIn: Nachricht nach der Messe', en: 'LinkedIn: message after a trade show' },
    task: {
      de: 'Du hast auf einer Messe kurz mit einer IT-Leiterin gesprochen (Thema: Dokumentenprüfung). Schreib ihr eine persönliche LinkedIn-Nachricht (höchstens 300 Zeichen): Bezug auf das Gespräch, ein Nutzen, ein leichter nächster Schritt – nicht verkäuferisch.',
      en: 'You briefly talked to an IT manager at a trade show (topic: document checks). Write her a personal LinkedIn message (max. 300 characters): refer to the conversation, one benefit, one easy next step – not salesy.',
    },
    words: [30, 60],
    focus: { de: 'Persönlich, nicht verkäuferisch', en: 'Personal, not salesy' },
    useful: ['Great meeting you at', 'You mentioned', 'Would you be open to', 'No pressure at all'],
    src: 'seed',
  },
  {
    id: 'nb-half',
    genre: 'email',
    level: 'C1',
    domain: 'work',
    title: { de: 'Halb so lang', en: 'Half as long' },
    task: {
      de: 'Kürze diese Mail auf die Hälfte (höchstens 45 Wörter), ohne eine Kernaussage zu verlieren: „Dear Mr. Carter, I hope this email finds you well. I just wanted to reach out to you in order to let you know that, unfortunately, due to some unforeseen technical issues on our side, the delivery of the new module will unfortunately be delayed by approximately two weeks. We are of course doing everything we possibly can to resolve this as quickly as possible. Please do not hesitate to contact me should you have any further questions. Best regards“',
      en: 'Cut this email in half (max. 45 words) without losing a key point: "Dear Mr. Carter, I hope this email finds you well. I just wanted to reach out to you in order to let you know that, unfortunately, due to some unforeseen technical issues on our side, the delivery of the new module will unfortunately be delayed by approximately two weeks. We are of course doing everything we possibly can to resolve this as quickly as possible. Please do not hesitate to contact me should you have any further questions. Best regards"',
    },
    words: [25, 45],
    focus: { de: 'Knapper US-Stil', en: 'Concise US style' },
    useful: ['is delayed by', 'We are working to', 'Let me know if'],
    src: 'seed',
  },
  {
    id: 'nb-mediate',
    genre: 'email',
    level: 'C1',
    domain: 'work',
    title: { de: 'Deutsch → Englisch vermitteln', en: 'German → English: mediate' },
    task: {
      de: 'Interne Notiz: „Kunde Müller AG ist verärgert, weil die letzte Rechnung doppelt verschickt wurde. Buchhaltung hat den Fehler gefunden, Gutschrift kommt diese Woche. Bitte beim UK-Partner nachhaken, ob dort derselbe Fehler passiert ist.“ Schreib dem UK-Partner eine kurze englische Mail – nicht Wort für Wort übersetzen, sondern für ihn aufbereiten.',
      en: 'Internal note (in German): the customer Müller AG is upset because the last invoice was sent twice; accounting found the error and a credit note will follow this week; please check with the UK partner whether the same error happened there. Write the UK partner a short English email – do not translate word for word, adapt it for him.',
    },
    words: [60, 120],
    focus: { de: 'Für den Empfänger aufbereiten', en: 'Adapt for the reader' },
    useful: ['Quick heads-up:', 'Could you check whether', 'On our side,', 'Thanks in advance'],
    src: 'seed',
  },
];

/** Gattungs-Wahl unter der Aufgabe (nur solange heute noch nichts abgegeben ist). */
export function GenreChips({ current, onPick, disabled }: { current: string; onPick: (p: WritingPrompt) => void; disabled?: boolean }) {
  const { t, lang } = useT();
  return (
    <div className="flex flex-col gap-2" data-testid="genre-chips">
      <p className="lx-eyebrow">{t('nbLesenGenres')}</p>
      <div className="flex flex-wrap gap-2">
        {GENRE_PROMPTS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            aria-pressed={current === p.id}
            onClick={() => onPick(p)}
            data-testid="genre-chip"
            data-id={p.id}
            className={`min-h-11 rounded-full px-4 text-sm transition-colors ${current === p.id ? 'bg-accent-soft font-semibold text-accent-text' : 'bg-surface text-muted hover:text-fg'}`}
          >
            {p.title[lang]}
          </button>
        ))}
      </div>
    </div>
  );
}
