
import React from 'react';
import { Button } from './Button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      icon={<AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
      maxWidth="max-w-sm"
      closeOnBackdrop={!isLoading}
      showCloseButton={!isLoading}
      footer={
        <>
          <Button 
            variant="outline" 
            onClick={onCancel} 
            disabled={isLoading} 
            className="rounded-xl border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs py-2 px-3.5"
          >
            Annuler
          </Button>
          <Button 
            variant="danger" 
            onClick={onConfirm} 
            disabled={isLoading}
            className="rounded-xl text-xs py-2 px-4 font-bold shadow-md shadow-red-600/20"
          >
            {isLoading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Traitement...
              </span>
            ) : (
              'Confirmer'
            )}
          </Button>
        </>
      }
    >
      <p className="text-slate-700 dark:text-slate-300 text-xs sm:text-sm leading-relaxed font-medium">
        {message}
      </p>
    </Modal>
  );
};

