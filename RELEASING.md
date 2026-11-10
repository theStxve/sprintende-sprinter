# Release erstellen

Ein Git-Tag wie `v1.2.0` startet den Workflow [`release.yml`](.github/workflows/release.yml). Er baut eine signierte APK und veröffentlicht sie als GitHub-Release. Obtainium findet das Release und bietet das Update an.

## Einmalig: Secrets anlegen

Unter **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Inhalt |
| --- | --- |
| `KEYSTORE_BASE64` | Inhalt von `release.jks.base64` (der Keystore als Base64) |
| `KEYSTORE_PASSWORD` | `storePassword` aus `keystore.properties` |
| `KEY_ALIAS` | `sprintende` |
| `KEY_PASSWORD` | `keyPassword` aus `keystore.properties` |

Keystore und Passwörter liegen **nicht** im Repo. Sie gehören an einen sicheren Ort, z. B. einen Passwort-Manager. Geht der Schlüssel verloren, kann niemand mehr Updates für die installierte App ausliefern; Nutzer müssten neu installieren.

## Jedes Release

1. Version in `package.json` erhöhen (`1.2.0`). Daraus entstehen `versionName` und `versionCode` der App.
2. In `CHANGELOG.md` einen Abschnitt `## [1.2.0] - JJJJ-MM-TT` anlegen. Er wird zum Release-Text.
3. Committen, taggen, pushen:

   ```bash
   git commit -am "Version 1.2.0"
   git tag v1.2.0
   git push origin main --tags
   ```

Der Workflow bricht ab, wenn Tag und `package.json` nicht zusammenpassen.

## Lokal signiert bauen

`android/keystore.properties` (in `.gitignore`) mit `storeFile`, `storePassword`, `keyAlias` und `keyPassword` anlegen, dann:

```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleRelease
```
