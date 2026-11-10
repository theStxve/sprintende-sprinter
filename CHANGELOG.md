# Changelog

Alle nennenswerten Änderungen an Sprintende Sprinter. Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), die Versionsnummern folgen [Semantic Versioning](https://semver.org/lang/de/).

Der Abschnitt einer Version wird beim Release automatisch als Release-Text übernommen.

## [1.0.0] - 2026-11-10

Erste Version mit eigenen Releases und Updates über Obtainium.

### Wichtig beim Umstieg

- Die App ist ab jetzt mit einem eigenen Release-Schlüssel signiert. Eine vorher installierte Testversion muss **einmal deinstalliert** werden, bevor diese Version installiert werden kann. Danach lassen sich alle weiteren Updates direkt drüberinstallieren.

### Neu

- **Go-Modus** (in den Optionen): eine einzige Ansicht für Eile. Häufiges Ziel antippen, auf der Karte verschieben, Ankunft per ±1/±5 min setzen, Los.
- **Wege**: gespeicherte Ziele mit Uhrzeiten, Puffer und Hinweis „spätestens um … los“.
- **Zug-Verknüpfung** über Transitous: Live-Verspätung, Gleis und Ausfälle fließen in die Zielzeit ein.
- **Erinnerungen** an gewählten Wochentagen mit Los-Knopf, dazu ein Hintergrund-Check auf Verspätung, Ausfall und Gleiswechsel.
- **Ortssuche** über Photon und Wegführung für Fuß, Rad und Auto.
- **Ansagen und Vibration** bei Wechsel und in festen Abständen; GPS und Ansagen laufen über einen Vordergrund-Dienst auch bei ausgeschaltetem Bildschirm.
- Strecken speichern, umkehren und als Rundkurs schließen.
- Zeitraffer-Vorschau des Pacers.
- Neues App-Symbol und Benachrichtigungssymbol.

### Geändert

- Komplett neue Oberfläche mit Karte und ausziehbarem Bedienfeld.
- Karte über OpenFreeMap (Vektorkarten mit MapLibre GL) mit deutschen Ortsnamen.
- Einstellungen, Strecken und ein laufender Lauf bleiben nach einem Neustart erhalten.

### Behoben

- Beim Start eines gespeicherten Wegs konnte der Pacer kurz mit der vorherigen Strecke loslaufen, bevor die neue berechnet war.

## [0.2.0] - 2026-09-14

### Neu

- Luftlinie als Alternative zur Wegführung.
- Android-App über Capacitor mit nativer GPS-Berechtigung.

## [0.1.0] - 2026-09-14

### Neu

- Erste Version: virtueller Pacer auf einer selbst gesetzten Strecke mit Zielzeit.

[1.0.0]: https://github.com/theStxve/sprintende-sprinter/releases/tag/v1.0.0
[0.2.0]: https://github.com/theStxve/sprintende-sprinter/commit/8318cdd
[0.1.0]: https://github.com/theStxve/sprintende-sprinter/commit/29478d7
