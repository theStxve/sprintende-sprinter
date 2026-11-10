<p align="center">
  <img src="docs/banner.png" alt="Sprintende Sprinter: Ein virtueller Pacer läuft deinen Weg im genau nötigen Tempo" width="100%">
</p>

<p align="center">
  <a href="https://github.com/theStxve/sprintende-sprinter/releases/latest"><img alt="Neueste Version" src="https://img.shields.io/github/v/release/theStxve/sprintende-sprinter?style=flat-square&label=Version&color=EE4F17"></a>
  <a href="https://github.com/theStxve/sprintende-sprinter/releases/latest"><img alt="Downloads" src="https://img.shields.io/github/downloads/theStxve/sprintende-sprinter/total?style=flat-square&label=Downloads&color=16181B&logo=android&logoColor=white"></a>
  <a href="https://github.com/theStxve/sprintende-sprinter/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/theStxve/sprintende-sprinter/ci.yml?branch=main&style=flat-square&label=CI"></a>
  <img alt="Android" src="https://img.shields.io/badge/Android-App-3DDC84?style=flat-square&logo=android&logoColor=white">
  <img alt="Capacitor 8" src="https://img.shields.io/badge/Capacitor-8-119EFF?style=flat-square&logo=capacitor&logoColor=white">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="MapLibre GL" src="https://img.shields.io/badge/MapLibre_GL-6-396CB2?style=flat-square&logo=maplibre&logoColor=white">
  <img alt="Ohne API-Key" src="https://img.shields.io/badge/API--Keys-keine-EE4F17?style=flat-square">
  <a href="LICENSE"><img alt="Lizenz: alle Rechte vorbehalten" src="https://img.shields.io/badge/Lizenz-alle_Rechte_vorbehalten-C93322?style=flat-square"></a>
</p>

<p align="center">
  <b>Zum Zug, zur Vorlesung, zum Date: genau rechtzeitig da, ohne zu früh zu hetzen oder zu spät zu kommen.</b>
</p>

---

**Sprintende Sprinter** ist eine Android-App für alle, die knapp dran sind. Du sagst, wohin und bis wann. Ein virtueller **Pacer** läuft die Strecke im exakt nötigen Tempo ab. Per GPS siehst und hörst du, wie viele Sekunden du vor oder hinter ihm liegst. Bleibst du vor ihm, bist du pünktlich.

## Installation

<p>
  <a href="https://apps.obtainium.imranr.dev/redirect?r=obtainium://add/https://github.com/theStxve/sprintende-sprinter"><img alt="Mit Obtainium holen" src="https://img.shields.io/badge/Obtainium-Holen_und_aktuell_halten-6438B5?style=for-the-badge&logo=android&logoColor=white"></a>
  <a href="https://github.com/theStxve/sprintende-sprinter/releases/latest"><img alt="APK herunterladen" src="https://img.shields.io/badge/APK-Herunterladen-16181B?style=for-the-badge&logo=github&logoColor=white"></a>
</p>

**Empfohlen: mit [Obtainium](https://github.com/ImranR98/Obtainium).** Obtainium installiert Apps direkt aus GitHub-Releases und meldet sich, sobald es eine neue Version gibt. So bleibt die App ohne Play Store aktuell.

1. Obtainium installieren (z. B. über [GitHub](https://github.com/ImranR98/Obtainium/releases) oder F-Droid).
2. Auf dem Handy den Button „Mit Obtainium holen“ oben antippen, oder in Obtainium **App hinzufügen** wählen und `https://github.com/theStxve/sprintende-sprinter` eintragen.
3. Installieren. Updates erscheinen ab jetzt in Obtainium.

**Oder direkt:** die APK aus dem [neuesten Release](https://github.com/theStxve/sprintende-sprinter/releases/latest) laden und öffnen. Android fragt einmal, ob der Browser Apps installieren darf.

Was sich in welcher Version geändert hat, steht im [CHANGELOG](CHANGELOG.md).

## Screenshots

<table>
  <tr>
    <td align="center" width="25%"><img src="docs/screenshots/wege.png" alt="Gespeicherte Wege mit nächsten Abfahrten"><br><sub><b>Wege</b><br>Nächste Abfahrt, spätestens-los-Zeit</sub></td>
    <td align="center" width="25%"><img src="docs/screenshots/lauf.png" alt="Laufender Pacer mit Abstand in Sekunden"><br><sub><b>Lauf</b><br>Abstand zum Pacer, live</sub></td>
    <td align="center" width="25%"><img src="docs/screenshots/go-ziel.png" alt="Go-Modus: häufige Ziele"><br><sub><b>Go-Modus</b><br>Häufige Ziele mit einem Tipp</sub></td>
    <td align="center" width="25%"><img src="docs/screenshots/go-los.png" alt="Go-Modus: Ankunft setzen und los"><br><sub><b>Go-Modus</b><br>Ankunft setzen, Los</sub></td>
  </tr>
</table>

## Funktionen

| | |
| --- | --- |
| **Pacer** | Läuft deine Strecke im genau nötigen Tempo. Abstand in Sekunden und Metern, Soll-Pace, eigenes Tempo, Restdistanz, Restzeit. Zielerkennung mit Ergebnis. |
| **Wege** | Gespeicherte Ziele mit Uhrzeiten, z. B. „Zum Bahnhof, 13:04 am Gleis“. Ein Tipp startet den Pacer von deinem Standort. Die nächste Zeit wird vorgeschlagen, mit Puffer und Hinweis „spätestens um … los“. |
| **Go-Modus** | Für echte Eile. Statt aller Reiter eine einzige Ansicht: oft genutztes Ziel antippen, bei Bedarf auf der Karte verschieben, bis zu drei Zwischenstopps setzen, Ankunft per ±1/±5 min wählen, **Los**. In den Optionen einschaltbar. |
| **Straßen sperren** | Auf eine Straße tippen, die du nicht nehmen willst. Die Wegführung macht einen Bogen darum, auch um die Gehwege daneben. Gilt für alle Strecken, Wege und den Go-Modus. Fällt der Sperr-Dienst aus, nutzt die App gespeicherte Strecken oder eine Ausweichroute. |
| **Zug-Verknüpfung** | Haltestelle, Linie und Richtung verknüpfen. Live-Verspätung, Gleis und Ausfälle fließen direkt in die Zielzeit ein. |
| **Erinnerungen** | An gewählten Wochentagen „In 5 min los …“ mit Los-Knopf. Ein Hintergrund-Check (ca. alle 15 min) meldet Verspätung, Ausfall und Gleiswechsel, auch bei geschlossener App. |
| **Strecken** | Punkte auf der Karte setzen oder Orte suchen. Wegführung für Fuß, Rad oder Auto, alternativ Luftlinie. Umkehren, als Rundkurs schließen, speichern. |
| **Zeit** | Ziel als Uhrzeit (Ankunft zu Beginn der Minute) oder als Laufzeit. Start beim Tippen oder zu einer festen Uhrzeit. |
| **Ansagen und Vibration** | In festen Abständen und bei Wechsel (zurückgefallen, wieder vorne, Strecke verlassen). GPS und Ansagen laufen über einen Vordergrund-Dienst auch bei ausgeschaltetem Bildschirm weiter. |
| **Vorschau** | Den Pacer-Ablauf im Zeitraffer ansehen, bevor es losgeht. |
| **Updates** | Nach einem Update zeigt die App, was neu ist. Unter *Optionen → App* wählbar: Updates mit Download direkt in der App, nur ein Hinweis (wenn Obtainium installiert) oder gar keine Hinweise. |

Alle Einstellungen, Strecken und ein laufender Lauf bleiben nach einem Neustart erhalten. Es gibt kein Konto und keinen eigenen Server; alle Daten bleiben auf dem Gerät.

## Datenschutz

Sprintende Sprinter hat **kein Konto, keinen eigenen Server, keine Werbung und kein Tracking**. Wege, Strecken, Sperren, Einstellungen, der Verlauf des Go-Modus und die zuletzt berechneten Strecken liegen nur auf deinem Gerät und verschwinden beim Deinstallieren.

Für Karte, Routen, Suche und Fahrplan fragt die App direkt bei freien Diensten an. Jeder Dienst sieht dabei deine IP-Adresse und nur das, was er für seine Aufgabe braucht:

| Dienst | Bekommt | Wann |
| --- | --- | --- |
| [OpenFreeMap](https://openfreemap.org) | den angezeigten Kartenausschnitt | beim Anzeigen der Karte |
| [FOSSGIS-OSRM](https://routing.openstreetmap.de) | die Koordinaten deiner Streckenpunkte, beim Start eines Wegs auch deinen Standort | beim Berechnen einer Strecke |
| [FOSSGIS-Valhalla](https://valhalla1.openstreetmap.de) | wie OSRM, dazu die Lage deiner gesperrten Straßen in der Nähe | statt OSRM, wenn Sperren in der Nähe der Strecke liegen, und beim Sperren einer Straße |
| [Photon](https://photon.komoot.io) | deinen Suchbegriff und deinen Standort auf ca. 10 m gerundet (für Treffer in der Nähe); beim Benennen eines Punkts dessen Koordinaten | bei Ortssuche und beim Setzen von Punkten |
| [Transitous](https://transitous.org) | Haltestellen-ID bzw. Suchbegriff und deinen auf ca. 10 m gerundeten Standort | bei verknüpften Zügen, auch im Hintergrund-Check |
| [GitHub](https://github.com) | nur die Anfrage nach der neuesten Version | beim Start höchstens alle 6 Stunden, außer die Update-Quelle steht unter *Optionen → App* auf „Aus“ |

Dein **GPS-Verlauf wird nicht gespeichert und nicht gesendet.** Die Position wird nur während eines Laufs zum Vergleich mit dem Pacer genutzt.

Berechtigungen und wofür sie da sind:

- **Standort**: Abstand zum Pacer. Während eines Laufs über einen Vordergrund-Dienst mit sichtbarer Benachrichtigung, damit es auch bei ausgeschaltetem Bildschirm weiterläuft. Ohne laufenden Lauf wird kein GPS im Hintergrund genutzt.
- **Benachrichtigungen, Vordergrund-Dienst**: laufender Lauf in der Statusleiste und Erinnerungen.
- **Exakte Alarme, Start nach dem Hochfahren**: Erinnerungen pünktlich und auch nach einem Neustart.
- **Vibration, Bildschirm anlassen**: Rückmeldung während des Laufs.
- **Internet**: die Dienste oben.

## So funktioniert der Pacer

```
Strecke (z. B. 1,4 km)  +  Ankunftszeit (z. B. 19:38)
              │
              ▼
  Soll-Tempo = Strecke / verbleibende Zeit
              │
              ▼
  Pacer-Position zu jedem Zeitpunkt  ◄──►  deine GPS-Position auf der Strecke
              │
              ▼
  Abstand in Sekunden  →  Anzeige, Ansage, Vibration
```

Deine Position wird auf die Strecke projiziert (mit Toleranz für ungenaues GPS). Der Abstand entlang der Strecke geteilt durch das Soll-Tempo ergibt den Vorsprung oder Rückstand in Sekunden.

## Dienste

Alles kostenlos und ohne API-Key:

| Zweck | Dienst |
| --- | --- |
| Karte | [OpenFreeMap](https://openfreemap.org) (Vektorkarten über MapLibre GL) |
| Wegführung | [FOSSGIS-OSRM](https://routing.openstreetmap.de) |
| Wegführung mit gesperrten Straßen | [FOSSGIS-Valhalla](https://valhalla1.openstreetmap.de) |
| Ortssuche | [Photon](https://photon.komoot.io) von komoot |
| Fahrplan und Echtzeit | [Transitous](https://transitous.org) |

Kartendaten © [OpenStreetMap-Mitwirkende](https://www.openstreetmap.org/copyright).

## Entwicklung

Voraussetzungen: Node.js 22.18 oder neuer, für die App zusätzlich Android Studio bzw. das Android SDK mit JDK 21.

```bash
npm install
npm run dev        # Browser-Version auf http://localhost:5173
npm test           # Tests für Geometrie, Pacer und Go-Modus (testen den echten Code)
npm run lint
npm run build
```

### Android-App bauen

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

### Projektstruktur

```
src/
├── App.tsx              Zustand, Ablauf, Bedienfeld
├── components/          Karte, Panels (Lauf, Zeit, Strecke, Optionen, Go), Editoren
├── hooks/               GPS-Tracking, Uhr/Simulation, Ansagen
├── services/            Geometrie, Pacer, Routing, Fahrplan, Erinnerungen, Go-Vorschläge
└── types/               Gemeinsame Typen
public/runners/          Hintergrund-Check für Zugverspätungen
android/                 Capacitor-Android-Projekt
test/                    Node-Tests (node:test, ohne Build-Schritt)
```

## Tech-Stack

[React 19](https://react.dev) · [TypeScript](https://www.typescriptlang.org) · [Vite](https://vite.dev) · [Tailwind CSS](https://tailwindcss.com) · [MapLibre GL](https://maplibre.org) · [Capacitor 8](https://capacitorjs.com) mit Background-Geolocation, Local Notifications, Background Runner, Text-to-Speech und Haptics · [oxlint](https://oxc.rs)

## Credits

- **Codegrundlage:** [kyropytis](https://github.com/kyropytis) hat die erste Fassung von Sprintende Sprinter geschrieben: den virtuellen Pacer auf einer selbst gesetzten Strecke, die Android-App und die GPS-Anbindung.
- **Weiterentwicklung:** [theStxve](https://github.com/theStxve)
- **Karten, Routen, Suche und Fahrplan:** die freien Dienste unter [Dienste](#dienste), Kartendaten © [OpenStreetMap-Mitwirkende](https://www.openstreetmap.org/copyright)

## Lizenz

**Alle Rechte vorbehalten.** Der Quelltext ist öffentlich einsehbar, aber nicht frei. Du darfst die App privat nutzen und den Code lesen, aber:

- **keine Weitergabe**: weder die App noch die APK noch der Quelltext, auch nicht kostenlos, auch nicht verändert
- **keine kommerzielle Nutzung**: kein Verkauf, keine Werbung, keine Einbindung in bezahlte Produkte oder Dienste

Teilen ist ausdrücklich über einen Link auf diese Seite erlaubt. Die genauen Bedingungen stehen in der [LICENSE](LICENSE).

Bis einschließlich Version 1.3.1 stand der Quelltext unter der MIT-Lizenz. Seit dem 10. November 2026 gilt die neue Lizenz für das ganze Repository und alle hier angebotenen Versionen, auch die früheren. Wer vorher eine Kopie unter MIT erhalten hat, behält für genau diese Kopie die MIT-Rechte.

---

<p align="center"><sub>© 2026 <a href="https://github.com/theStxve">theStxve</a>. Alle Rechte vorbehalten. Codegrundlage von <a href="https://github.com/kyropytis">kyropytis</a>. Kartendaten © OpenStreetMap-Mitwirkende.</sub></p>
