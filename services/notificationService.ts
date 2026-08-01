/**
 * Service centralisé pour le déclenchement et la gestion des notifications natives PWA.
 * Résout l'incompatibilité Android/Chrome où 'new Notification()' est strictement interdit.
 * Utilise 'ServiceWorkerRegistration.showNotification()' pour afficher les bandeaux sur Android, iOS et Desktop.
 */

export interface AppNotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  renotify?: boolean;
  vibrate?: number[];
  data?: any;
  silent?: boolean;
  url?: string;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'default') {
    return await Notification.requestPermission();
  }
  return Notification.permission;
}

export async function sendNativeNotification(title: string, options: AppNotificationOptions = {}) {
  if (!('Notification' in window)) return null;

  if (Notification.permission !== 'granted') {
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return null;
    } else {
      return null;
    }
  }

  const notificationOptions: NotificationOptions = {
    body: options.body || '',
    icon: options.icon || '/pwa-192x192.png',
    badge: options.badge || '/pwa-192x192.png',
    tag: options.tag || 'dps65-alert',
    requireInteraction: options.requireInteraction ?? false,
    renotify: options.renotify ?? true,
    silent: options.silent ?? false,
    data: {
      ...(options.data || {}),
      url: options.url || '/'
    },
    // @ts-ignore - vibration pattern pour Android
    vibrate: options.vibrate || [200, 100, 200, 100, 200, 100, 400]
  };

  // 1. Priorité : Passer par le Service Worker (Rendu universel, indispensable sur Android)
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(title, notificationOptions);
        return registration;
      }
    } catch (swErr) {
      console.warn("[NotificationService] Échec ServiceWorker showNotification, tentative fallback window:", swErr);
    }
  }

  // 2. Fallback pour navigateurs de bureau acceptant la syntaxe historique
  try {
    const notif = new Notification(title, notificationOptions);
    notif.onclick = () => {
      window.focus();
      if (options.url) {
        window.location.hash = options.url;
      }
      notif.close();
    };
    return notif;
  } catch (err) {
    console.error("[NotificationService] Erreur création notification:", err);
    return null;
  }
}
