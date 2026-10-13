import { z } from 'zod';

// Was Paket L3 / die Hauptsitzung für den Leser verdrahten muss (Paket L4 fasst Routen und Reiter nicht an):
//
//  1. Route `readArticle` (kind: 'page', Reiterleiste bleibt sichtbar; Reiter `read`) mit dem Parameter-Schema `readerRouteParams`
//     (Parameter `id` = Artikel-Kennung `a-<Tag>-<Nr.>-<Streuwert>`; sie steht in jedem Eintrag des Monatsindex `read/m-…`).
//     Der Bildschirm der Route ist `<ReaderScreen id={params.id} />` aus `./index` (importiert wird über `src/modules/read/index.ts`,
//     die Tür nach außen; dort `export { ReaderScreen } from './ui/reader'` ergänzen).
//  2. Die Liste (L3) öffnet den Artikel mit `nav.push({ name: 'readArticle', id })`.
//  3. `keepScroll` der Route einschalten (der Leser merkt sich zusätzlich die Position `pos` im Lesezustand).
//  4. Texte: `rdrDe`/`rdrEn` aus `../../i18n/rdReader.{de,en}` in `readMessages` aufnehmen (der Leser läuft auch ohne, mit eigener Suche).
//  5. Fortsetzen (`Resumable` id `read`): beim Öffnen steht „Weiter bei Satz N“ im Leser selbst; die Zeile auf „Heute“ kann auf die
//     Route `readArticle` mit der zuletzt gelesenen Kennung zeigen (aus dem Monatsindex: Eintrag mit `st.pos > 0` und nicht `st.done`).
//  6. Der Leser nutzt `src/app/shell` nicht: das Nachschlage-Fenster (`LookupLayer`) und die Hinweise (`Toaster`) hängen bereits im Rahmen.

/** Parameter der Route `readArticle`. */
export const readerRouteParams = z.object({ id: z.string().regex(/^a-\d{4}-\d{2}-\d{2}-\d+-[0-9a-z]+$/) });
export type ReaderRouteParams = z.infer<typeof readerRouteParams>;
