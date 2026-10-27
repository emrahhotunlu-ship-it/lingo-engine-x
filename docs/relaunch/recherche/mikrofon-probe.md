# Mikrofon- und Stimmen-Probe (27.10.2026)

Probe-Artefakt (ohne Fähigkeiten) einmal von Emrah geöffnet. Ergebnis wörtlich:

> LX-Probe v1 2026-10-27 16:16 | Ort: iPhone-Claude-App | Gerät: iPhone iOS 18.7, App-Webansicht (WebKit) +Claude / Rahmen: iframe / sicher: ja / APIs: TTS=ja STT=ja gUM=ja MR=ja | Vorlesen: Fehler canceled, 26 en-Stimmen (21 en-US, 19 Spaß), gespielt 2 (Favorit: Karen) | Erkennung: haengt (8 s ohne Start) | Aufnahme: gesperrt NotAllowedError nach 4 ms | Diktat: ok "I'll get back to you by the end of the day" (100 %) | Richtlinie-Mikro: unbekannt | Browser-Erlaubnis: denied | claude.permissions: nicht verfügbar (null) | Datei: –

## Was daraus folgt

| Frage | Ergebnis | Folge fürs Konzept |
|---|---|---|
| Vorlesen (`speechSynthesis`) | geht; 26 englische Stimmen, davon 19 Spaß-/Effektstimmen; eine `canceled`-Meldung beim Abbrechen | Hören und Tempi wie geplant. **Spaßstimmen herausfiltern** (feste Liste erlaubter Stimmen). Akzentwechsel möglich (Karen = australisch). `canceled` beim Abbrechen ist kein Fehler und darf nicht als Ausfall gemeldet werden. |
| Eigene Spracherkennung (`SpeechRecognition`) | vorhanden, startet aber nie (8 s ohne Start) | **Nicht nutzbar** in der Claude-App. |
| Mikrofon-Aufnahme (`getUserMedia`) | sofort gesperrt (`NotAllowedError` nach 4 ms, Erlaubnis `denied`) | Der claude.ai-Rahmen gibt das Mikrofon nicht frei. Keine Aufnahme, keine Pausenmessung. |
| Diktiertaste der Tastatur | **geht**, Satz zu 100 % richtig erkannt | **Sprechen läuft über die Diktiertaste.** Das ist der einzige Sprechweg und wird gut angeleitet. |
| `claude.permissions` | nicht verfügbar | Kein Weg, das Mikrofon über die Plattform anzufragen (Vertrag 0.2.49). |

**Entscheidung (Leitung):** Weg 2 (eigene Erkennung, „Drücken zum Sprechen“) entfällt. Pausen und „Wörter leuchten beim Sprechen auf“ entfallen. Sprechkurve: Wörter pro Minute grob aus Startzeit bis Senden, korrekte Sätze, Wendungen. Ein Test im Handy-Browser (Safari) ist optional; die App wird in der Claude-App genutzt.
