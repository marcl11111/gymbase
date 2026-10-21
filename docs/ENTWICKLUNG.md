# Entwicklung

[← Zurück zur README](../README.md)

## Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver mit Live-Reload (http://localhost:5173) |
| `npm run build` | TypeScript-Prüfung + Produktions-Build nach `dist/` |
| `npm run preview` | Build ausliefern (http://localhost:4173) |
| `npm test` | Unit-Tests (Vitest, jsdom) |
| `npm run lint` | ESLint |
| `npm run typecheck` | Nur TypeScript prüfen |

## Tests

| Datei | Prüft |
|---|---|
| `tests/data.test.ts` | ≥ 60 Übungen, eindeutige IDs, alle Muskelgruppen und Geräte abgedeckt, 2–4 Anleitungsschritte mit Texten, alle Bilddateien vorhanden, Platzhalter gekennzeichnet, Suche, kombinierte Filter, Alternativen |
| `tests/generator.test.ts` | Alle geforderten Generator-Fälle (siehe [GENERATOR.md](GENERATOR.md)) |
| `tests/storage-stats.test.ts` | Speichern/Laden, beschädigte Daten, Validierung, aktive Einheit nach Reload, Import-Prüfung, Zusammenführen, Volumen, Bestleistungen, 1RM, Rekorderkennung, Wochen, letzte Leistung |

Stand 2026-10-21: 38 Tests, alle erfolgreich.

### Browser-Smoke-Test (optional)

`e2e/smoke.mjs` klickt die Hauptabläufe durch (Suche, Filter, Fotoanleitung, Favorit, Generator, Editor, Training inkl. Reload, Fortschritt, Einstellungen, Export, Mobil, reduzierte Bewegung) und speichert Screenshots unter `e2e/screenshots/`.

```bash
npm i -D playwright
npx playwright install chromium
npm run build && npm run preview     # Fenster 1
node e2e/smoke.mjs                   # Fenster 2
```

## Continuous Integration

`.github/workflows/ci.yml` führt bei jedem Push und Pull Request `npm ci`, `npm run lint`, `npm test` und `npm run build` aus.

## Eigene Übung fest in die Datenbank aufnehmen

1. Fotos ablegen: `public/exercises/<Id>/0.jpg` und `1.jpg`.
2. In `src/data/exercises.ts` einen Eintrag im Array `DEFS` ergänzen:
   ```ts
   {
     id: 'Meine_Uebung', name: 'Meine Übung', p: 'brust', sec: ['trizeps'],
     eq: 'maschine', d: 'anfaenger', t: 'grunduebung', pat: 'horizontal_push',
     s: 0,                 // welches Foto zeigt die Ausgangsposition (0 oder 1)
     desc: '…', ins: ['…', '…', '…'], tips: ['…'], err: ['…'], safe: ['…'],
     steps: [['Ausgangsposition', '…', 'A'], ['Bewegung', '…', 'B'], ['Rückführung', '…', 'A']],
     // 'A' = Startfoto, 'B' = anderes Foto, 'N' = kein Foto (Platzhalter)
   },
   ```
3. `npm test` prüft automatisch, ob die Bilder existieren und alle Texte gesetzt sind.

Für einzelne Übungen ohne Code-Änderung: *Meine Sammlung → Eigene Übung* in der App.

## Konventionen

- Oberfläche und Texte auf Deutsch; Code-Bezeichner auf Englisch.
- Logik ohne React in `src/services` (testbar), UI in `src/components` / `src/pages`.
- Animationen nur über `useGsap` bzw. die Komponenten in `src/animations` – nie ScrollTrigger direkt in `useEffect` ohne Aufräumen.
- Nur `transform`/`opacity` animieren; `prefersReducedMotion()` beachten.
- Farben als CSS-Variablen in `src/styles/index.css` (`--accent`, `--bg`, …), in Tailwind als `bg-accent`, `text-muted` usw.
- Interaktive Elemente sind echte `<button>`/`<a>`/`<input>` mit Beschriftung; Touch-Ziele mindestens 44 px.

## Bekannte Einschränkungen

- Pro Übung zwei Fotos (850 px); Schritt 3 zeigt wieder die Ausgangsposition. Bei „Umsetzen und Drücken“ und „Thruster“ fehlt das Überkopf-Foto (Platzhalter).
- Der Pausentimer läuft nach einem Neuladen nicht weiter (die Einheit selbst bleibt).
- Kein Abgleich zwischen Geräten (kein Backend).
- Drag-and-drop wurde nicht automatisiert mit echter Maus/Touch getestet; Auf/Ab-Buttons sind die Alternative.

## Ideen

- Hochauflösende 3–4-Schritt-Fotoserien
- PWA (installierbar, offline)
- Steigerungsvorschläge aus der letzten Leistung
- Backend mit Login und Synchronisation
