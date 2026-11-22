/**
 * Prüfregeln für Konten nach NIST SP 800-63B:
 * - Mindestlänge statt Zeichenklassen-Zwang, lange Passphrasen erlaubt
 * - bekannte/zu einfache Passwörter ablehnen
 * - Einfügen (Passwort-Manager) ausdrücklich erlaubt
 * Obergrenze 72 Bytes, weil der Anmeldedienst (bcrypt) längere Passwörter abschneidet.
 */

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX_BYTES = 72;

// Häufigste Passwörter (Auszug aus öffentlichen Leak-Statistiken) und naheliegende App-Begriffe
const COMMON = new Set([
  '123456789', '1234567890', '12345678910', 'password', 'password1', 'password123', 'passwort', 'passwort1', 'passwort123', 'qwertzuiop', 'qwertyuiop',
  '1q2w3e4r5t', 'abc1234567', 'iloveyou12', 'hallo12345', 'hallohallo', 'schatz1234', 'sommer2024', 'sommer2025', 'sommer2026', 'winter2025', 'winter2026',
  'fussball12', 'fußball123', 'dragon1234', 'monkey1234', 'letmein123', 'welcome123', 'willkommen', 'willkommen1', 'admin12345', 'administrator',
  'milewyse123', 'milewyse', 'milewise123', 'fahrzeug123', 'volkswagen', 'volkswagen1', 'mercedes123', 'porsche911', '0000000000', '1111111111',
  'aaaaaaaaaa', 'asdfghjkl1', 'yxcvbnm123', 'qwertz1234', 'passwort!1', 'geheim1234', 'geheimnis1', 'ichliebedich', 'bundesliga'
]);

export type PasswordCheck = { ok: true; strength: 0 | 1 | 2 | 3 | 4 } | { ok: false; strength: 0 | 1 | 2 | 3 | 4; message: string };

const byteLength = (s: string) => new TextEncoder().encode(s).length;

/** Grobe Stärke 0–4 (Länge + Vielfalt), nur zur Anzeige. */
export function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let classes = 0;
  if (/[a-zäöüß]/.test(pw)) classes++;
  if (/[A-ZÄÖÜ]/.test(pw)) classes++;
  if (/\d/.test(pw)) classes++;
  if (/[^\w\s]|_/.test(pw)) classes++;
  if (/\s/.test(pw)) classes++;
  const unique = new Set(pw).size;
  let score = 0;
  if (pw.length >= PASSWORD_MIN) score++;
  if (pw.length >= 14) score++;
  if (pw.length >= 20) score++;
  if (classes >= 3 && unique >= 6) score++;
  if (unique <= 3) score = Math.min(score, 1);
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}

export function checkPassword(pw: string, context: { email?: string; name?: string } = {}): PasswordCheck {
  const strength = passwordStrength(pw);
  if (pw.length < PASSWORD_MIN) return { ok: false, strength, message: `Mindestens ${PASSWORD_MIN} Zeichen. Tipp: Eine Passphrase aus mehreren Wörtern ist leicht zu merken und sicher.` };
  if (byteLength(pw) > PASSWORD_MAX_BYTES) return { ok: false, strength, message: 'Das Passwort ist zu lang (höchstens 72 Bytes).' };
  const lower = pw.toLowerCase();
  if (COMMON.has(lower)) return { ok: false, strength, message: 'Dieses Passwort ist sehr verbreitet und leicht zu erraten.' };
  if (new Set(pw).size <= 2) return { ok: false, strength, message: 'Bitte nicht nur ein oder zwei Zeichen wiederholen.' };
  if (/^(0123456789|1234567890|abcdefghij|qwertzuiop)/i.test(pw)) return { ok: false, strength, message: 'Einfache Zeichenfolgen sind leicht zu erraten.' };
  const local = context.email?.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return { ok: false, strength, message: 'Das Passwort sollte nicht deine E-Mail-Adresse enthalten.' };
  if (context.name && context.name.length >= 4 && lower.includes(context.name.toLowerCase())) return { ok: false, strength, message: 'Das Passwort sollte nicht deinen Namen enthalten.' };
  return { ok: true, strength };
}

export const STRENGTH_LABEL = ['Sehr schwach', 'Schwach', 'Mittel', 'Gut', 'Sehr gut'] as const;

/** Pragmatische E-Mail-Prüfung (der Anmeldedienst bestätigt die Adresse per Mail). */
export function checkEmail(email: string): string | null {
  const e = email.trim();
  if (!e) return 'Bitte eine E-Mail-Adresse eingeben.';
  if (e.length > 254) return 'Die E-Mail-Adresse ist zu lang.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return 'Bitte eine gültige E-Mail-Adresse eingeben.';
  return null;
}

/** Fehlermeldungen des Anmeldedienstes verständlich auf Deutsch – ohne zu verraten, ob ein Konto existiert. */
export function authErrorMessage(err: unknown): string {
  const raw = (err as { message?: string; code?: string; status?: number } | null) ?? {};
  const m = `${raw.code ?? ''} ${raw.message ?? ''}`.toLowerCase();
  if (/invalid.*(login|credentials)|invalid_credentials/.test(m)) return 'E-Mail-Adresse oder Passwort ist falsch.';
  if (/email.*not.*confirmed|email_not_confirmed/.test(m)) return 'Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der Bestätigungs-Mail.';
  if (/rate|too many|over_email_send_rate_limit|429/.test(m) || raw.status === 429) return 'Zu viele Versuche. Bitte warte einen Moment und versuche es dann erneut.';
  if (/weak.*password|pwned|leaked/.test(m)) return 'Dieses Passwort ist zu schwach oder in bekannten Datenlecks aufgetaucht. Bitte wähle ein anderes.';
  if (/same.*password/.test(m)) return 'Das neue Passwort muss sich vom bisherigen unterscheiden.';
  if (/already.*registered|user_already_exists/.test(m)) return 'Wir haben dir eine E-Mail geschickt. Prüfe dein Postfach, um fortzufahren.';
  if (/network|fetch|failed to fetch|load failed/.test(m)) return 'Keine Verbindung zum Anmeldedienst. Bitte prüfe deine Internetverbindung.';
  if (/provider.*not.*enabled|unsupported provider/.test(m)) return 'Diese Anmeldemethode ist im Anmeldedienst noch nicht freigeschaltet.';
  if (/session.*missing|expired|invalid.*token|otp_expired/.test(m)) return 'Der Link ist abgelaufen oder ungültig. Bitte fordere einen neuen an.';
  return 'Das hat nicht geklappt. Bitte versuche es erneut.';
}
