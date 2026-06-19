
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Fonction helper pour récupérer les variables d'environnement de manière sûre (Vite vs Node)
const getEnvVar = (key: string) => {
    // 1. Vite import.meta.env
    if ((import.meta as any).env?.[key]) {
        return (import.meta as any).env[key];
    }
    // 2. Fallback process.env (si polyfillé ou environnement Node)
    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env?.[key]) {
            // @ts-ignore
            return process.env[key];
        }
    } catch (e) {
        // Ignore errors accessing process
    }
    return '';
};

export const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
export const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

let client: SupabaseClient;
export let isLive = false; // Indicateur public : est-ce qu'on est connecté au vrai cloud ?

// Initialisation conditionnelle
if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'undefined' && supabaseUrl.startsWith('http')) {
    try {
        client = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
            },
            realtime: {
                params: {
                    eventsPerSecond: 10,
                },
            },
        });
        isLive = true;
    } catch (e) {
        console.error("Supabase init error:", e);
        isLive = false;
    }
} 

// Fonction pour inscrire un utilisateur sans modifier la session active (pour l'admin)
export const signUpWithoutChangingSession = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: string
) => {
    if (!isLive || !supabaseUrl || !supabaseAnonKey) {
        throw new Error("L'inscription nécessite une connexion internet active et une configuration Supabase.");
    }
    const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        }
    });
    const { data, error } = await tempClient.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
            data: {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                role: role
            }
        }
    });
    if (error) throw error;
    if (!data.user) throw new Error("Erreur de création de l'utilisateur d'authentification.");
    return data.user;
};

// Mock (Mode Hors Ligne forcé ou Fallback si erreur init)
if (!isLive || !client!) {
    if (!supabaseUrl) console.warn("⚠️ Supabase credentials missing. App running in Offline Mode.");
    
    client = {
        channel: () => ({
            on: () => ({
                subscribe: (callback: any) => { if(callback) callback('CLOSED'); return { unsubscribe: () => {} }; }
            }),
            subscribe: () => {}
        }),
        removeAllChannels: () => Promise.resolve([]),
        from: () => ({
            select: () => Promise.resolve({ data: null, error: { message: 'Mode Hors Ligne (Mock)' } }),
            insert: () => Promise.resolve({ data: null, error: { message: 'Mode Hors Ligne (Mock)' } }),
            upsert: () => Promise.resolve({ data: null, error: { message: 'Mode Hors Ligne (Mock)' } }),
            delete: () => Promise.resolve({ data: null, error: { message: 'Mode Hors Ligne (Mock)' } }),
        }),
        auth: {
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            getSession: () => Promise.resolve({ data: { session: null }, error: null }),
            signOut: () => Promise.resolve({ error: null }),
            // Mock des autres méthodes auth si nécessaire
        },
        // Mock storage si nécessaire
        storage: {
            from: () => ({
                upload: () => Promise.resolve({ data: null, error: { message: 'Offline' } }),
                getPublicUrl: () => ({ data: { publicUrl: '' } })
            })
        }
    } as unknown as SupabaseClient;
}

export const supabase = client;

// Fonction de diagnostic pour l'AdminPage
export const testConnection = async (): Promise<{ success: boolean; message: string; latency?: number }> => {
    if (!isLive) {
        return { success: false, message: "Mode Hors Ligne : Clés API manquantes ou invalides." };
    }

    const start = Date.now();
    try {
        // On essaie une requête très légère (HEAD) sur la table events
        const { count, error } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true });

        const latency = Date.now() - start;

        if (error) {
            // Si la table n'existe pas encore, c'est une erreur "utile" pour le diagnostic
            return { success: false, message: `Erreur API: ${error.message} (Code: ${error.code})`, latency };
        }

        return { success: true, message: `Connecté. Latence: ${latency}ms. (Events: ${count || 0})`, latency };
    } catch (e: any) {
        return { success: false, message: `Exception réseau: ${e.message}`, latency: 0 };
    }
};
