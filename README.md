# Milewyse

Herstellerunabhängige Fahrzeugverwaltung als installierbare Progressive Web App (React, TypeScript, Vite): Wartung, Kilometer, Serviceheft, Belege mit Texterkennung, Ersatzteile und Kosten – für beliebig viele Fahrzeuge. Alle Daten bleiben auf dem Gerät.

Version 0.2

## Schnellstart

Voraussetzung: Node.js 18 oder neuer.

```bash
npm install
npm run dev          # Entwicklung: http://localhost:5173
npm test             # 53 Tests (Fälligkeiten, Kilometer, Rechnungsauswertung, Kosten, Dubletten, Migration)
npm run build        # Produktionsbuild mit Service Worker in ./dist
npm run preview      # Produktionsbuild lokal ansehen
```

`npm run build:preview` erzeugt eine Variante ohne Service Worker (`dist-artifact`) für Vorschau-Hosts.

## Auf dem iPhone installieren

1. Inhalt von `dist/` auf einen HTTPS-Webspace laden (z. B. GitHub Pages, Netlify, Cloudflare Pages). Relative Pfade, funktioniert auch im Unterordner.
2. In **Safari** öffnen → Teilen → **Zum Home-Bildschirm**.
3. Nach dem ersten Start funktionieren App, Texterkennung und Dokumentenarchiv offline.

Nur als Home-Bildschirm-App sind die Daten auf iOS dauerhaft geschützt. Regelmäßig unter *Mehr → Datensicherung* ein Backup (optional inkl. Dokumente) exportieren.

## Funktionen

| Bereich | Stand |
|---|---|
| Mehrere Fahrzeuge beliebiger Marken; Wartungsliste passend zu Kraftstoff und Antrieb; optionale Vorlage „VW T4 2.5 TDI Syncro (AXL)“ | ✅ |
| Wartungsmanager mit km- und Zeitintervallen, „zuerst erreichte Grenze gilt“, Ampelstatus, Vorwarnschwellen, Quellenkennzeichnung | ✅ |
| Kilometerstand mit Rücksprungschutz, Korrekturen, Ø-Fahrleistung und Prognosen | ✅ |
| Serviceheft (Timeline), Reparaturen, zusammenhängende Arbeiten mit Einzelbestätigung | ✅ |
| **Dokument scannen**: Kamera, Fotos, PDF (mehrseitig); automatische Blatterkennung, Perspektivkorrektur, Filter, Vorschau | ✅ |
| **Texterkennung lokal** (Tesseract, deutsche Sprachdaten in der App); bei PDFs zuerst eingebetteter Text | ✅ |
| **Rechnungsauswertung**: Datum, Nr., Händler, Gesamtbetrag, MwSt., km, Kennzeichen, FIN, Positionen, Teilenummern, Hersteller, Betriebsstoffe; unsichere Werte markiert; Plausibilitätsprüfung Betrag ↔ MwSt. | ✅ |
| Werkstattrechnung vs. Teilekauf: bei Teilekäufen wird der Einbau nicht angenommen, sondern muss bestätigt werden | ✅ |
| Wartungsvorschläge (mehrere pro Rechnung), einzeln bestätigen/bearbeiten/verwerfen; Intervalle werden nach Bestätigung aktualisiert | ✅ |
| Ersatzteil-Datenbank mit Suche (Teilenummer, Hersteller, Bezeichnung) | ✅ |
| Dokumentenarchiv: Volltextsuche (inkl. Teilenummern), Filter nach Fahrzeug, Kategorie, Jahr, Sortierung nach Datum/Betrag, Original ansehen/laden, bearbeiten, löschen, mit mehreren Einträgen verknüpfen | ✅ |
| **Sammelimport** alter Rechnungen mit Dublettenerkennung, chronologischer Vorschau der rekonstruierten Historie | ✅ |
| Kosten ohne Doppelbuchung (Beleg zählt einmal), Jahr/12 Monate/pro km, Monatsverlauf, Kategorien | ✅ |
| Backup/Wiederherstellung (JSON, optional inkl. Dokumente), CSV-Export, alles löschen | ✅ |
| Migration der Daten aus Version 0.1 (T4 Syncro Companion) | ✅ |

## Grenzen und Alternativen

- **Kantenerkennung**: automatische Blatterkennung per Helligkeitsanalyse (gut bei hellem Papier auf dunklerem Untergrund); bei Bedarf Ecken manuell ziehen. Eine OpenCV-basierte Erkennung wie in Apple Notizen würde ca. 8 MB zusätzlich laden.
- **Texterkennung**: Qualität hängt von Foto-Auflösung und Licht ab. Firmenlogos werden nicht gelesen. Händlernamen aus Fotos sind daher immer als „unsicher“ markiert.
- **Externe KI**: nicht eingebaut. Dafür ist ein eigenes Backend nötig, damit keine API-Schlüssel in der App liegen; Übertragung nur nach ausdrücklicher Zustimmung.
- **Noch offen**: Tankbuch, Checklisten, Push-Benachrichtigungen, PDF-Servicebericht.

## Projektstruktur

```
src/
  lib/            Typen, Datum, Fälligkeiten, Kilometer, Speicherung (IndexedDB + Dateispeicher), Store,
                  invoice.ts (Rechnungsauswertung), matcher.ts (Wartungs-/Teileerkennung), scan.ts (Pipeline),
                  imageproc.ts (Zuschnitt/Perspektive/Filter), ocr.ts (Tesseract/pdf.js), costs.ts, duplicates.ts
  lib/__fixtures__/  anonymisierte echte Rechnungstexte für Regressionstests
  data/           Wartungskatalog (allgemein + T4-Syncro-Vorlage), Startzustand, Migration, Beispieldaten
  components/     UI-Bausteine, Zuschnitt-Editor, Belegprüfung, Fahrzeugformular
  screens/        Übersicht, Wartung, Historie, Kosten, Mehr, Dokumente, Ersatzteile, Fahrzeuge …
  sheets/         Eingabemasken, Scanner, Sammelimport
public/ocr/       Tesseract-Worker, WebAssembly-Kern, deutsche Sprachdaten, pdf.js-Worker (lokal, offline)
tools/            Entwicklerwerkzeuge (Rechnungen auswerten, Sprachdaten einbetten)
```

Neue Rechnungsformate testen: `INV_DIR=/pfad/zu/pdfs npx vitest run tools/extract.test.ts`
