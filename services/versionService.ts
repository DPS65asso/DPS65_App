/**
 * Service de détection et mise à jour automatique et silencieuse depuis Vercel.
 * Maintient l'application à jour en arrière-plan sans interrompre ni déconnecter l'utilisateur.
 */

declare const __APP_BUILD_ID__: string | undefined;

interface VersionInfo {
  buildId: string;
  builtAt?: string;
}

class VersionService {
  private currentBuildId: string;
  private pendingUpdate = false;
  private checkIntervalId: any = null;
  private isChecking = false;
  private swRegistration: ServiceWorkerRegistration | null = null;
  private appStartTime = Date.now();

  constructor() {
    // ID de build injecté à la compilation Vite ou timestamp initial
    this.currentBuildId = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev';
  }

  /**
   * Retourne l'identifiant de la version locale actuellement exécutée
   */
  public getCurrentBuildId(): string {
    return this.currentBuildId;
  }

  /**
   * Initialise le suivi silencieux des mises à jour Vercel
   */
  public initSilentAutoUpdate(): void {
    if (typeof window === 'undefined') return;

    // 1. Initialiser la surveillance du Service Worker
    this.initServiceWorkerWatcher();

    // 2. Première vérification immédiate puis à +3 secondes (fin d'hydratation)
    this.checkAndUpdate();
    setTimeout(() => {
      this.checkAndUpdate();
    }, 3000);

    // 3. Vérification périodique toutes les 5 minutes
    if (this.checkIntervalId) clearInterval(this.checkIntervalId);
    this.checkIntervalId = setInterval(() => {
      this.checkAndUpdate();
    }, 5 * 60 * 1000);

    // 4. Vérification lors du retour au premier plan ou focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        this.checkAndUpdate();
      } else if (document.visibilityState === 'hidden' && this.pendingUpdate) {
        // L'utilisateur quitte l'onglet ou verrouille son téléphone :
        // Moment idéal pour rafraîchir silencieusement l'application !
        this.executeSilentReload();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', () => this.checkAndUpdate());
    window.addEventListener('online', () => this.checkAndUpdate());

    // 5. Écouter les diffusions de mise à jour forcée (via Supabase / admin)
    try {
      const bc = new BroadcastChannel('dps65_config_channel');
      bc.onmessage = (e) => {
        if (e.data?.type === 'UPDATE_CONFIG') {
          this.checkAndUpdate();
        }
      };
    } catch (e) {
      // BroadcastChannel indisponible
    }
  }

  /**
   * Surveille le Service Worker et force l'activation sans attente
   */
  private initServiceWorkerWatcher(): void {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.getRegistration()
      .then((reg) => {
        if (!reg) return;
        this.swRegistration = reg;

        // Si un SW est déjà en attente, lui demander de s'activer
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          this.pendingUpdate = true;
        }

        // Si une nouvelle version du SW est détectée
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // Nouveau contenu disponible en cache
                  this.pendingUpdate = true;
                  this.handleUpdateAvailable();
                }
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('[VersionService] Erreur récupération SW:', err);
      });

    // Quand le nouveau SW prend le contrôle, appliquer silencieusement si approprié
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      this.pendingUpdate = true;
      this.handleUpdateAvailable();
    });
  }

  /**
   * Interroge Vercel pour récupérer les informations de la dernière version déployée
   */
  public async fetchRemoteVersion(): Promise<VersionInfo | null> {
    try {
      const timestamp = Date.now();
      
      // 1. Essai prioritaire sur le manifest de version
      const res = await fetch(`/version.json?_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.buildId) {
          return {
            buildId: String(data.buildId),
            builtAt: data.builtAt
          };
        }
      }

      // 2. Fallback : interrogation directe de la racine HTML sur Vercel
      // On inspecte les hashes d'assets ou les en-têtes Vercel
      const htmlRes = await fetch(`/?_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (htmlRes.ok) {
        const vercelId = htmlRes.headers.get('x-vercel-id');
        const etag = htmlRes.headers.get('etag');
        const text = await htmlRes.text();
        
        // Trouver le hash du bundle principal /assets/index-*.js
        const match = text.match(/\/assets\/index-([a-zA-Z0-9_-]+)\.js/);
        const scriptHash = match ? match[1] : (vercelId || etag);

        if (scriptHash) {
          return {
            buildId: scriptHash
          };
        }
      }
    } catch (err) {
      // Échec réseau (hors-ligne ou réseau instable sur le terrain) : on ignore silencieusement
    }
    return null;
  }

  /**
   * Vérifie si une nouvelle version existe sur Vercel et déclenche la mise à jour silencieuse
   */
  public async checkAndUpdate(): Promise<boolean> {
    if (this.isChecking) return false;
    this.isChecking = true;

    try {
      // 1. Déclencher la mise à jour du Service Worker en tâche de fond
      if (this.swRegistration) {
        this.swRegistration.update().catch(() => {});
      }

      // 2. Interroger Vercel
      const remote = await this.fetchRemoteVersion();
      if (!remote) {
        this.isChecking = false;
        return false;
      }

      // En mode dev ('dev'), ne pas forcer de mise à jour intempestive
      if (this.currentBuildId === 'dev' || remote.buildId === 'dev') {
        this.isChecking = false;
        return false;
      }

      // Vérifier si la version distante diffère de la version locale
      if (remote.buildId !== this.currentBuildId) {
        console.log(`[VersionService] Nouvelle version Vercel détectée: ${remote.buildId} (actuel: ${this.currentBuildId})`);
        this.pendingUpdate = true;

        // Prévenir le Service Worker d'activer immédiatement le nouveau cache
        if (this.swRegistration?.waiting) {
          this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        this.handleUpdateAvailable(remote.buildId);
        this.isChecking = false;
        return true;
      }
    } catch (e) {
      // Ne jamais bloquer l'app en cas d'erreur de vérification
    } finally {
      this.isChecking = false;
    }

    return false;
  }

  /**
   * Traite la disponibilité d'une mise à jour de manière invisible
   */
  private handleUpdateAvailable(newBuildId?: string): void {
    // Si l'utilisateur est inactif ou si l'onglet est masqué, recharger tout de suite
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.executeSilentReload(newBuildId);
      return;
    }

    // Si l'application vient juste de démarrer (moins de 2.5 secondes) et qu'aucun
    // formulaire n'est en cours de saisie, synchroniser immédiatement
    const timeSinceStart = Date.now() - this.appStartTime;
    const isFormFocused = typeof document !== 'undefined' && !!document.querySelector('input:focus, textarea:focus, select:focus');
    const alreadyReloadedForBuild = newBuildId && sessionStorage.getItem('dps65_reloaded_build') === newBuildId;

    if (timeSinceStart < 2500 && !isFormFocused && !alreadyReloadedForBuild) {
      this.executeSilentReload(newBuildId);
      return;
    }

    // Sinon, l'utilisateur est activement sur l'écran :
    // On attend le premier masquage de l'onglet (fermeture, bascule d'app, extinction d'écran)
    // pour effectuer la mise à jour de façon 100% invisible sans perte de saisie.
  }

  /**
   * Recharge silencieusement la page vers la dernière version Vercel
   */
  private executeSilentReload(targetBuildId?: string): void {
    if (targetBuildId) {
      const lastReload = sessionStorage.getItem('dps65_reloaded_build');
      if (lastReload === targetBuildId) {
        // Empêcher toute boucle de rafraîchissement
        return;
      }
      sessionStorage.setItem('dps65_reloaded_build', targetBuildId);
    }

    try {
      // Rechargement silencieux
      window.location.reload();
    } catch (e) {
      window.location.href = window.location.href;
    }
  }
}

export const versionService = new VersionService();
