import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiUrl } from '../utils/api';
import { useI18n } from '../components/i18n/useI18n';
import { useAuth } from '../hooks/useAuth';

function LoginPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { refetch } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Refresh auth state and redirect
      await refetch();

      // If user has profile (unlikely for new user), go to dashboard, else setup
      if (data.user.isProfileComplete) {
        navigate('/dashboard');
      } else {
        navigate('/setup');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    console.log(apiUrl('/api/auth/google'))
    window.location.href = apiUrl('/api/auth/google');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-primary-50/20 to-secondary-50/20 flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Back button */}
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-900 hover:bg-primary-100/60 rounded-lg px-3 py-2 -ml-3 cursor-pointer transition-all duration-150 mb-10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            {t('auth.backToHome')}
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 mb-12">
            <div className="w-11 h-11 bg-gradient-to-br from-primary-500 via-primary-600 to-teal-700 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white text-lg font-bold">L</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary-700 to-secondary-600 bg-clip-text text-transparent">{t('app.name')}</span>
          </Link>

          {/* Header */}
          <h1 className="text-3xl font-black text-surface-900 mb-2">{t('auth.welcomeBack')}</h1>
          <p className="text-lg text-surface-600 font-medium mb-10">{t('auth.continueJourney')}</p>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Social Login */}
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="btn-3d btn-3d-surface w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white border-2 border-surface-200 rounded-2xl text-surface-700 font-bold hover:bg-surface-50"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="text-base">{t('auth.continueGoogle')}</span>
            </button>

            <button
              type="button"
              className="btn-3d btn-3d-surface w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white border-2 border-surface-200 rounded-2xl text-surface-700 font-bold hover:bg-surface-50"
            >
              <svg className="w-6 h-6" fill="#1877F2" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span className="text-base">{t('auth.continueFacebook')}</span>
            </button>
          </div>

          {/* Divider */}
          <div className="my-8 flex items-center">
            <div className="flex-1 border-t border-surface-300"></div>
            <span className="px-4 text-sm font-semibold text-surface-600">{t('auth.or')}</span>
            <div className="flex-1 border-t border-surface-300"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5 mb-8">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-surface-900 mb-2">
                {t('auth.email')}
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-5 py-4 bg-surface-50 border-2 border-surface-200 rounded-2xl text-surface-900 placeholder-surface-400 focus:outline-none focus:bg-white focus:border-primary-500 focus-visible:ring-4 focus-visible:ring-primary-500/20 font-bold hover:bg-surface-100 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-bold text-surface-900">
                  {t('auth.password')}
                </label>
                <a href="#" className="text-sm font-semibold text-primary-600 hover:text-primary-700 cursor-pointer transition-colors duration-150">
                  {t('auth.forgot')}
                </a>
              </div>
              <input
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-5 py-4 bg-surface-50 border-2 border-surface-200 rounded-2xl text-surface-900 placeholder-surface-400 focus:outline-none focus:bg-white focus:border-primary-500 focus-visible:ring-4 focus-visible:ring-primary-500/20 font-bold hover:bg-surface-100 transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-3d btn-3d-secondary w-full px-5 py-4 bg-secondary-500 border-2 border-secondary-600 text-white font-bold text-lg rounded-2xl hover:bg-secondary-400 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in…' : t('auth.signIn')}
            </button>
          </form>

          {/* Sign up link */}
          <p className="text-center text-base text-surface-700 font-medium">
            {t('auth.noAccount')}{' '}
            <Link to="/signup" className="font-bold text-primary-600 hover:text-primary-700 cursor-pointer transition-colors duration-150">
              {t('auth.createOne')}
            </Link>
          </p>

          {/* Terms */}
          <p className="mt-6 text-center text-xs text-surface-600 leading-relaxed font-medium">
            {t('auth.bySigningIn')}{' '}
            <a href="#" className="underline hover:text-surface-800 cursor-pointer transition-colors duration-150">{t('auth.terms')}</a>
            {' '}and{' '}
            <a href="#" className="underline hover:text-surface-800 cursor-pointer transition-colors duration-150">{t('auth.privacy')}</a>.
          </p>
        </div>
      </div>

      {/* Right Panel - Visual */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary-600 via-primary-500 to-teal-600 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
        <div className="relative max-w-md text-center z-10">
          <div className="w-24 h-24 bg-white/15 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-10 shadow-xl border border-white/20">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-3xl font-black text-white mb-4">
            Your journey continues
          </h2>
          <p className="text-primary-100 leading-relaxed text-lg font-medium">
            Pick up where you left off. Your progress is saved and waiting for you.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
