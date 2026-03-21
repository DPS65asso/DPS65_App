
import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { authService } from '../services/authService';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: { id: string; role: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  currentTeam: string | null;
  setSessionTeam: (team: string | null) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [currentTeam, setCurrentTeam] = useState<string | null>(() => {
      return sessionStorage.getItem('dps65_current_team');
  });

  const setSessionTeam = useCallback((team: string | null) => {
      setCurrentTeam(team);
      if (team) sessionStorage.setItem('dps65_current_team', team);
      else sessionStorage.removeItem('dps65_current_team');
  }, []);

  const checkAuth = useCallback(async () => {
      setLoading(true);
      try {
          const data = await authService.getSession();
          setProfile(data.profile);
      } catch (e) {
          console.error("Profile Load Error", e);
          setProfile(null);
      } finally {
          setLoading(false);
      }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const signOut = useCallback(async () => {
      await authService.logout();
      setProfile(null);
      setSessionTeam(null);
  }, [setSessionTeam]);

  const refreshProfile = useCallback(async () => {
      const data = await authService.getSession();
      setProfile(data.profile);
  }, []);

  const value = useMemo(() => ({
      user: profile ? { id: profile.id, role: profile.role } : null,
      profile, 
      loading, 
      isAdmin: profile?.role === 'admin',
      currentTeam, 
      setSessionTeam, 
      signOut, 
      refreshProfile, 
      checkAuth
  }), [profile, loading, currentTeam, setSessionTeam, signOut, refreshProfile, checkAuth]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
