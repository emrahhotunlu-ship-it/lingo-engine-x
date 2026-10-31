#!/usr/bin/env node
// Vokabeln V0: 60-Tage-Simulation (Ausgangsmessung, Emrahs Auftrag §2 und Abnahmekriterium 1).
//
// Lädt den Planer über Vite (dieselben Plugins wie die App, `import.meta.glob` und `?raw` funktionieren),
// damit die ECHTE Logik läuft und nicht nachgebaut wird. Der Kern steht in `sim-core.ts`, der Planer als
// austauschbarer Adapter in `adapter-current.ts` (heute) bzw. später `adapter-v1.ts` (neuer Planer, Paket V1).
//
//   node scripts/vocab/simulate.mjs                 # heutiger Planer, alle Szenarien, Tabelle auf stdout
//   node scripts/vocab/simulate.mjs --write         # dazu docs/umbau/vokabeln/ausgangsmessung.md und .json neu schreiben
//   node scripts/vocab/simulate.mjs --adapter v1    # später: neuer Planer (Datei adapter-v1.ts)
//   node scripts/vocab/simulate.mjs --days 60 --seed 20261031 --seeds 5   # Abnahme: schlechtester Wert über 5 Startwerte
//
// Der simulierte Lerner ist erfunden und deterministisch (fester Startwert). Keine echten Daten.

process.env.TZ = 'Europe/Berlin';

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

const args = process.argv.slice(2);
const opt = (name, d) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const write = args.includes('--write');
const adapterName = opt('adapter', 'current');
const days = Number(opt('days', '60'));
const seed = Number(opt('seed', '20261031'));
const seeds = Number(opt('seeds', '5'));

const { createServer } = await import(resolve(root, 'node_modules/vite/dist/node/index.js'));
const server = await createServer({
  root,
  configFile: resolve(root, 'vite.config.ts'),
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
});

let code = 0;
try {
  const core = await server.ssrLoadModule('/scripts/vocab/sim-core.ts');
  const adapter = await server.ssrLoadModule(`/scripts/vocab/adapter-${adapterName}.ts`);
  const result = core.runAll(adapter.default, { days, seed, seeds });
  const md = core.toMarkdown(result);
  process.stdout.write(md + '\n');
  const failed = core.selfCheck(result);
  if (failed.length) {
    process.stderr.write(`Selbstprüfung rot:\n- ${failed.join('\n- ')}\n`);
    code = 1;
  }
  if (write) {
    const suffix = adapterName === 'current' ? '' : `-${adapterName}`;
    writeFileSync(resolve(root, `docs/umbau/vokabeln/ausgangsmessung${suffix}.json`), JSON.stringify(core.toJson(result), null, 1) + '\n');
    writeFileSync(resolve(root, `docs/umbau/vokabeln/ausgangsmessung${suffix}.tabelle.md`), md + '\n');
  }
} catch (err) {
  process.stderr.write(String(err?.stack ?? err) + '\n');
  code = 2;
} finally {
  await server.close();
}
process.exit(code);
