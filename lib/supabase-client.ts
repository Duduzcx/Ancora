import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { Preferences } from '@capacitor/preferences'

// Sessão salva no armazenamento nativo do aparelho (Capacitor Preferences).
// Antes o app usava @supabase/ssr, que guarda a sessão em cookies do WebView —
// no Android esses cookies podem se perder ao fechar o app, e a pessoa precisava
// entrar de novo toda vez. Agora o login fica salvo até a pessoa tocar em "Sair".
const capacitorStorage = {
  getItem: async (key: string) => {
    if (typeof window === 'undefined') return null;
    const { value } = await Preferences.get({ key });
    return value;
  },
  setItem: async (key: string, value: string) => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key: string) => {
    await Preferences.remove({ key });
  },
};

// Durante o build (pré-renderização) não existe aparelho nem armazenamento.
const isBrowser = typeof window !== 'undefined';

let client: SupabaseClient | null = null;

export const createClient = (): SupabaseClient => {
  if (!client) {
    client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          storage: capacitorStorage,
          storageKey: 'norica-auth',
          persistSession: isBrowser,
          autoRefreshToken: isBrowser,
          // O retorno do login (Google, e-mail) é tratado manualmente com exchangeCodeForSession.
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      }
    )
  }
  return client;
}

export const supabase = createClient();

// Lê a sessão salva no aparelho sem passar pela rede. Serve só para abrir o app
// na hora (mostrar a Início e o nome); o Supabase confirma/renova o login logo depois.
export async function peekStoredSession(): Promise<any | null> {
  if (!isBrowser) return null;
  try {
    const raw = await capacitorStorage.getItem('norica-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user && parsed?.refresh_token ? parsed : null;
  } catch (_e) {
    return null;
  }
}
