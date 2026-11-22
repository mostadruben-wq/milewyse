import { describe, expect, it } from 'vitest';
import { authErrorMessage, checkEmail, checkPassword, passwordStrength } from './password';

describe('Passwortregeln (NIST 800-63B)', () => {
  it('verlangt eine Mindestlänge statt Zeichenklassen', () => {
    expect(checkPassword('kurz').ok).toBe(false);
    expect(checkPassword('blauer bus fährt nach norden').ok).toBe(true);
    expect(checkPassword('alllowercaselong').ok).toBe(true);
  });
  it('lehnt verbreitete und triviale Passwörter ab', () => {
    expect(checkPassword('password123').ok).toBe(false);
    expect(checkPassword('Passwort123').ok).toBe(false);
    expect(checkPassword('aaaaaaaaaaaa').ok).toBe(false);
    expect(checkPassword('1234567890ab').ok).toBe(false);
  });
  it('lehnt Passwörter mit E-Mail-Namen ab und begrenzt auf 72 Bytes', () => {
    expect(checkPassword('rubenrules2026!', { email: 'ruben@example.org' }).ok).toBe(false);
    expect(checkPassword('ä'.repeat(40)).ok).toBe(false);
  });
  it('bewertet lange, abwechslungsreiche Passwörter stärker', () => {
    expect(passwordStrength('abc')).toBeLessThan(passwordStrength('Syncro-Tour 2026 nach Norden!'));
    expect(passwordStrength('Syncro-Tour 2026 nach Norden!')).toBe(4);
  });
});

describe('E-Mail und Fehlermeldungen', () => {
  it('prüft E-Mail-Adressen', () => {
    expect(checkEmail('')).not.toBeNull();
    expect(checkEmail('name@domain')).not.toBeNull();
    expect(checkEmail(' name@domain.de ')).toBeNull();
  });
  it('übersetzt Fehler, ohne Kontoexistenz zu verraten', () => {
    expect(authErrorMessage({ message: 'Invalid login credentials' })).toBe('E-Mail-Adresse oder Passwort ist falsch.');
    expect(authErrorMessage({ code: 'user_already_exists' })).toMatch(/E-Mail geschickt/);
    expect(authErrorMessage({ status: 429, message: 'x' })).toMatch(/Zu viele Versuche/);
  });
});
