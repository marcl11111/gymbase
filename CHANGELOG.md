# Changelog

## [1.0.1] – 2026-10-21

### Hinzugefügt
- Online-Version über GitHub Pages: <https://marcl11111.github.io/gymbase/>
- Workflow `deploy.yml` (Build und Veröffentlichung bei jedem Push auf `main`)
- `GitHub hochladen.bat` + `tools/github-hochladen.ps1`: Commit, Push, Repository-Metadaten, GitHub Pages und Profil-README in einem Schritt
- Dokumentation `docs/VEROEFFENTLICHEN.md`; Anleitung, Architektur, Entwicklung und README um Online-Version ergänzt

## [1.0.0] – 2026-10-21

Erste Version.

### Hinzugefügt
- Übungsdatenbank mit 79 Übungen (12 Muskelgruppen, 8 Geräteklassen, 3 Schwierigkeitsgrade, 4 Übungstypen), Suche und kombinierbare Filter, Muskelübersicht
- Aufklappbare Fotoanleitung (standardmäßig geschlossen, Lazy Loading, Großansicht)
- Übungsdetailseiten mit Technik-, Fehler- und Sicherheitshinweisen, Empfehlungen, letzter Leistung und Alternativen-Finder
- Favoriten, eigene Sammlungen, eigene Übungen mit eigenen Fotos (IndexedDB)
- Manueller Plan-Editor mit Drag-and-drop, Auf/Ab-Sortierung, Ersetzen, Duplizieren
- Deterministischer Trainingsplan-Generator (8 Schritte, automatischer oder manueller Split, einzelne Tage neu generieren)
- Trainingsmodus mit Satzerfassung, Pausentimer, Pausieren, Wiederherstellung nach Reload und Rekorderkennung
- Fortschrittsseite mit Diagrammen, Bestleistungen (inkl. geschätztem 1RM) und Historie
- Einstellungen: Dunkel/Hell, Akzentfarbe, kg/lb, Standardwerte, bevorzugtes Equipment, JSON-Export/-Import, Zurücksetzen
- Scroll-Animationen (Zoom, Fade, Parallax, fixierte Sektionen, wortweise Überschriften), animiertes Logo, Intro
- Versionierte, validierte lokale Speicherung mit Sicherung beschädigter Daten
- 38 Unit-Tests, Browser-Smoke-Test, GitHub-Actions-CI
- `GymBase starten.bat` für den Start per Doppelklick
- Dokumentation unter `docs/`
