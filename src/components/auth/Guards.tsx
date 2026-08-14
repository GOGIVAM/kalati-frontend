import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { LoadingBlock, EmptyState } from '@/components/common/States';
import type { Role } from '@/types';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'idle' || status === 'restoring') return <LoadingBlock />;
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/**
 * Masque un écran hors rôle. Purement cosmétique : le contrôle d'accès
 * opposable est celui du backend .NET et du filtre RBAC Qdrant.
 */
export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const { t } = useTranslation();
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  if (!roles.includes(role)) {
    return (
      <div className="k-page">
        <EmptyState title={t('common.forbiddenTitle')} body={t('common.forbiddenBody')} />
      </div>
    );
  }
  return <>{children}</>;
}
