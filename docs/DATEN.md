# Datenmodell & Speicherung

[← Zurück zur README](../README.md)

Alle Typen stehen in [`src/types/index.ts`](../src/types/index.ts).

## Entitäten

| Typ | Zweck | Wichtige Felder |
|---|---|---|
| `Exercise` | Übung (eingebaut oder eigene) | `id`, `name`, `primaryMuscle`, `secondaryMuscles`, `equipment`, `difficulty`, `type`, `pattern` (Bewegungsmuster), `instructions`, `techniqueTips`, `commonMistakes`, `safetyNotes`, `recommended` (Sätze/Wdh./Pause), `repUnit` (wdh/sek/m), `imageUrl`, `photoGuide`, `isCustom` |
| `ExerciseInstructionStep` | Schritt der Fotoanleitung | `stepNumber`, `title`, `description`, `imageUrl` (`null` = Platzhalter), `altText` |
| `ExerciseCollection` | Eigene Sammlung | `id`, `name`, `description`, `exerciseIds`, `createdAt` |
| `WorkoutPlan` | Trainingsplan | `id`, `name`, `description`, `goal`, `days`, `notes`, `createdAt`, `updatedAt`, `generated` (Generator-Eingaben) |
| `PlanDay` | Trainingstag | `id`, `name`, `weekday` (0 = Mo … 6 = So, oder `null`), `muscles`, `exercises` |
| `PlanExercise` | Übung im Plan | `uid`, `exerciseId`, `sets`, `repsMin`, `repsMax`, `restSec`, `targetWeight` (kg), `notes` |
| `WorkoutSession` | Trainingseinheit | `planId`, `planName`, `dayName`, `startedAt`, `endedAt`, `pausedMs`, `exercises` (Snapshot), `status` |
| `SetLog` | Satz | `targetRepsMin/Max`, `targetWeight`, `reps`, `weight` (kg), `done` |
| `UserSettings` | Einstellungen | `unit`, `theme`, `accent`, `defaultRestSec`, `preferredEquipment`, `defaultSets`, `defaultRepsMin/Max`, `userName`, `reducedMotion` |

Muskelgruppen: Brust, Rücken, Schultern, Bizeps, Trizeps, Unterarme, Bauch, Quadrizeps, Beinbeuger, Gesäß, Waden, Ganzkörper.
Equipment: Maschine, Kabelzug, Kurzhanteln, Langhantel, Eigengewicht, Multipresse, Kettlebell, Sonstige.

## Speicherorte

| Was | Wo | Schlüssel |
|---|---|---|
| Alle persönlichen Daten | `localStorage` | `gymbase:data` |
| Sicherung unlesbarer Daten | `localStorage` | `gymbase:backup` |
| Eigene Bilder | IndexedDB | DB `gymbase-images`, Store `images`; Referenz im Modell als `idb:<key>` |
| Intro bereits gesehen | `sessionStorage` | `gymbase:intro` |

Eingebaute Übungen werden **nicht** gespeichert – sie kommen immer aus `src/data/exercises.ts`. Gespeichert werden nur Verweise (IDs).

## Versionierung und Robustheit

- Das gespeicherte Objekt trägt `version` (aktuell `1`). `services/storage.ts` enthält ein Migrationsgerüst (`MIGRATIONS[alteVersion]`), das Daten Schritt für Schritt hochstuft.
- Beim Laden wird **jeder Eintrag einzeln validiert** (`sanitizeAppData`): ungültige Einträge werden übersprungen und gemeldet, gültige bleiben erhalten. Unbekannte Werte fallen auf sichere Standardwerte zurück.
- Ist der gespeicherte Text kein gültiges JSON oder stammt er aus einer neueren Version, wird er nach `gymbase:backup` kopiert statt gelöscht.
- Eine laufende Einheit (`activeSession`) wird bei jeder Eingabe gespeichert und nach einem Neuladen fortgesetzt.

## Export-Format

```json
{
  "app": "GymBase",
  "format": 1,
  "dataVersion": 1,
  "exportedAt": "2026-10-21T18:00:00.000Z",
  "data": { "version": 1, "customExercises": [], "favorites": [], "collections": [], "plans": [], "activePlanId": null, "sessions": [], "activeSession": null, "settings": {} },
  "images": { "idb:img-abc123": "data:image/jpeg;base64,..." }
}
```

Beim Import wird die Datei vollständig validiert, bevor etwas gespeichert wird. Bilder werden nur übernommen, wenn der Schlüssel mit `idb:` beginnt und der Wert ein `data:image/…`-URI ist.

- **Zusammenführen**: Bestehende Einträge bleiben; Einträge mit neuen IDs werden ergänzt; Favoriten werden vereinigt; Einstellungen bleiben unverändert.
- **Ersetzen**: Alles wird durch den Dateiinhalt ersetzt (mit Rückfrage).

## Statistik

Berechnet in `services/stats.ts`, ausschließlich aus Einheiten mit Status `abgeschlossen` und abgehakten Sätzen mit Wiederholungen > 0:

| Kennzahl | Berechnung |
|---|---|
| Volumen | Σ Gewicht × Wiederholungen |
| Bestleistung Gewicht | höchstes Gewicht (bei Gleichstand mehr Wiederholungen) |
| Bestleistung Wiederholungen | meiste Wiederholungen |
| Geschätztes 1RM | Epley: Gewicht × (1 + Wdh./30), nur bis 12 Wdh. – als Schätzung gekennzeichnet |
| Neue Rekorde | Vergleich mit allen früheren Einheiten; die erste Durchführung zählt nicht als Rekord |
| Wochen | Montag 00:00 bis Sonntag (lokale Zeit) |
