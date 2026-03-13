import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LogOut,
  Moon,
  Sun,
  ChevronDown,
  Settings,
  LayoutDashboard
} from 'lucide-react';

export const Navbar = () => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { user, logout, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-white dark:bg-surface-900 border-b border-slate-200 dark:border-surface-800 sticky top-0 z-50 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-[#069494] via-[#047c7c] to-[#035f5f] rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <span className="text-white text-base font-bold">L</span>
            </div>
            <span className="text-xl font-black bg-gradient-to-r from-[#047c7c] to-[#069494] bg-clip-text text-transparent dark:from-[#069494] dark:to-[#0bc5c5]">
              LearnHub
            </span>
          </Link>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-surface-800 text-slate-600 dark:text-surface-400 hover:bg-slate-200 dark:hover:bg-surface-700 transition-all active:scale-95"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Profile Dropdown */}
            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-200 ${isUserMenuOpen
                    ? 'bg-slate-100 dark:bg-surface-800'
                    : 'hover:bg-slate-50 dark:hover:bg-surface-800/50'
                    }`}
                >
                  <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center shadow-sm">
                    <span className="text-white text-sm font-bold">
                      {user.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-bold text-slate-800 dark:text-surface-100 leading-none mb-1">
                      {user.name}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-surface-500 uppercase tracking-wider">
                      Student
                    </p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-surface-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-surface-700 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-surface-700 mb-2">
                      <p className="text-xs font-bold text-slate-400 dark:text-surface-500 uppercase tracking-widest mb-1">Signed in as</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-surface-100 truncate">{user.email}</p>
                    </div>

                    <button
                      onClick={() => { navigate('/dashboard'); setIsUserMenuOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-surface-300 hover:bg-slate-50 dark:hover:bg-surface-700/50 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-3 transition-colors"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </button>

                    <button
                      onClick={() => { navigate('/setup'); setIsUserMenuOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-surface-300 hover:bg-slate-50 dark:hover:bg-surface-700/50 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-3 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Preferences
                    </button>

                    <div className="h-px bg-slate-100 dark:bg-surface-700 my-2"></div>

                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

