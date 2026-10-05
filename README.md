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
- **Zug-Zähler:** Während der Runde „Nächster Zug“ und „Ghalta gecastet!“ tippen. Ghalta-Zug,
  Spieldauer und Commander-Steuer landen automatisch in den Notizen.
- **Training:** Kurze Lektionen im Duolingo-Stil (Antwort wählen → Prüfen → Erklärung, Fehler kommen
  am Ende noch einmal):
  - *Ghalta-Mathe*, *Kampf & Trample*, *Commander-Regeln*
  - *Mulligan-Trainer:* echte Starthände aus deinem Deck, bewertet nach der Faustregel aus dem Lernplan
  - *Wann kommt Ghalta?:* simulierte Züge mit deinem Deck
  - *Karten kennen:* Teile einer Karte sind versteckt (Name, Kosten, Stärke, Textstelle). Rate sie
    oder baue die Karte aus Kacheln; dazu die Rolle der Karte im Gameplan (Ramp, dicke Kreatur,
    Kartenvorteil, Interaktion, Schutz, Finisher).
- **Goldfish-Labor:** 1.000 simulierte Spiele zeigen, in welchem Zug Ghalta mit deinem Deck kommt.
  Nach einer Swap-Runde nochmal laufen lassen: Ist das Deck schneller geworden?
- **Deck & Swap-Runden:** Deckliste mit Kartenbildern, Swap-Runden („raus“ / „rein“) mit
  Protokoll und Rückgängig, Siegquote je Deckversion.
- **Statistik:** Siegquote, Skills, wiederkehrende Fehler („Muster“ ab 3×), tote Karten als
  Upgrade-Kandidaten und der Upgrade-Fahrplan (erste Swap-Runde nach 8 Spielen, danach alle 5).

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

### Kartendaten (Scryfall)

Kartenbilder und -texte kommen von der [Scryfall-API](https://scryfall.com/docs/api). Die App fragt
nur die Karten deines Decks ab (zwei Anfragen an `/cards/collection`), speichert sie auf dem Handy und
funktioniert danach offline. Die Bulk-Daten von Scryfall (über 100 MB) wären fürs Handy zu groß.

Damit die **richtigen Bilder** erscheinen, lädt die App die Druckversion aus dem Precon (Set
`FDC`, Foundations Commander). Gibt es eine Karte in diesem Set nicht, zeigt sie eine andere
Version und weist auf der Deck-Seite darauf hin. Am genauesten wird es, wenn du deine Liste aus
Moxfield mit Set und Sammlernummer einfügst (z. B. `1 Llanowar Elves (FDC) 227`).

Die Standard-Deckliste von Tramplesaurus Rex stammt aus veröffentlichten Decklisten. Gleiche sie
unter **Mehr → Deckliste & Swaps** mit deinem Deck ab.

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

App-Icon ändern: `public/logo.png` (quadratisch, mind. 512 px) ersetzen und `npm run generate-icons` ausführen.

### Aufbau

```
src/
  lib/          Logik ohne UI: Datentypen, Speicherung, Statistik, Ghalta-Mathe, Lernplan-Inhalte,
                Deckliste, Scryfall-Anbindung
  lib/sim/      Goldfish-Simulation (Autopilot) und Mulligan-Faustregel
  lib/quiz/     Quiz-Lektionen und Karten-Quiz (Rollen, Lücken, Kacheln)
  components/   Wiederverwendbare Bausteine (Formular, Ghalta-Rechner, Kartenbild, Kartenrahmen …)
  pages/        Die Bildschirme: Start, Runde, Training, Lektion, Verlauf, Statistik, Deck, Mehr
.github/workflows/
  ci.yml        Prüft PRs und master
  release.yml   Version erhöhen + Release + Ausrollen (manuell starten)
  deploy.yml    Bestimmte Version ausrollen (auch für Rollbacks)
```

Stack: React + TypeScript + Vite, `vite-plugin-pwa` für Offline-Betrieb und Updates,
Phosphor-Icons und die Schrift Nunito (beides lokal eingebunden, funktioniert offline).

### Design

Angelehnt an Lern-Apps wie Duolingo:

- **Eine Sache pro Bildschirm:** Nach dem Spiel kommt jede Frage einzeln, mit Fortschrittsbalken.
  Einfachauswahlen springen automatisch weiter, alles außer dem Ergebnis lässt sich überspringen.
- **Lernpfad statt Liste:** Die Fokus-Rotation ist ein Pfad aus Knoten; der nächste Skill pulsiert.
- **Daumenzone:** Die Hauptaktion steht immer unten; Zusatzinfos öffnen sich als Bottom Sheet.
- **Taktile Elemente:** Buttons und Karten haben eine 3D-„Lippe“ und sinken beim Tippen ein,
  auf Android mit kurzer Vibration.
- **Belohnung:** Wochen-Serie (🔥), Feier-Bildschirm mit Konfetti nach jeder Runde.
- **Farben:** Jeder Skill hat eine feste Farbe plus Icon. Die Palette ist auf Farbfehlsichtigkeit
  geprüft (hell und dunkel); Farben stehen nie allein, immer mit Icon und Text.

### Später denkbar

- **Sync zwischen Geräten** (z. B. mit Cloudflare Workers + D1 im Free Tier). Dafür bräuchte es ein Login.
- **Echte Store-App:** Derselbe Code lässt sich mit Capacitor als Android-/iOS-App verpacken. Für den
  iOS App Store ist ein Apple-Developer-Konto nötig (99 $/Jahr).
