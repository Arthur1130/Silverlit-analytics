import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  // Restauration de session en cours — on évite un flash vers /login
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-night-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-surface-line dark:border-night-line border-t-silverlit-red animate-spin" />
          <p className="text-2xs text-ink-muted dark:text-night-muted">Chargement de la session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }
  return <>{children}</>;
}
