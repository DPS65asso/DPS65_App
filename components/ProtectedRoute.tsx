
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<Props> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
    );
  }

  if (!user) {
      return <Navigate to="/login" replace />;
  }

  // Si c'est un organisateur, il n'a accès qu'à son tableau de bord spécifique
  if (user.role === 'organisateur' && location.pathname !== '/organizer-dashboard') {
      return <Navigate to="/organizer-dashboard" replace />;
  }

  return <>{children}</>;
};
