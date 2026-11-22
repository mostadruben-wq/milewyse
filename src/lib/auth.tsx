/**
 * Konto (optional) über Supabase Auth, Serverstandort EU.
 * Es werden NUR Kontodaten (E-Mail, Name) beim Anbieter gespeichert – Fahrzeugdaten und Belege bleiben auf dem Gerät.
 * Der „anon key“ ist ein öffentlicher Schlüssel (kein Geheimnis); der Zugriff wird serverseitig über Richtlinien abgesichert.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
// Schalter: Konto erst sichtbar, wenn VITE_AUTH_ENABLED=true (GitHub-Variable AUTH_ENABLED)
const ENABLED = (import.meta.env.VITE_AUTH_ENABLED as string | undefined)?.trim() === 'true';
export const authConfigured = ENABLED && !!(URL && KEY);

let clientPromise: Promise<SupabaseClient> | null = null;
export function getClient(): Promise<SupabaseClient> {
  if (!authConfigured) return Promise.reject(new Error('Anmeldedienst nicht eingerichtet'));
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(URL!, KEY!, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'milewyse-auth' }
      })
    );
  }
  return clientPromise;
}

/** Rücksprungadresse nach Bestätigung, Passwort-Reset und Apple/Google – funktioniert auch im Unterordner (GitHub Pages). */
export const redirectUrl = () => window.location.origin + window.location.pathname;

export type Provider = 'apple' | 'google';

export interface AuthState {
  configured: boolean;
  ready: boolean;
  session: Session | null;
  user: User | null;
  /** true nach Klick auf den Link „Passwort zurücksetzen“ – dann neues Passwort setzen */
  recovery: boolean;
  clearRecovery: () => void;
  signUp: (email: string, password: string, name: string) => Promise<{ needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWith: (p: Provider) => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateName: (name: string) => Promise<void>;
  signOut: (everywhere?: boolean) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!authConfigured);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!authConfigured) return;
    let unsub: (() => void) | undefined;
    getClient()
      .then(async (c) => {
        const { data } = await c.auth.getSession();
        setSession(data.session);
        const { data: sub } = c.auth.onAuthStateChange((event, s) => {
          setSession(s);
          if (event === 'PASSWORD_RECOVERY') setRecovery(true);
        });
        unsub = () => sub.subscription.unsubscribe();
        // Rücksprung-Parameter aus der Adresszeile entfernen (Code nicht im Verlauf lassen)
        if (/[?&](code|error)=/.test(window.location.search) || /access_token|error_description/.test(window.location.hash)) {
          window.history.replaceState(null, '', redirectUrl());
        }
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
    return () => unsub?.();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      configured: authConfigured,
      ready,
      session,
      user: session?.user ?? null,
      recovery,
      clearRecovery: () => setRecovery(false),
      signUp: async (email, password, name) => {
        const c = await getClient();
        const { data, error } = await c.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectUrl(), data: { name: name.trim() } } });
        if (error) throw error;
        return { needsConfirmation: !data.session };
      },
      signIn: async (email, password) => {
        const c = await getClient();
        const { error } = await c.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      },
      signInWith: async (provider) => {
        const c = await getClient();
        const { error } = await c.auth.signInWithOAuth({ provider, options: { redirectTo: redirectUrl(), scopes: provider === 'apple' ? 'name email' : undefined } });
        if (error) throw error;
      },
      sendReset: async (email) => {
        const c = await getClient();
        const { error } = await c.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl() });
        if (error) throw error;
      },
      resendConfirmation: async (email) => {
        const c = await getClient();
        const { error } = await c.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirectUrl() } });
        if (error) throw error;
      },
      updatePassword: async (password) => {
        const c = await getClient();
        const { error } = await c.auth.updateUser({ password });
        if (error) throw error;
      },
      updateName: async (name) => {
        const c = await getClient();
        const { error } = await c.auth.updateUser({ data: { name: name.trim() } });
        if (error) throw error;
      },
      signOut: async (everywhere = false) => {
        const c = await getClient();
        await c.auth.signOut({ scope: everywhere ? 'global' : 'local' });
      },
      deleteAccount: async () => {
        const c = await getClient();
        // Serverseitige Funktion löscht ausschließlich das eigene Konto (siehe docs/supabase-setup.sql)
        const { error } = await c.rpc('delete_own_account');
        if (error) throw error;
        await c.auth.signOut({ scope: 'local' });
      }
    }),
    [ready, session, recovery]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const a = useContext(Ctx);
  if (!a) throw new Error('AuthProvider fehlt');
  return a;
}

export const displayName = (u: User | null) => (u?.user_metadata?.name as string | undefined)?.trim() || (u?.user_metadata?.full_name as string | undefined) || u?.email || '';
