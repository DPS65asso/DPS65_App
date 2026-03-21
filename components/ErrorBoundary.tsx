
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Erreur Critique</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Une erreur inattendue est survenue. Vos données locales sont sécurisées.
            </p>
            
            {this.state.error && (
                <div className="bg-slate-100 dark:bg-slate-950 p-3 rounded-lg text-xs font-mono text-left mb-6 text-red-600 dark:text-red-400 overflow-x-auto border border-slate-200 dark:border-slate-800">
                    {this.state.error.toString()}
                </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={this.handleHome}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                    <Home className="w-4 h-4" /> Accueil
                </button>
                <button 
                    onClick={this.handleReload}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                >
                    <RefreshCw className="w-4 h-4" /> Recharger
                </button>
            </div>
          </div>
        </div>
      );
    }

    // Fix: Accessed children via type assertion to address the error where 'props' was reported missing on type 'ErrorBoundary'
    return (this as any).props.children;
  }
}
