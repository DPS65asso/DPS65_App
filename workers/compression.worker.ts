
// Worker dédié à la compression d'images pour ne pas bloquer l'UI avec support Noir & Blanc (Grayscale)
self.onmessage = async (e: MessageEvent) => {
  const { file, id, maxWidth = 1024, quality = 0.7, grayscale = false } = e.data;

  try {
    // 1. Création d'un bitmap depuis le fichier (plus performant que Image())
    const bitmap = await createImageBitmap(file);

    // 2. Calcul des dimensions
    let width = bitmap.width;
    let height = bitmap.height;

    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    // 3. Utilisation de OffscreenCanvas (API Worker)
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error("Canvas context null");

    ctx.drawImage(bitmap, 0, 0, width, height);

    // Si conversion Noir & Blanc demandée (Option Réseau Dégradé)
    if (grayscale) {
      try {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Formule de luminance standard
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          data[i] = gray;     // R
          data[i + 1] = gray; // G
          data[i + 2] = gray; // B
        }
        ctx.putImageData(imgData, 0, 0);
      } catch (grayscaleErr) {
        console.warn("Could not apply pixel-level grayscale, falling back to filter", grayscaleErr);
        // Fallback filter
        ctx.filter = 'grayscale(100%)';
        ctx.drawImage(bitmap, 0, 0, width, height);
      }
    }

    // 4. Conversion en Blob WebP (léger et performant) avec fallback JPEG
    let blob: Blob | null = null;
    try {
      blob = await canvas.convertToBlob({
        type: 'image/webp',
        quality: quality
      });
    } catch (webpError) {
      // Fallback JPEG si webp n'est pas supporté dans OffscreenCanvas de certains anciens mobiles
      blob = await canvas.convertToBlob({
        type: 'image/jpeg',
        quality: quality
      });
    }

    // 5. Renvoi du résultat
    self.postMessage({ id, blob, success: true });

    // Nettoyage
    bitmap.close();

  } catch (error: any) {
    console.error("Worker Compression Error", error);
    self.postMessage({ id, error: error.message, success: false });
  }
};
