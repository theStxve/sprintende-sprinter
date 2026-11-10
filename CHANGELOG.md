# Changelog

Alle nennenswerten Änderungen an Sprintende Sprinter. Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), die Versionsnummern folgen [Semantic Versioning](https://semver.org/lang/de/).

Der Abschnitt einer Version wird beim Release automatisch als Release-Text übernommen.

## [Unveröffentlicht]

### Lizenz

- **Neue Lizenz: alle Rechte vorbehalten.** Die App darf privat genutzt, aber **nicht weitergegeben** werden (weder kostenlos noch gegen Geld) und **nicht kommerziell** genutzt werden. Teilen per Link auf die GitHub-Seite ist erlaubt. Bis einschließlich 1.3.1 galt die MIT-Lizenz; seit dem 10. November 2026 gilt die neue Lizenz für alle hier angebotenen Versionen. Details in der [LICENSE](https://github.com/theStxve/sprintende-sprinter/blob/main/LICENSE). Der Hinweis steht jetzt auch unter *Optionen → App*.
- **Credits**: Die Codegrundlage stammt von [kyropytis](https://github.com/kyropytis). Das steht jetzt im README, in der Lizenz und in der App.

### Geändert

- **Wischen auf dem ganzen Bedienfeld**: Nicht mehr nur am Griff. Zugeklappt öffnet ein Wisch nach oben irgendwo auf dem Feld. Aufgeklappt schließt ein Wisch nach unten, sobald der Inhalt ganz oben steht; sonst scrollt der Inhalt wie gewohnt. Seitliche Bewegungen und Eingabefelder lösen nichts aus, und ein Knopf unter dem Finger wird beim Wischen nicht versehentlich gedrückt.

## [1.3.1] - 2026-11-10

### Geändert

- **Updates über Obtainium**: Ist unter *Optionen → App* „Obtainium“ als Update-Quelle gewählt, öffnet ein Tipp auf den Update-Hinweis direkt Obtainium, damit du dort aktualisieren kannst. Das gilt auch für den Knopf „Update“ in den Optionen. Ist Obtainium nicht installiert, gibt es stattdessen den normalen Download.

## [1.3.0] - 2026-11-10

### Geändert

- **Alles fühlt sich flüssiger an**: Überall Übergänge statt harter Sprünge, mit einheitlichen Kurven und Dauern.
- **Bedienfeld**: gleitet beim Auf- und Zuklappen und bei jedem Inhaltswechsel weich auf die neue Höhe. Beim Wischen am Griff folgt es dem Finger und klappt je nach Weg und Tempo auf oder zu, sonst federt es zurück.
- **Reiter und Auswahlfelder**: Die Markierung gleitet zum gewählten Eintrag, der Inhalt blendet aus der passenden Richtung ein. Schalter federn leicht.
- **Knöpfe** geben beim Drücken leicht nach. Bei Auswahl und bei „Los“ gibt es ein kurzes haptisches Tippen (folgt der Einstellung *Vibration*).
- **Dialoge, Meldungen, Suche, Editoren und Werkzeugleisten** fahren ein und wieder aus, statt aufzuploppen und zu verschwinden.
- **Karte**: Pacer und eigener Standort gleiten flüssig zwischen den GPS-Updates, statt zu springen. Neue Punkte ploppen weich auf. Dein Standort und der laufende Pacer pulsieren dezent.
- Listen (Wege, Ziele im Go-Modus) erscheinen kurz nacheinander.
- Ist in Android „Animationen entfernen“ eingeschaltet, bleibt die App ohne Bewegung.

## [1.2.0] - 2026-11-10

### Neu

- **Update-Quelle wählbar** unter *Optionen → App*: **Diese App** (Hinweis mit Download), **Obtainium** (nur ein kurzer Hinweis, installiert wird in Obtainium) oder **Aus** (keine Hinweise). Die Einstellung aus 1.1.0 wird übernommen.
- **Strecken auch ohne Wegführungsdienst**: Die zuletzt berechneten Strecken werden im Gerät gespeichert. Ist der Dienst nicht erreichbar, wird die gespeicherte Strecke für genau dieselben Punkte und Sperren genutzt.

### Geändert

- **Sperren bleiben zuverlässig, auch wenn der Sperr-Dienst ausfällt**: Erst kommt die gespeicherte Strecke, dann eine Ausweichroute, die durch keine Sperre läuft. Nur wenn beides fehlt, wird die normale Route mit deutlicher Warnung angezeigt.
- Straßen lassen sich auch sperren, wenn der Sperr-Dienst offline ist, dann ohne roten Straßenverlauf.
- Hinweise zur Herkunft der Strecke erscheinen jetzt auch im Go-Modus.

## [1.1.0] - 2026-11-10

### Neu

- **Straßen sperren**: Unter *Strecke → Straßen sperren* auf eine Straße tippen, die du nicht nehmen willst. Die Wegführung macht einen Bogen darum, auch um die Gehwege daneben. Gesperrte Stücke sind rot auf der Karte; ein Tipp auf die Sperre hebt sie wieder auf. Sperren gelten für alle Strecken, Wege und den Go-Modus.
- **Zwischenstopps im Go-Modus**: bis zu drei Punkte zwischen Start und Ziel, per Tipp auf die Karte gesetzt und verschiebbar.
- **Was ist neu**: Nach einem Update zeigt die App, was sich geändert hat. Unter *Optionen → App* jederzeit nachlesbar.
- **Update-Hinweis ohne Obtainium**: Die App schaut beim Start (höchstens alle 6 Stunden) bei GitHub nach einer neuen Version und bietet den Download an. Abschaltbar unter *Optionen → App*.

### Datenschutz

- Mit gesperrten Straßen in der Nähe wird die Strecke über FOSSGIS-Valhalla statt FOSSGIS-OSRM berechnet. Beide bekommen nur die Streckenpunkte, Valhalla zusätzlich die Lage der Sperren.
- Die Update-Prüfung fragt nur die neueste Versionsnummer bei GitHub ab.

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

[1.3.1]: https://github.com/theStxve/sprintende-sprinter/releases/tag/v1.3.1
[1.3.0]: https://github.com/theStxve/sprintende-sprinter/releases/tag/v1.3.0
[1.2.0]: https://github.com/theStxve/sprintende-sprinter/releases/tag/v1.2.0
[1.1.0]: https://github.com/theStxve/sprintende-sprinter/releases/tag/v1.1.0
[1.0.0]: https://github.com/theStxve/sprintende-sprinter/releases/tag/v1.0.0
[0.2.0]: https://github.com/theStxve/sprintende-sprinter/commit/8318cdd
[0.1.0]: https://github.com/theStxve/sprintende-sprinter/commit/29478d7
