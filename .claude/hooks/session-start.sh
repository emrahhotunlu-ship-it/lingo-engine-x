#!/bin/bash
# Richtet eine frische Claude-Code-Cloud-Sitzung ein: Abhängigkeiten installieren,
# damit Typprüfung, Lint und Tests sofort laufen. Chromium für Playwright ist in der
# Cloud-Umgebung vorinstalliert (/opt/pw-browsers) – nie `playwright install`.
set -euo pipefail
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm ci --no-audit --no-fund >/dev/null 2>&1 || npm install --no-audit --no-fund >/dev/null 2>&1
fi
echo "lingo-engine-x: Abhängigkeiten bereit (npm run verify prüft alles)."
