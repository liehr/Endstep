# Endstep

**Commander-Runden tracken und mit jedem Spiel besser werden.**

Endstep ist eine kleine App fürs Handy, gebaut nach dem Lernplan „Commander von der Pike auf“
(Tramplesaurus Rex / Ghalta):

- **Vor dem Spiel:** Der nächste Fokus-Skill aus der Rotation (Mulligan → Sequencing → Threat
  Assessment → Kampfmathe → Board-Wipe-Disziplin → Removal-Timing → Politik), dazu dein Satz für den Tisch.
- **Während des Spiels:** Ghalta-Rechner (Stärke + Commander-Steuer → Kosten), die Wrath-Frage,
  „Wen angreifen?“ und ein Regel-Spickzettel.
- **Nach dem Spiel (2 Minuten):** Die drei Fragen: Warum hat der Gewinner gewonnen? Welche eine
  Entscheidung würdest du anders treffen? Welche Karten waren tot oder haben überperformt?
- **Statistik:** Siegquote, Skills, wiederkehrende Fehler („Muster“ ab 3×), tote Karten als
  Upgrade-Kandidaten und der Upgrade-Fahrplan (erste Swap-Runde nach 8 Spielen).

## Technik in einem Satz

Endstep ist eine **Progressive Web App (PWA)**: eine Web-App, die man aufs Handy installiert. Sie hat
ein eigenes Icon auf dem Startbildschirm, läuft im Vollbild ohne Browserleiste und funktioniert offline.
Gehostet wird sie kostenlos auf **GitHub Pages**. Ein App Store ist nicht nötig.

## App aufs Handy holen

Adresse: **https://liehr.github.io/Endstep/**

**iPhone (Safari):** Adresse öffnen → **Teilen** (Quadrat mit Pfeil) → **„Zum Home-Bildschirm“** →
„Als Web-App öffnen“ an lassen (falls angezeigt) → **Hinzufügen**.

**Android (Chrome):** Adresse öffnen → **„App installieren“** antippen (Banner in der App oder
Menü ⋮) → bestätigen.

Danach Endstep immer über das Icon starten. Neue Versionen lädt die App selbst und fragt
**„Neue Version verfügbar – Aktualisieren?“**.

### Deine Daten

Alle Runden bleiben **nur auf deinem Handy**. Es gibt keinen Server und kein Konto. Unter
**Mehr → Backup sichern** kannst du ab und zu eine Sicherungsdatei anlegen (z. B. in iCloud Drive
oder Google Drive). Damit nimmst du deine Daten auch auf ein neues Handy mit (**Backup einspielen**).

## Einmalige Einrichtung auf GitHub

1. Repository → **Settings → Pages** → bei **Source** „**GitHub Actions**“ auswählen.
2. Fertig. Ab jetzt läuft alles über GitHub Actions.

## Neue Version ausrollen

1. Änderungen landen per Pull Request auf `master`. Der **CI**-Workflow prüft jeden PR automatisch.
2. Repository → **Actions → Release → Run workflow** → Art der Änderung wählen:
   - `patch`: kleine Korrektur (0.1.0 → 0.1.1)
   - `minor`: neue Funktion (0.1.0 → 0.2.0)
   - `major`: große Umstellung (0.1.0 → 1.0.0)
3. Der Workflow prüft die App, erhöht die Versionsnummer, legt ein GitHub-Release mit Änderungsliste
   an und rollt die Version aus. Nach 1–2 Minuten ist sie live.

Ein Merge auf `master` allein verändert die App auf dem Handy **nicht**. Live geht nur, was per
Release veröffentlicht wurde.

### Zurück zu einer älteren Version (Rollback)

**Actions → Deploy → Run workflow** → bei „Version“ den alten Tag eintragen (z. B. `v0.1.0`). Alle
Versionen stehen unter **Releases**.

## Entwicklung

Voraussetzung: Node.js 22 (siehe `.nvmrc`).

```bash
npm install
npm run dev        # Entwicklungsserver, auch im WLAN vom Handy aus erreichbar
npm test           # Unit-Tests (Vitest)
npm run typecheck  # TypeScript prüfen
npm run lint       # oxlint
npm run build      # Produktions-Build nach dist/
```

App-Icons ändern: `public/logo.svg` bearbeiten und `npm run generate-icons` ausführen.

### Aufbau

```
src/
  lib/          Logik ohne UI: Datentypen, Speicherung, Statistik, Ghalta-Mathe, Lernplan-Inhalte
  components/   Wiederverwendbare Bausteine (Formular, Ghalta-Rechner, Update-Hinweis …)
  pages/        Die Bildschirme: Start, Runde, Verlauf, Statistik, Mehr
.github/workflows/
  ci.yml        Prüft PRs und master
  release.yml   Version erhöhen + Release + Ausrollen (manuell starten)
  deploy.yml    Bestimmte Version ausrollen (auch für Rollbacks)
```

Stack: React + TypeScript + Vite, `vite-plugin-pwa` für Offline-Betrieb und Updates.

### Später denkbar

- **Sync zwischen Geräten** (z. B. mit Cloudflare Workers + D1 im Free Tier). Dafür bräuchte es ein Login.
- **Echte Store-App:** Derselbe Code lässt sich mit Capacitor als Android-/iOS-App verpacken. Für den
  iOS App Store ist ein Apple-Developer-Konto nötig (99 $/Jahr).
