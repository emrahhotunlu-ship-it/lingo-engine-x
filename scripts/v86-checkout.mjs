// Rückweg-Gerüst (Stufe 1, P0 S1-TOR Nr. 7; Plan docs/relaunch/stufe1-plan.md §4.6): holt den Live-Stand v86 (Commit 3377252)
// als Testverzeichnis nach .cache/v86/ (gitignored, nichts eingecheckt).
//
//  - Prüft zuerst, dass die Commit-Nachricht „Live v86“ enthält; sonst Abbruch (falscher Stand = falscher Rückweg).
//  - Holt `src/` und `dist/index.html` per `git archive` (keine Einzeldateien per `git show`, damit alle Importe der v86-Schemas aufgehen).
//  - Entpackt in einen Nachbarordner und benennt ihn erst danach um: ein abgebrochener Lauf hinterlässt nie einen halben Stand.
//  - Wiederholbar: Steht der Stand schon da (Datei COMMIT mit dem vollen Hash), passiert nichts.
//
// Aufruf: node scripts/v86-checkout.mjs [--dir <ordner>]   (npm run v86:checkout)
// Ausgabe: der Pfad des Testverzeichnisses. Genutzt von tests/e2e/rueckweg.spec.ts und für den Rückweg per
// `npm run publish:manifest -- --dist .cache/v86/dist --previous docs/relaunch/publish/<link>.json` (docs/relaunch/publish/README.md).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const V86_COMMIT = '3377252';
export const V86_MARK = 'Live v86';
export const V86_DIR = join(ROOT, '.cache', 'v86');
/** Was aus dem v86-Stand geholt wird. */
export const V86_PATHS = ['src', 'dist/index.html'];

const git = (args, opts = {}) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 1024 * 1024 * 1024, ...opts });

/**
 * Holt v86 nach `dir` (Standard .cache/v86/) und gibt Ordner, vollen Hash und Commit-Nachricht zurück.
 * @param {{ dir?: string, commit?: string }} [opts]
 * @returns {{ dir: string, commit: string, subject: string, fresh: boolean }}
 */
export function checkoutV86({ dir = V86_DIR, commit = V86_COMMIT } = {}) {
  let full;
  let subject;
  try {
    full = git(['rev-parse', '--verify', '--quiet', `${commit}^{commit}`], { encoding: 'utf8' }).trim();
    subject = git(['log', '-1', '--format=%s', full], { encoding: 'utf8' }).trim();
  } catch (err) {
    throw new Error(
      `Commit ${commit} (v86) fehlt in diesem Repository – vermutlich ein flacher Klon. Abhilfe: \`git fetch --unshallow origin claude/umbau-fokus\`. (${err instanceof Error ? err.message.split('\n')[0] : err})`,
      { cause: err },
    );
  }
  if (!subject.includes(V86_MARK)) throw new Error(`Commit ${full.slice(0, 9)} ist nicht der Live-Stand: Nachricht „${subject}“ enthält nicht „${V86_MARK}“`);

  const stamp = join(dir, 'COMMIT');
  if (existsSync(stamp) && readFileSync(stamp, 'utf8').split('\n')[0] === full && existsSync(join(dir, 'dist', 'index.html')) && existsSync(join(dir, 'src'))) {
    return { dir, commit: full, subject, fresh: false };
  }
  const tmp = `${dir}.tmp-${process.pid}`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  try {
    const tar = git(['archive', '--format=tar', full, ...V86_PATHS]);
    execFileSync('tar', ['-x', '-C', tmp], { input: tar, maxBuffer: 1024 * 1024 * 1024 });
    if (!existsSync(join(tmp, 'dist', 'index.html'))) throw new Error('dist/index.html fehlt im v86-Stand');
    writeFileSync(join(tmp, 'COMMIT'), `${full}\n${subject}\n`);
    mkdirSync(dirname(dir), { recursive: true });
    rmSync(dir, { recursive: true, force: true });
    renameSync(tmp, dir);
  } catch (err) {
    rmSync(tmp, { recursive: true, force: true });
    throw err;
  }
  return { dir, commit: full, subject, fresh: true };
}

function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--dir');
  const dir = i >= 0 && args[i + 1] ? resolve(args[i + 1]) : V86_DIR;
  try {
    const r = checkoutV86({ dir });
    console.error(`v86 (${r.commit.slice(0, 9)} „${r.subject}“) ${r.fresh ? 'geholt' : 'schon vorhanden'}`);
    console.log(r.dir);
  } catch (err) {
    console.error(`v86-checkout: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
