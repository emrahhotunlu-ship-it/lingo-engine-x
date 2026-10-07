"""Erzeugt die Inhalte der neuen Themen (Lernplattform 3.0, P36/P37) aus den Themenmodulen tp_*.py.
Aufruf im Wurzelverzeichnis des Repos (danach: node scripts/grammar/build-content.mjs):
  python3 scripts/topics-gen/apply.py . t01 500 450 p02 tp_inversion tp_emph tp_ellipsis tp_nounphrase        (P36)
  python3 scripts/topics-gen/apply.py . t02 600 470 p03 tp_modalsprob tp_stativeadv tp_futurepast tp_quantneg  (P37)
Argumente: Wurzel, Paketname der c1x-Dateien, erste c1x-Nummer, erste Einstufungsnummer, Name der Einstufungsdatei, Module.
Schreibt toolkit.json (Thema und Regelblatt), patterns/<thema>.json, scripts/grammar/parts/<thema>/*, die c1x-Dateien <art>/<paket>-themen.json und place/<datei>.json.
Die Module sind die Quelle: die erzeugten JSON-Dateien werden bei jedem Lauf neu geschrieben (Handarbeit darin geht verloren)."""
import sys, json, importlib, os
sys.path.insert(0, os.path.dirname(__file__))
import lib
ROOT = sys.argv[1]
PKG = sys.argv[2]            # t01 / t02
C1X_BASE = int(sys.argv[3])  # 500 / 600
PLACE_BASE = int(sys.argv[4])  # 450 / 470
PLACE_FILE = sys.argv[5]     # p02 / p03
mods = [importlib.import_module(m) for m in sys.argv[6:]]

def dumpj(path, obj, indent, nl):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(obj, f, ensure_ascii=False, indent=indent)
        if nl: f.write('\n')

# toolkit
tk_path = f'{ROOT}/src/content/c1/toolkit.json'
tk = json.load(open(tk_path))
for m in mods:
    tid = m.TOPIC['id']
    tk['topics'] = [t for t in tk['topics'] if t['id'] != tid] + [m.TOPIC]
    tk['rules'][tid] = m.RULES
dumpj(tk_path, tk, 1, False)

for m in mods:
    t = m.TOPIC['id']
    dumpj(f'{ROOT}/src/content/grammar/patterns/{t}.json', m.FILE, 1, False)
    parts = f'{ROOT}/scripts/grammar/parts/{t}'
    dumpj(f'{parts}/map.json', getattr(m, 'MAP', {}), 1, True)
    dumpj(f'{parts}/v2.json', m.V.items, 1, True)
    dumpj(f'{parts}/order.json', m.ORDER, 1, True)

lib.use(C1X_BASE, False)
import life36
for m in mods:
    m.c1x()
    f = life36.LIFE.get(m.TOPIC['id'])
    if f: f()
lib.write_kinds(f'{ROOT}/src/content/c1x/src', f'{PKG}-themen')
print('c1x', {k: len(v) for k, v in lib.CTX.out.items()})
lib.use(PLACE_BASE, True)
for m in mods: m.place()
lib.write_place(f'{ROOT}/src/content/c1x/src', PLACE_FILE)
print('place', {k: len(v) for k, v in lib.CTX.out.items()})
