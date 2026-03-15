import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
  requireSetup?: boolean;
}

export const ProtectedRoute = ({ children, requireSetup = false }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const { user, isLoading, isProfileComplete } = useAuth();
  const [canRender, setCanRender] = useState(false);
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (!isLoading) {
      if (!user) {
        // Debounce redirect to prevent race conditions during auth check
        timeout = setTimeout(() => {
          if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
            navigate('/login');
          }
        }, 100);
      } else if (requireSetup && !isProfileComplete) {
        if (window.location.pathname !== '/setup') {
          navigate('/setup');
        }
      } else {
        setCanRender(true);
      }
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isLoading, user, isProfileComplete, navigate, requireSetup]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-surface-50 via-primary-50/20 to-secondary-50/20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-surface-600">Loading...</p>
        </div>
      </div>
    );
  }

  return canRender ? children : null;
};

export default ProtectedRoute;
