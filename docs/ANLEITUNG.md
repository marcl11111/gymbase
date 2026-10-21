# Anleitung

[← Zurück zur README](../README.md)

## 1. Installation

1. **Node.js** installieren (Version 18 oder neuer, empfohlen LTS): <https://nodejs.org>
   Prüfen in der Eingabeaufforderung: `node -v`
2. Projektordner ablegen, z. B. `C:\Users\marce\Desktop\gymbase`.
3. Abhängigkeiten installieren (nur beim ersten Mal – macht die Batch-Datei automatisch):
   ```bash
   npm install
   ```

## 2. Starten

### Variante A – `GymBase starten.bat` (Windows)

Doppelklick. Die Datei
1. prüft, ob Node.js vorhanden ist,
2. führt bei Bedarf `npm install` aus,
3. erstellt den Build, falls der Ordner `dist` fehlt,
4. öffnet nach ca. 3 Sekunden den Browser auf **http://localhost:4173** und startet die Vorschau.

Beenden: Konsolenfenster schließen oder `Strg + C`.

**Nach Code-Änderungen neu bauen:** Ordner `dist` löschen und die Batch-Datei starten – oder in der Eingabeaufforderung im Projektordner:
```bat
"GymBase starten.bat" build
```

### Variante B – manuell

| Befehl | Zweck | Adresse |
|---|---|---|
| `npm run build` | Produktions-Build nach `dist/` | – |
| `npm run preview` | Build lokal ausliefern | http://localhost:4173 |
| `npm run dev` | Entwicklungsserver mit Live-Reload | http://localhost:5173 |

`dist/index.html` per Doppelklick zu öffnen funktioniert nicht – Browser blockieren JavaScript-Module über `file://`. Es wird immer ein Server benötigt.

## 3. Bedienung

### Dashboard
Zeigt den nächsten Trainingstag des **aktiven Plans** (Stern-Symbol in der Planliste), die Trainingstage der Woche (gefüllt = trainiert, gestrichelt = laut Plan geplant), das Wochenvolumen der letzten 8 Wochen, die letzten Einheiten, Bestleistungen und Favoriten. Ohne Daten erscheinen Leerzustände mit passender Aktion.

### Übungen
- **Suche** reagiert während der Eingabe auf Name, Muskelgruppen, Equipment und Bewegungsmuster (Umlaute egal: „gesass“ findet „Gesäß“).
- **Filter**: innerhalb einer Kategorie ODER, zwischen Kategorien UND. „Alle Filter zurücksetzen“ leert alles.
- **Muskelübersicht** oben: eine Kachel antippen filtert auf diese Muskelgruppe.
- Auf jeder Karte: **Details**, **Herz** (Favorit), **+** (zu Sammlung oder Trainingsplan) und **Fotoanleitung anzeigen**.

### Fotoanleitung
Standardmäßig geschlossen. „Fotoanleitung anzeigen“ klappt die nummerierten Schritte auf (Bild, Titel, Beschreibung). Bild anklicken → Großansicht, mit Pfeiltasten blättern, `Esc` schließt. Mehrere Anleitungen lassen sich unabhängig öffnen.

### Übungsdetails
Beschreibung, Ausführung, Technikhinweise, häufige Fehler, Sicherheitshinweise, Steckbrief, empfohlene Sätze/Wiederholungen/Pausen und die letzte dokumentierte Leistung. Unten der **Alternativen-Finder** („Gerät belegt?“) mit „Übernehmen“ direkt in einen Plan.

### Meine Sammlung
- **Sammlungen**: anlegen, umbenennen, löschen; Übungen über das **+** auf einer Karte hinzufügen. Innerhalb einer Sammlung nach Muskelgruppe und Gerät filtern.
- **Eigene Übungen**: „Eigene Übung“ öffnet ein Formular mit allen Feldern, Hauptbild und beliebig vielen Fotoanleitungs-Schritten mit eigenen Bildern. Bilder werden verkleinert (max. 1200 px) und lokal gespeichert.
- Eine Übung in einer Sammlung ist **nicht** automatisch Teil eines Plans.

### Trainingspläne – manuell
1. *Trainingspläne → Selbst erstellen*.
2. Name, Ziel, Beschreibung, Notizen festlegen.
3. Trainingstage mit **+ Tag** anlegen, benennen, Wochentag zuweisen, mit den Pfeilen sortieren.
4. Rechts (mobil: Reiter „Übungen hinzufügen“) Übungen aus **Datenbank**, **Favoriten** oder einer **Sammlung** suchen und hinzufügen. Doppelte Übungen im selben Tag werden nachgefragt.
5. Übungen per Ziehgriff (⠿) oder Pfeilen sortieren; **Ersetzen** schlägt ähnliche Übungen vor.
6. **Speichern** (unten). Ungespeicherte Änderungen werden angezeigt; beim Verlassen kommt eine Rückfrage.

### Trainingspläne – Generator
1. *Trainingspläne → Plan generieren*.
2. Ziel → Erfahrung → Häufigkeit **und** konkrete Wochentage (Anzahl muss passen) → Muskelgruppen → Aufteilung (automatisch oder manuell) → Dauer (optional) → Ausrüstung.
3. Ergebnis prüfen: Split, Erklärung, Ruhetage, geschätzte Dauer pro Tag, Hinweise.
4. Alles ist bearbeitbar; **Tag neu generieren** ändert nur den gewählten Tag.
5. **Plan übernehmen** speichert und setzt ihn als aktiven Plan.

Details zur Logik: [GENERATOR.md](GENERATOR.md)

### Trainingsmodus
1. *Trainingsmodus* → Plan wählen → **Starten** beim gewünschten Tag (oder „Freies Training“).
2. Pro Satz Gewicht und Wiederholungen eintragen und **✓** antippen. Ist das Wiederholungsfeld leer, wird beim Abhaken der Zielwert übernommen.
3. Nach jedem abgehakten Satz startet der **Pausentimer** (Pause/Fortsetzen, Reset, +15 s, Schließen; Ton + Vibration am Ende).
4. Oben: Gesamtzeit, Fortschrittsbalken, Pause-Taste. Übungen über die Chips oder Zurück/Weiter wechseln; **+** fügt spontan eine Übung hinzu; **+/− Satz** ändert die Satzanzahl.
5. **Beenden** speichert die Einheit in der Historie und zeigt eine Zusammenfassung inkl. neuer Bestleistungen. **✕** verwirft die Einheit.

Der laufende Stand wird bei jeder Eingabe gespeichert – ein versehentliches Neuladen verliert nichts.

### Fortschritt
Übung und Zeitraum wählen. Diagramme: Gewichtsentwicklung (schwerster Satz je Einheit, gestrichelt das **geschätzte** 1RM nach Epley), Volumen und Einheiten pro Woche, höchstes Gewicht je Übung. Jedes Diagramm hat „Als Tabelle anzeigen“. Darunter Bestleistungen und die aufklappbare Historie (Einheiten löschbar).

### Einstellungen
Designmodus, Akzentfarbe, Animationen reduzieren, Name für die Begrüßung, kg/lb, Standardpause, Standard-Sätze/-Wiederholungen, bevorzugtes Equipment (Vorauswahl im Generator), Export, Import, Zurücksetzen.

## 4. Daten sichern und umziehen

- **Export**: *Einstellungen → Daten exportieren* erzeugt `gymbase-export-JJJJ-MM-TT.json` mit eigenen Übungen (inkl. Bilder), Sammlungen, Favoriten, Plänen, Einheiten und Einstellungen.
- **Import**: *Daten importieren* prüft die Datei zuerst und zeigt den Inhalt. Dann **Zusammenführen** (Bestehendes bleibt, Neues kommt dazu) oder **Alles ersetzen**.
- Daten gelten **pro Browser und pro Adresse** (Host + Port). Beim Wechsel von Browser, Rechner oder Port: exportieren → importieren.
- **Zurücksetzen** löscht alle persönlichen Daten erst nach Eingabe von `LÖSCHEN`. Die Übungsdatenbank bleibt.

## 5. Problemlösung

| Problem | Lösung |
|---|---|
| „Node.js wurde nicht gefunden“ | Node.js installieren, Fenster neu öffnen |
| `Port 4173 is in use` | Läuft GymBase schon in einem anderen Fenster? Dieses schließen oder Port in der Batch-Datei ändern (Achtung: andere Daten pro Port) |
| Änderungen am Code nicht sichtbar | `dist` löschen bzw. `"GymBase starten.bat" build` |
| Daten „weg“ | Gleiche Adresse und gleichen Browser verwenden; ggf. Export/Import |
| Animationen stören | *Einstellungen → Animationen reduzieren* oder Windows-Einstellung „Animationseffekte“ aus |
| Schriftart sieht anders aus | Ohne Internet wird statt „Archivo/Inter“ eine Systemschrift genutzt – reine Optik |
