import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  headerGradient?: string;
  className?: string;
  bodyClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  children,
  footer,
  maxWidth = 'max-w-md',
  closeOnBackdrop = true,
  showCloseButton = true,
  headerGradient = 'from-blue-900 via-indigo-950 to-blue-900',
  className = '',
  bodyClassName = '',
}) => {
  useEffect(() => {
    if (!isOpen) return;

    // Bloquer le défilement de l'arrière-plan pour éviter les artefacts de scroll mobile
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
      }}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-2xl w-full ${maxWidth} shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[min(88dvh,calc(100dvh-2rem))] animate-in zoom-in-95 duration-200 my-auto ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Toujours visible en haut */}
        {(title || showCloseButton) && (
          <div
            className={`p-3.5 bg-gradient-to-r ${headerGradient} text-white flex items-center justify-between border-b border-blue-800/80 flex-shrink-0`}
          >
            <div className="flex items-center gap-2 font-bold text-sm min-w-0 pr-2">
              {icon && <span className="shrink-0">{icon}</span>}
              {title && <span className="truncate">{title}</span>}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-slate-300 hover:text-white rounded-lg transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-white/40"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Corps - Défilable verticalement lorsque nécessaire */}
        <div
          className={`p-4 overflow-y-auto space-y-4 flex-1 overscroll-contain text-slate-800 dark:text-slate-100 ${bodyClassName}`}
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>

        {/* Footer - Toujours visible et fixé au bas de la modale */}
        {footer && (
          <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/95 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5 sm:gap-3 flex-shrink-0 sticky bottom-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
