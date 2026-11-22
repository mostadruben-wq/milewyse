# Konto einrichten (Supabase, EU)

Das Konto ist optional und dient nur der Anmeldung. Fahrzeugdaten und Belege bleiben auf dem Gerät.
Status: vorbereitet, aber ausgeschaltet. Einschalten: in deploy.yml unter `env:` die Zeile
`VITE_AUTH_ENABLED: ${{ vars.AUTH_ENABLED }}` ergänzen, GitHub-Variable `AUTH_ENABLED` = `true` anlegen, Workflow neu starten.

Ohne Konfiguration zeigt die App „nicht eingerichtet“ und funktioniert normal weiter.

## 1. Projekt
1. supabase.com → New project, Region **Central EU (Frankfurt)**.
2. SQL Editor → Inhalt von `docs/supabase-setup.sql` ausführen (Konto-Löschen).

## 2. Authentication
- **URL Configuration:** Site URL `https://mostadruben-wq.github.io/milewyse/`, Redirect URLs zusätzlich `http://localhost:5173/**`.
- **Email:** „Confirm email“ an, „Secure email change“ an. Für echten Betrieb eigenen SMTP-Versand eintragen (der eingebaute ist stark begrenzt).
- **Passwörter:** Mindestlänge 10; „Leaked password protection“ (nur Pro-Plan) optional.
- **Google:** Google Cloud → OAuth-Client (Web), autorisierte Weiterleitungs-URI = Callback-URL aus Supabase. Client-ID und -Secret in Supabase eintragen (das Secret bleibt bei Supabase, nie im Frontend).
- **Apple:** benötigt eine kostenpflichtige Apple-Developer-Mitgliedschaft (Services ID, Key, Team-ID). Werte in Supabase eintragen.

## 3. GitHub
Repository → Settings → Secrets and variables → Actions → **Variables**:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (öffentlicher Schlüssel)
- `AUTH_PROVIDERS` z. B. `google` oder `apple,google` – nur freigeschaltete Wege eintragen
- `PRIVACY_URL` Link zur Datenschutzerklärung

Danach den Workflow neu starten (Actions → Deploy → Run workflow).

## Rechtliches
Mit Konten verarbeitest du personenbezogene Daten: Datenschutzerklärung und Impressum veröffentlichen,
mit Supabase einen Auftragsverarbeitungsvertrag (DPA) abschließen.
