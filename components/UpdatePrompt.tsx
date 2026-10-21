import React, { useEffect } from 'react';
import { versionService } from '../services/versionService';

/**
 * Composant de mise à jour transparente et silencieuse.
 * Ne présente aucune modale intrusive et ne déconnecte pas l'utilisateur.
 * Maintient l'application alignée en permanence sur le dernier déploiement Vercel.
 */
export const UpdatePrompt: React.FC = () => {
  useEffect(() => {
    versionService.initSilentAutoUpdate();
  }, []);

  return null;
};
