import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}
