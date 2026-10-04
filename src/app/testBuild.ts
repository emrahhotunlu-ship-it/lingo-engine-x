// Gibt es die Testwerkzeuge in dieser Fassung? Nur im Test-Build für den Test-Link (`npm run build:test`,
// LX_TEST=1). Im normalen Build ersetzt Vite `__LX_TEST__` durch `false`; die Zweige hinter dieser Prüfung
// sind dann toter Code und fliegen mit allen Testdateien und Texten aus der Datei.
// scripts/check-platform.mjs --prod prüft das an der Kennzeichnung `lx-test-tools`.
// In Unit-Tests ist die Konstante nicht definiert und gilt als falsch.
//
// Wichtig für Aufrufer: Zweige mit der KONSTANTE schreiben (`TEST_BUILD && <TestTools />`). Der Bündler
// faltet eine importierte Konstante, ruft eine Funktion aber nicht ab: Hinter `isTestBuild()` bliebe der
// Zweig in der Datei stehen. Die Funktion ist für Code und Tests da, die keinen Zweig entfernen müssen.
export const TEST_BUILD: boolean = typeof __LX_TEST__ !== 'undefined' && __LX_TEST__ === true;

export const isTestBuild = (): boolean => TEST_BUILD;
