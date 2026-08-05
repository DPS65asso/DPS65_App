
import React, { useRef, useState, useEffect } from 'react';
import { Eraser, PenTool } from 'lucide-react';

interface SignaturePadProps {
  onSave: (data: string | undefined) => void;
  initialData?: string;
  height?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, initialData, height = '160px' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!initialData);

  // Initialisation et redessin si initialData change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (initialData && canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          // Nettoyer avant de dessiner pour éviter la duplication/superposition
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height); // Force fit to canvas
        };
        img.src = initialData;
      }
    }
  }, [initialData]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    // Empêcher le scroll sur mobile
    if (e.type === 'touchstart') {
       // e.preventDefault(); // Géré par style touch-action: none
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { offsetX, offsetY } = getCoordinates(e, canvas);

    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000'; 
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    // Bloquer le scroll lors du dessin
    if (e.type === 'touchmove') e.preventDefault();

    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { offsetX, offsetY } = getCoordinates(e, canvas);

    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
    
    if (!hasSignature) setHasSignature(true);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      save();
    }
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    // Calcul précis tenant compte du scale CSS éventuel
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      offsetX: (clientX - rect.left) * scaleX,
      offsetY: (clientY - rect.top) * scaleY
    };
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
      onSave(undefined);
    }
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      try {
          // Compression et redimensionnement pour stockage léger
          const tempCanvas = document.createElement('canvas');
          const maxWidth = 300;
          const scale = maxWidth / canvas.width;
          
          tempCanvas.width = maxWidth;
          tempCanvas.height = canvas.height * scale;
          
          const ctx = tempCanvas.getContext('2d');
          if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
              onSave(tempCanvas.toDataURL('image/png'));
          } else {
              onSave(canvas.toDataURL('image/png'));
          }
      } catch (e) {
          onSave(canvas.toDataURL('image/png'));
      }
    }
  };

  return (
    <div className="flex flex-col gap-2 select-none">
      <div className="border-2 border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden bg-white touch-none">
        <canvas
          ref={canvasRef}
          width={600}
          height={300}
          style={{ width: '100%', height, touchAction: 'none' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div className="flex justify-between items-center text-xs text-slate-500">
        <span className="flex items-center gap-1">
            <PenTool className="w-3 h-3" /> 
            {hasSignature ? "Signature enregistrée" : "Signez dans le cadre ci-dessus"}
        </span>
        <button 
            type="button" 
            onClick={clear}
            className="flex items-center gap-1 text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
        >
            <Eraser className="w-3 h-3" /> Effacer
        </button>
      </div>
    </div>
  );
};
