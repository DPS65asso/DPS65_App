
import React, { useEffect, Suspense, lazy, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { GlobalAlerts } from './components/GlobalAlerts';
import { ExpiryNotifier } from './components/ExpiryNotifier'; 
import { DiplomaExpiryNotifier } from './components/DiplomaExpiryNotifier'; 
import { FleetNotificationSystem } from './components/FleetNotificationSystem'; 
import { MissionReminder } from './components/MissionReminder';
import { UpdatePrompt } from './components/UpdatePrompt';
import { TrackingGuard } from './components/TrackingGuard'; // NOUVEAU
import { OfflineMapPrompt } from './components/OfflineMapPrompt'; // NOUVEAU
import { VitalsExpiryNotifier } from './components/VitalsExpiryNotifier'; // NOUVEAU: surveillance ré-bilan constantes
import { storageService } from './services/storageService';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NewContentProvider } from './context/NewContentContext';

// Lazy Loading Wrapper de sécurité pour recharger l'app en cas d'erreur de chunk (ex: Vercel redeploy)
function safeLazy<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((error) => {
      console.error("Erreur de chargement du module dynamique:", error);
      const isChunkError = 
        error.message && (
          error.message.includes("Failed to fetch dynamically imported module") ||
          error.message.includes("Error dynamically importing") ||
          error.message.includes("dynamically imported module")
        );
      
      if (isChunkError || error.name === "TypeError") {
        console.warn("Échec de chargement d'un module dynamique (nouvelle version probable). Rechargement...");
        window.location.reload();
      }
      throw error;
    })
  );
}

const LoginPage = safeLazy(() => import('./pages/LoginPage').then(module => ({ default: module.LoginPage })));
const SignupPage = safeLazy(() => import('./pages/SignupPage').then(module => ({ default: module.SignupPage })));
const AdminPage = safeLazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage })));
const CreateEventPage = safeLazy(() => import('./pages/CreateEventPage').then(module => ({ default: module.CreateEventPage })));
const EventListPage = safeLazy(() => import('./pages/EventListPage').then(module => ({ default: module.EventListPage })));
const EventDashboardPage = safeLazy(() => import('./pages/EventDashboardPage').then(module => ({ default: module.EventDashboardPage })));
const AddVictimPage = safeLazy(() => import('./pages/AddVictimPage').then(module => ({ default: module.AddVictimPage })));
const ToolsPage = safeLazy(() => import('./pages/ToolsPage').then(module => ({ default: module.ToolsPage })));
const ScanPage = safeLazy(() => import('./pages/ScanPage').then(module => ({ default: module.ScanPage })));
const TacticalDashboardPage = safeLazy(() => import('./pages/TacticalDashboardPage').then(module => ({ default: module.TacticalDashboardPage })));
const FullscreenMapPage = safeLazy(() => import('./pages/FullscreenMapPage').then(module => ({ default: module.FullscreenMapPage })));
const TvDebugPage = safeLazy(() => import('./pages/TvDebugPage').then(module => ({ default: module.TvDebugPage })));
const DiagnosticsPage = safeLazy(() => import('./pages/DiagnosticsPage').then(module => ({ default: module.DiagnosticsPage })));
const AiPage = safeLazy(() => import('./pages/AiPage').then(module => ({ default: module.AiPage })));
const ManagementDashboardPage = safeLazy(() => import('./pages/ManagementDashboardPage').then(module => ({ default: module.ManagementDashboardPage })));
const PlanningPage = safeLazy(() => import('./pages/management/PlanningPage').then(module => ({ default: module.PlanningPage })));
const LogisticsPage = safeLazy(() => import('./pages/management/LogisticsPage').then(module => ({ default: module.LogisticsPage })));
const BagManagementPage = safeLazy(() => import('./pages/management/BagManagementPage').then(module => ({ default: module.BagManagementPage }))); 
const HrPage = safeLazy(() => import('./pages/management/HrPage').then(module => ({ default: module.HrPage })));
const DashboardPage = safeLazy(() => import('./pages/management/DashboardPage').then(module => ({ default: module.DashboardPage })));
const ProfilePage = safeLazy(() => import('./pages/management/ProfilePage').then(module => ({ default: module.ProfilePage })));
const AssoLifePage = safeLazy(() => import('./pages/management/AssoLifePage').then(module => ({ default: module.AssoLifePage })));
const UniformPage = safeLazy(() => import('./pages/management/UniformPage').then(module => ({ default: module.UniformPage })));
const OrganizerDashboardPage = safeLazy(() => import('./pages/OrganizerDashboardPage').then(module => ({ default: module.OrganizerDashboardPage })));

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
  </div>
);

const AppRoutes: React.FC = () => {
    useEffect(() => {
        storageService.purgeOldData().catch(console.error);
    }, []);

    return (
        <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
              <Route path="/ai" element={<ProtectedRoute><AiPage /></ProtectedRoute>} />
              <Route path="/tools" element={<ProtectedRoute><ToolsPage /></ProtectedRoute>} />
              <Route path="/scan" element={<ProtectedRoute><ScanPage /></ProtectedRoute>} />
              <Route path="/create-event" element={<ProtectedRoute><CreateEventPage /></ProtectedRoute>} />
              <Route path="/events" element={<ProtectedRoute><EventListPage /></ProtectedRoute>} />
              <Route path="/events/:id" element={<ProtectedRoute><EventDashboardPage /></ProtectedRoute>} />
              <Route path="/events/:id/add" element={<ProtectedRoute><AddVictimPage /></ProtectedRoute>} />
              <Route path="/events/:id/edit/:victimId" element={<ProtectedRoute><AddVictimPage /></ProtectedRoute>} />
              <Route path="/tactical" element={<ProtectedRoute><TacticalDashboardPage /></ProtectedRoute>} />
              <Route path="/organizer-dashboard" element={<ProtectedRoute><OrganizerDashboardPage /></ProtectedRoute>} />
              <Route path="/map/:id" element={<FullscreenMapPage />} />
              <Route path="/tv-debug/:id" element={<TvDebugPage />} />
              <Route path="/admin/diagnostics" element={<ProtectedRoute><DiagnosticsPage /></ProtectedRoute>} />
              <Route path="/management" element={<ProtectedRoute><ManagementDashboardPage /></ProtectedRoute>} />
              <Route path="/management/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/management/planning" element={<ProtectedRoute><PlanningPage /></ProtectedRoute>} />
              <Route path="/management/logistics" element={<ProtectedRoute><LogisticsPage /></ProtectedRoute>} />
              <Route path="/management/bags" element={<ProtectedRoute><BagManagementPage /></ProtectedRoute>} />
              <Route path="/management/hr" element={<ProtectedRoute><HrPage /></ProtectedRoute>} />
              <Route path="/management/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/management/life" element={<ProtectedRoute><AssoLifePage /></ProtectedRoute>} />
              <Route path="/management/uniforms" element={<ProtectedRoute><UniformPage /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
              <HashRouter>
                  <GlobalAlerts />
                  <TrackingGuard /> {/* Protection GPS */}
                  <ExpiryNotifier />
                  <DiplomaExpiryNotifier />
                  <FleetNotificationSystem />
                  <MissionReminder />
                  <UpdatePrompt />
                  <OfflineMapPrompt /> {/* Proposer téléchargement carte hors-ligne des Hautes-Pyrénées */}
                  <VitalsExpiryNotifier /> {/* Surveillance automatique du renouvellement des constantes vitales */}
                  <NewContentProvider>
                      <AppRoutes />
                  </NewContentProvider>
              </HashRouter>
          </AuthProvider>
        </ThemeProvider>
    </ErrorBoundary>
  );
};
export default App;
