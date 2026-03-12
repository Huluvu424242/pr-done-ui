# PR Done · OrbitDB Browser Demo

Ein kleines OSS-Gerüst für ein local-first Team-Dashboard:

- Erstkonfiguration im Browser mit `teamName`, `memberShort` und Upload einer Schlüsseldatei
- Persistenz der Konfiguration im `localStorage`
- PR-Review-Events als append-only Einträge in einer **OrbitDB events database**
- Helia/IPFS + OrbitDB direkt **im Browser**
- Speicherung von Helia/IPFS-Daten in **IndexedDB**
- Einfache Auswertung als Tabellen und Balkendiagramm
- Berechnung eines grünen Punktes, sobald der aktuelle Benutzer heute mindestens ein PR-Review eingetragen hat

## Wichtige Einordnung

Dieses Projekt ist bewusst ein **Gerüst** und kein fertig produktionsreifes Mehrbenutzer-System.

Was bereits drin ist:

- lokale In-Browser-OrbitDB-Instanz
- persistente Browser-Speicherung
- append-only Event-Log
- Aggregation für Mitarbeiter/Tag/Gesamtzahlen

Was für echte Team-Synchronisation typischerweise noch ergänzt werden sollte:

- Browser-geeignete Peer-Connectivity über Relay / Bootstrap / WebRTC / WebSockets
- ggf. externe Pinning- oder Replikationsknoten
- echte kryptographische Nutzeridentität auf Basis der hochgeladenen Schlüsseldatei
- Rechtekonzept und Access Controller
- Datenschutz- und Security-Härtung

In dieser Demo wird die hochgeladene Schlüsseldatei **nur lokal im Browser gespeichert** und zur Ableitung einer stabilen Benutzerkennung verwendet. Das ist als schneller Start gedacht, nicht als endgültiges Sicherheitskonzept.

## Technologie-Hintergrund

OrbitDB beschreibt sich als serverlose, verteilte P2P-Datenbank auf Basis von IPFS/Libp2p und bietet unter anderem den Datenbanktyp `events`, der sich gut für append-only Ereignisprotokolle eignet. Die aktuelle README zeigt die Verwendung von `createHelia`, `createOrbitDB` und einem `events`-Store. Außerdem wird ausdrücklich erwähnt, dass OrbitDB in Browsern und Node.js funktioniert. citeturn329684view0turn131152view1

Die Helia-Beispiele zeigen für Browser-Szenarien, dass `blockstore-idb` und `datastore-idb` typische Bausteine für persistente Speicherung in IndexedDB sind. Genau dieses Muster nutzt dieses Gerüst. citeturn323156search0turn323156search1

## Lokal starten

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## GitHub Pages

Das Projekt enthält einen einfachen GitHub-Actions-Workflow für GitHub Pages.

Voraussetzungen:

1. Repository auf GitHub anlegen
2. Inhalte pushen
3. Unter **Settings → Pages** die Quelle auf **GitHub Actions** stellen
4. Workflow laufen lassen

## Projektstruktur

```text
.
├── .github/workflows/deploy-pages.yml
├── index.html
├── package.json
├── src/
│   ├── main.js
│   └── style.css
└── vite.config.js
```

## Nächste sinnvolle Ausbaustufen

1. Gemeinsame Team-DB-Adresse explizit anzeigen und importierbar machen
2. Relay-/Bootstrap-Konfiguration für echte Browser-zu-Browser-Replikation ergänzen
3. Schlüsseldaten nicht in `localStorage`, sondern verschlüsselt in `IndexedDB` oder via WebAuthn/Passkey anbinden
4. Tagesziel visualisieren, z. B. Ampel pro Benutzer
5. CSV-Export und Wochen-/Monatsansichten ergänzen
