
// Worker dédié à la compression d'images pour ne pas bloquer l'UI
self.onmessage = async (e: MessageEvent) => {
  const { file, id, maxWidth = 1024, quality = 0.7 } = e.data;

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

    // 4. Conversion en Blob WebP (léger et performant)
    const blob = await canvas.convertToBlob({
      type: 'image/webp',
      quality: quality
    });

    // 5. Renvoi du résultat
    self.postMessage({ id, blob, success: true });

    // Nettoyage
    bitmap.close();

  } catch (error: any) {
    console.error("Worker Compression Error", error);
    self.postMessage({ id, error: error.message, success: false });
  }
};
