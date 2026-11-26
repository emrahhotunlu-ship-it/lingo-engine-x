import type { Engine } from '../voice/engine';

// Nachgebildete neue Stimme (Stimme 2.0) für E2E-Tests: statt des 200-MB-Stimmen-Pakets eine Maschine, die nach `delayMs` einen kurzen,
// stillen Ton liefert. So lassen sich Lade-Zustand des Anhören-Knopfs und „nie die Gerätestimme bei langsamem Satz“ im echten Bau prüfen.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds (wird über `window.__lxVoiceEngine` eingespielt, siehe voice/neural.ts).

export type FakeNeuralOptions = { delayMs?: number; fail?: boolean };

export function installFakeNeural(target: object, opts: FakeNeuralOptions, log: string[]): void {
  const make = (): Promise<Engine> => {
    if (opts.fail) return Promise.reject(new Error('fake: kein Stimmen-Paket'));
    return Promise.resolve({
      device: 'webgpu',
      version: 'fake-neural-1',
      worker: true,
      fromCache: true,
      loadMs: 5,
      lost: () => false,
      dispose: () => Promise.resolve(),
      generate: (text: string) =>
        new Promise((resolve) => {
          setTimeout(() => {
            log.push(text);
            resolve({ audio: new Float32Array(2_400), rate: 24_000 });
          }, opts.delayMs ?? 300);
        }),
    });
  };
  Object.defineProperty(target, '__lxVoiceEngine', { value: make, configurable: true });
}
