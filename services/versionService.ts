/**
 * Service de détection et mise à jour automatique et silencieuse depuis Vercel.
 * Maintient l'application à jour en arrière-plan sans interrompre ni déconnecter l'utilisateur.
 * Optimisé pour ne jamais bloquer ni ralentir l'application ou la saisie sur le terrain.
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
  private lastCheckTime = 0;
  private swRegistration: ServiceWorkerRegistration | null = null;
  private appStartTime = Date.now();
  private readonly MIN_CHECK_INTERVAL_MS = 120_000; // Au maximum une vérification toutes les 2 minutes

  constructor() {
    this.currentBuildId = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev';
  }

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

    // 2. Première vérification après un délai de démarrage tranquille (5s) pour ne pas encombrer le boot
    setTimeout(() => {
      this.checkAndUpdate();
    }, 5000);

    // 3. Vérification périodique toutes les 10 minutes
    if (this.checkIntervalId) clearInterval(this.checkIntervalId);
    this.checkIntervalId = setInterval(() => {
      this.checkAndUpdate();
    }, 10 * 60 * 1000);

    // 4. Écouter le masquage / retour d'onglet UNIQUEMENT (Pas de window.focus pour ne pas réagir aux inputs de formulaires)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        this.checkAndUpdate();
      } else if (document.visibilityState === 'hidden' && this.pendingUpdate) {
        // L'utilisateur quitte l'application ou verrouille son téléphone :
        // Moment propice pour rafraîchir en tâche de fond de façon transparente
        this.executeSilentReload();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 5. Écouter les diffusions de mise à jour forcée (via Supabase / admin)
    try {
      const bc = new BroadcastChannel('dps65_config_channel');
      bc.onmessage = (e) => {
        if (e.data?.type === 'UPDATE_CONFIG') {
          this.checkAndUpdate(true);
        }
      };
    } catch (e) {
      // BroadcastChannel indisponible
    }
  }

  private initServiceWorkerWatcher(): void {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.getRegistration()
      .then((reg) => {
        if (!reg) return;
        this.swRegistration = reg;

        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          this.pendingUpdate = true;
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.pendingUpdate = true;
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('[VersionService] Erreur récupération SW:', err);
      });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      this.pendingUpdate = true;
    });
  }

  /**
   * Interroge Vercel pour récupérer les informations de la dernière version déployée
   */
  public async fetchRemoteVersion(): Promise<VersionInfo | null> {
    try {
      const timestamp = Date.now();
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
    } catch (err) {
      // Hors-ligne ou réseau mobile instable : ignore silencieusement
    }
    return null;
  }

  /**
   * Vérifie si une nouvelle version existe sur Vercel et déclenche la mise à jour silencieuse
   */
  public async checkAndUpdate(force: boolean = false): Promise<boolean> {
    if (this.isChecking) return false;

    const now = Date.now();
    if (!force && (now - this.lastCheckTime < this.MIN_CHECK_INTERVAL_MS)) {
      return false; // Évite les requêtes rapprochées
    }

    this.isChecking = true;
    this.lastCheckTime = now;

    try {
      // Tâche de fond Service Worker
      if (this.swRegistration) {
        this.swRegistration.update().catch(() => {});
      }

      const remote = await this.fetchRemoteVersion();
      if (!remote) {
        return false;
      }

      // En mode développement local ou initial, pas de rechargement intempestif
      if (
        this.currentBuildId === 'dev' || 
        remote.buildId === 'dev' || 
        remote.buildId === 'initial' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
      ) {
        return false;
      }

      // Version distante différente de la version locale
      if (remote.buildId !== this.currentBuildId) {
        this.pendingUpdate = true;

        if (this.swRegistration?.waiting) {
          this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        this.handleUpdateAvailable(remote.buildId);
        return true;
      }
    } catch (e) {
      // Jamais d'erreur bloquante
    } finally {
      this.isChecking = false;
    }

    return false;
  }

  /**
   * Traite la disponibilité d'une mise à jour de manière invisible
   */
  private handleUpdateAvailable(newBuildId?: string): void {
    // Si l'utilisateur est hors de l'onglet, recharger discrètement
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.executeSilentReload(newBuildId);
      return;
    }

    // Si un champ de formulaire est actif ou si l'utilisateur est sur la page depuis longtemps,
    // on NE recharge JAMAIS directement pour ne pas interrompre la saisie.
    // La mise à jour s'appliquera dès la fermeture ou mise en veille de l'écran.
  }

  private executeSilentReload(targetBuildId?: string): void {
    if (targetBuildId) {
      const lastReload = sessionStorage.getItem('dps65_reloaded_build');
      if (lastReload === targetBuildId) {
        return;
      }
      sessionStorage.setItem('dps65_reloaded_build', targetBuildId);
    }

    try {
      window.location.reload();
    } catch (e) {
      window.location.href = window.location.href;
    }
  }
}

export const versionService = new VersionService();
