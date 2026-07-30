
import { UserProfile, UserRole, AppConfig } from '../types';
import { initDB } from './db';
import { generateUUID } from '../utils/security';
import { syncService } from './syncService';
import { supabase, isLive, signUpWithoutChangingSession } from './supabaseClient';
import { adminService } from './features/adminService';

const SESSION_KEY = 'dps65_active_user_id';
const SESSION_TIMESTAMP_KEY = 'dps65_session_login_time';
const SESSION_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 heures en millisecondes
const ADMIN_EMAIL = 'dps65.asso@gmail.com';

export const authService = {
  // Vérifie si la session actuelle est expirée (> 6h)
  isSessionExpired: (): boolean => {
      const storedId = localStorage.getItem(SESSION_KEY);
      if (!storedId) return false;
      const timestampStr = localStorage.getItem(SESSION_TIMESTAMP_KEY);
      if (!timestampStr) return false;
      const timestamp = parseInt(timestampStr, 10);
      if (isNaN(timestamp)) return false;
      return Date.now() - timestamp > SESSION_MAX_AGE_MS;
  },

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
                localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
                return { user: { id: previewAdminId, role: 'admin' }, profile };
            } catch (err) {
                console.error("Failed to auto-login preview admin:", err);
            }
        }
    }

    // 1. Priorité au stockage local pour un chargement instantané (très important pour la fenêtre TV)
    const storedId = localStorage.getItem(SESSION_KEY);
    
    if (storedId) {
        // Vérification de la durée de session (expiration à 6h)
        const timestampStr = localStorage.getItem(SESSION_TIMESTAMP_KEY);
        if (timestampStr) {
            const timestamp = parseInt(timestampStr, 10);
            if (!isNaN(timestamp) && (Date.now() - timestamp > SESSION_MAX_AGE_MS)) {
                console.warn("Session expirée (> 6 heures). Déconnexion automatique pour rechargement...");
                if (isLive) await supabase.auth.signOut();
                localStorage.removeItem(SESSION_KEY);
                localStorage.removeItem(SESSION_TIMESTAMP_KEY);
                localStorage.removeItem('dps65_organizer_code');
                return { user: null, profile: null };
            }
        } else {
            // Initialisation du horodatage pour une session préexistante
            localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
        }

        if (storedId.startsWith('temp-organizer-')) {
            const eventId = storedId.replace('temp-organizer-', '');
            
            // Reconnexion transparente à Supabase en tant qu'organisateur si en ligne
            if (isLive) {
                try {
                    const { data: { session: currentSession } } = await supabase.auth.getSession();
                    if (!currentSession?.user || currentSession.user.email !== 'organisateur@dps65.fr') {
                        console.log("Reconnexion transparente du compte générique organisateur...");
                        await supabase.auth.signInWithPassword({
                            email: 'organisateur@dps65.fr',
                            password: 'dps65-organisateur-secure'
                        });
                    }
                } catch (liveAuthErr) {
                    console.error("Échec reconnexion Supabase organisateur:", liveAuthErr);
                }
            }

            try {
                const db = await initDB();
                const event = await db.get('events', eventId);
                const profile = {
                    id: storedId,
                    email: `organizer-${eventId}@dps65.fr`.toLowerCase(),
                    firstName: 'Organisateur',
                    lastName: event ? event.name : 'Événement',
                    role: 'organisateur' as UserRole,
                    diplomas: [],
                    points: 0
                };
                return { user: { id: storedId, role: 'organisateur' }, profile };
            } catch (e) {
                console.warn("Failed to load organizer profile locally", e);
            }
        }
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
              .maybeSingle();
          if (!error && data && data.signupCode !== undefined && data.signupCode !== null) {
              currentSignupCode = data.signupCode;
          }
      } catch (e) {
          console.warn("Impossible de récupérer le code d'inscription depuis Supabase, repli sur IndexedDB local", e);
      }

      if (currentSignupCode === '') {
          const config = await adminService.getConfig();
          currentSignupCode = config.signupCode || '';
      }

      const providedCode = accessCode.trim().toUpperCase();
      const validCode = currentSignupCode.trim().toUpperCase();

      if (validCode && providedCode !== validCode) {
          throw new Error("Code d'accès invalide. Veuillez vérifier le code fourni par l'association.");
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
      localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
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
              localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
              return profile;
          }
          throw new Error("Profil introuvable.");
      } else {
          const db = await initDB();
          const all = await db.getAll('profiles');
          const user = all.find(p => p.email.toLowerCase() === email.toLowerCase().trim());

          if (!user) throw new Error("Utilisateur inconnu localement.");
          localStorage.setItem(SESSION_KEY, user.id);
          localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
          return user;
      }
  },

  loginAsOrganizer: async (code: string) => {
      const db = await initDB();
      let event: any = null;

      const cleanCode = code.trim().toUpperCase();

      // 1. Si en ligne, on cherche d'abord l'événement via RPC dans Supabase pour s'assurer d'avoir les infos à jour
      if (isLive) {
          try {
              const { data, error } = await supabase.rpc('get_event_by_organizer_code', { code_param: cleanCode });
              if (error) {
                  console.warn("RPC get_event_by_organizer_code failed, trying direct select:", error);
              } else if (data && data.length > 0) {
                  event = data[0];
              }
          } catch (rpcErr) {
              console.error("RPC call failed:", rpcErr);
          }

          // Fallback direct select si RPC ne renvoie rien mais qu'on est connecté
          if (!event) {
              try {
                  const { data, error } = await supabase
                      .from('events')
                      .select('*')
                      .eq('organizer_code', cleanCode);
                  if (!error && data && data.length > 0) {
                      event = data[0];
                  }
              } catch (selectErr) {
                  console.error("Direct select failed:", selectErr);
              }
          }
      }

      // Si hors ligne ou échec de récupération en ligne, fallback sur la base IndexedDB locale
      if (!event) {
          const events = await db.getAll('events');
          event = events.find(e => e.organizer_code && e.organizer_code.trim().toUpperCase() === cleanCode);
      }

      if (!event) {
          throw new Error("Code organisateur invalide ou aucun événement actif trouvé avec ce code.");
      }

      // 2. Si en ligne, on se connecte avec le compte générique unique pour les organisateurs (évite la création de comptes multiples)
      if (isLive) {
          const GUEST_EMAIL = 'organisateur@dps65.fr';
          const GUEST_PWD = 'dps65-organisateur-secure';
          try {
              const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                  email: GUEST_EMAIL,
                  password: GUEST_PWD
              });

              if (signInError) {
                  // Si le compte générique n'existe pas encore sur cette instance, on le crée de façon transparente
                  if (signInError.message.includes("Invalid login credentials") || signInError.status === 400) {
                      console.log("Compte générique organisateur inexistant, création en cours...");
                      const { error: signUpError } = await supabase.auth.signUp({
                          email: GUEST_EMAIL,
                          password: GUEST_PWD,
                          options: {
                              data: {
                                  firstName: 'Organisateur',
                                  lastName: 'Générique',
                                  role: 'organisateur'
                              }
                          }
                      });
                      if (!signUpError) {
                          // Connexion immédiate après création
                          await supabase.auth.signInWithPassword({
                              email: GUEST_EMAIL,
                              password: GUEST_PWD
                          });
                      }
                  }
              }
          } catch (liveAuthErr) {
              console.error("Échec authentification Supabase pour le compte générique organisateur:", liveAuthErr);
          }
      }

      // 3. Stockage de la session virtuelle locale spécifique à cet événement
      const ORGANIZER_ID = `temp-organizer-${event.id}`;
      localStorage.setItem(SESSION_KEY, ORGANIZER_ID);
      localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
      localStorage.setItem('dps65_organizer_code', cleanCode);

      // On sauvegarde l'événement localement pour l'affichage immédiat
      await db.put('events', event);

      // On déclenche une synchronisation des données pour cet événement si en ligne
      if (isLive) {
          try {
              // Import dynamique pour éviter une dépendance circulaire au démarrage
              const { syncService } = await import('./syncService');
              await syncService.pullOrganizerData();
          } catch (syncErr) {
              console.warn("Pulling data after organizer login failed, using local cache:", syncErr);
          }
      }

      const finalProfile = {
          id: ORGANIZER_ID,
          email: `organizer-${event.id}@dps65.fr`.toLowerCase(),
          firstName: 'Organisateur',
          lastName: event.name,
          role: 'organisateur' as UserRole,
          diplomas: [],
          points: 0
      };

      return finalProfile;
  },

  logout: async () => {
      if (isLive) await supabase.auth.signOut();
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_TIMESTAMP_KEY);
      localStorage.removeItem('dps65_organizer_code');
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
          localStorage.removeItem(SESSION_TIMESTAMP_KEY);
      }
      if (isLive) syncService.processQueue();
  },

  sendPasswordResetEmail: async (email: string) => { 
      if (!isLive) return true;
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      return true;
  },

  changePassword: async (password: string) => {
      if (!isLive) {
          throw new Error("Le changement de mot de passe nécessite une connexion active.");
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      return true;
  }
};
