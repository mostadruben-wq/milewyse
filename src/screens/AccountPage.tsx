import { useState } from 'react';
import { useNav } from '../nav';
import { authErrorMessage, checkEmail, checkPassword, STRENGTH_LABEL } from '../lib/password';
import { displayName, useAuth, type Provider } from '../lib/auth';
import { Confirm, Field, NavBar, Row, Section, Segmented, Sheet, toast } from '../components/ui';
import { Icon } from '../components/Icon';

const PROVIDERS = ((import.meta.env.VITE_AUTH_PROVIDERS as string | undefined) ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter((s): s is Provider => s === 'apple' || s === 'google');
const PRIVACY_URL = (import.meta.env.VITE_PRIVACY_URL as string | undefined) || '';

function PasswordField({ id, label, value, onChange, autoComplete, email, meter }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; email?: string; meter?: boolean }) {
  const [show, setShow] = useState(false);
  const check = meter && value ? checkPassword(value, { email }) : null;
  return (
    <>
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <input id={id} type={show ? 'text' : 'password'} value={value} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} spellCheck={false} autoCapitalize="off" />
        <button type="button" className="nav-btn" style={{ minHeight: 0, padding: 4, background: 'none', boxShadow: 'none', color: 'var(--label-2)', fontSize: 13 }} onClick={() => setShow(!show)} aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'}>
          {show ? 'Verbergen' : 'Anzeigen'}
        </button>
      </div>
      {check && (
        <div style={{ padding: '0 18px 12px' }}>
          <div className="pw-meter" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={i < check.strength ? `on s${check.strength}` : ''} />
            ))}
          </div>
          <div className="small" style={{ marginTop: 6, color: check.ok ? 'var(--label-2)' : 'var(--overdue-text)' }} aria-live="polite">
            {check.ok ? `Stärke: ${STRENGTH_LABEL[check.strength]}` : check.message}
          </div>
        </div>
      )}
    </>
  );
}

function ProviderButtons({ busy, onPick }: { busy: boolean; onPick: (p: Provider) => void }) {
  if (!PROVIDERS.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
      {PROVIDERS.includes('apple') && (
        <button className="btn btn-block provider-btn apple" disabled={busy} onClick={() => onPick('apple')}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M16.4 12.6c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1.1-2.9-4.1zM13.9 4.9c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z" /></svg>
          Mit Apple fortfahren
        </button>
      )}
      {PROVIDERS.includes('google') && (
        <button className="btn btn-block provider-btn google" disabled={busy} onClick={() => onPick('google')}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.4-1 2.5-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8C3.9 20.6 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.8 14.2c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V7H2.1C1.4 8.5 1 10.2 1 12s.4 3.5 1.1 5l3.7-2.8z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2C17.5 2.1 15 1 12 1 7.7 1 3.9 3.4 2.1 7l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" /></svg>
          Mit Google fortfahren
        </button>
      )}
      <div className="divider-or">oder mit E-Mail</div>
    </div>
  );
}

/** Konto: registrieren, anmelden, Passwort vergessen, Profil, Abmelden, Konto löschen. */
export function AccountPage() {
  const auth = useAuth();
  const nav = useNav();

  if (!auth.configured) {
    return (
      <>
        <NavBar onBack={nav.pop} backLabel="Mehr" />
        <h1 className="large-title">Konto</h1>
        <div className="card small" style={{ lineHeight: 1.5 }}>
          Der Anmeldedienst ist für diese Installation noch nicht eingerichtet. Milewyse funktioniert vollständig ohne Konto – alle Daten bleiben auf diesem Gerät.
        </div>
      </>
    );
  }
  return auth.user ? <Profile /> : <SignInUp />;
}

function SignInUp() {
  const auth = useAuth();
  const nav = useNav();
  const [mode, setMode] = useState<'anmelden' | 'registrieren'>('anmelden');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setInfo(null);
    const em = checkEmail(email);
    if (em) return setError(em);
    if (mode === 'anmelden') {
      if (!password) return setError('Bitte das Passwort eingeben.');
      return run(async () => {
        await auth.signIn(email, password);
        toast('Angemeldet');
      });
    }
    const pc = checkPassword(password, { email, name });
    if (!pc.ok) return setError(pc.message);
    if (password !== password2) return setError('Die Passwörter stimmen nicht überein.');
    if (!consent) return setError('Bitte bestätige die Datenschutzhinweise.');
    run(async () => {
      const r = await auth.signUp(email, password, name);
      setPassword('');
      setPassword2('');
      setInfo(r.needsConfirmation ? `Fast geschafft: Wir haben dir eine E-Mail an ${email.trim()} geschickt. Bitte bestätige deine Adresse über den Link darin.` : 'Konto angelegt – du bist angemeldet.');
    });
  };

  return (
    <>
      <NavBar onBack={nav.pop} backLabel="Mehr" />
      <h1 className="large-title">{mode === 'anmelden' ? 'Anmelden' : 'Konto erstellen'}</h1>
      <p className="muted small" style={{ margin: '-6px 2px 14px', lineHeight: 1.5 }}>
        Das Konto ist optional. Deine Fahrzeugdaten und Belege bleiben weiterhin nur auf diesem Gerät.
      </p>
      <Segmented
        label="Anmelden oder registrieren"
        value={mode}
        onChange={(m) => (setMode(m), setError(null), setInfo(null))}
        options={[
          { value: 'anmelden', label: 'Anmelden' },
          { value: 'registrieren', label: 'Registrieren' }
        ]}
      />

      <ProviderButtons busy={busy} onPick={(p) => run(() => auth.signInWith(p))} />

      <form onSubmit={submit} noValidate>
        <Section>
          <div className="group mt">
            {mode === 'registrieren' && (
              <div className="field">
                <label htmlFor="acc-name">Name</label>
                <input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="optional" />
              </div>
            )}
            <div className="field">
              <label htmlFor="acc-email">E-Mail</label>
              <input id="acc-email" type="email" inputMode="email" autoComplete={mode === 'anmelden' ? 'username' : 'email'} autoCapitalize="off" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@beispiel.de" />
            </div>
            <PasswordField id="pw-main" label="Passwort" value={password} onChange={setPassword} autoComplete={mode === 'anmelden' ? 'current-password' : 'new-password'} email={email} meter={mode === 'registrieren'} />
            {mode === 'registrieren' && <PasswordField id="pw-repeat" label="Wiederholen" value={password2} onChange={setPassword2} autoComplete="new-password" />}
          </div>
        </Section>

        {mode === 'registrieren' && (
          <label className="consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              Ich habe die {PRIVACY_URL ? <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">Datenschutzhinweise</a> : 'Datenschutzhinweise'} gelesen. Für das Konto werden E-Mail-Adresse und Name beim Anmeldedienst Supabase (Serverstandort Frankfurt, EU) gespeichert.
            </span>
          </label>
        )}

        {error && (
          <div className="error-text" role="alert">
            <Icon name="alert" size={16} style={{ flex: 'none', marginTop: 2 }} />
            {error}
          </div>
        )}
        {info && (
          <div className="banner mt" role="status">
            <Icon name="checkCircle" size={20} style={{ color: 'var(--ok)', flex: 'none' }} />
            <div className="small">{info}</div>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block mt-lg" disabled={busy}>
          {busy ? 'Bitte warten …' : mode === 'anmelden' ? 'Anmelden' : 'Konto erstellen'}
        </button>
      </form>

      {mode === 'anmelden' && (
        <button className="btn btn-plain btn-block mt" onClick={() => setForgot(true)}>
          Passwort vergessen?
        </button>
      )}
      {info && mode === 'registrieren' && (
        <button className="btn btn-plain btn-block mt" disabled={busy} onClick={() => run(async () => (await auth.resendConfirmation(email), setInfo('Bestätigungs-Mail erneut gesendet.')))}>
          Bestätigungs-Mail erneut senden
        </button>
      )}

      {forgot && <ForgotSheet initialEmail={email} onClose={() => setForgot(false)} />}
    </>
  );
}

function ForgotSheet({ initialEmail, onClose }: { initialEmail: string; onClose: () => void }) {
  const auth = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const em = checkEmail(email);
    if (em) return setError(em);
    setBusy(true);
    try {
      await auth.sendReset(email);
      setDone(true);
    } catch (e) {
      // Aus Datenschutzgründen dieselbe Antwort, ob es das Konto gibt oder nicht – außer bei Verbindungs-/Limitfehlern
      const msg = authErrorMessage(e);
      if (/Verbindung|Zu viele/.test(msg)) setError(msg);
      else setDone(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open title="Passwort vergessen" onClose={onClose} leftLabel={done ? 'Schließen' : 'Abbrechen'}>
      {done ? (
        <div className="center" style={{ padding: '30px 10px' }}>
          <Icon name="checkCircle" size={44} style={{ color: 'var(--ok)' }} />
          <p style={{ lineHeight: 1.5 }}>Falls ein Konto mit dieser Adresse existiert, haben wir dir einen Link zum Zurücksetzen geschickt. Der Link ist nur kurz gültig.</p>
        </div>
      ) : (
        <>
          <p className="muted small" style={{ margin: '6px 2px 12px' }}>Gib deine E-Mail-Adresse ein. Du bekommst einen Link, mit dem du ein neues Passwort festlegst.</p>
          <div className="group">
            <Field label="E-Mail" value={email} onChange={setEmail} type="email" placeholder="name@beispiel.de" />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary btn-block mt-lg" onClick={send} disabled={busy}>
            {busy ? 'Wird gesendet …' : 'Link senden'}
          </button>
        </>
      )}
    </Sheet>
  );
}

/** Nach Klick auf den Reset-Link: neues Passwort festlegen. */
export function RecoverySheet() {
  const auth = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!auth.recovery) return null;
  const save = async () => {
    const c = checkPassword(pw, { email: auth.user?.email });
    if (!c.ok) return setError(c.message);
    if (pw !== pw2) return setError('Die Passwörter stimmen nicht überein.');
    setBusy(true);
    try {
      await auth.updatePassword(pw);
      auth.clearRecovery();
      toast('Neues Passwort gespeichert');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open title="Neues Passwort" onClose={auth.clearRecovery}>
      <p className="muted small" style={{ margin: '6px 2px 12px' }}>Lege ein neues Passwort für {auth.user?.email} fest.</p>
      <div className="group">
        <PasswordField id="pw-new" label="Neues Passwort" value={pw} onChange={setPw} autoComplete="new-password" email={auth.user?.email} meter />
        <PasswordField id="pw-new2" label="Wiederholen" value={pw2} onChange={setPw2} autoComplete="new-password" />
      </div>
      {error && <div className="error-text">{error}</div>}
      <button className="btn btn-primary btn-block mt-lg" onClick={save} disabled={busy}>
        Passwort speichern
      </button>
    </Sheet>
  );
}

function Profile() {
  const auth = useAuth();
  const nav = useNav();
  const u = auth.user!;
  const [name, setName] = useState((u.user_metadata?.name as string) ?? '');
  const [pwOpen, setPwOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const providers = (u.app_metadata?.providers as string[] | undefined) ?? [u.app_metadata?.provider as string].filter(Boolean);
  const created = u.created_at ? new Date(u.created_at).toLocaleDateString('de-DE') : '–';
  const initials = displayName(u).split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <NavBar onBack={nav.pop} backLabel="Mehr" />
      <div className="detail-head" style={{ marginTop: 10 }}>
        <div className="avatar" style={{ width: 72, height: 72, fontSize: 24 }}>{initials}</div>
        <h2>{displayName(u)}</h2>
        <div className="muted small">{u.email}</div>
      </div>

      <Section header="Profil">
        <div className="group">
          <Field label="Name" value={name} onChange={setName} placeholder="optional" />
          <Row title="Anmeldung über" value={providers.map((p) => (p === 'email' ? 'E-Mail' : p === 'apple' ? 'Apple' : p === 'google' ? 'Google' : p)).join(', ') || 'E-Mail'} />
          <Row title="Konto seit" value={created} />
        </div>
        {name !== ((u.user_metadata?.name as string) ?? '') && (
          <button className="btn btn-secondary btn-block mt" onClick={async () => {
            try {
              await auth.updateName(name);
              toast('Name gespeichert');
            } catch (e) {
              setError(authErrorMessage(e));
            }
          }}>
            Name speichern
          </button>
        )}
      </Section>

      <Section header="Sicherheit">
        <div className="group">
          {providers.includes('email') && <Row title="Passwort ändern" onClick={() => setPwOpen(true)} />}
          <Row title="Auf allen Geräten abmelden" onClick={() => setConfirmOut(true)} />
        </div>
      </Section>

      <Section footer="Deine Fahrzeugdaten bleiben beim Abmelden und Löschen des Kontos auf diesem Gerät erhalten.">
        <div className="group">
          <button className="row action" onClick={async () => (await auth.signOut(false), toast('Abgemeldet'))}>
            Abmelden
          </button>
          <button className="row destructive" onClick={() => setConfirmDel(true)}>
            Konto löschen
          </button>
        </div>
      </Section>
      {error && <div className="error-text">{error}</div>}

      {pwOpen && <ChangePasswordSheet onClose={() => setPwOpen(false)} />}
      <Confirm open={confirmOut} title="Überall abmelden?" message="Du wirst auf allen Geräten abgemeldet, auf denen du angemeldet bist." confirmLabel="Überall abmelden" onConfirm={async () => (await auth.signOut(true), toast('Überall abgemeldet'))} onClose={() => setConfirmOut(false)} />
      <Confirm
        open={confirmDel}
        title="Konto endgültig löschen?"
        message="Dein Konto (E-Mail, Name, Anmeldungen) wird sofort und unwiderruflich gelöscht. Fahrzeugdaten auf diesem Gerät bleiben erhalten."
        confirmLabel="Konto löschen"
        destructive
        onConfirm={async () => {
          try {
            await auth.deleteAccount();
            toast('Konto gelöscht');
          } catch (e) {
            setError(authErrorMessage(e));
          }
        }}
        onClose={() => setConfirmDel(false)}
      />
    </>
  );
}

function ChangePasswordSheet({ onClose }: { onClose: () => void }) {
  const auth = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const c = checkPassword(pw, { email: auth.user?.email });
    if (!c.ok) return setError(c.message);
    if (pw !== pw2) return setError('Die Passwörter stimmen nicht überein.');
    setBusy(true);
    try {
      await auth.updatePassword(pw);
      toast('Passwort geändert');
      onClose();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open title="Passwort ändern" onClose={onClose} right={<button className="nav-btn bold" onClick={save} disabled={busy}>Sichern</button>}>
      <div className="group">
        <PasswordField id="pw-new" label="Neues Passwort" value={pw} onChange={setPw} autoComplete="new-password" email={auth.user?.email} meter />
        <PasswordField id="pw-new2" label="Wiederholen" value={pw2} onChange={setPw2} autoComplete="new-password" />
      </div>
      {error && <div className="error-text">{error}</div>}
    </Sheet>
  );
}
