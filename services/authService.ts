
import { UserProfile, UserRole, AppConfig } from '../types';
import { initDB } from './db';
import { generateUUID } from '../utils/security';
import { syncService } from './syncService';
import { supabase, isLive, signUpWithoutChangingSession } from './supabaseClient';
import { adminService } from './features/adminService';

const SESSION_KEY = 'dps65_active_user_id';
const ADMIN_EMAIL = 'dps65.asso@gmail.com';

export const authService = {
  // Récupère la session active (locale ou distante)
  getSession: async () => {
    // Auto-login inside AI Studio preview if no session exists to bypass the login screen
    const isAiStudioPreview = typeof window !== 'undefined' && 
      (window.location.hostname.includes('europe-west2.run.app') || 
       window.location.hostname.includes('aistudio.google.com') ||
       window.location.search.includes('preview=true'));

    if (isAiStudioPreview) {
        const storedId = localStorage.getItem(SESSION_KEY);
        if (!storedId) {
            try {
                const db = await initDB();
                const previewAdminId = 'preview-admin-uid-dps65';
                let profile = await db.get('profiles', previewAdminId);
                if (!profile) {
                    profile = {
                        id: previewAdminId,
                        email: 'dps65.asso@gmail.com',
                        firstName: 'Admin',
                        lastName: 'AI Studio',
                        role: 'admin',
                        diplomas: [],
                        points: 100
                    };
                    await db.put('profiles', profile);
                }
                localStorage.setItem(SESSION_KEY, previewAdminId);
                return { user: { id: previewAdminId, role: 'admin' }, profile };
            } catch (err) {
                console.error("Failed to auto-login preview admin:", err);
            }
        }
    }

    // 1. Priorité au stockage local pour un chargement instantané (très important pour la fenêtre TV)
    const storedId = localStorage.getItem(SESSION_KEY);
    
    if (storedId) {
        try {
            // On essaie de récupérer le profil localement
            const db = await initDB();
            const profile = await db.get('profiles', storedId);
            if (profile) {
                return { user: { id: profile.id, role: profile.role }, profile };
            }
        } catch (e) {
            console.warn("Local profile load failed, trying Supabase...", e);
        }
    }

    // 2. Fallback Supabase (si en ligne et pas de session locale valide)
    if (isLive) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const db = await initDB();
                const profile = await db.get('profiles', session.user.id);
                if (profile) {
                    localStorage.setItem(SESSION_KEY, profile.id);
                    return { user: session.user, profile };
                }
            }
        } catch (e) {
            console.error("Supabase session error", e);
        }
    }
    
    return { user: null, profile: null };
  },

  getProfiles: async (): Promise<UserProfile[]> => {
      const db = await initDB();
      return await db.getAll('profiles');
  },

  updateProfile: async (userId: string, updates: Partial<UserProfile>) => {
      const db = await initDB();
      const current = await db.get('profiles', userId);
      if (current) {
          const updatedProfile = { ...current, ...updates };
          
          delete (updatedProfile as any).password;

          const tx = db.transaction(['profiles', 'sync_queue'], 'readwrite');
          await tx.objectStore('profiles').put(updatedProfile);
          
          if (isLive) {
              await tx.objectStore('sync_queue').put({
                  id: generateUUID(),
                  table: 'profiles',
                  action: 'UPSERT',
                  data: updatedProfile,
                  timestamp: Date.now(),
                  status: 'PENDING',
                  retries: 0
              });
          }
          
          await tx.done;
          if (isLive) syncService.processQueue();
      }
  },

  adminCreateUser: async (email: string, password: string, firstName: string, lastName: string, role: UserRole) => {
      const user = await signUpWithoutChangingSession(email, password, firstName, lastName, role);
      
      const newProfile: UserProfile = {
          id: user.id,
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role: role,
          diplomas: [],
          points: 0
      };
      
      const db = await initDB();
      const tx = db.transaction(['profiles', 'sync_queue'], 'readwrite');
      await tx.objectStore('profiles').put(newProfile);
      
      if (isLive) {
          await tx.objectStore('sync_queue').put({
              id: generateUUID(),
              table: 'profiles',
              action: 'UPSERT',
              data: newProfile,
              timestamp: Date.now(),
              status: 'PENDING',
              retries: 0
          });
      }
      
      await tx.done;
      if (isLive) syncService.processQueue();
      
      return newProfile;
  },

  register: async (email: string, password: string, firstName: string, lastName: string, requestedRole: UserRole, accessCode: string) => {
      if (!isLive) {
          throw new Error("L'inscription nécessite une connexion internet active. En mode hors ligne, seule la connexion à un compte existant est autorisée.");
      }

      let currentSignupCode = '';
      try {
          const { data, error } = await supabase
              .from('config')
              .select('signupCode')
              .eq('id', 'main')
              .single();
          if (!error && data) currentSignupCode = data.signupCode;
      } catch (e) {}

      if (!currentSignupCode) {
          const config = await adminService.getConfig();
          currentSignupCode = config.signupCode || '';
      }

      const providedCode = accessCode.trim().toUpperCase();
      const validCode = currentSignupCode.trim().toUpperCase();

      if (validCode && providedCode !== validCode) {
          throw new Error("Code d'accès invalide.");
      }

      let finalRole = requestedRole;
      if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          finalRole = 'admin';
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
              data: {
                  firstName: firstName.trim(),
                  lastName: lastName.trim(),
                  role: finalRole
              }
          }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Erreur création utilisateur.");

      const newProfile: UserProfile = {
          id: authData.user.id,
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role: finalRole,
          diplomas: [],
          points: 0
      };
      
      const db = await initDB();
      const tx = db.transaction(['profiles', 'sync_queue'], 'readwrite');
      await tx.objectStore('profiles').put(newProfile);
      
      await tx.objectStore('sync_queue').put({
          id: generateUUID(),
          table: 'profiles',
          action: 'UPSERT',
          data: newProfile,
          timestamp: Date.now(),
          status: 'PENDING',
          retries: 0
      });
      
      await tx.done;
      
      localStorage.setItem(SESSION_KEY, newProfile.id);
      syncService.processQueue();
      
      return newProfile;
  },

  login: async (email: string, password: string) => {
      if (isLive) {
          const { data, error } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password: password
          });

          if (error) throw error;
          if (!data.user) throw new Error("Erreur d'authentification.");

          const db = await initDB();
          let profile = await db.get('profiles', data.user.id);

          if (!profile) {
              const { data: remoteProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();
              
              if (remoteProfile) {
                  profile = remoteProfile;
                  await db.put('profiles', profile!);
              }
          }

          if (profile) {
              localStorage.setItem(SESSION_KEY, profile.id);
              return profile;
          }
          throw new Error("Profil introuvable.");
      } else {
          const db = await initDB();
          const all = await db.getAll('profiles');
          const user = all.find(p => p.email.toLowerCase() === email.toLowerCase().trim());

          if (!user) throw new Error("Utilisateur inconnu localement.");
          localStorage.setItem(SESSION_KEY, user.id);
          return user;
      }
  },

  loginAsOrganizer: async (code: string) => {
      const db = await initDB();
      let event: any = null;

      // 1. Si en ligne, on cherche d'abord l'événement via RPC dans Supabase pour s'assurer d'avoir les infos à jour
      if (isLive) {
          try {
              const { data, error } = await supabase.rpc('get_event_by_organizer_code', { code_param: code });
              if (error) {
                  console.warn("RPC get_event_by_organizer_code failed, trying local fallback check:", error);
              } else if (data && data.length > 0) {
                  event = data[0];
              }
          } catch (rpcErr) {
              console.error("RPC call failed:", rpcErr);
          }
      }

      // Si hors ligne ou échec RPC, fallback sur la base IndexedDB locale
      if (!event) {
          const events = await db.getAll('events');
          event = events.find(e => e.organizer_code && e.organizer_code.trim().toUpperCase() === code.trim().toUpperCase());
      }

      if (!event) {
          throw new Error("Code organisateur invalide ou aucun événement actif trouvé avec ce code.");
      }

      const ORGANIZER_EMAIL = `organizer-${event.id}@dps65.fr`.toLowerCase();
      // Le mot de passe doit faire au moins 6 caractères, on garantit cela avec un préfixe unique et le code
      const ORGANIZER_PWD = `dps65-org-${code.trim().toUpperCase()}`;
      
      let finalProfile: any = null;

      // 2. Si en ligne, on authentifie l'organisateur dans Supabase Auth
      if (isLive) {
          try {
              // On essaie d'abord de se connecter
              const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                  email: ORGANIZER_EMAIL,
                  password: ORGANIZER_PWD
              });

              if (signInError) {
                  // Si l'utilisateur n'existe pas encore (premier login pour cet événement), on le crée
                  if (signInError.message.includes("Invalid login credentials") || signInError.status === 400) {
                      console.log("Compte organisateur inexistant, création automatique en cours...");
                      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                          email: ORGANIZER_EMAIL,
                          password: ORGANIZER_PWD,
                          options: {
                              data: {
                                  firstName: 'Organisateur',
                                  lastName: event.name,
                                  role: 'organisateur'
                              }
                          }
                      });

                      if (signUpError) throw signUpError;
                      if (signUpData.user) {
                          const userId = signUpData.user.id;
                          // On attend 1,5 seconde que le trigger Supabase insère le profil associé
                          await new Promise(resolve => setTimeout(resolve, 1500));

                          // On récupère le profil
                          const { data: profileData } = await supabase
                              .from('profiles')
                              .select('*')
                              .eq('id', userId)
                              .single();

                          if (profileData) {
                              finalProfile = profileData;
                              await db.put('profiles', finalProfile);
                          }
                      }
                  } else {
                      throw signInError;
                  }
              } else if (signInData.user) {
                  const userId = signInData.user.id;
                  const { data: profileData } = await supabase
                      .from('profiles')
                      .select('*')
                      .eq('id', userId)
                      .single();

                  if (profileData) {
                      finalProfile = profileData;
                      await db.put('profiles', finalProfile);
                  }
              }
          } catch (liveAuthErr) {
              console.error("Échec authentification Supabase pour l'organisateur, utilisation du mode déconnecté:", liveAuthErr);
          }
      }

      // 3. Fallback hors ligne ou si l'authentification en ligne a échoué
      if (!finalProfile) {
          const ORGANIZER_ID = `organizer-${event.id}`;
          let profile = await db.get('profiles', ORGANIZER_ID);

          if (!profile) {
              profile = {
                  id: ORGANIZER_ID,
                  email: ORGANIZER_EMAIL,
                  firstName: 'Organisateur',
                  lastName: event.name,
                  role: 'organisateur',
                  diplomas: [],
                  points: 0
              };
              await db.put('profiles', profile);
          }
          finalProfile = profile;
      }

      localStorage.setItem(SESSION_KEY, finalProfile.id);
      return finalProfile;
  },

  logout: async () => {
      if (isLive) await supabase.auth.signOut();
      localStorage.removeItem(SESSION_KEY);
  },

  deleteAccount: async (userId: string) => { 
      const db = await initDB();
      const tx = db.transaction(['profiles', 'sync_queue'], 'readwrite');
      await tx.objectStore('profiles').delete(userId);
      
      if (isLive) {
          await tx.objectStore('sync_queue').put({
              id: generateUUID(),
              table: 'profiles',
              action: 'DELETE',
              data: { id: userId },
              timestamp: Date.now(),
              status: 'PENDING',
              retries: 0
          });
      }
      
      await tx.done;
      if (localStorage.getItem(SESSION_KEY) === userId) {
          localStorage.removeItem(SESSION_KEY);
      }
      if (isLive) syncService.processQueue();
  },

  sendPasswordResetEmail: async (email: string) => { 
      if (!isLive) return true;
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      return true;
  }
};
