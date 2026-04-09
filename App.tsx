
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
import { storageService } from './services/storageService';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy Loading
const LoginPage = lazy(() => import('./pages/LoginPage').then(module => ({ default: module.LoginPage })));
const SignupPage = lazy(() => import('./pages/SignupPage').then(module => ({ default: module.SignupPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage })));
const CreateEventPage = lazy(() => import('./pages/CreateEventPage').then(module => ({ default: module.CreateEventPage })));
const EventListPage = lazy(() => import('./pages/EventListPage').then(module => ({ default: module.EventListPage })));
const EventDashboardPage = lazy(() => import('./pages/EventDashboardPage').then(module => ({ default: module.EventDashboardPage })));
const AddVictimPage = lazy(() => import('./pages/AddVictimPage').then(module => ({ default: module.AddVictimPage })));
const ToolsPage = lazy(() => import('./pages/ToolsPage').then(module => ({ default: module.ToolsPage })));
const ScanPage = lazy(() => import('./pages/ScanPage').then(module => ({ default: module.ScanPage })));
const TacticalDashboardPage = lazy(() => import('./pages/TacticalDashboardPage').then(module => ({ default: module.TacticalDashboardPage })));
const FullscreenMapPage = lazy(() => import('./pages/FullscreenMapPage').then(module => ({ default: module.FullscreenMapPage })));
const TvDebugPage = lazy(() => import('./pages/TvDebugPage').then(module => ({ default: module.TvDebugPage })));
const DiagnosticsPage = lazy(() => import('./pages/DiagnosticsPage').then(module => ({ default: module.DiagnosticsPage })));
const AiPage = lazy(() => import('./pages/AiPage').then(module => ({ default: module.AiPage })));
const ManagementDashboardPage = lazy(() => import('./pages/ManagementDashboardPage').then(module => ({ default: module.ManagementDashboardPage })));
const PlanningPage = lazy(() => import('./pages/management/PlanningPage').then(module => ({ default: module.PlanningPage })));
const LogisticsPage = lazy(() => import('./pages/management/LogisticsPage').then(module => ({ default: module.LogisticsPage })));
const BagManagementPage = lazy(() => import('./pages/management/BagManagementPage').then(module => ({ default: module.BagManagementPage }))); 
const HrPage = lazy(() => import('./pages/management/HrPage').then(module => ({ default: module.HrPage })));
const DashboardPage = lazy(() => import('./pages/management/DashboardPage').then(module => ({ default: module.DashboardPage })));
const ProfilePage = lazy(() => import('./pages/management/ProfilePage').then(module => ({ default: module.ProfilePage })));
const AssoLifePage = lazy(() => import('./pages/management/AssoLifePage').then(module => ({ default: module.AssoLifePage })));
const UniformPage = lazy(() => import('./pages/management/UniformPage').then(module => ({ default: module.UniformPage })));

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
                  <AppRoutes />
              </HashRouter>
          </AuthProvider>
        </ThemeProvider>
    </ErrorBoundary>
  );
};
export default App;
