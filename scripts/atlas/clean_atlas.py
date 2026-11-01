#!/usr/bin/env python3
"""Bereinigt src/content/atlas/atlas.json ohne Neuaufbau aus den Quellen (nur zur Entwicklung, stdlib).

Nichts wird gelöscht. Geändert wird nur, was ein offensichtlicher Datenfehler ist; alles Zweifelhafte wird markiert:
  hidden 1   Eintrag wird im Atlas nicht angezeigt (britische Schreibweise des Stichworts, Wortart passt nicht zur Definition)
  basic  1   Grundwortschatz (Rang < BASIC_RANK oder alltägliche Dinge): kein C1-Ziel
  exWeak 1   Beispielsatz schwach (Vorname wie „Tom …“, britisches Wort wie „lorry“): beim Kartenanlegen neuen Satz holen
Korrekturen: britische Schreibung im Beispielsatz → US-Form; englische Brocken in der deutschen Bedeutung (`d`) entfernen;
Wortart `p` nach der Definition, wenn die deutsche Bedeutung dazu passt.
Aufruf: python3 scripts/atlas/clean_atlas.py   (idempotent; schreibt atlas.json und meta.json)
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
import british

ATLAS = 'src/content/atlas/atlas.json'
META = 'src/content/atlas/meta.json'
PACK = 'src/content/c1/pack.json'
# Grundwortschatz: wordfreq-Rang unter dieser Grenze (die NGSL-Kernliste ist offline nicht verfügbar; ~2.800 Wörter ≈ Rang 3.300).
BASIC_RANK = 3300
# Alltägliche, konkrete Dinge ohne C1-Bezug (Bänder „häufig/mittel/selten“ bleiben Rangbänder, dies ist die zweite Achse).
EVERYDAY = {'jeans', 'lighter', 'euro', 'dollar', 'cent', 'pound', 'sandwich', 'pizza', 'hamburger', 'banana', 'potato', 'tomato', 'sofa', 'fridge'}
NAMES = re.compile(r"\b(Tom|Mary|Ken|Bill|John|Emily|Dmitri|Tom's|Mary's|Betty|Jim|Maria|Ann|Anne|Mike|Peter|Paul|Linda|Lucy|Bob|Alice|Sam|Jack|Susan|Dan|Ben|Kate|Nancy|Jane|Paulo|Marco|Carl|Sally|Fred)\b")
EN_WORD = re.compile(r"\b(the|a|an|of|for|to|in|on|at|is|are|was|were|I|you|he|she|it|we|they|my|his|her|and|or|with|from|this|that|should|be|by|as|not|no|can|will|do|does|did|have|has|had|feel|long|rights|used|someone|something)\b")
# Handkorrekturen nach der Prüfung des Englischlehrers (nur Felder d, p, exWeak; g/xd/r bleiben unberührt)
OVERRIDES = {
    'receipt': {'d': 'Empfang, Erhalt, Quittung'},
    'interact': {'d': 'interagieren, in Kontakt treten'},
    'fond': {'d': 'zugetan, gernhaben'},
    'shred': {'d': 'in Streifen schneiden, schreddern', 'exWeak': 1},
    'quake': {'d': 'Erdbeben'},
    'sling': {'d': 'Schleuder'},
    'referee': {'exWeak': 1},
    # english-teacher S7c (Einstufung/Nachfüllen): Business-Bedeutung und -Satz, Glossen ohne Rauschen, heikle/seltsame Sätze nicht abfragen.
    'earnings': {'d': 'Gewinn, Ertrag; Verdienst', 'x': "The company's quarterly earnings beat expectations.", 'xd': 'Der Quartalsgewinn des Unternehmens übertraf die Erwartungen.'},
    'margin': {'d': 'Marge, Gewinnspanne; Rand', 'x': 'Our margin on cloud licenses is around 30 percent.', 'xd': 'Unsere Marge bei Cloud-Lizenzen liegt bei etwa 30 Prozent.'},
    'acceptable': {'x': 'Would a two-week delay be acceptable to the client?', 'xd': 'Wäre eine Verzögerung von zwei Wochen für den Kunden akzeptabel?'},
    'auction': {'x': 'I bought the painting at auction.', 'xd': 'Ich habe das Bild auf einer Auktion gekauft.'},
    'concentration': {'x': 'The open-plan office makes concentration difficult.', 'xd': 'Das Großraumbüro erschwert die Konzentration.'},
    'indicator': {'x': 'Churn is a key indicator of customer satisfaction.', 'xd': 'Die Abwanderungsrate ist ein wichtiger Indikator für die Kundenzufriedenheit.'},
    'execution': {'d': 'Umsetzung, Ausführung; Hinrichtung', 'x': 'The strategy was fine; the execution was poor.', 'xd': 'Die Strategie war gut, die Umsetzung schlecht.'},
    'thickness': {'d': 'Dicke, Stärke'},
    'secondly': {'d': 'zweitens'},
    'flee': {'d': 'fliehen, flüchten'},
    'creep': {'d': 'schleichen, kriechen'},
    'shave': {'d': 'rasieren, sich rasieren'},
    'chaos': {'hidden': 1},
    'corps': {'hidden': 1},
    'salad': {'exWeak': 1},
    'cookie': {'exWeak': 1},
    'priority': {'exWeak': 1},
    'memorial': {'exWeak': 1},
    'newborn': {'exWeak': 1},
    'prophet': {'exWeak': 1},
    'lesbian': {'exWeak': 1},
    'dough': {'x': 'Let the dough rest for an hour before baking.', 'xd': 'Lass den Teig vor dem Backen eine Stunde ruhen.'},
    'corresponding': {'x': 'Each invoice has a corresponding purchase order.', 'xd': 'Zu jeder Rechnung gibt es eine entsprechende Bestellung.'},
    'exposure': {'d': 'Kontakt, Ausgesetztsein'},
    'jungle': {'hidden': 1},
    'channels': {'hidden': 1},
    'regulation': {'d': 'Vorschrift, Bestimmung'},
    'strive': {'x': 'We strive to answer every support ticket within four hours.', 'xd': 'Wir bemühen uns, jedes Support-Ticket innerhalb von vier Stunden zu beantworten.'},
    'adequate': {'x': 'We need adequate time to test the migration.', 'xd': 'Wir brauchen ausreichend Zeit, um die Umstellung zu testen.'},
    'perceive': {'x': 'Many customers perceive the cloud as less secure than on-premise.', 'xd': 'Viele Kunden nehmen die Cloud als weniger sicher wahr als eigene Server.'},
    'equally': {'d': 'gleichermaßen, gleich'},
    'railroad': {'exWeak': 1},
    'destination': {'d': 'Reiseziel, Zielort'},
    'scam': {'x': 'The email was an obvious phishing scam.', 'xd': 'Die E-Mail war ein offensichtlicher Phishing-Betrug.'},
    'spice': {'x': 'This dish needs more spice.', 'xd': 'Dieses Gericht braucht mehr Würze.'},
}
GERMAN_CH = re.compile(r"[äöüÄÖÜß]")


def english_piece(piece: str) -> bool:
    if GERMAN_CH.search(piece):
        return False
    words = re.findall(r"[A-Za-z']+", piece)
    hits = sum(1 for w in words if EN_WORD.fullmatch(w))
    # reine ASCII-Stücke mit mindestens zwei englischen Funktionswörtern, oder Satz mit Punkt ohne deutsche Zeichen
    german = re.search(r"\b(der|die|das|den|dem|des|ein|eine|einen|und|zu|zur|zum|im|mit|von|sich|etw|jdn|jdm|jmdn|auf|aus|bei|nach|vor|für|über|um)\b", piece)
    return not german and ((len(words) >= 3 and hits >= 1) or (len(words) >= 2 and hits >= 1 and re.search(r"[a-z]{3,} [a-z]{3,}", piece) is not None))


def clean_d(d: str) -> str:
    pieces = [p.strip() for p in d.split(',') if p.strip()]
    keep = [p for i, p in enumerate(pieces) if i == 0 or not english_piece(p)]
    # Stichwort wie „introduction of the euro“ als zweites Stück bleibt nie stehen
    return ', '.join(keep) if keep else d


def main() -> None:
    raw = json.load(open(ATLAS, encoding='utf8'))
    items = raw['items']
    st = dict(spell_x=0, d=0, hidden_w=0, hidden_pos=0, pos=0, exweak=0, basic=0)
    for e in items:
        e.pop('hidden', None); e.pop('basic', None); e.pop('exWeak', None)
        # Stichwort britisch → ausgeblendet
        if british.spell_hits(e['w']):
            e['hidden'] = 1; st['hidden_w'] += 1
        # Beispielsatz: Schreibung → US
        us = british.to_us(e['x'])
        if us != e['x']:
            e['x'] = us; st['spell_x'] += 1
        # Datenmüll in der deutschen Bedeutung
        nd = clean_d(e['d'])
        if nd != e['d']:
            e['d'] = nd; st['d'] += 1
        # Wortart gegen Definition
        g = e['g'].lstrip('( ').lower()
        noun_gloss = bool(re.match(r'(a|an|the|any|one)\s', g))
        verb_gloss = g.startswith('to ')
        upper_d = e['d'][:1].isupper()
        if e['p'] == 'verb' and noun_gloss and not verb_gloss:
            if upper_d: e['p'] = 'noun'; st['pos'] += 1
            else: e['hidden'] = 1; st['hidden_pos'] += 1
        elif e['p'] == 'noun' and verb_gloss:
            if not upper_d: e['p'] = 'verb'; st['pos'] += 1
            else: e['hidden'] = 1; st['hidden_pos'] += 1
        # schwacher Beispielsatz
        if NAMES.search(e['x']) or british.lex_hits(e['x']):
            e['exWeak'] = 1; st['exweak'] += 1
        for k, v in OVERRIDES.get(e['w'], {}).items():
            e[k] = v
        # Grundwortschatz
        if e['r'] < BASIC_RANK or e['w'] in EVERYDAY:
            e['basic'] = 1; st['basic'] += 1
    json.dump(raw, open(ATLAS, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    visible = sum(1 for e in items if not e.get('hidden') and e['w'] and e['d'] and e['x'])
    n_pack = len(json.load(open(PACK, encoding='utf8'))['items'])
    json.dump({'atlas': visible, 'pack': n_pack}, open(META, 'w'))
    open(META, 'a').write('\n')
    print(st, 'sichtbar', visible, 'von', len(items), 'Paket', n_pack)


if __name__ == '__main__':
    main()
