# PR Done – OrbitDB Browser Demo

Kleines GitHub-Pages-fähiges Beispielprojekt für ein Team-Review-Tracking mit OrbitDB direkt im Browser.

## Ziel

Die App demonstriert einen bewusst einfachen, statischen Ansatz:

- keine Build-Pipeline
- kein Node.js für die Entwicklung nötig
- Konfiguration über Browser-Formular
- Speicherung der Grundkonfiguration im Local Storage
- Schreiben von `pr_done`-Events in eine OrbitDB Event-Database
- Anzeige der Rohdaten und einfacher Aggregationen im Browser

## Projektstruktur

```text
.
├── app.js
├── index.html
├── README.md
└── styles.css
```

## Lokal starten

Wichtig: Die Seite sollte nicht per `file://` geöffnet werden, sondern über einen kleinen Webserver.

Geeignet sind zum Beispiel:

- der eingebaute Webserver der IDE
- `python -m http.server 8080`
- ein beliebiger anderer statischer Webserver

Dann die `index.html` im Browser öffnen.

## Deployment auf GitHub Pages

1. Repository auf GitHub anlegen
2. Dateien in den Default-Branch pushen
3. In GitHub unter **Settings → Pages** den Branch auswählen
4. Als Root das Repository-Root verwenden
5. Nach dem Deploy die erzeugte Pages-URL öffnen

## Konfiguration

Beim ersten Start fragt die App:

- Teamname
- eigenes Namenskürzel
- optional eine bekannte OrbitDB-Adresse

Wird keine OrbitDB-Adresse eingetragen, erzeugt die App anhand des Teamnamens eine DB und speichert die resultierende DB-Adresse anschließend ebenfalls in der Local-Storage-Konfiguration.

## Was schon funktioniert

- statische Browser-App
- Local-Storage-Konfiguration
- PR-done-Button
- Schreiben von Events in eine OrbitDB Event-DB
- tabellarische Darstellung der Einzelereignisse
- Aggregation nach Tag und Mitarbeiter
- Kennzahlen für Top-Reviewer und stärksten Tag

## Was in der Praxis noch fehlt

Für ein echtes Team-Setup über mehrere Browser hinweg ist dieses Gerüst bewusst nur ein Startpunkt. In der Praxis solltest du als Nächstes ergänzen:

- stabile Peer-Discovery / Relay-Strategie
- klare Festlegung einer gemeinsamen DB-Adresse
- optional Export / Import der DB-Adresse
- Rechte- und Vertrauensmodell für Schreibzugriffe
- robustere Synchronisations- und Fehlersicht

## Nächste sinnvolle Ausbaustufen

- Chart.js für echte Diagramme
- Filter nach Zeitraum / Person
- Export nach CSV
- grüner Punkt je Person und Tag als Avatar-Ansicht
- separates Team-Dashboard
- Relay-/Anchor-Node außerhalb von GitHub Pages

## Hinweis zur Architektur

GitHub Pages ist nur das Hosting der statischen Oberfläche. Die eigentliche Datenhaltung geschieht im Browser mittels Helia + OrbitDB. Für echte Zusammenarbeit zwischen mehreren Clients ist meistens zusätzliche P2P-Infrastruktur nötig.
