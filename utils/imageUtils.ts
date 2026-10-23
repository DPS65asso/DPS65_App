/**
 * Utilitaires de compression et de traitement d'images
 * Conçu pour optimiser les photos de véhicules et documents légers
 * sans dépendance externe, assurant un stockage local et synchronisé Supabase ultra-rapide.
 */

export const compressImageFile = (
    file: File, 
    maxWidth: number = 1200, 
    maxHeight: number = 900, 
    quality: number = 0.8
): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            return reject(new Error("Le fichier sélectionné n'est pas une image valide."));
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;

                // Calcul du redimensionnement proportionnel
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return resolve(e.target?.result as string);
                }

                // Amélioration du lissage de l'image
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = () => reject(new Error("Impossible de charger l'image."));
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error("Erreur de lecture du fichier."));
        reader.readAsDataURL(file);
    });
};
