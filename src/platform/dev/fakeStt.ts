// Nachgebildete Spracheingabe (`SpeechRecognition`) für E2E- und Unit-Tests (Plan §9.5):
// - 'ok': startet; `say(text)` liefert erst einen Zwischenstand, dann das Ergebnis und endet,
// - 'blocked': jeder Start endet mit `not-allowed` (wie ein gesperrtes Mikrofon im iframe),
// - 'absent': die Schnittstelle fehlt ganz (auch Chromiums eigene wird ausgeblendet).
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

export type FakeSttMode = 'ok' | 'blocked' | 'absent';

type Handler<E> = ((ev: E) => void) | null;
type Result = { transcript: string };
type ResultList = Array<[Result] & { isFinal: boolean }>;

export type FakeSttHandle = { say(text: string): void; starts: number };

export function installFakeStt(win: Window, mode: FakeSttMode): FakeSttHandle {
  const handle: FakeSttHandle = { say: () => undefined, starts: 0 };
  const define = (name: string, value: unknown) => Object.defineProperty(win, name, { value, configurable: true, writable: true });
  if (mode === 'absent') {
    define('SpeechRecognition', undefined);
    define('webkitSpeechRecognition', undefined);
    return handle;
  }
  let active: FakeRecognition | null = null;

  class FakeRecognition {
    lang = '';
    interimResults = false;
    continuous = false;
    maxAlternatives = 1;
    onresult: Handler<{ results: ResultList; resultIndex: number }> = null;
    onerror: Handler<{ error: string }> = null;
    onend: (() => void) | null = null;
    private running = false;

    start(): void {
      handle.starts++;
      if (this.running) throw new Error('InvalidStateError: already started');
      this.running = true;
      if (mode === 'blocked') {
        setTimeout(() => {
          this.onerror?.({ error: 'not-allowed' });
          this.end();
        }, 10);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-this-alias -- die Nachbildung merkt sich die laufende Erkennung
      active = this;
    }

    stop(): void {
      this.end();
    }

    abort(): void {
      if (!this.running) return;
      this.onerror?.({ error: 'aborted' });
      this.end();
    }

    hear(text: string): void {
      if (!this.running) return;
      const words = text.split(' ');
      const half = words.slice(0, Math.max(1, Math.floor(words.length / 2))).join(' ');
      const interim = Object.assign([{ transcript: half }] as [Result], { isFinal: false });
      this.onresult?.({ results: [interim], resultIndex: 0 });
      setTimeout(() => {
        const fin = Object.assign([{ transcript: text }] as [Result], { isFinal: true });
        this.onresult?.({ results: [fin], resultIndex: 0 });
        this.end();
      }, 30);
    }

    private end(): void {
      if (!this.running) return;
      this.running = false;
      if (active === this) active = null;
      setTimeout(() => this.onend?.(), 0);
    }
  }

  define('SpeechRecognition', FakeRecognition);
  define('webkitSpeechRecognition', FakeRecognition);
  handle.say = (text: string) => active?.hear(text);
  return handle;
}
