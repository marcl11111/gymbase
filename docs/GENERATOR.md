# Trainingsplan-Generator

[← Zurück zur README](../README.md)

Implementierung: [`src/services/generator.ts`](../src/services/generator.ts) · Tests: [`tests/generator.test.ts`](../tests/generator.test.ts)

Der Generator ist **deterministisch**: Er verwendet keinen Zufall. Gleiche Eingaben und gleicher Übungsbestand ergeben immer denselben Plan.

## Eingaben

| Schritt | Eingabe | Wirkung |
|---|---|---|
| 1 | Ziel (Muskelaufbau, Maximalkraft, Allgemeine Fitness, Wiedereinstieg) | Sätze, Wiederholungen, Pausen, Split bei 3 Tagen |
| 2 | Erfahrung (Anfänger, Fortgeschritten, Erfahren) | Erlaubte Schwierigkeit, Umfang, Übungsbudget |
| 3 | Häufigkeit (2–6) + Wochentage | Muss übereinstimmen; nicht gewählte Tage = Ruhetage |
| 4 | Muskelgruppen | Nur diese werden trainiert – nichts wird ungefragt ergänzt |
| 5 | Aufteilung automatisch oder manuell | Manuell: Muskelgruppen frei auf die Tage verteilen |
| 6 | Dauer (30–90 min, optional) | Anzahl Übungen und ggf. Sätze |
| 7 | Ausrüstung (Preset oder individuell) | Übungen mit fehlendem Equipment werden ausgeschlossen |

## 1. Split-Vorschlag

| Tage | Vorschlag |
|---|---|
| 2 | Ganzkörper / Ganzkörper (unterschiedliche Übungen) |
| 3 | Ganzkörper A/B/C (Anfänger, Fitness, Wiedereinstieg) – sonst Push / Pull / Beine |
| 4 | Oberkörper / Unterkörper / Oberkörper / Unterkörper |
| 5 | Oberkörper / Unterkörper / Push / Pull / Beine |
| 6 | Push / Pull / Beine × 2 |

Gruppen: Push = Brust, Schultern, Trizeps · Pull = Rücken, Bizeps, Unterarme · Beine = Quadrizeps, Beinbeuger, Gesäß, Waden, Bauch · Oberkörper = Push + Pull · Unterkörper = Beine.

Die Vorlage wird auf die gewählten Muskelgruppen gefiltert. Gruppen ohne Platz kommen an den Tag mit den wenigsten Gruppen. Bleibt ein Tag leer (z. B. nur Oberkörper gewählt, aber 4-Tage-OK/UK), wird auf Ganzkörper umgestellt und ein Hinweis angezeigt.

Hinweis bei Überschneidung: Werden große Muskelgruppen an zwei direkt aufeinanderfolgenden Tagen trainiert (inkl. So → Mo), erscheint eine Empfehlung.

## 2. Übungsbudget pro Tag

| Dauer | 30 | 45 | 60 | 75 | 90 | keine Angabe |
|---|---|---|---|---|---|---|
| Übungen | 3 | 5 | 6 | 7 | 8 | 5 / 6 / 7 (nach Erfahrung) |

Anfänger: maximal 6 Übungen.

## 3. Verteilung der Plätze

1. Große Gruppen (Quadrizeps, Beinbeuger, Gesäß, Rücken, Brust, Schultern) zuerst, je ein Platz.
2. Bei knappem Budget bleibt mindestens ein Platz für eine kleine Gruppe; kleine Gruppen **rotieren je Variante** (Ganzkörper A/B/C decken so über die Woche mehr ab). Gesäß/Beinbeuger wechseln sich bei Platzmangel ab, weil Hüftübungen beide trainieren.
3. Weitere Plätze gehen reihum an große Gruppen (max. 3 Übungen je Gruppe und Tag).

## 4. Auswahl je Platz (Bewertung)

| Regel | Punkte |
|---|---|
| Erster Platz einer großen Gruppe und Grund-/Kraftübung | +10 |
| Weiterer Platz mit bereits genutztem Bewegungsmuster | −4 |
| Anfänger: Maschine oder Kabelzug (gut erlernbar) | +1,5 |
| Anfänger: schwere Kraftübung | −3 |
| Erfahren: Kraftübung | +1 |
| Rücken: Hüftbeuge-Übung (Kreuzheben) bzw. Schulterheben | −6 bzw. −3 |
| Übung schon an einem anderen Tag im Plan | −3 je Vorkommen |

Filter vorab: richtige primäre Muskelgruppe, Equipment verfügbar, Schwierigkeit erlaubt (Anfänger nur Anfänger-Übungen, sofern vorhanden). Bei Gleichstand gewinnt die Reihenfolge in der Datenbank; wiederholte Tagestypen nutzen deterministisch die nächstbeste Variante.

## 5. Reihenfolge und Vorgaben

Reihenfolge: Grund-/Kraftübungen → Isolation → Bauch zuletzt.

| Ziel | Grundübung | Isolation |
|---|---|---|
| Muskelaufbau | 3 (Erfahren 4) × 6–10, 120 s | 3 × 10–15, 75 s |
| Maximalkraft | 4 (Erfahren 5) × 3–6, 180 s | 3 × 8–10, 90 s |
| Allgemeine Fitness | 3 × 10–15, 75 s | 3 × 10–15, 60 s |
| Wiedereinstieg | 2–3 × 10–12, 90 s | 2–3 × 10–12, 60 s |

Halte- und Streckenübungen (Plank in Sekunden, Farmer's Walk in Metern) behalten ihre eigenen Vorgaben.

## 6. Zeitschätzung

`Dauer ≈ 8 min Aufwärmen + Σ Übungen (Sätze × (Ø Wdh. × 3 s + 10 s) + (Sätze − 1) × Pause + 90 s Wechsel)`

Liegt die Schätzung über der gewählten Zeit, werden Übungen entfernt; reicht das nicht, wird je Übung ein Satz gekürzt (mind. 2). Die Anzeige ist ausdrücklich eine Schätzung.

## 7. Hinweise im Ergebnis

- weniger als 3 Muskelgruppen gewählt
- Wochentage passen nicht zur Häufigkeit (Generierung gesperrt)
- keine passende Übung für eine Gruppe mit der gewählten Ausrüstung
- Gruppe nur indirekt über Grundübungen trainiert bzw. kein Platz im Zeitrahmen
- Überschneidung großer Gruppen an aufeinanderfolgenden Tagen

## 8. Nach der Generierung

Der Plan ist vollständig bearbeitbar (gleicher Editor wie beim manuellen Plan). **Tag neu generieren** erhöht nur für diesen Tag einen Variantenzähler; Übungen der anderen Tage gelten als „bereits verwendet“, bleiben aber unverändert.

## Getestete Fälle

2 Tage Ganzkörper · 3 Tage mit individueller Auswahl · 4 Tage OK/UK · 6 Tage PPL × 2 · fehlendes Equipment · unvollständige Auswahl · zu wenige Muskelgruppen · Änderung eines generierten Plans · Neugenerierung eines einzelnen Tages · Speichern und Wiederherstellen · Determinismus · Zeitbudget · Reihenfolge.
