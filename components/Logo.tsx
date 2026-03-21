
import React, { useState } from 'react';
import { Shield } from 'lucide-react';

interface LogoProps {
  className?: string;
  variant?: 'simple' | 'full';
}

export const Logo: React.FC<LogoProps> = ({ className = "w-12 h-12", variant = 'simple' }) => {
  const [imgError, setImgError] = useState(false);

  // Fallback si logo.png introuvable (plus de croix jaune, mais un bouclier neutre)
  if (imgError) {
      return (
        <div className={`flex flex-col items-center justify-center text-slate-400 ${className}`}>
          <Shield className="w-full h-full" />
          {variant === 'full' && <span className="font-bold text-sm mt-1">DPS 65</span>}
        </div>
      );
  }

  return (
    <img 
        src="/logo.png" 
        alt="Logo DPS65" 
        className={`${className} object-contain`}
        onError={() => setImgError(true)}
    />
  );
};
