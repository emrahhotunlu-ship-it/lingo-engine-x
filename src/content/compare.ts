// Monatliche Vergleichsaufgabe (Backlog B1, lehrer.md X1): feste Aufgabenpaare aus Sprechen (45 s)
// und Schreiben (Mail). Jeden Monat kommt dasselbe Paar wie beim letzten Mal – nur so sind beide
// Fassungen vergleichbar. Aufgabe auf Deutsch und Englisch (Oberflächensprache), der Inhalt der
// Antwort ist immer Englisch (US).

export type CompareTask = {
  id: string;
  speak: { de: string; en: string };
  write: { de: string; en: string };
};

export const COMPARE_TASKS: readonly CompareTask[] = [
  {
    id: 'ct1',
    speak: {
      de: 'Erzähl von einem Projekt, an dem du gerade arbeitest: Worum geht es, was läuft gut, was ist schwierig?',
      en: 'Talk about a project you are working on: what is it about, what is going well, what is difficult?',
    },
    write: {
      de: 'Schreib einer Kundin eine Mail: Der vereinbarte Liefertermin verschiebt sich um zwei Wochen. Erkläre den Grund, entschuldige dich und schlag einen nächsten Schritt vor.',
      en: 'Write an email to a client: the agreed delivery date is delayed by two weeks. Explain why, apologize and suggest a next step.',
    },
  },
  {
    id: 'ct2',
    speak: {
      de: 'Stell dich einem neuen internationalen Team vor: deine Rolle, deine Erfahrung und was die anderen von dir erwarten können.',
      en: 'Introduce yourself to a new international team: your role, your experience and what they can expect from you.',
    },
    write: {
      de: 'Schreib deinem Vorgesetzten eine Mail: Du schlägst eine Änderung an einem Ablauf vor. Nenne den Nutzen, ein Risiko und bitte um ein kurzes Gespräch.',
      en: 'Write an email to your manager proposing a change to a process. Name the benefit, one risk, and ask for a short meeting.',
    },
  },
];

export function compareTask(id: string | null | undefined): CompareTask {
  return COMPARE_TASKS.find((t) => t.id === id) ?? (COMPARE_TASKS[0] as CompareTask);
}
