import { Navigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';

/**
 * AuthGuard: Redirects unauthenticated users to /login
 */
export function AuthGuard({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/retail/login" replace />;
  }

  return children;
}

/**
 * PublicOnlyGuard: Redirects authenticated users away from public pages
 */
export function PublicOnlyGuard({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/retail/dashboard" replace />;
  }

  return children;
}

