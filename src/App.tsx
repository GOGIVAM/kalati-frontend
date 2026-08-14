import { useEffect, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/Guards';
import { LoginPage } from '@/pages/LoginPage';
import { ChatPage } from '@/pages/ChatPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { DocumentsPage } from '@/pages/DocumentsPage';
import { DocumentDetailPage } from '@/pages/DocumentDetailPage';
import { MetricsPage } from '@/pages/MetricsPage';
import { AuditPage } from '@/pages/AuditPage';
import { AdminPage } from '@/pages/AdminPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { useAuthStore } from '@/store/authStore';

const guard = (element: ReactNode) => <ProtectedRoute>{element}</ProtectedRoute>;

export default function App() {
  const restore = useAuthStore((s) => s.restore);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status === 'idle') void restore();
  }, [restore, status]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={guard(<ChatPage />)} />
      <Route path="/c/:conversationId" element={guard(<ChatPage />)} />
      <Route path="/historique" element={guard(<HistoryPage />)} />
      <Route path="/documents" element={guard(<DocumentsPage />)} />
      <Route path="/documents/:documentId" element={guard(<DocumentDetailPage />)} />
      <Route path="/indicateurs" element={guard(<MetricsPage />)} />
      <Route path="/audit" element={guard(<AuditPage />)} />
      <Route path="/administration" element={guard(<AdminPage />)} />
      <Route path="/parametres" element={guard(<SettingsPage />)} />
      <Route path="*" element={guard(<NotFoundPage />)} />
    </Routes>
  );
}
