
// Ce service utilise l'API WebAuthn standard pour déclencher l'authentification native (FaceID/TouchID/Android)
// Nous n'utilisons pas de serveur FIDO2 complet ici, nous utilisons la création d'identifiants
// comme preuve de présence et de validation biométrique locale ("User Verifying Platform Authenticator").

export const biometricService = {
  // Vérifie si le matériel est compatible (FaceID, TouchID, Windows Hello...)
  isAvailable: async (): Promise<boolean> => {
    try {
      if (!window.PublicKeyCredential) return false;
      
      // Check Permission Policy (Nouvelle norme)
      if ('permissionsPolicy' in document) {
          const pp = (document as any).permissionsPolicy;
          if (pp && pp.allowsFeature && !pp.allowsFeature('publickey-credentials-create')) {
              return false;
          }
      }
      
      // Check Feature Policy (Ancienne norme)
      if ('featurePolicy' in document) {
          const fp = (document as any).featurePolicy;
          if (fp && fp.allowsFeature && !fp.allowsFeature('publickey-credentials-create')) {
              return false;
          }
      }

      // Vérification basique de disponibilité matérielle
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return available;
    } catch (e) {
      console.warn("Biometric check failed", e);
      return false;
    }
  },

  // Vérifie si la biométrie est activée dans les réglages locaux de l'utilisateur
  isEnabled: (): boolean => {
    return localStorage.getItem('dps65_bio_enabled') === 'true';
  },

  // Marque la biométrie comme configurée (acceptée ou refusée) pour ne plus redemander
  setChoiceMade: () => {
    localStorage.setItem('dps65_bio_choice_done', 'true');
  },

  hasMadeChoice: (): boolean => {
    return localStorage.getItem('dps65_bio_choice_done') === 'true';
  },

  disable: () => {
    localStorage.removeItem('dps65_bio_enabled');
    localStorage.removeItem('dps65_bio_choice_done');
  },

  // Déclenche la demande native de l'OS (FaceID/TouchID)
  authenticate: async (reason: string = "Authentification requise"): Promise<boolean> => {
    // Check Policy first to avoid browser error console spam
    if ('permissionsPolicy' in document) {
         const pp = (document as any).permissionsPolicy;
         if (pp && pp.allowsFeature && !pp.allowsFeature('publickey-credentials-create')) return false;
    }

    try {
      // Challenge aléatoire requis par le protocole
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userId = 'user_' + Date.now();
      // Use TextEncoder instead of Buffer for browser compatibility
      const userIdBuffer = new TextEncoder().encode(userId);

      // On demande la création d'une clé publique.
      // Cela force l'OS à demander une authentification biométrique (ou code PIN appareil)
      // pour accéder à l'enclave sécurisée.
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: {
            name: "DPS 65 - Sécurité Civile",
            id: window.location.hostname // Doit correspondre au domaine actuel (localhost ou domaine réel)
          },
          user: {
            id: userIdBuffer,
            name: "membre@dps65",
            displayName: "Membre DPS65"
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          timeout: 60000,
          authenticatorSelection: {
            authenticatorAttachment: "platform", // Force l'auth interne (pas de clé USB Yubikey)
            userVerification: "required" // Force la biométrie/code
          },
          attestation: "none"
        }
      });

      // Si on arrive ici, c'est que l'utilisateur a réussi son FaceID/TouchID
      return !!credential;

    } catch (e) {
      // On loggue en warn pour ne pas polluer en cas d'annulation utilisateur ou restriction
      console.warn("Biometric auth failed or cancelled or restricted", e);
      return false;
    }
  },

  // Active la fonctionnalité après un succès
  enable: () => {
    localStorage.setItem('dps65_bio_enabled', 'true');
    localStorage.setItem('dps65_bio_choice_done', 'true');
  }
};
